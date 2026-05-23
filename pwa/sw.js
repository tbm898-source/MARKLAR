const CACHE_NAME="operatoros-cache-v1";
const ASSETS=["./","./index.html","./styles.css","./app.js","./manifest.json","./sw.js","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install",(event)=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",(event)=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>(k!==CACHE_NAME?caches.delete(k):null)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",(event)=>{
  event.respondWith(
    caches.match(event.request).then(cached=>{
      if(cached) return cached;
      return fetch(event.request).then(resp=>{
        const copy=resp.clone();
        caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));
        return resp;
      }).catch(()=>caches.match("./index.html"));
    })
  );
});
