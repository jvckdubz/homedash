// Минимальный Service Worker - только для PWA функционала
// НЕ кэширует контент, чтобы обновления применялись мгновенно

const SW_VERSION = 'v1.5.0';

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

// ==================== PUSH NOTIFICATIONS ====================

// Получение push-уведомления
self.addEventListener('push', event => {
  console.log('[SW] Push received');
  
  let data = {
    title: 'HomeDash',
    body: 'Новое уведомление',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    url: '/'
  };
  
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    console.error('[SW] Push data parse error:', e);
  }
  
  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag || 'homedash',
    data: {
      url: data.url,
      ...data.data
    },
    vibrate: [200, 100, 200],
    requireInteraction: data.data?.type === 'monitoring', // Мониторинг требует взаимодействия
    actions: []
  };
  
  // Добавляем действия в зависимости от типа
  if (data.data?.type === 'monitoring') {
    options.actions = [
      { action: 'open', title: 'Открыть' },
      { action: 'dismiss', title: 'Закрыть' }
    ];
  } else if (data.data?.type === 'payment') {
    options.actions = [
      { action: 'open', title: 'Посмотреть' },
      { action: 'dismiss', title: 'Закрыть' }
    ];
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Клик по уведомлению
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification click:', event.action);
  
  event.notification.close();
  
  // Если нажали "Закрыть" - ничего не делаем
  if (event.action === 'dismiss') {
    return;
  }
  
  // Получаем URL из данных уведомления
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Ищем уже открытое окно приложения
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Переходим на нужный URL и фокусируемся
            return client.navigate(url).then(() => client.focus());
          }
        }
        // Если нет открытых окон - открываем новое
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Закрытие уведомления
self.addEventListener('notificationclose', event => {
  console.log('[SW] Notification closed');
});

// ==================== MESSAGES ====================

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
