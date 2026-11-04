// EXA daily schedule reader, extracted from the verified Chrome extension.
// Read-only module: no credentials, network requests, or database writes.
// The caller must obtain pages through an authenticated and authorized channel.
import { DOMParser } from "npm:linkedom@0.18.12";

export type ExaRow = { date:string; id:number; name:string; start:string; finish:string };
export type DayResult = { date:string; rows:ExaRow[]; nextUrl:string|null };
const EXA_ORIGIN="https://rose-gentleman.com";
const EXA_DAILY="/exa/member/schedule/schedule_daily.php";
export function parseExaDay(html:string,baseUrl:string):DayResult {
 const base=new URL(baseUrl);
 if(base.origin!==EXA_ORIGIN || base.pathname!==EXA_DAILY) throw Error("Unsupported EXA daily page");
 const doc=new DOMParser().parseFromString(html,"text/html");
 const text=doc.body?.textContent||"";
 // The EXA daily title has varied between Japanese and slash/hyphen date formats.
 // Parse the visible page text, not href attributes (which can contain the *next* day).
 const fallbackText=html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
  .replace(/<[^>]*>/g," ")
  .replace(/&nbsp;|&#160;/gi," ");
 const normalized=(text+" "+fallbackText)
  .replace(/\u00a0/g," ")
  .replace(/[０-９]/g,c=>String(c.charCodeAt(0)-0xFF10));
 const patterns=[
  /(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/,
  /(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})/,
 ];
 let m:RegExpMatchArray|null=null;
 for(const pattern of patterns){m=normalized.match(pattern);if(m)break;}
 if(!m)throw Error("Daily date missing");
 const date=m[1]+"-"+m[2].padStart(2,"0")+"-"+m[3].padStart(2,"0");
 const parsed=new Date(date+"T00:00:00Z");
 if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)throw Error("Daily date invalid");
 const dayRows:ExaRow[]=[];
 const ids=new Set<number>();
 const radios=doc.querySelectorAll('input[type="radio"][name$="[status]"]');
 if(!radios.length) throw Error("Daily status controls missing");
 for(const tr of doc.querySelectorAll("tr")){
   const statuses=Array.from(tr.querySelectorAll('input[type="radio"][name$="[status]"]'));
   if(!statuses.length)continue;
   const checked=statuses.filter(x=>x.hasAttribute("checked"));
   if(checked.length!==1)throw Error("Invalid number of selected statuses in "+date);
   const selected=checked[0];
   const idMatch=(selected.getAttribute("name")||"").match(/^(\d+)\[status\]$/);
   if(!idMatch)throw Error("Invalid therapist ID");
   const id=Number(idMatch[1]);
   if(ids.has(id))throw Error("Duplicate EXA ID");
   ids.add(id);
   if(selected.getAttribute("value")!=="1")continue;
   const name=(tr.querySelector("td")?.textContent||"").trim().replace(/\s+/g," ");
   const start=(tr.querySelector('input[name="'+id+'[start]"]')?.getAttribute("value")||"").trim();
   const finish=(tr.querySelector('input[name="'+id+'[finish]"]')?.getAttribute("value")||"").trim();
   const minutes=(t:string)=>{if(!/^\d{4}$/.test(t))return null;const h=+t.slice(0,2),n=+t.slice(2);return h<=29&&n<=59?h*60+n:null};
   const sm=minutes(start),fm=minutes(finish);
   if(!name||sm===null||fm===null||fm<=sm)throw Error("Invalid hours for "+id);
   dayRows.push({date,id,name,start,finish});
 }
 const button=Array.from(doc.querySelectorAll("button[onclick]")).find(x=>(x.textContent||"").includes("次の日"));
 const match=button?.getAttribute("onclick")?.match(/location\.href\s*=\s*(['"])(.*?)\1/);
 let nextUrl:string|null=null;
 if(match){const next=new URL(match[2].replaceAll("&amp;","&"),EXA_ORIGIN);if(next.origin===EXA_ORIGIN&&next.pathname===EXA_DAILY)nextUrl=next.href;}
 return {date,rows:dayRows,nextUrl};
}

export function validateExaSnapshot(days:DayResult[]):{rows:ExaRow[];first:string;last:string;days:number}{
 if(days.length!==30)throw Error("Exactly 30 days required");
 const seen=new Set<string>();
 for(let i=0;i<days.length;i++){
  const day=days[i];
  if(seen.has(day.date))throw Error("Duplicate day");
  seen.add(day.date);
  const expected=Date.parse(days[0].date+"T00:00:00Z")+i*86400000;
  if(new Date(expected).toISOString().slice(0,10)!==day.date)throw Error("Nonconsecutive days");
  if(i<29&&!day.nextUrl)throw Error("Missing next-day link");
 }
 const rows=days.flatMap(d=>d.rows);
 if(!rows.length||rows.length>3000)throw Error("Invalid snapshot row count");
 return {rows,first:days[0].date,last:days[29].date,days:30};
}
