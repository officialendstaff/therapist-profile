const CACHE='mattan-admin-v2';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request))
    );
  }
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = {}; }
  const titles = {
    interview_new: '新しい面接予定',
    interview_cancel: '面接キャンセル',
    interview_reschedule: '面接日程変更',
    interview_form: '面接フォーム記入完了',
    interview_help: '面接フォーム HELP'
  };
  if (!Object.prototype.hasOwnProperty.call(titles, data.type)) return;
  event.waitUntil(self.registration.showNotification(titles[data.type], {
    body: String(data.body || '管理ページをご確認ください').slice(0, 120),
    icon: './icon-192.png',
    tag: String(data.event_id || data.type),
    data: { url: self.registration.scope }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = self.registration.scope;
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const current = windows.find(w => w.url.startsWith(url));
    if (current) return current.focus();
    return clients.openWindow(url);
  })());
});
