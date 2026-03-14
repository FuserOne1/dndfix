// Service Worker для D&D Dark Fantasy AI
const CACHE_NAME = 'dnd-dark-fantasy-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install - кэшируем файлы
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('SW: кэш открыт');
        return cache.addAll(urlsToCache);
      })
  );
  // Активируем новый SW сразу
  self.skipWaiting();
});

// Activate - удаляем старый кэш
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('SW: удаляю старый кэш:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Берём под контроль все страницы
  self.clients.claim();
});

// Fetch - сеть сначала, потом кэш
self.addEventListener('fetch', (event) => {
  // Пропускаем не-GET запросы
  if (event.request.method !== 'GET') return;

  // Пропускаем cross-origin запросы
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Кэшируем успешные ответы
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Клонируем ответ для кэша
        const responseToCache = response.clone();

        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });

        return response;
      })
      .catch(() => {
        // Сеть не доступна - берём из кэша
        return caches.match(event.request);
      })
  );
});
