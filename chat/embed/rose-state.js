/* 薔薇と紳士HP：表示ON＋既存読み込み済みウィジェットのアイコン補正 */
window.__LG_ROSE_EMBED_SET_STATE__?.({enabled:true,release:'rose-profile-icon-fix-20261118'});
(()=>{
 const host=document.getElementById("lgroup-rose-chat-mount");
 const root=host?.shadowRoot;
 const button=root?.querySelector(".lg-chat-profile");
 if(!button)return;
 button.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 21c0-4.5 3.6-7 8-7s8 2.5 8 7Z" fill="currentColor"/></svg>';
 button.style.setProperty("width","36px","important");
 button.style.setProperty("height","36px","important");
 button.style.setProperty("display","grid","important");
 button.style.setProperty("place-items","center","important");
 button.style.setProperty("padding","0","important");
 button.style.setProperty("border-radius","50%","important");
 button.style.setProperty("border","1px solid #ffffff66","important");
 button.style.setProperty("background","#ffffff18","important");
 button.style.setProperty("color","#ffffff","important");
 button.style.setProperty("cursor","pointer","important");
 const svg=button.querySelector("svg");
 if(svg){svg.style.setProperty("display","block","important");svg.style.setProperty("width","20px","important");svg.style.setProperty("height","20px","important");}
})();
