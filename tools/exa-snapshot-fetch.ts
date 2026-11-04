// Read-only 30-day EXA traversal; caller supplies an authorized page fetcher.
// No credentials, cookies or secrets are stored or returned by this module.
import { parseExaDay,validateExaSnapshot } from "./exa-schedule-parser.ts";
const ORIGIN="https://rose-gentleman.com";
const DAILY="/exa/member/schedule/schedule_daily.php";
export async function readThirtyDays(
  initialUrl:string,
  fetchHtml:(url:string)=>Promise<{url:string;status:number;html:string}>
){
 const validate=(value:string)=>{
  const u=new URL(value);
  if(u.origin!==ORIGIN||u.pathname!==DAILY)throw Error("Unexpected EXA URL");
  return u.href;
 };
 let current=validate(initialUrl);
 const results=[];
 for(let i=0;i<30;i++){
  const page=await fetchHtml(current);
  if(page.status!==200)throw Error("EXA day "+(i+1)+" returned HTTP "+page.status);
  const finalUrl=validate(page.url);
  const day=parseExaDay(page.html,finalUrl);
  results.push(day);
  if(i<29){
   if(!day.nextUrl)throw Error("EXA next day unavailable");
   current=validate(day.nextUrl);
  }
 }
 return validateExaSnapshot(results);
}
