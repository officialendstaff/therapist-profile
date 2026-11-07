(function(){
"use strict";
const API="https://vjjnkflbfsjihwzjsjpr.supabase.co/functions/v1/interview-line-push-register";
const STORAGE="mattan-recruit-auth";
const SW="./line-push-sw.js";
const ROOT="./";
const $=id=>document.getElementById(id);
const supported=()=>"serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window&&window.isSecureContext;
const pushBtn=$("linePushButton");
if(!pushBtn)return;
const modal=document.createElement("section");
modal.id="linePushModal";
modal.hidden=true;
modal.setAttribute("role","dialog");
modal.setAttribute("aria-modal","true");
modal.setAttribute("aria-labelledby","linePushTitle");
modal.innerHTML='<div class="line-push-dialog"><div class="line-push-dialog-head"><strong id="linePushTitle">LINE新着｜プッシュ通知設定</strong><button id="linePushClose" type="button" aria-label="閉じる">×</button></div><p>面接管理を閉じていても、LINEの新着をWindows・Chromeの通知でお知らせします。</p><p id="linePushMessage" role="status" aria-live="polite">確認中</p><div class="line-push-controls"><button id="linePushRegister" type="button">この端末で通知を有効化</button><button id="linePushTest" type="button" disabled>通知テスト</button></div><p class="line-push-note">通知をクリックすると、面接管理の「LINE通知」が開きます。iPhoneの場合は、面接管理をホーム画面に追加してからご利用ください。</p></div>';
document.body.append(modal);
const status=$("linePushMessage"),register=$("linePushRegister"),test=$("linePushTest");
let subscription=null,busy=false;
function message(s){status.textContent=s}
function setState(registered){
 register.textContent=registered?"この端末の通知を解除":"この端末で通知を有効化";
 register.dataset.registered=registered?"true":"false";
 test.disabled=!registered;
 pushBtn.dataset.enabled=registered?"true":"false";
 pushBtn.textContent=registered?"LINEプッシュ ON":"LINEプッシュ通知";
}
function jwt(){
 try{
  const raw=localStorage.getItem(STORAGE)||sessionStorage.getItem(STORAGE);
  const value=raw?JSON.parse(raw):null;
  return typeof value?.access_token==="string"?value.access_token:"";
 }catch{return ""}
}
async function call(action,extra={}){
 const bearer=jwt();
 if(!bearer)throw new Error("面接管理の管理者ログインが必要です。");
 const ctrl=new AbortController();
 const timer=setTimeout(()=>ctrl.abort(),12000);
 try{
  const res=await fetch(API,{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json","Authorization":"Bearer "+bearer},body:JSON.stringify({action,...extra}),signal:ctrl.signal});
  const data=await res.json();
  if(!res.ok||data.ok!==true)throw new Error(data.error==="unauthorized"?"管理者ログインを更新してください。":data.error||"接続エラー");
  return data;
 }finally{clearTimeout(timer)}
}
function keyBytes(key){
 const v=atob(key.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(key.length/4)*4,"="));
 return Uint8Array.from(v,c=>c.charCodeAt(0));
}
async function findSub(){
 const reg=await navigator.serviceWorker.getRegistration(ROOT);
 if(!reg)return null;
 return reg.pushManager.getSubscription();
}
async function refreshState(){
 if(!supported()){setState(false);message("Web Pushに未対応です。ChromeやEdgeなどの対応ブラウザをご利用ください。");return}
 if(Notification.permission==="denied"){setState(false);message("通知が拒否されています。ブラウザの通知設定を確認してください。");return}
 subscription=await findSub();
 if(subscription&&Notification.permission==="granted"){setState(true);message("通知を登録済みです。ページを閉じても新着LINEを受信できます。")}
 else{setState(false);message("この端末は未登録です。通知を有効化してください。")}
}
function show(){
 modal.hidden=false;
 void refreshState().catch(e=>message("状態の確認に失敗："+String(e.message||e)));
}
function hide(){modal.hidden=true}
pushBtn.addEventListener("click",show);
$("linePushClose").addEventListener("click",hide);
modal.addEventListener("click",e=>{if(e.target===modal)hide()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!modal.hidden)hide()});
register.addEventListener("click",async()=>{
 if(busy)return;
 if(!window.interviewAdminAuthorized){message("面接管理の管理者アカウントでログインしてください。");return}
 if(!supported()){message("このブラウザではプッシュ通知を利用できません。");return}
 busy=true;register.disabled=true;
 try{
  // Permission must be requested as the first asynchronous operation under a user gesture.
  const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();
  if(permission!=="granted"){message(permission==="denied"?"通知が拒否されています。ブラウザ設定を確認してください。":"通知を許可してください。");return}
  const current=await findSub();
  if(current){
   await call("unsubscribe",{endpoint:current.endpoint});
   await current.unsubscribe();
   subscription=null;setState(false);message("この端末の通知登録を解除しました。");return;
  }
  message("通知を登録しています…");
  const [cfg,reg]=await Promise.all([call("config"),navigator.serviceWorker.register(SW,{scope:ROOT})]);
  let sub=await reg.pushManager.getSubscription();
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(cfg.public_key)});
  await call("subscribe",{subscription:sub.toJSON()});
  subscription=sub;setState(true);message("登録完了。通知テストを押してください。");
 }catch(e){message("通知登録に失敗："+String(e.message||e))}
 finally{busy=false;register.disabled=false}
});
test.addEventListener("click",async()=>{
 if(busy||!subscription)return;
 busy=true;test.disabled=true;message("通知テストを送信しています…");
 try{
  await call("test",{endpoint:subscription.endpoint});
  message("配信サーバーが受付けました。Windowsの通知を確認してください。");
 }catch(e){message("テスト失敗："+String(e.message||e))}
 finally{busy=false;test.disabled=!subscription}
});
function openLineFromPush(){
 const params=new URLSearchParams(location.search);
 if(params.get("linePush")!=="1")return;
 let attempts=0;
 function activate(){
  if(!(window.interviewAdminAuthorized||window.interviewStaffAuthorized))return false;
  const button=document.querySelector('#nav button[data-page="LINE通知"]');
  if(!button||button.hidden)return false;
  button.click();
  const uri=new URL(location.href);uri.searchParams.delete("linePush");history.replaceState(null,"",uri.pathname+uri.search+uri.hash);
  return true;
 }
 if(activate())return;
 window.addEventListener("interview-auth-ready",activate);
 const timer=setInterval(()=>{attempts++;if(activate()||attempts>=30)clearInterval(timer)},1000);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",openLineFromPush,{once:true});else openLineFromPush();
if(supported()&&Notification.permission==="granted")void refreshState().catch(()=>{});
})();
