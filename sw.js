const CACHE_NAME = 'nour-cache-v2';
const ASSETS = [
  './',
  './index.html',
  './Test.html',
  './IM9.jpg',
  './mauritania-seal.png.jpg',
  './launchericon-512x512.png',
  './manifest.json'
];

function isCacheableResponse(response) {
  if (!response) return false;
  if (response.type === 'opaque') return true;
  if (!response.ok || response.status !== 200) return false;
  const contentLength = response.headers.get('content-length');
  if (contentLength === '0') return false;
  return true;
}

function isHtmlRequest(request, url) {
  if (request.mode === 'navigate' || request.destination === 'document') {
    return true;
  }
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html')) {
    return true;
  }
  return /\.html?$/i.test(url.pathname) || url.pathname === '/' || url.pathname.endsWith('/');
}

function isStaticAssetRequest(request, url) {
  if (
    request.destination === 'image' ||
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    request.destination === 'manifest'
  ) {
    return true;
  }
  if (/\.(png|jpe?g|webp|gif|svg|ico|css|js|woff2?|ttf|eot|json)$/i.test(url.pathname)) {
    return true;
  }
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdnjs.cloudflare.com')
  ) {
    return true;
  }
  return false;
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS.map((asset) => {
          const req = new Request(asset, { cache: 'reload' });
          return fetch(req)
            .catch(() => fetch(asset))
            .then((res) => {
              if (isCacheableResponse(res)) {
                return cache.put(asset, res.clone());
              }
            })
            .catch(() => {});
        })
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            return caches.delete(k);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') {
    return;
  }

  let url;
  try {
    url = new URL(e.request.url);
  } catch (err) {
    return;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  if (
    e.request.url.includes('.apk') ||
    e.request.url.includes('.pdf') ||
    e.request.url.includes('supabase.co')
  ) {
    return;
  }

  // 1. ملفات HTML والتنقل (index.html و Test.html): Network-First مع الرجوع إلى الكاش عند انقطاع الإنترنت
  if (isHtmlRequest(e.request, url)) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (isCacheableResponse(response)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
          }
          return response;
        })
        .catch(() => {
          return caches.match(e.request, { ignoreSearch: true }).then((cached) => {
            if (cached) return cached;
            if (/Test\.html$/i.test(url.pathname)) {
              return caches.match('./Test.html');
            }
            return caches.match('./index.html').then((idx) => idx || caches.match('./Test.html'));
          });
        })
    );
    return;
  }

  // 2. الصور والملفات الثابتة (mauritania-seal.png.jpg و launchericon-512x512.png و IM9.jpg وغيرها): Cache-First مع تحديث خلفي
  if (isStaticAssetRequest(e.request, url)) {
    e.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(e.request, { ignoreSearch: true }).then((cached) => {
          const networkUpdate = fetch(e.request)
            .then((response) => {
              if (isCacheableResponse(response)) {
                cache.put(e.request, response.clone());
              }
              return response;
            })
            .catch(() => cached);

          if (cached) {
            e.waitUntil(networkUpdate);
            return cached;
          }
          return networkUpdate;
        });
      })
    );
    return;
  }

  // 3. بقية الطلبات من نفس النطاق: الشبكة أولاً مع fallback للكاش
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (isCacheableResponse(response)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(e.request, { ignoreSearch: true }))
    );
  }
});
