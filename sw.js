const CACHE_NAME="scanner-v2";

const ASSETS=[
 "./",
 "./index.html",
 "https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js"
];

self.addEventListener("install",e=>{
 self.skipWaiting();
 e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));
});

self.addEventListener("activate",e=>{
 e.waitUntil(
  caches.keys().then(keys=>
    Promise.all(keys.map(k=>{
      if(k!==CACHE_NAME) return caches.delete(k);
    }))
  )
 );
 self.clients.claim();
});

self.addEventListener("fetch",e=>{
 e.respondWith(
  fetch(e.request)
   .then(res=>{
     const copy=res.clone();
     caches.open(CACHE_NAME).then(c=>c.put(e.request,copy));
     return res;
   })
   .catch(()=>caches.match(e.request))
 );
});

self.addEventListener("message",event=>{
 if(event.data && event.data.type==="SKIP_WAITING"){
  self.skipWaiting();
 }
});