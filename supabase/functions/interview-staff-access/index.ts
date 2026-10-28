import {createClient} from "npm:@supabase/supabase-js@2";
const headers={"Access-Control-Allow-Origin":"https://officialendstaff.github.io","Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
async function digest(s:string){return hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))))}
async function verify(password:string,salt:string,expected:string){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:Uint8Array.from(salt.match(/../g)!.map(x=>parseInt(x,16))),iterations:200000,hash:"SHA-256"},key,256);const actual=hex(new Uint8Array(bits));let diff=0;for(let i=0;i<actual.length;i++)diff|=actual.charCodeAt(i)^expected.charCodeAt(i);return diff===0}
Deno.serve(async req=>{if(req.method==="OPTIONS")return new Response(null,{headers});if(req.method!=="POST")return response({error:"method"},405);
const origin=req.headers.get("origin");if(origin&&origin!=="https://officialendstaff.github.io")return response({error:"origin"},403);
const url=Deno.env.get("SUPABASE_URL"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!url||!service)return response({error:"configuration"},503);
const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
let body:any;try{body=await req.json()}catch{return response({error:"invalid"},400)}
const action=body?.action;
if(action==="login"){
const password=body?.password;if(typeof password!=="string"||password.length>128)return response({error:"invalid"},400);
const ip=req.headers.get("cf-connecting-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]||"unknown";
const clientDigest=await digest(ip);const {data:attempt}=await db.from("interview_access_attempts").select("failures,window_start").eq("client_digest",clientDigest).maybeSingle();
const recent=attempt&&Date.now()-new Date(attempt.window_start).getTime()<15*60*1000;
if(recent&&attempt.failures>=5)return response({error:"too_many_attempts"},429);
const {data:config,error:configError}=await db.from("interview_access_config").select("verifier,salt").eq("id",1).single();
if(configError||!config)return response({error:"configuration"},503);
if(!await verify(password,config.salt,config.verifier)){await db.from("interview_access_attempts").upsert({client_digest:clientDigest,failures:recent?attempt.failures+1:1,window_start:recent?attempt.window_start:new Date().toISOString()});return response({error:"incorrect_password"},401)}
await db.from("interview_access_attempts").delete().eq("client_digest",clientDigest);
const token=hex(crypto.getRandomValues(new Uint8Array(32))),tokenDigest=await digest(token),expires=new Date(Date.now()+8*60*60*1000).toISOString();
const {error}=await db.from("interview_access_sessions").insert({token_digest:tokenDigest,expires_at:expires});if(error)return response({error:"session"},503);
return response({token,expires_at:expires})}
const token=body?.token;if(typeof token!=="string"||!/^[0-9a-f]{64}$/.test(token))return response({error:"unauthorized"},401);
const {data:session}=await db.from("interview_access_sessions").select("expires_at").eq("token_digest",await digest(token)).maybeSingle();
if(!session||new Date(session.expires_at).getTime()<=Date.now())return response({error:"unauthorized"},401);
if(action==="verify")return response({ok:true});
if(action==="create_linked_interview"){const account=String(body.account_id||""),lineId=String(body.line_user_id||""),name=String(body.line_display_name||"").slice(0,100),shop=String(body.shop||""),interviewDate=String(body.interview_date||""),interviewTime=String(body.interview_time||""),assignee=String(body.interviewer_user_id||"");const shops:Record<string,string>={rose:"薔薇と紳士",grandluxe:"Grand Luxe",luxy:"LUXY",unsecret:"Un Secret",us:"Un Secret"};if(shops[account]!==shop||!/^U[a-f0-9]{32}$/i.test(lineId)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(interviewDate)||!/^([01][0-9]|2[0-4]):[0-5][0-9]$/.test(interviewTime)||! /^[a-f0-9-]{36}$/i.test(assignee))return response({error:"invalid_booking"},400);const {data:event}=await db.from("recruit_line_events").select("id").eq("account_id",account).eq("line_user_id",lineId).limit(1).maybeSingle();if(!event)return response({error:"line_applicant_not_found"},404);const {data:created,error:createError}=await db.from("staff_interviews").insert({shop,interview_date:interviewDate,interview_time:interviewTime,status:"面接予定",interviewer_user_id:assignee,confirmed:false,alert:false}).select("id").single();if(createError||!created)return response({error:"booking_failed",detail:createError?.message},409);const {error:linkError}=await db.from("staff_interview_line_links").insert({interview_id:created.id,account_id:account,line_user_id:lineId,line_display_name:name});if(linkError){await db.from("staff_interview_line_links").delete().eq("interview_id",created.id);const {error:rollbackError}=await db.from("staff_interviews").delete().eq("id",created.id);return response({error:rollbackError?"rollback_failed":"link_failed",interview_id:rollbackError?created.id:undefined},409)}return response({ok:true,interview_id:created.id})}
if(action==="reschedule_linked_interview"){
 const id=Number(body.interview_id),mode=String(body.mode||""),account=String(body.account_id||""),lineId=String(body.line_user_id||"");
 if(!Number.isSafeInteger(id)||id<1||!["未定","変更","修正"].includes(mode)||!/^U[a-f0-9]{32}$/i.test(lineId))return response({error:"invalid_reschedule"},400);
 const {data:link}=await db.from("staff_interview_line_links").select("interview_id").eq("interview_id",id).eq("account_id",account).eq("line_user_id",lineId).maybeSingle();if(!link)return response({error:"not_linked"},404);
 const {data:old}=await db.from("staff_interviews").select("id,shop,status,interview_date,interview_time,interviewer_user_id").eq("id",id).maybeSingle();if(!old||["採用","不採用","辞退","キャンセル","無断トビ"].includes(old.status))return response({error:"not_editable"},409);
 const nextDate=String(body.interview_date||""),nextTime=String(body.interview_time||""),nextStaff=String(body.interviewer_user_id||"");
 if(mode!=="未定"&&(!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)||!/^\d{2}:\d{2}$/.test(nextTime)||!/^[-a-f0-9]{36}$/i.test(nextStaff)))return response({error:"invalid_datetime"},400);
 if(mode==="未定"&&old.status==="日程未定")return response({ok:true,interview_id:id});
 // Moving to pending does not create a history event or increment reschedule counts.
 if(mode==="修正"){const {data:corrected,error:ce}=await db.rpc("apply_interview_correction",{p_id:id,p_old_status:old.status,p_date:nextDate,p_time:nextTime,p_staff:nextStaff});if(ce||!corrected)return response({error:"correction_failed",detail:ce?.message},409);return response({ok:true,interview_id:id});}
 const update=mode==="未定"?{status:"日程未定",updated_at:new Date().toISOString()}:{status:"面接予定",interview_date:nextDate,interview_time:nextTime,interviewer_user_id:nextStaff,updated_at:new Date().toISOString()};
 const {data:updated,error:ue}=await db.from("staff_interviews").update(update).eq("id",id).eq("status",old.status).select("id").maybeSingle();if(ue||!updated)return response({error:"update_failed",detail:ue?.message},409);
 return response({ok:true,interview_id:id});
}
if(action==="cancel_linked_interview"){
 const id=Number(body.interview_id),account=String(body.account_id||""),lineId=String(body.line_user_id||"");
 if(!Number.isSafeInteger(id)||id<=0||!["rose","grandluxe","luxy","unsecret","us"].includes(account)||!/^U[a-f0-9]{32}$/i.test(lineId))return response({error:"invalid_cancel"},400);
 const {data:link}=await db.from("staff_interview_line_links").select("interview_id").eq("interview_id",id).eq("account_id",account).eq("line_user_id",lineId).maybeSingle();
 if(!link)return response({error:"not_linked"},404);
 const {data:current}=await db.from("staff_interviews").select("id,status,interview_date,interview_time,interviewer_user_id,shop").eq("id",id).maybeSingle();
 if(!current)return response({error:"not_found"},404);
 if(["キャンセル","無断トビ","トビ（キャンセル）"].includes(current.status))return response({error:"already_closed"},409);
 if(["採用","不採用","辞退","在籍"].includes(current.status))return response({error:"result_finalized"},409);
 const {error:historyError}=await db.from("staff_interview_history").insert({interview_id:id,event_type:"キャンセル",original_date:current.interview_date,original_time:current.interview_time,original_interviewer_user_id:current.interviewer_user_id,original_shop:current.shop});
 if(historyError)return response({error:"history_failed"},409);
 const {error:updateError}=await db.from("staff_interviews").update({status:"キャンセル",updated_at:new Date().toISOString()}).eq("id",id).eq("status",current.status);
 if(updateError)return response({error:"cancel_failed"},409);
 return response({ok:true,interview_id:id});
}
if(action==="link_interview"){const id=Number(body.interview_id),account=String(body.account_id||""),lineId=String(body.line_user_id||""),name=String(body.line_display_name||"").slice(0,100);const shops:Record<string,string>={rose:"薔薇と紳士",grandluxe:"Grand Luxe",luxy:"LUXY"};if(!Number.isSafeInteger(id)||id<=0||!shops[account]||!/^U[a-f0-9]{32}$/i.test(lineId))return response({error:"invalid_link"},400);const {data:event}=await db.from("recruit_line_events").select("id").eq("account_id",account).eq("line_user_id",lineId).limit(1).maybeSingle();if(!event)return response({error:"line_applicant_not_found"},404);const {data:interview}=await db.from("staff_interviews").select("id,shop").eq("id",id).maybeSingle();if(!interview||interview.shop!==shops[account])return response({error:"interview_shop_mismatch"},400);const {data:existing}=await db.from("staff_interview_line_links").select("interview_id").eq("interview_id",id).maybeSingle();if(existing)return response({error:"already_linked"},409);const {error}=await db.from("staff_interview_line_links").insert({interview_id:id,account_id:account,line_user_id:lineId,line_display_name:name});if(error)return response({error:"link_failed"},409);return response({ok:true,interview_id:id})}

if(action==="afterlife_list"){
 const {data,error}=await db.from("staff_line_afterlife").select("account_id,line_user_id,display_name,picture_url,reasons,registered_at").order("registered_at",{ascending:false}).limit(1000);
 if(error)return response({error:"afterlife_list_failed"},503);
 return response({items:data||[]});
}
if(action==="afterlife_save"){
 const account=String(body.account_id||""),user=String(body.line_user_id||"");
 const allowedAccounts=["rose","grandluxe","luxy","unsecret","us"];
 const allowedReasons=["報酬条件NG","年齢条件NG","デブ・ガリNG","勤務場所NG","業種業態NG","コミュ障害NG","過去履歴NG","業者FUCK"];
 const reasons=Array.isArray(body.reasons)?[...new Set(body.reasons)]:[];
 if(!allowedAccounts.includes(account)||!/^U[a-f0-9]{32}$/i.test(user)||reasons.length<1||reasons.length>8||reasons.some(x=>!allowedReasons.includes(x)))return response({error:"invalid_afterlife"},400);
 const name=String(body.display_name||"").slice(0,100),pic=typeof body.picture_url==="string"&&body.picture_url.startsWith("https://")?body.picture_url.slice(0,1024):null;
 const {error}=await db.from("staff_line_afterlife").upsert({account_id:account,line_user_id:user,display_name:name,picture_url:pic,reasons,registered_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:"account_id,line_user_id"});
 if(error)return response({error:"afterlife_save_failed"},503);
 return response({ok:true});
}
if(action==="afterlife_remove"){
 const account=String(body.account_id||""),user=String(body.line_user_id||"");
 if(!["rose","grandluxe","luxy","unsecret","us"].includes(account)||!/^U[a-f0-9]{32}$/i.test(user))return response({error:"invalid_afterlife"},400);
 const {error}=await db.from("staff_line_afterlife").delete().eq("account_id",account).eq("line_user_id",user);
 if(error)return response({error:"afterlife_remove_failed"},503);
 return response({ok:true});
}
if(action==="set_interview_confirmation"){
 const id=Number(body.interview_id),kind=String(body.kind||"");if(!Number.isSafeInteger(id)||id<1||!["sent","ok"].includes(kind))return response({error:"invalid_confirmation"},400);
 const {data:existing,error:readError}=await db.from("staff_interviews").select("id,status,confirmed,confirmation_line_sent").eq("id",id).maybeSingle();if(readError||!existing)return response({error:"interview_not_found"},404);
 if(["採用","不採用","辞退","キャンセル","無断トビ"].includes(existing.status))return response({error:"not_editable"},409);
 const patch=kind==="sent"?{confirmation_line_sent:true}:{confirmed:true};const {data:updated,error:updateError}=await db.from("staff_interviews").update(patch).eq("id",id).select("id,confirmed,confirmation_line_sent").single();if(updateError)return response({error:"confirmation_save_failed",detail:updateError.message},409);return response({ok:true,interview:updated});
}
if(action==="interview_lists"){
 const [ir,lr,hr,fr,sr]=await Promise.all([
 db.from("staff_interviews").select("id,shop,interview_date,interview_time,status,interviewer_user_id,updated_at,confirmed,confirmation_line_sent").order("interview_date",{ascending:false}).limit(1000),
 db.from("staff_interview_line_links").select("interview_id,account_id,line_user_id,line_display_name,line_picture_url"),
 db.from("staff_interview_history").select("interview_id,event_type,original_date,original_time,recorded_at").order("recorded_at",{ascending:false}).limit(1000),
 db.from("staff_interview_form_links").select("interview_id,interview_applicant_id"),
 db.from("interview_staff_assignments").select("user_id,display_name")]);
 if(ir.error||lr.error||hr.error||fr.error||sr.error)return response({error:"list_read_failed"},503);
 const ids=[...new Set((fr.data||[]).map((v:any)=>v.interview_applicant_id))];
 const {data:forms,error:fe}=ids.length?await db.from("interview_applicants").select("id,name,status").in("id",ids):{data:[],error:null};
 if(fe)return response({error:"form_read_failed"},503);
 return response({interviews:ir.data||[],links:lr.data||[],history:hr.data||[],formLinks:fr.data||[],forms:forms||[],staff:sr.data||[]});
}
if(action==="inbox"){
const {data:events,error}=await db.from("recruit_line_events").select("id,account_id,line_user_id,event_type,received_at,message_type,message_text").in("account_id",["rose","grandluxe","luxy"]).eq("event_type","message").order("id",{ascending:false}).limit(100);
if(error)return response({error:"read_failed"},503);
const {data:links}=await db.from("staff_interview_line_links").select("account_id,line_user_id,line_display_name,line_picture_url,interview_id").in("account_id",["rose","grandluxe","luxy"]);
const profileCandidates=[...(links||[]),...(events||[])];const ids=[...new Set(profileCandidates.map((e:any)=>e.line_user_id).filter((id:unknown)=>typeof id==="string"&&/^U[a-f0-9]{32}$/i.test(id)))].slice(0,120);
const profiles:Record<string,{displayName:string,pictureUrl:string|null}>={};
const lineTokens:Record<string,string|undefined>={rose:Deno.env.get("LINE_ROSE_CHANNEL_ACCESS_TOKEN"),grandluxe:Deno.env.get("LINE_GRANDLUXE_CHANNEL_ACCESS_TOKEN"),luxy:Deno.env.get("LINE_LUXY_CHANNEL_ACCESS_TOKEN")};
await Promise.all([...new Map(profileCandidates.filter((e:any)=>ids.includes(e.line_user_id)).map((e:any)=>[e.account_id+":"+e.line_user_id,e])).values()].slice(0,30).map(async(e:any)=>{const id=e.line_user_id;const lineToken=lineTokens[e.account_id];if(!lineToken)return;try{const res=await fetch("https://api.line.me/v2/bot/profile/"+encodeURIComponent(id),{headers:{Authorization:"Bearer "+lineToken}});if(res.ok){const profile=await res.json();if(typeof profile.displayName==="string")profiles[e.account_id+":"+id]={displayName:profile.displayName,pictureUrl:typeof profile.pictureUrl==="string"?profile.pictureUrl:null}}}catch(e){console.warn("Profile lookup failed",e)}}));
const interviewIds=[...new Set((links||[]).map((l:any)=>Number(l.interview_id)).filter((id:number)=>Number.isSafeInteger(id)&&id>0))];
let interviews:any[]=[],history:any[]=[],staff:any[]=[];
if(interviewIds.length){
 const [ir,hr]=await Promise.all([
  db.from("staff_interviews").select("id,shop,interview_date,interview_time,status,interviewer_user_id,updated_at").in("id",interviewIds),
  db.from("staff_interview_history").select("interview_id,event_type,original_date,original_time,recorded_at").in("interview_id",interviewIds).order("recorded_at",{ascending:false})
 ]);
 if(ir.error)return response({error:"interview_context_failed"},503);
 interviews=ir.data||[];history=hr.error?[]:(hr.data||[]);
 if(hr.error)console.warn("Interview history unavailable; inbox remains available",hr.error.code);
}
const {data:formLinks}=await db.from("staff_interview_form_links").select("interview_id,interview_applicant_id").in("interview_id",interviewIds.length?interviewIds:[-1]);
const formIds=[...new Set((formLinks||[]).map((x:any)=>x.interview_applicant_id))];
const {data:forms}=formIds.length?await db.from("interview_applicants").select("id,status").in("id",formIds):{data:[]};
const formStatus=(formLinks||[]).map((l:any)=>({interview_id:l.interview_id,status:(forms||[]).find((f:any)=>f.id===l.interview_applicant_id)?.status||""}));
const staffResult=await db.from("interview_staff_assignments").select("user_id,display_name");
if(staffResult.error)console.warn("Staff labels unavailable; inbox remains available",staffResult.error.code);
staff=staffResult.error?[]:(staffResult.data||[]);
return response({events:events||[],links:links||[],profiles,interviews,history,staff,formStatus})}
return response({error:"invalid_action"},400)
});