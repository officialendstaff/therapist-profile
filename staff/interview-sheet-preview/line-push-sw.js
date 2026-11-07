"use strict";
const TARGET="/therapist-profile/staff/interview-sheet-preview/?linePush=1";
self.addEventListener("install",event=>event.waitUntil(self.skipWaiting()));
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("push",event=>{
 let payload={};
 try{payload=event.data?event.data.json():{}}catch{payload={}}
 const type=typeof payload.type==="string"?payload.type:"line_new";
 const labels={line_new:"LINE新着｜面接管理",interview_new:"新しい面接予定",interview_cancel:"面接キャンセル",interview_reschedule:"面接日程変更",interview_form:"面接フォーム記入完了",interview_help:"面接フォーム HELP",interview_confirmed:"面接確認済み",push_test:"通知テスト"};
 const title=typeof payload.title==="string"&&payload.title.length<90?payload.title:(labels[type]||"面接管理｜新着通知");
 const body=typeof payload.body==="string"&&payload.body.length<200?payload.body:
   type==="line_new"?"新しいLINEのお問い合わせがあります。":"管理画面をご確認ください。";
 const destination=type==="line_new"||type==="push_test"?TARGET:"/therapist-profile/staff/interview-sheet-preview/";
 const options={
  body,
  icon:"/therapist-profile/staff/interview-sheet-preview/icons/recruit-180.png",
  badge:"/therapist-profile/staff/interview-sheet-preview/icons/recruit-180.png",
  tag:"interview-notice-"+(payload.event_id||Date.now()),
  data:{url:destination},
  renotify:true,
  requireInteraction:type==="line_new"
 };
 event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const intended=event.notification.data?.url||TARGET;
 const target=new URL(intended,self.location.origin);
 if(target.origin!==self.location.origin||!target.pathname.startsWith("/therapist-profile/staff/"))return;
 event.waitUntil((async()=>{
  const clients=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  for(const client of clients){
   if(new URL(client.url).pathname.startsWith("/therapist-profile/staff/interview-sheet-preview/")){
    if("navigate" in client)await client.navigate(target.href);
    return client.focus();
   }
  }
  return self.clients.openWindow(target.href);
 })());
});