// EXA server-only sync runner. Must not be activated until server login is verified.
// Requires a private scheduler bearer token AND a database permission gate.
// Secrets and session cookies are never returned or logged.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.10";
import { ExaTransport } from "./exa-server-transport.ts";
import { readThirtyDays } from "./exa-snapshot-fetch.ts";

const SB_URL=Deno.env.get("SUPABASE_URL")||"";
const SB_SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
// Cron calls carry a Vault-backed token, validated by its SHA-256 in a service-role-only RPC.
const EXA_ID=Deno.env.get("EXA_LOGIN_ID")||"";
const EXA_PASSWORD=Deno.env.get("EXA_LOGIN_PASSWORD")||"";
const admin=createClient(SB_URL,SB_SERVICE,{auth:{persistSession:false}});
const json=(obj:unknown,status=200)=>new Response(JSON.stringify(obj),{status,headers:{
  "Content-Type":"application/json","Cache-Control":"no-store"
}});
const todayInTokyo=()=>new Intl.DateTimeFormat("sv-SE",{
  timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"
}).format(new Date());
const minutes=(value:string)=>{
  if(!/^\d{4}$/.test(value))throw Error("Invalid EXA time");
  const hour=Number(value.slice(0,2)),minute=Number(value.slice(2));
  if(hour>29||minute>59)throw Error("Invalid EXA time");
  return hour*60+minute;
};
Deno.serve(async (req:Request)=>{
  if(req.method!=="POST")return json({error:"method_not_allowed"},405);
  const authorization=req.headers.get("Authorization")||"";
  // Empty secrets never permit a request; browsers never receive a usable credential.
  const bearer=authorization.startsWith("Bearer ")?authorization.slice(7):"";
  if(!bearer||bearer.length>256)return json({error:"unauthorized"},401);
  const {data:valid,error:authError}=await admin.rpc("exa_server_sync_auth_valid",{
    p_store:"rose",p_token:bearer
  });
  if(authError||valid!==true)return json({error:"unauthorized"},401);
  const {data:allowed,error:gateError}=await admin.rpc("exa_server_sync_is_permitted",{p_store:"rose"});
  if(gateError||allowed!==true)return json({status:"disabled"},200);
  if(!EXA_ID||!EXA_PASSWORD)return json({error:"credentials_not_configured"},503);
  try {
    const transport=new ExaTransport();
    await transport.login(EXA_ID,EXA_PASSWORD);
    const data=await readThirtyDays(
      "https://rose-gentleman.com/exa/member/schedule/schedule_daily.php",
      url=>transport.fetchDay(url)
    );
    if(data.first!==todayInTokyo())throw Error("EXA first day does not match Japan date");
    const rows=data.rows.map(x=>({
      exa_id:x.id,stage_name:x.name,work_date:x.date,
      start_minutes:minutes(x.start),end_minutes:minutes(x.finish)
    }));
    const days=Array.from({length:30},(_,i)=>{
      const base=new Date(data.first+"T00:00:00Z");
      base.setUTCDate(base.getUTCDate()+i);
      return base.toISOString().slice(0,10);
    });
    // Protect against accidentally empty or grossly incomplete snapshots.
    const {count,error:countError}=await admin.from("exa_shift_entries")
      .select("exa_id",{count:"exact",head:true})
      .eq("store_code","rose").gte("work_date",data.first).lte("work_date",data.last);
    if(countError)throw Error("Could not validate existing shift count");
    if((count||0)>=20 && rows.length<(count||0)*0.7)throw Error("Snapshot too small to replace existing shifts");
    const {data:result,error:saveError}=await admin.rpc("exa_shift_apply_snapshot",{
      p_store:"rose",p_dates:days,p_rows:rows
    });
    if(saveError)throw Error("Atomic snapshot failed");
    return json({ok:true,imported:result.imported,removed:result.removed,days:result.days});
  } catch(e) {
    // Redact runtime exception detail to avoid echoing upstream responses containing tokens.
    console.error("EXA scheduled synchronization failed",e instanceof Error?e.name:"failure");
    return json({error:"server_sync_failed"},502);
  }
});
