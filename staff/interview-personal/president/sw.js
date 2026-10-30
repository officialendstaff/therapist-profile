/* Personal interview dashboard Web Push; same-origin and profile-scoped. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{}}catch{}
 const titles={line_new:'新着LINE',interview_new:'新しい面接予定',
  interview_cancel:'面接キャンセル',interview_reschedule:'面接日時変更',
  interview_form:'Interview Sheet新着',interview_help:'Interview Sheet HELP',
  interview_confirmed:'面接確認済み',push_test:'通知テスト'};
 const title=titles[data.type];if(!title)return;
 event.waitUntil(self.registration.showNotification(title,{
  body:String(data.body||'面接管理をご確認ください。').slice(0,100),
  icon:'/therapist-profile/staff/mobile/icon-192.png',
  badge:'/therapist-profile/staff/mobile/icon-192.png',
  tag:String(data.event_id||data.type||'interview-notice'),
  data:{url:self.registration.scope}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const url=self.registration.scope;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(w=>w.url.startsWith(url));
  if(existing){await existing.focus();existing.postMessage({type:'personal-mobile-push-open'});return}
  return self.clients.openWindow(url);
 })());
});
