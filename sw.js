/**
 * HOLLY LIQUID — Service Worker
 *
 * Магазин відкривається як справжній застосунок: МИТТЄВО з памʼяті
 * телефона, а нова версія тихо завантажується у фоні й зʼявляється при
 * наступному запуску.
 *
 * Раніше було навпаки — «спершу інтернет»: при кожному запуску (зокрема
 * з іконки на головному екрані) телефон заново завантажував увесь сайт
 * (~3 МБ), а збережену копію брав лише без інтернету. До того ж Telegram
 * відкриває магазин із різними параметрами в адресі (?pt=…&promos=…), і
 * збережена копія не знаходилась — кожна адреса здавалась новою.
 *
 * ОНОВЛЕННЯ САЙТУ: після заливання нового index.html клієнти побачать
 * його з НАСТУПНОГО запуску (цей — ще зі збереженої копії). Номер версії
 * в CACHE_NAME і далі варто міняти при кожному оновленні — тоді старий
 * кеш гарантовано прибирається.
 */
const CACHE_NAME = 'holyliquid-v2';
const SHELL = './index.html';          // сам магазин — один ключ для будь-яких параметрів адреси
const PRECACHE_URLS = ['./', SHELL, './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Оновити збережену копію з мережі (у фоні). Браузер сам перевіряє, чи
// файл змінився (якщо ні — сервер відповідає коротким «не змінився»),
// тож зайвих мегабайтів не витрачається.
function refresh(request, key) {
  return fetch(request)
    .then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(key || request, copy)).catch(() => {});
      }
      return response;
    })
    .catch(() => null);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;   // запити до бота — напряму, без кешу

  // Сам магазин: одразу збережена копія (незалежно від ?параметрів),
  // паралельно — тихе оновлення до наступного запуску
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith((async () => {
      const cached = await caches.match(SHELL);
      const network = refresh(request, SHELL);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      const fresh = await network;                 // перший запуск — лише з мережі
      return fresh || new Response('Offline', { status: 503, statusText: 'Offline' });
    })());
    return;
  }

  // Іконки, маніфест тощо — так само: з памʼяті, а оновлення у фоні
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      const network = refresh(request);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      return network.then((r) => r || new Response('', { status: 504, statusText: 'Offline' }));
    })
  );
});
