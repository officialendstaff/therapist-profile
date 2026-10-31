/* Mobile TOP notification counters, in-page sound and independent Web Push opt-in.
 * All datasets are fetched under the signed-in administrator's existing permissions.
 */
(function(){
'use strict';
const top=document.getElementById('personalMobileTop');
if(!top)return;
const profile=window.__interviewPersonal?.profile;
if(!['owner','president','ota','festival'].includes(profile))return;
const SB='https://vjjnkflbfsjihwzjsjpr.supabase.co';
const LINE_KEY='interview_new_line_seen_at_v1';
const SHEET_KEY='interview_sheet_seen_at_v1';
const SOUND_KEY='personal_mobile_sound_enabled_v1';
const legacySheetStart=Date.parse('2026-10-22T00:00:00+09:00')-1;
const items=['LINE通知','今日の予定','Interview Sheet'];
const badge=key=>top.querySelector('[data-personal-menu="'+key+'"] .personal-mobile-count');
const dateJP=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
const authorized=()=>document.getElementById('gate')?.style.display==='none';
let lineEvents=[],lineLoaded=false,linesLoading=false,sheetLoading=false,started=false;
let audioContext=null,lastSoundAt=0,soundAcknowledged='',lastSignature='',ackTodaySignature='';
let soundEnabled=localStorage.getItem(SOUND_KEY)!=='off';
let lastReadError='';
function currentSheets(){return Array.isArray(window.interviewApplicants)?window.interviewApplicants:[]}
function currentToday(){
 const userId=typeof personalViewer!=='undefined'?personalViewer?.userId:null;
 const rows=Array.isArray(window.scheduleInterviewRows)?window.scheduleInterviewRows:[];
 if(!userId)return [];
 return rows.filter(x=>String(x.interviewer_user_id)===String(userId)&&String(x.interview_date)===dateJP()&&['面接予定','日程変更'].includes(x.status));
}
function unseenSheets(){
 const rows=currentSheets();
 const readIds=new Set((()=>{try{return JSON.parse(localStorage.getItem('interviewSheetReadIds')||'[]')}catch{return []}})().map(String));
 const seen=localStorage.getItem(SHEET_KEY);
 const last=seen===null?Math.max(Number(localStorage.getItem('interviewSheetSeenAt')||0),legacySheetStart):Date.parse(seen)||0;
 return rows.filter(x=>x.id&&x.submitted_at&&Date.parse(x.submitted_at)>last&&!readIds.has(String(x.id)));
}
function unseenLines(){
 if(!lineLoaded)return [];
 const latest=lineEvents.reduce((m,e)=>String(e.received_at||'')>m?String(e.received_at):m,'');
 let seen=localStorage.getItem(LINE_KEY);
 if(seen===null&&latest){localStorage.setItem(LINE_KEY,latest);seen=latest}
 return lineEvents.filter(e=>String(e.received_at||'')>String(seen||''));
}
function update(){
 if(!authorized())return;
 const data={
  'LINE通知':unseenLines().length,
  '今日の予定':currentToday().length,
  'Interview Sheet':unseenSheets().length
 };
 for(const key of items){
  const el=badge(key);if(!el)continue;
  const count=data[key];el.hidden=!count;
  el.textContent=count?String(count):'';
 }
 try{
  if('setAppBadge' in navigator){
   const total=data['LINE通知']+data['Interview Sheet']+data['今日の予定'];
   if(total)navigator.setAppBadge(total).catch(()=>{});
   else navigator.clearAppBadge?.().catch(()=>{});
  }
 }catch{}
 const due=currentToday().filter(x=>{
  const time=String(x.interview_time||'').slice(0,5);
  const start=Date.parse(String(x.interview_date)+'T'+time+':00+09:00');
  return Number.isFinite(start)&&start>Date.now()&&start-Date.now()<=7200000;
 });
 const dueItems=due.map(e=>'today:'+String(e.id)+':'+String(e.interview_date)+':'+String(e.interview_time));
 const dueSignature=dueItems.slice().sort().join('|');
 const signature=[
  ...unseenLines().map(e=>'line:'+String(e.id||e.line_event_id||e.received_at)),
  ...unseenSheets().map(e=>'sheet:'+String(e.id)),
  ...(dueSignature===ackTodaySignature?[]:dueItems)
 ].sort().join('|');
 if(signature!==lastSignature)lastSignature=signature;
 if(signature&&signature!==soundAcknowledged)playSound();
}
window.personalMobileNotificationsUpdate=update;
async function getAccessToken(force=false){
 let token=!force?sessionStorage.getItem('interview_staff_session_v2'):null;
 if(token)return token;
 const session=(await sb.auth.getSession()).data?.session;
 if(!session?.access_token)throw Error('ログインが必要です');
 const result=await fetch(SB+'/functions/v1/interview-staff-access',{
  method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
  body:JSON.stringify({action:'admin_exchange'}),cache:'no-store'
 });
 const json=await result.json();
 if(!result.ok||!json.token)throw Error('管理者認証を確認できません');
 sessionStorage.setItem('interview_staff_session_v2',json.token);
 return json.token;
}
async function getInbox(token){
 const response=await fetch(SB+'/functions/v1/interview-staff-access',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({action:'inbox',token}),cache:'no-store'
 });
 if(response.status===401)throw Object.assign(Error('認証の更新が必要'),{reauth:true});
 if(!response.ok)throw Error('LINE通知の取得に失敗しました');
 return response.json();
}
async function pollLines(){
 if(linesLoading||!authorized()||document.hidden)return;
 linesLoading=true;
 try{
  let result;
  try{result=await getInbox(await getAccessToken())}
  catch(error){
   if(!error.reauth)throw error;
   sessionStorage.removeItem('interview_staff_session_v2');
   result=await getInbox(await getAccessToken(true));
  }
  lineEvents=Array.isArray(result.events)?result.events:[];
  lineLoaded=true;lastReadError='';update();
 }catch(e){lastReadError=String(e.message||e);console.warn('TOP LINE通知:',e)}
 finally{linesLoading=false}
}
async function pollSheets(){
 if(sheetLoading||!authorized()||document.hidden)return;
 sheetLoading=true;
 try{if(typeof loadInterviewSheets==='function')await loadInterviewSheets();update()}
 catch(e){console.warn('TOP Interview Sheet:',e)}
 finally{sheetLoading=false}
}
async function pollToday(){
 if(!authorized()||document.hidden)return;
 try{if(typeof loadSchedule==='function')await loadSchedule();update()}
 catch(e){console.warn('TOP 今日の予定:',e)}
}
function acknowledge(key){
 if(key==='今日の予定'){
  const now=Date.now();
  ackTodaySignature=currentToday().filter(x=>{
   const start=Date.parse(String(x.interview_date)+'T'+String(x.interview_time||'').slice(0,5)+':00+09:00');
   return Number.isFinite(start)&&start>now&&start-now<=7200000;
  }).map(x=>'today:'+String(x.id)+':'+String(x.interview_date)+':'+String(x.interview_time)).sort().join('|');
 }
 if(key==='LINE通知'){
  const latest=lineEvents.reduce((m,e)=>String(e.received_at||'')>m?String(e.received_at):m,'');
  if(latest)localStorage.setItem(LINE_KEY,latest);
 }else if(key==='Interview Sheet'){
  const sheets=currentSheets();const latest=sheets.reduce((m,s)=>String(s.submitted_at||'')>m?String(s.submitted_at):m,'');
  if(latest)localStorage.setItem(SHEET_KEY,latest);
  const ids=new Set((()=>{try{return JSON.parse(localStorage.getItem('interviewSheetReadIds')||'[]')}catch{return []}})().map(String));
  sheets.forEach(s=>{if(s.id)ids.add(String(s.id))});
  localStorage.setItem('interviewSheetReadIds',JSON.stringify([...ids].slice(-2000)));
  if(typeof updateInterviewSheetAlert==='function')updateInterviewSheetAlert();
 }
 soundAcknowledged='';
 lastSoundAt=0;update();
}
function unlockAudio(){
 if(!soundEnabled||audioContext)return;
 try{const Audio=window.AudioContext||window.webkitAudioContext;if(Audio){audioContext=new Audio();void audioContext.resume().catch(()=>{})}}catch(e){console.warn('Audio initialization',e)}
}
function playSound(force=false){
 if(!soundEnabled||!audioContext||audioContext.state!=='running')return;
 if(!force&&(!lastSignature||lastSignature===soundAcknowledged||Date.now()-lastSoundAt<60000))return;
 try{
  const start=audioContext.currentTime;
  for(const [i,freq] of [[0,659.25],[1,880]]){
   const osc=audioContext.createOscillator(),gain=audioContext.createGain();
   osc.type='sine';osc.frequency.value=freq;
   gain.gain.setValueAtTime(0.0001,start+i*0.19);
   gain.gain.exponentialRampToValueAtTime(0.075,start+i*0.19+0.025);
   gain.gain.exponentialRampToValueAtTime(0.0001,start+i*0.19+0.17);
   osc.connect(gain);gain.connect(audioContext.destination);
   osc.start(start+i*0.19);osc.stop(start+i*0.19+0.18);
  }
  lastSoundAt=Date.now();
 }catch(e){console.warn('TOP notification sound',e)}
}
const header=top.querySelector('.personal-mobile-header');
const refresh=top.querySelector('.personal-mobile-refresh');
const tools=document.createElement('div');tools.className='personal-mobile-header-tools';
const settings=document.createElement('button');
settings.type='button';settings.className='personal-mobile-settings';settings.setAttribute('aria-label','通知設定');settings.title='通知設定';
settings.textContent='🔔';tools.append(settings);
if(refresh)tools.append(refresh);
header?.append(tools);
const modal=document.createElement('div');
modal.id='personalMobileNotificationSettings';modal.hidden=true;
modal.innerHTML='<div class="personal-mobile-notification-panel" role="dialog" aria-modal="true" aria-label="通知・通知音設定"><div class="personal-mobile-notification-heading"><strong>通知・通知音設定</strong><button type="button" data-notification-close>閉じる</button></div><p id="personalNotificationStatus">通知設定を確認しています。</p><button type="button" id="personalPushEnable">スマホ通知を設定</button><button type="button" id="personalSoundToggle">通知音</button><button type="button" id="personalSoundTest">音を確認</button><p class="personal-mobile-notification-note">iPhoneで画面を閉じても通知を受け取るには、Safariの共有メニューからホーム画面に追加し、追加したアイコンから開いて通知を許可してください。通知音はページを開いている間に再生されます。</p></div>';
top.append(modal);
const status=modal.querySelector('#personalNotificationStatus'),enable=modal.querySelector('#personalPushEnable'),toggle=modal.querySelector('#personalSoundToggle');
function soundLabel(){toggle.textContent='通知音：'+(soundEnabled?'ON':'OFF')}
function standalone(){return window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}
function notificationStatus(){
 soundLabel();
 if(!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window)){
  status.textContent='この環境はWeb Pushに対応していません。';enable.hidden=true;return;
 }
 if(!standalone()){
  status.textContent='スマホ通知にはホーム画面に追加したWebアプリでの起動が必要です。';
  enable.hidden=true;return;
 }
 if(Notification.permission==='denied'){
  status.textContent='通知が拒否されています。端末の設定から許可してください。';
  enable.hidden=true;return;
 }
 status.textContent=Notification.permission==='granted'?'通知許可済み。登録状態を確認してください。':'通知は未許可です。';
 enable.hidden=false;
 enable.textContent=Notification.permission==='granted'?'この端末を通知先に登録':'通知を許可する';
}
async function registerPush(){
 if(!('serviceWorker' in navigator)||!('PushManager' in window))throw Error('Web Push非対応の環境です');
 const path='/therapist-profile/staff/interview-personal/'+profile+'/';
 const reg=await navigator.serviceWorker.register(path+'sw.js',{scope:path});
 await navigator.serviceWorker.ready;
 let subscription=await reg.pushManager.getSubscription();
 if(!subscription){
  const publicKey=typeof INTERVIEW_PUSH_VAPID_PUBLIC_KEY!=='undefined'?INTERVIEW_PUSH_VAPID_PUBLIC_KEY:null;
  if(!publicKey)throw Error('通知用公開鍵がありません');
  if(typeof decodeVapidKey!=='function')throw Error('通知用鍵を読み込めません');
  subscription=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeVapidKey(publicKey)});
 }
 const {data:{user},error:authError}=await sb.auth.getUser();
 if(authError||!user)throw Error('ログインを確認できません');
 const {error}=await sb.from('staff_push_subscriptions').upsert({
  user_id:user.id,endpoint:subscription.endpoint,subscription:subscription.toJSON(),
  user_agent:navigator.userAgent,updated_at:new Date().toISOString()
 },{onConflict:'endpoint'});
 if(error)throw error;
 status.textContent='この端末を通知先に登録しました。';
}
settings.addEventListener('click',()=>{unlockAudio();modal.hidden=false;notificationStatus()});
refresh?.addEventListener('click',()=>{void pollLines();void pollSheets();void pollToday()});
modal.querySelector('[data-notification-close]').addEventListener('click',()=>modal.hidden=true);
toggle.addEventListener('click',()=>{soundEnabled=!soundEnabled;localStorage.setItem(SOUND_KEY,soundEnabled?'on':'off');if(soundEnabled)unlockAudio();soundLabel()});
modal.querySelector('#personalSoundTest').addEventListener('click',async()=>{unlockAudio();await audioContext?.resume();playSound(true)});
enable.addEventListener('click',async()=>{
 enable.disabled=true;
 try{
  if(Notification.permission!=='granted'){
   const choice=await Notification.requestPermission();
   if(choice!=='granted'){notificationStatus();return}
  }
  status.textContent='端末を登録しています…';
  await registerPush();
 }catch(error){status.textContent='通知登録エラー：'+String(error.message||error)}
 finally{enable.disabled=false}
});
top.addEventListener('click',event=>{
 unlockAudio();
 const button=event.target.closest('[data-personal-menu]');
 if(!button)return;
 const key=button.dataset.personalMenu;
 if(items.includes(key))acknowledge(key);
});
window.addEventListener('storage',event=>{if([LINE_KEY,SHEET_KEY,'interviewSheetReadIds',SOUND_KEY].includes(event.key)){soundEnabled=localStorage.getItem(SOUND_KEY)!=='off';update()}});
const watch=new MutationObserver(()=>update());
for(const id of ['mobileSheetCount','mobileSheetAlert','scheduleToday']){
 const node=document.getElementById(id);
 if(node)watch.observe(node,{childList:true,characterData:true,subtree:true});
}
function begin(){
 if(started||!authorized())return;
 started=true;void pollLines();void pollSheets();void pollToday();update();
}
new MutationObserver(begin).observe(document.getElementById('gate'),{attributes:true,attributeFilter:['style']});
window.addEventListener('pageshow',begin);
navigator.serviceWorker?.addEventListener('message',event=>{if(event.data?.type==='personal-mobile-push-open'){void pollLines();void pollSheets();void pollToday()}});
window.addEventListener('focus',()=>{begin();void pollLines();void pollSheets();void pollToday()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){begin();void pollLines();void pollSheets();void pollToday()}});
setInterval(()=>{if(!authorized()||document.hidden)return;void pollLines();void pollSheets();update()},30000);
setInterval(()=>{if(!authorized()||document.hidden)return;void pollToday()},60000);
begin();
})();