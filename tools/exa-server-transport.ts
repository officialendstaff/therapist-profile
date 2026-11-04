// EXA HTTP session transport. Never logs or returns passwords/session cookies.
// Production use requires verified server-side login and EXA permission to automate.
const ORIGIN="https://rose-gentleman.com";
const HOME=ORIGIN+"/exa/";
const LOGIN=ORIGIN+"/exa/login.php";
const DAILY="/exa/member/schedule/schedule_daily.php";
export type ExaResponse={url:string;status:number;html:string};
export class ExaTransport {
 private jar=new Map<string,string>();
 private remember(headers:Headers){
   const list=typeof headers.getSetCookie==="function"?headers.getSetCookie():[headers.get("set-cookie")||""];
   for(const entry of list){
     const match=entry.match(/^\s*([^;=,\s]+)=([^;]*)/);
     if(!match)continue;
     if(/^(?:path|expires|max-age|secure|httponly|samesite)$/i.test(match[1]))continue;
     this.jar.set(match[1],match[2]);
   }
 }
 private cookieHeader(){return Array.from(this.jar).map(([k,v])=>k+"="+v).join("; ");}
 private async request(url:string,options:RequestInit={},limit=4):Promise<Response>{
   let target=new URL(url,ORIGIN);
   for(let n=0;n<=limit;n++){
     if(target.origin!==ORIGIN||target.protocol!=="https:")throw Error("Cross-origin redirect refused");
     const controller=new AbortController();
     const timer=setTimeout(()=>controller.abort(),12000);
     let response:Response;
     try{
       response=await fetch(target.href,{...options,redirect:"manual",signal:controller.signal,
         headers:{...(options.headers||{}),"Cookie":this.cookieHeader(),"Accept":"text/html"}});
     }finally{clearTimeout(timer)}
     this.remember(response.headers);
     if(response.status>=300&&response.status<400){
       const location=response.headers.get("location");
       if(!location)throw Error("Redirect without location");
       target=new URL(location,target);
       // Browsers switch POST -> GET after 302 / 303.
       if(response.status===303||((response.status===301||response.status===302)&&options.method==="POST")){
         options={method:"GET"};
       }
       continue;
     }
     return response;
   }
   throw Error("Too many redirects");
 }
 async login(id:string,password:string):Promise<void>{
   if(!id||!password)throw Error("Missing EXA credentials");
   await this.request(HOME);
   const body=new URLSearchParams({id,password,button:"ログイン"});
   const r=await this.request(LOGIN,{method:"POST",body,
     headers:{"Content-Type":"application/x-www-form-urlencoded","Origin":ORIGIN,"Referer":HOME}});
   if(!r.ok)throw Error("EXA authentication returned HTTP "+r.status);
   // A subsequent restricted-page fetch must prove auth; an HTTP 200 login page does not.
   const check=await this.request(ORIGIN+DAILY);
   if(!check.ok||new URL(check.url).pathname!==DAILY)throw Error("EXA session not authenticated");
   const html=await check.text();
   if(!html.includes("[status]")||!html.includes("の出勤"))throw Error("EXA daily screen unavailable");
 }
 async fetchDay(url:string):Promise<ExaResponse>{
   const target=new URL(url,ORIGIN);
   if(target.origin!==ORIGIN||target.pathname!==DAILY)throw Error("Unexpected day URL");
   const response=await this.request(target.href);
   const final=new URL(response.url);
   if(final.origin!==ORIGIN||final.pathname!==DAILY)throw Error("EXA session expired or redirected");
   if(response.status!==200)throw Error("EXA schedule HTTP "+response.status);
   const html=await response.text();
   if(html.length>2_000_000)throw Error("EXA page exceeds maximum size");
   return {url:response.url,status:response.status,html};
 }
}
