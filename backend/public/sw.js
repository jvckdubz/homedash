// Минимальный Service Worker - только для PWA функционала
// НЕ кэширует контент, чтобы обновления применялись мгновенно

const SW_VERSION = 'v10';

// Install - сразу активируемся
self.addEventListener('install', event => {
  console.log('[SW] Install', SW_VERSION);
  self.skipWaiting();
});

// Activate - очищаем ВСЕ старые кэши и берём контроль
self.addEventListener('activate', event => {
  console.log('[SW] Activate', SW_VERSION);
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.map(name => {
        console.log('[SW] Deleting cache:', name);
        return caches.delete(name);
      })))
      .then(() => self.clients.claim())
  );
});

// Fetch - НЕ перехватываем, пусть браузер работает напрямую
// Это гарантирует что обновления будут загружаться сразу
self.addEventListener('fetch', event => {
  // Просто пропускаем - браузер сам обработает запрос
  return;
});

// Сообщения от клиента
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  if (event.data === 'clearCaches') {
    caches.keys().then(names => 
      Promise.all(names.map(name => caches.delete(name)))
    ).then(() => {
      event.source.postMessage({ type: 'CACHES_CLEARED' });
    });
  }
});
