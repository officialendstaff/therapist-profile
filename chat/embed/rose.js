/* L GROUP | Rose & Gentleman embedded HP chat launcher */
(()=>{
"use strict";
if(window.__LG_ROSE_CHAT_WIDGET_RUNNING__)return;
const script=document.currentScript;
const allowedHosts=new Set(["rose-gentleman.com","www.rose-gentleman.com","officialendstaff.github.io"]);
if(!allowedHosts.has(location.hostname))return;
const preview=location.hostname==="officialendstaff.github.io"&&script?.dataset.preview==="1";
const base="https://officialendstaff.github.io/therapist-profile/chat/";
const chatOrigin=new URL(base).origin;
const guestStore="薔薇と紳士";
const tokenKey="lgroup_rose_booking_chat_token_v1";
const stateURL=base+"embed/rose-state.js";
let host=null,frame=null,root=null,open=false,sequence=0;
window.__LG_ROSE_CHAT_WIDGET_RUNNING__=true;
function token(){try{return localStorage.getItem(tokenKey)||""}catch{return ""}}
function setToken(value){
 if(typeof value!=="string"||!/^[a-f0-9]{64}$/.test(value))return;
 try{localStorage.setItem(tokenKey,value)}catch{}
}
function clearToken(){try{localStorage.removeItem(tokenKey)}catch{}}
window.addEventListener("message",event=>{
 if(!frame||event.origin!==chatOrigin||event.source!==frame.contentWindow)return;
 const data=event.data;
 if(!data||typeof data!=="object"||data.store!==guestStore)return;
 if(data.type==="lgroup.chat.getToken"){
  frame.contentWindow.postMessage({type:"lgroup.chat.token",store:guestStore,token:token()},chatOrigin);
 }else if(data.type==="lgroup.chat.saveToken"){
  setToken(data.token);
 }else if(data.type==="lgroup.chat.clearToken"){
  clearToken();
 }else if(data.type==="lgroup.chat.close"){
  closeChat();
 }
});
function closeChat(){
 if(!root)return;
 open=false;
 const panel=root.querySelector(".lg-chat-panel"),back=root.querySelector(".lg-chat-backdrop"),button=root.querySelector(".lg-chat-launcher");
 panel.hidden=true;back.hidden=true;button.setAttribute("aria-expanded","false");
 button.focus({preventScroll:true});
}
function showChat(){
 if(!root)return;
 const panel=root.querySelector(".lg-chat-panel"),back=root.querySelector(".lg-chat-backdrop"),button=root.querySelector(".lg-chat-launcher");
 open=true;panel.hidden=false;back.hidden=false;button.setAttribute("aria-expanded","true");
 if(!frame.getAttribute("src"))frame.setAttribute("src",base+"?store="+encodeURIComponent(guestStore)+"&embed=1");
 root.querySelector(".lg-chat-close").focus({preventScroll:true});
}
function removeWidget(){
 if(root&&open)closeChat();
 host?.remove();host=null;root=null;frame=null;open=false;
}
function createWidget(){
 if(host||!document.body)return;
 host=document.createElement("div");
 host.id="lgroup-rose-chat-mount";
 host.style.cssText="all:initial;position:relative;z-index:2147482000";
 document.body.append(host);
 root=host.attachShadow({mode:"open"});
 const style=document.createElement("style");
 style.textContent="\n:host{all:initial}\n*,*:before,*:after{box-sizing:border-box}\n[hidden]{display:none!important}\nbutton{font-family:-apple-system,BlinkMacSystemFont,\"Hiragino Kaku Gothic ProN\",\"Yu Gothic\",Meiryo,sans-serif;cursor:pointer}\n.lg-chat-launcher{position:fixed;right:20px;bottom:22px;z-index:2147482002;display:inline-flex;align-items:center;gap:10px;min-height:56px;padding:0 21px;border:1px solid #c19a75;border-radius:999px;background:linear-gradient(120deg,#332328,#5b333b);color:#fff;font-size:13px;font-weight:750;letter-spacing:.025em;box-shadow:0 8px 29px #281a2066}\n.lg-chat-launcher:hover{filter:brightness(1.1)}\n.lg-chat-launcher:focus-visible,.lg-chat-close:focus-visible{outline:3px solid #c59c70;outline-offset:2px}\n.lg-chat-icon{width:18px;height:18px;flex:none;display:inline-grid;place-items:center}\n.lg-chat-icon svg{width:18px;height:18px;fill:none;stroke:#fff;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}\n.lg-chat-panel{position:fixed;right:20px;bottom:91px;z-index:2147482003;display:flex;flex-direction:column;width:min(420px,calc(100vw - 28px));height:min(670px,calc(100dvh - 115px));background:#fff;border:1px solid #d5c5bd;border-radius:17px;overflow:hidden;box-shadow:0 17px 55px #130c1460}\n.lg-chat-head{height:52px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 13px 0 20px;background:#3b2930;color:#fff;font-size:14px;font-weight:800;letter-spacing:.05em}\n.lg-chat-close{width:36px;height:36px;display:grid;place-items:center;background:#ffffff20;border:1px solid #ffffff36;border-radius:50%;color:#fff;font-size:24px;line-height:1}\n.lg-chat-frame{display:block;width:100%;height:100%;flex:1;min-height:0;border:0;background:#fff}\n.lg-chat-backdrop{display:none}\n@media(max-width:640px){\n .lg-chat-launcher{right:12px;bottom:calc(12px + env(safe-area-inset-bottom));min-height:51px;padding:0 17px;font-size:12px}\n .lg-chat-backdrop:not([hidden]){display:block;position:fixed;inset:0;background:#1210168c;z-index:2147482002}\n .lg-chat-panel{position:fixed;left:0;right:0;top:0;bottom:0;width:100%;height:100dvh;height:100svh;border:0;border-radius:0}\n .lg-chat-head{height:54px;padding-left:18px}\n}";
 const backdrop=document.createElement("div");
 backdrop.className="lg-chat-backdrop";backdrop.hidden=true;
 const button=document.createElement("button");
 button.className="lg-chat-launcher";button.type="button";
 button.setAttribute("aria-label","薔薇と紳士へチャットでお問い合わせ");
 button.setAttribute("aria-expanded","false");
 const icon=document.createElement("span");icon.className="lg-chat-icon";
 icon.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.8 7.8 0 0 1-8 7.5 9.2 9.2 0 0 1-3.6-.7L4 20l1.2-4A7.2 7.2 0 0 1 4 11.5 7.8 7.8 0 0 1 12 4a7.8 7.8 0 0 1 8 7.5Z"/><path d="M8.5 11.5h7"/></svg>';
 button.append(icon,document.createTextNode("チャットでお問い合わせ"));
 const panel=document.createElement("section");
 panel.className="lg-chat-panel";panel.hidden=true;panel.id="lg-chat-panel";
 panel.setAttribute("role","dialog");panel.setAttribute("aria-label","薔薇と紳士 お問い合わせチャット");
 const header=document.createElement("header");header.className="lg-chat-head";
 const title=document.createElement("strong");title.textContent="薔薇と紳士｜お問い合わせ";
 const close=document.createElement("button");close.className="lg-chat-close";close.type="button";
 close.textContent="×";close.setAttribute("aria-label","チャットを閉じる");
 header.append(title,close);
 frame=document.createElement("iframe");
 frame.className="lg-chat-frame";frame.title="薔薇と紳士 チャット";
 frame.loading="eager";frame.referrerPolicy="strict-origin-when-cross-origin";
 frame.setAttribute("sandbox","allow-scripts allow-forms allow-same-origin");
 panel.append(header,frame);
 root.append(style,backdrop,button,panel);
 button.addEventListener("click",()=>open?closeChat():showChat());
 close.addEventListener("click",closeChat);
 backdrop.addEventListener("click",closeChat);
}
function applyState(state){
 if(preview||state?.enabled===true)createWidget();
 else removeWidget();
}
window.__LG_ROSE_EMBED_SET_STATE__=applyState;
function loadSwitch(){
 const tag=document.createElement("script");
 const current=++sequence;
 tag.async=true;tag.src=stateURL+"?t="+Date.now()+"-"+current;
 tag.onload=()=>tag.remove();
 tag.onerror=()=>tag.remove();
 (document.head||document.documentElement).append(tag);
}
window.addEventListener("keydown",e=>{if(e.key==="Escape"&&open)closeChat()});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",loadSwitch,{once:true});else loadSwitch();
setInterval(loadSwitch,45000);
})();
