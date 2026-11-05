const CACHE_NAME = 'nour-pwa-v5';
const ASSETS = [
  './',
  './index.html',
  './IM9.jpg',
  './launchericon-512x512.png',
  './manifest.json'
];

// التثبيت والتخزين المؤقت وتجاوز الانتظار فوراً
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// التفعيل وحذف كافة نسخ الكاش القديمة والسيطرة الفورية على الصفحات
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// استراتيجية Network-First: جلب أحدث نسخة دائماً مع تجنب كاش الصفحات الرئيسية
self.addEventListener('fetch', (e) => {
  // عدم تخزين ملفات APK أو اتصالات Supabase الخارجية في الكاش
  if (e.request.url.includes('.apk') || e.request.url.includes('supabase.co')) {
    return;
  }

  // إجبار جلب صفحات HTML من الشبكة مباشرة لتفادي بقاء الواجهة القديمة
  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
          return response;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
