/* Shared mobile TOP / navigation for owner, president, ota and festival. */
(function(){
 'use strict';
 const profile=window.__interviewPersonal?.profile;
 const names={owner:'村上',president:'社長',ota:'オオタ',festival:'お祭り'};
 if(!names[profile])return;
 const symbols={
  line:'<path d="M20 11.5a8 8 0 0 1-8 8 9 9 0 0 1-4-.9L3 20l1.4-4A8.5 8.5 0 0 1 3.5 12a8.5 8.5 0 0 1 16.5-.5z"/><path d="M8 12h8M8 15h5"/>',
  today:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18m5 5 3 3 6-7"/>',
  sheet:'<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 3h6v3H9zm0 8h6m-6 4h6m-6 4h4"/>',
  done:'<rect x="4" y="3" width="16" height="19" rx="2"/><path d="M8 12l3 3 5-6M9 3v3h6V3"/>',
  future:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M12 13v6m-3-3h6"/>',
  adjust:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2M3.6 7H7m-3.4 0 1-3.2"/>',
  stats:'<path d="M4 20V4m0 16h17M8 17v-5h3v5m2 0V7h3v10m2 0V3h3v14"/>',
  blocks:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M9 14l6 5m0-5-6 5"/>'
 };
 const items=[
  {key:'LINE通知',icon:'line',color:'#397eae'},
  {key:'今日の予定',icon:'today',color:'#328866'},
  {key:'Interview Sheet',icon:'sheet',color:'#7965a6'},
  {key:'面接済み',icon:'done',color:'#4b827e'},
  {key:'明日以降',icon:'future',color:'#4975ac'},
  {key:'日程調整',icon:'adjust',color:'#b57d51'},
  {key:'店舗数値',icon:'stats',color:'#677db0'},
  {key:'対応不可',icon:'blocks',color:'#b66572'}
 ];
 const svg=key=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+symbols[key]+'</svg>';
 const top=document.createElement('section');top.id='personalMobileTop';top.setAttribute('aria-label','面接管理 TOP');
 top.innerHTML='<div class="personal-mobile-header"><div><small class="personal-mobile-eyebrow">L GROUP MANAGEMENT</small><strong class="personal-mobile-name">'+names[profile]+'｜面接管理</strong></div><button type="button" class="personal-mobile-refresh" aria-label="最新情報に更新">↻</button></div><div class="personal-mobile-grid">'+
 items.map(item=>'<button type="button" class="personal-mobile-action" data-personal-menu="'+item.key+'" style="--action-color:'+item.color+'"><span class="personal-mobile-icon">'+svg(item.icon)+'</span><span class="personal-mobile-label">'+item.key+'</span><span class="personal-mobile-count" hidden></span></button>').join('')+
 '</div>';
 const viewer=document.createElement('section');viewer.id='personalMobileViewer';viewer.setAttribute('aria-label','面接管理 詳細');
 viewer.innerHTML='<div class="personal-mobile-subheader"><button type="button" data-personal-back>‹ TOP</button><strong id="personalMobileViewTitle"></strong></div><iframe id="personalMobileFrame" title="面接管理の詳細画面" loading="eager"></iframe>';
 const blockBar=document.createElement('div');blockBar.id='personalMobileBlockBar';blockBar.innerHTML='<button type="button" data-personal-back>‹ TOP</button><strong>対応不可の設定</strong>';
 document.body.append(top,viewer,blockBar);
 const gate=document.getElementById('gate'),frame=viewer.querySelector('iframe');
 const mobile=()=>window.matchMedia('(max-width:900px)').matches;
 const authorized=()=>gate?.style.display==='none';
 function clearFrame(){if(frame.getAttribute('src'))frame.setAttribute('src','about:blank')}
 function showHome(){
  if(!mobile()||!authorized())return;
  clearFrame();
  try{if(typeof openSpSection==='function')openSpSection('home')}catch(error){console.warn('TOP return',error)}
  document.body.dataset.personalMobileView='home';
  window.scrollTo(0,0);
  updateBadges();
 }
 function openPage(key){
  if(!mobile()||!authorized())return;
  if(key==='対応不可'){
   clearFrame();
   document.body.dataset.personalMobileView='blocks';
   if(typeof tab==='function')tab('schedule',null);
   if(typeof openSpSection==='function')openSpSection('blocks');
   window.scrollTo(0,0);
   return;
  }
  if(!items.some(item=>item.key===key))return;
  viewer.querySelector('#personalMobileViewTitle').textContent=key;
  document.body.dataset.personalMobileView='app';
  frame.src='/therapist-profile/staff/interview-sheet-preview/?personalMobile=1&page='+encodeURIComponent(key);
 }
 function updateBadges(){
  const userId=typeof personalViewer!=='undefined'?personalViewer?.userId:null;
  if(userId){
   const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
   const rows=Array.isArray(window.scheduleInterviewRows)?window.scheduleInterviewRows:[];
   const count=rows.filter(x=>String(x.interviewer_user_id)===String(userId)&&String(x.interview_date)===today&&['面接予定','日程変更'].includes(x.status)).length;
   const badge=top.querySelector('[data-personal-menu="今日の予定"] .personal-mobile-count');
   badge.textContent=String(count);badge.hidden=count===0;
  }
  const sheet=document.getElementById('mobileSheetAlert');
  const sheetCount=document.getElementById('mobileSheetCount');
  const matched=(sheetCount?.textContent||'').match(/\d+/);
  const count=sheet&&sheet.style.display!=='none'&&matched?Number(matched[0]):0;
  const badge=top.querySelector('[data-personal-menu="Interview Sheet"] .personal-mobile-count');
  badge.textContent=String(count);badge.hidden=count===0;
 }
 function sync(){
  if(!mobile()||!authorized()){
   if(document.body.dataset.personalMobileView==='app')clearFrame();
   document.body.removeAttribute('data-personal-mobile-view');
   return;
  }
  if(!document.body.dataset.personalMobileView)document.body.dataset.personalMobileView='home';
  updateBadges();
 }
 top.addEventListener('click',event=>{
  if(event.target.closest('.personal-mobile-refresh')){
   if(typeof loadSchedule==='function')void loadSchedule();
   if(typeof loadInterviewSheets==='function')void loadInterviewSheets();
   return;
  }
  const button=event.target.closest('[data-personal-menu]');
  if(button)openPage(button.dataset.personalMenu);
 });
 for(const button of document.querySelectorAll('[data-personal-back]'))button.addEventListener('click',showHome);
 const gateObserver=new MutationObserver(sync);
 if(gate)gateObserver.observe(gate,{attributes:true,attributeFilter:['style']});
 const countObserver=new MutationObserver(updateBadges);
 for(const id of ['scheduleToday','mobileSheetAlert','mobileSheetCount']){
  const node=document.getElementById(id);
  if(node)countObserver.observe(node,{subtree:true,childList:true,characterData:true,attributes:id==='mobileSheetAlert'});
 }
 window.addEventListener('resize',sync);
 window.addEventListener('pageshow',sync);
 sync();
})();
