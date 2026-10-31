import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2";
const headers={"Access-Control-Allow-Origin":"https://officialendstaff.github.io","Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,"0")).join("");
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{headers});
 if(req.method!=="POST")return respond({error:"method"},405);
 const origin=req.headers.get("origin");if(origin&&origin!=="https://officialendstaff.github.io")return respond({error:"origin"},403);
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)return respond({error:"configuration"},503);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 let body:any;try{body=await req.json()}catch{return respond({error:"invalid"},400)}
 if(!["list_sheets","update_sheet","link_sheet","unlink_sheet","decide_sheet","get_roster"].includes(body?.action))return respond({error:"action"},400);
 const token=body?.token;
 if(typeof token!=="string"||!/^[a-f0-9]{64}$/.test(token))return respond({error:"unauthorized"},401);
 const {data:session,error:sessionError}=await db.from("interview_access_sessions").select("expires_at").eq("token_digest",await digest(token)).maybeSingle();
 if(sessionError||!session||new Date(session.expires_at).getTime()<=Date.now())return respond({error:"unauthorized"},401);
 if(body.action==="get_roster"){
  const sheetId=body.sheet_id;
  if(typeof sheetId!=="string"||!/^[0-9a-f-]{36}$/i.test(sheetId))return respond({error:"invalid_sheet"},400);
  const {data:person,error:personError}=await db.from("interview_applicants")
   .select("id,name,kana,birth_date,phone,postal_code,prefecture,city,street,shop,hire_shop,status,stage_name,nationality,residence_status,residence_period,work_permission")
   .eq("id",sheetId).maybeSingle();
  if(personError)return respond({error:"read_failed"},503);
  if(!person)return respond({error:"not_found"},404);
  if(!["採用","在籍","入店"].includes(person.status))return respond({error:"not_hired"},403);
  return respond({ok:true,roster:person});
 }
 if(body.action==="unlink_sheet"){const interviewId=Number(body.interview_id);if(!Number.isSafeInteger(interviewId)||interviewId<=0)return respond({error:"invalid_interview"},400);const {data:interview}=await db.from("staff_interviews").select("id,status").eq("id",interviewId).maybeSingle();if(!interview||!["来店済み","採用","不採用","辞退","在籍","入店"].includes(interview.status))return respond({error:"not_completed"},409);const {data:link}=await db.from("staff_interview_form_links").select("interview_id,interview_applicant_id").eq("interview_id",interviewId).maybeSingle();if(!link)return respond({error:"not_linked"},409);const {error}=await db.from("staff_interview_form_links").delete().eq("interview_id",interviewId).eq("interview_applicant_id",link.interview_applicant_id);if(error)return respond({error:"unlink_failed"},503);return respond({ok:true,interview_id:interviewId})}
 if(body.action==="link_sheet"){const sheetId=body.sheet_id,interviewId=body.interview_id;if(typeof sheetId!=="string"||!Number.isSafeInteger(Number(interviewId)))return respond({error:"invalid_link"},400);const {data:existing}=await db.from("staff_interview_form_links").select("interview_id,interview_applicant_id").or("interview_id.eq."+Number(interviewId)+",interview_applicant_id.eq."+sheetId);if(existing?.length){if(existing.length===1&&String(existing[0].interview_id)===String(interviewId)&&existing[0].interview_applicant_id===sheetId)return respond({ok:true,interview_id:Number(interviewId)});return respond({error:"already_linked"},409)}const {data:interview}=await db.from("staff_interviews").select("id,status").eq("id",interviewId).maybeSingle();const {data:sheet}=await db.from("interview_applicants").select("id").eq("id",sheetId).maybeSingle();if(!interview||!sheet)return respond({error:"not_found"},404);if(!["来店済み","採用","不採用","辞退","在籍","入店"].includes(interview.status))return respond({error:"not_completed"},409);const {data:lineLink}=await db.from("staff_interview_line_links").select("interview_id").eq("interview_id",interviewId).maybeSingle();if(!lineLink)return respond({error:"line_link_required"},409);const {error}=await db.from("staff_interview_form_links").insert({interview_id:Number(interviewId),interview_applicant_id:sheetId});if(error)return respond({error:"link_failed"},409);return respond({ok:true,interview_id:Number(interviewId)})}
 if(body.action==="decide_sheet"){
  const sheetId=body.sheet_id,result=body.result;
  if(typeof sheetId!=="string"||!/^[0-9a-f-]{36}$/i.test(sheetId)||!["採用","不採用","辞退"].includes(result))return respond({error:"invalid_decision"},400);
  const sheetPatch:any={status:result};
  if(result==="不採用"){
   if(!Array.isArray(body.reasons)||body.reasons.length<1||body.reasons.length>30||body.reasons.some((r:unknown)=>typeof r!=="string"||!r.trim()||r.length>100))return respond({error:"reasons_required"},400);
   const reasons=[...new Set((body.reasons as string[]).map(r=>r.trim()))];
   sheetPatch.rejection_reason=JSON.stringify(reasons);
   sheetPatch.rejection_note=null;
  }else if(result==="辞退"){
   if(typeof body.note!=="string"||!body.note.trim()||body.note.length>2000)return respond({error:"withdrawal_note_required"},400);
   sheetPatch.rejection_reason=null;
   sheetPatch.rejection_note=body.note.trim();
  }else{
   const allowedShops=["Grand Luxe","LUXY OSAKA","薔薇と紳士","Un Secret","BUSTY OSAKA"];
   if(typeof body.shop!=="string"||!allowedShops.includes(body.shop))return respond({error:"invalid_hire_shop"},400);
   if(typeof body.stage_name!=="string"||!body.stage_name.trim()||body.stage_name.length>100)return respond({error:"invalid_stage_name"},400);
   if(body.hire_date!==undefined&&body.hire_date!==""&&(typeof body.hire_date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(body.hire_date)))return respond({error:"invalid_hire_date"},400);
   sheetPatch.hire_shop=body.shop;
   sheetPatch.stage_name=body.stage_name.trim();
   sheetPatch.hire_date=body.hire_date||null;
   sheetPatch.rejection_reason=null;
   sheetPatch.rejection_note=null;
  }
  const {data:link,error:linkError}=await db.from("staff_interview_form_links").select("interview_id").eq("interview_applicant_id",sheetId).maybeSingle();
  if(linkError)return respond({error:"link_read_failed"},503);
  if(!link)return respond({error:"link_required"},409);
  const {data:updated,error:interviewError}=await db.from("staff_interviews").update({status:result,updated_at:new Date().toISOString()}).eq("id",link.interview_id).select("id,status").maybeSingle();
  if(interviewError||!updated)return respond({error:"decision_failed"},503);
  const {data:savedSheet,error:sheetError}=await db.from("interview_applicants").update(sheetPatch).eq("id",sheetId).select("id,status,rejection_reason,rejection_note,hire_shop,stage_name,hire_date").maybeSingle();
  if(sheetError||!savedSheet)return respond({error:"sheet_update_failed"},503);
  return respond({ok:true,interview_id:updated.id,status:updated.status,sheet:savedSheet});
 }
 if(body.action==="update_sheet"){const sheetId=body.sheet_id;const patch=body.patch;if((typeof sheetId!=="string"&&typeof sheetId!=="number")||!patch||typeof patch!=="object"||Array.isArray(patch))return respond({error:"invalid_payload"},400);const allowed=["name","kana","birth_date","phone","recruit_source","id_type","smoking","tattoo","tattoo_detail","stage_name","hire_shop"];const update:any={};for(const field of allowed){if(Object.prototype.hasOwnProperty.call(patch,field)){if(typeof patch[field]!=="string"||patch[field].length>2000)return respond({error:"invalid_field",field},400);update[field]=patch[field]||null}}if(Object.prototype.hasOwnProperty.call(update,"hire_shop")&&!["Grand Luxe","LUXY OSAKA","Un Secret","薔薇と紳士","BUSTY OSAKA"].includes(update.hire_shop))return respond({error:"invalid_hire_shop"},400);if(Object.prototype.hasOwnProperty.call(update,"stage_name")&&String(update.stage_name||"").length>100)return respond({error:"stage_name_too_long"},400);if(!Object.keys(update).length)return respond({error:"empty_update"},400);const {data:updated,error:updateError}=await db.from("interview_applicants").update(update).eq("id",sheetId).select("id,name,kana,birth_date,phone,recruit_source,id_type,smoking,tattoo,tattoo_detail,stage_name,hire_shop").maybeSingle();if(updateError)return respond({error:"update_failed"},503);if(!updated)return respond({error:"not_found"},404);return respond({ok:true,sheet:updated})}
 const {data,error}=await db.from("interview_applicants").select("id,name,kana,birth_date,phone,recruit_source,id_type,smoking,tattoo,tattoo_detail,experience,work_history,status,remarks,submitted_at,shop,stage_name,hire_shop,rejection_reason,rejection_note,hire_date").order("submitted_at",{ascending:false}).limit(200);
 if(error)return respond({error:"read_failed"},503);
 const {data:links}=await db.from("staff_interview_form_links").select("interview_id,interview_applicant_id");return respond({ok:true,sheets:data||[],links:links||[]});
});