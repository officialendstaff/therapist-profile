/* L GROUP booking chat: persistent browser push notifications */
"use strict";
const STAFF_URL="/therapist-profile/staff/booking-chat/rose-push-v1.html?store="+encodeURIComponent("薔薇と紳士")+"&fromPush=1";
self.addEventListener("install",event=>event.waitUntil(self.skipWaiting()));
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("push",event=>{
 event.waitUntil((async()=>{
  // App-icon notification dot while the installed PWA is closed (best effort).
  try{if(self.navigator&&"setAppBadge" in self.navigator)await self.navigator.setAppBadge();}catch{}
  return self.registration.showNotification("L GROUP｜新着チャット",{
  body:"新しいお問い合わせがあります。チャット管理をご確認ください。",
  tag:"lgroup-new-chat",
  renotify:true,
  requireInteraction:true,
  data:{url:STAFF_URL},
  icon:"/therapist-profile/staff/interview-sheet-preview/icons/recruit-180.png"
 });
 })());
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const target=new URL(event.notification.data?.url||STAFF_URL,self.location.origin);
 if(target.origin!==self.location.origin)return;
 event.waitUntil((async()=>{
  const pages=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  for(const client of pages){
   if(new URL(client.url).pathname.includes("/therapist-profile/staff/booking-chat/")){
    if("navigate" in client)await client.navigate(target.href);
    return client.focus();
   }
  }
  return self.clients.openWindow(target.href);
 })());
});
