/**
 * HOLLY LIQUID — Service Worker
 *
 * Кешує сайт, щоб він відкривався навіть без інтернету
 * (наприклад, у метро чи в укритті).
 *
 * УВАГА: якщо оновлюєш index.html — обов'язково зміни номер версії
 * у CACHE_NAME нижче (наприклад v1 -> v2), інакше клієнти
 * бачитимуть стару закешовану версію сайту!
 */

const CACHE_NAME = 'holyliquid-v15';

// Файли, які кешуються одразу при встановленні.
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
];

// ---------- INSTALL ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

// ---------- ACTIVATE ----------
// Прибирає старі версії кешу, коли з'являється нова.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ---------- FETCH ----------
// Стратегія "network-first" для головної сторінки: завжди пробуємо
// взяти свіжу версію, а якщо мережі немає — віддаємо збережену копію.
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Кешуємо лише GET-запити зі свого домену.
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Успішна відповідь — оновлюємо кеш свіжою копією.
        const responseClone = response.clone();
        caches.open(CACHE_NAME)
          .then((cache) => cache.put(request, responseClone))
          .catch(() => {});
        return response;
      })
      .catch(() => {
        // Мережі немає — шукаємо в кеші.
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // Для навігаційних запитів віддаємо головну сторінку.
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('', { status: 504, statusText: 'Offline' });
        });
      })
  );
});
