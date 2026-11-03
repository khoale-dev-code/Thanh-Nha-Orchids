const CACHE = 'thanh-nha-static-v7';
const ASSETS = ['/offline.html','/offline-notes.html','/icons/icon-192.png','/icons/icon-512.png','/brand/logo-doc-sang.png'];
self.addEventListener('install', event => {event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))); self.skipWaiting();});
self.addEventListener('activate', event => {event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))); self.clients.claim();});
self.addEventListener('fetch', event => {
 const req=event.request; if(req.method!=='GET')return;
 const url=new URL(req.url); if(url.origin!==self.location.origin)return;
 // Dữ liệu đơn hàng, API, đường dẫn dashboard có thông tin cá nhân: KHÔNG cache.
 if(url.pathname.startsWith('/api/') || url.pathname.startsWith('/track/') || req.mode==='navigate') {
  if(req.mode==='navigate')event.respondWith(fetch(req).catch(()=>(url.pathname.startsWith('/operations')?caches.match('/offline-notes.html'):caches.match('/offline.html'))));
  return;
 }
 if(url.pathname.startsWith('/icons/')||url.pathname.startsWith('/brand/')) event.respondWith(caches.match(req).then(cached=>cached||fetch(req)));
});
