/* Shared "お知らせ" / release-notes dialog for the four personal dashboards.
   The Japanese copy is maintained in release-notes.json; no auth or app routes change. */
(function(){
 'use strict';
 const top=document.getElementById('personalMobileTop');
 const controls=top?.querySelector('.personal-mobile-header-tools');
 const bell=controls?.querySelector('.personal-mobile-settings');
 if(!top||!controls||!bell)return;

 const button=document.createElement('button');
 button.type='button';
 button.className='personal-mobile-settings personal-mobile-news-trigger';
 button.setAttribute('aria-label','お知らせ・最新の改修内容');
 button.setAttribute('title','お知らせ');
 button.setAttribute('aria-haspopup','dialog');
 button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10v4a2 2 0 0 0 2 2h3l2 4h3l-2.4-4H12l7 4V4l-7 4H5a2 2 0 0 0-2 2Z"/><path d="M21 9a4 4 0 0 1 0 6"/></svg>';
 controls.insertBefore(button,bell);

 const dialog=document.createElement('dialog');
 dialog.className='personal-mobile-news-dialog';
 dialog.setAttribute('aria-labelledby','personalNewsHeading');
 dialog.innerHTML='<div class="personal-news-shell">'+
 '<header class="personal-news-heading"><div><small>L GROUP MANAGEMENT</small><h2 id="personalNewsHeading">お知らせ・改修履歴</h2><p id="personalNewsUpdated" class="personal-news-updated"></p></div>'+
 '<button type="button" class="personal-news-close" aria-label="閉じる">×</button></header>'+
 '<div class="personal-news-scroll" tabindex="0"><p id="personalNewsStatus" class="personal-news-status" role="status">改修内容を読み込んでいます…</p>'+
 '<div id="personalNewsEntries" class="personal-news-entries"></div></div>'+
 '<footer class="personal-news-footer"><span>個人ページの更新内容</span><button type="button" class="personal-news-done">閉じる</button></footer>'+
 '</div>';
 top.appendChild(dialog);

 const updated=dialog.querySelector('#personalNewsUpdated');
 const status=dialog.querySelector('#personalNewsStatus');
 const entries=dialog.querySelector('#personalNewsEntries');
 const closeBtn=dialog.querySelector('.personal-news-close');
 const doneBtn=dialog.querySelector('.personal-news-done');
 let lastFocus=null;

 function close(){
  if(dialog.open&&typeof dialog.close==='function')dialog.close();
  else dialog.removeAttribute('open');
 }
 function formatDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return '';
  const [year,month,day]=String(value).split('-');
  return year+'年'+Number(month)+'月'+Number(day)+'日';
 }
 function render(data){
  entries.replaceChildren();
  const records=Array.isArray(data?.entries)?data.entries.slice(0,20):[];
  updated.textContent=data?.updatedAt?'最終更新：'+formatDate(data.updatedAt):'';
  if(!records.length){
   status.textContent='現在、掲載中の改修情報はありません。';
   status.hidden=false;
   return;
  }
  records.forEach((item,index)=>{
   const entry=document.createElement('article');
   entry.className='personal-news-entry';
   const meta=document.createElement('div');
   meta.className='personal-news-entry-meta';
   const date=document.createElement('time');
   date.textContent=formatDate(item.date);
   if(/^\d{4}-\d{2}-\d{2}$/.test(String(item.date||'')))date.dateTime=item.date;
   meta.appendChild(date);
   if(index===0){
    const latest=document.createElement('span');
    latest.className='personal-news-latest';
    latest.textContent='最新';
    meta.appendChild(latest);
   }
   const heading=document.createElement('h3');
   heading.textContent=String(item.title||'改修内容');
   entry.append(meta,heading);
   if(Array.isArray(item.details)&&item.details.length){
    const list=document.createElement('ul');
    item.details.slice(0,8).forEach(line=>{
     const li=document.createElement('li');
     li.textContent=String(line);
     list.append(li);
    });
    entry.append(list);
   }
   entries.append(entry);
  });
  status.hidden=true;
 }
 async function load(){
  status.hidden=false;
  status.textContent='改修内容を読み込んでいます…';
  try{
   const url='/therapist-profile/staff/interview-personal/mobile/release-notes.json?v=20261030a';
   const response=await fetch(url,{cache:'no-store',credentials:'same-origin'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=await response.json();
   if(!data||!Array.isArray(data.entries))throw Error('Invalid release notes');
   render(data);
  }catch(error){
   console.warn('お知らせの取得に失敗しました:',error);
   if(!entries.childElementCount){
    status.hidden=false;
    status.textContent='お知らせを取得できませんでした。通信状態を確認し、もう一度お試しください。';
   }else{
    status.hidden=false;
    status.textContent='最新情報を取得できませんでした。前回読み込んだ内容を表示しています。';
   }
  }
 }
 button.addEventListener('click',()=>{
  lastFocus=document.activeElement;
  if(typeof dialog.showModal==='function')dialog.showModal();
  else dialog.setAttribute('open','');
  void load();
 });
 closeBtn.addEventListener('click',close);
 doneBtn.addEventListener('click',close);
 dialog.addEventListener('click',event=>{
  if(event.target===dialog)close();
 });
 dialog.addEventListener('close',()=>{
  lastFocus?.focus?.();
  lastFocus=null;
 });
 dialog.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&typeof dialog.close!=='function')close();
 });
})();
