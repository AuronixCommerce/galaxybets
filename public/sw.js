const CACHE="galaxy-bets-offline-v1";
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.add("/offline")));self.skipWaiting();});
self.addEventListener("activate",event=>{event.waitUntil(self.clients.claim());});
self.addEventListener("fetch",event=>{if(event.request.mode!=="navigate")return;event.respondWith(fetch(event.request).catch(async()=>await caches.match("/offline")||new Response("Reconnect to play demo games.",{status:503,headers:{"Content-Type":"text/plain"}})));});
