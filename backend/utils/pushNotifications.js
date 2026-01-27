/**
 * PWA Push Notifications
 * Отправка push-уведомлений на подписанные устройства
 */

const webpush = require('web-push');
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const VAPID_FILE = path.join(DATA_DIR, 'vapid-keys.json');
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, 'push-subscriptions.json');

let vapidKeys = null;
let subscriptions = [];
let initPromise = null;
let initError = null;

/**
 * Инициализация VAPID ключей
 */
async function initVapid() {
  try {
    // Пробуем загрузить существующие ключи
    const data = await fs.readFile(VAPID_FILE, 'utf8');
    vapidKeys = JSON.parse(data);
    console.log('[Push] VAPID keys loaded');
  } catch (err) {
    // Генерируем новые ключи
    console.log('[Push] Generating new VAPID keys...');
    try {
      vapidKeys = webpush.generateVAPIDKeys();
      await fs.writeFile(VAPID_FILE, JSON.stringify(vapidKeys, null, 2));
      console.log('[Push] VAPID keys generated and saved');
    } catch (writeErr) {
      console.error('[Push] Failed to save VAPID keys:', writeErr.message);
      throw writeErr;
    }
  }
  
  // Настраиваем web-push с валидным mailto
  // Apple/Google требуют реальный формат email
  webpush.setVapidDetails(
    'mailto:push@homedash.app',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
}

/**
 * Загрузка подписок
 */
async function loadSubscriptions() {
  try {
    const data = await fs.readFile(SUBSCRIPTIONS_FILE, 'utf8');
    subscriptions = JSON.parse(data);
    console.log(`[Push] Loaded ${subscriptions.length} subscription(s)`);
  } catch (err) {
    subscriptions = [];
  }
}

/**
 * Сохранение подписок
 */
async function saveSubscriptions() {
  await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions, null, 2));
}

/**
 * Получение публичного VAPID ключа
 */
function getPublicKey() {
  return vapidKeys?.publicKey || null;
}

/**
 * Добавление подписки
 */
async function addSubscription(subscription, deviceName = 'Unknown') {
  // Проверяем, нет ли уже такой подписки
  const exists = subscriptions.find(s => s.endpoint === subscription.endpoint);
  if (exists) {
    // Обновляем существующую
    exists.subscription = subscription;
    exists.deviceName = deviceName;
    exists.updatedAt = new Date().toISOString();
  } else {
    // Добавляем новую
    subscriptions.push({
      id: Date.now().toString(),
      endpoint: subscription.endpoint,
      subscription,
      deviceName,
      createdAt: new Date().toISOString()
    });
  }
  await saveSubscriptions();
  console.log(`[Push] Subscription added/updated: ${deviceName}`);
  return true;
}

/**
 * Удаление подписки
 */
async function removeSubscription(endpoint) {
  const before = subscriptions.length;
  subscriptions = subscriptions.filter(s => s.endpoint !== endpoint);
  if (subscriptions.length < before) {
    await saveSubscriptions();
    console.log('[Push] Subscription removed');
    return true;
  }
  return false;
}

/**
 * Получение списка подписок
 */
function getSubscriptions() {
  return subscriptions.map(s => ({
    id: s.id,
    deviceName: s.deviceName,
    createdAt: s.createdAt
  }));
}

/**
 * Отправка уведомления
 * @param {Object} payload - данные уведомления
 * @param {string} payload.title - заголовок
 * @param {string} payload.body - текст
 * @param {string} payload.icon - иконка (опционально)
 * @param {string} payload.tag - тег для группировки (опционально)
 * @param {string} payload.url - URL для открытия по клику
 * @param {Object} payload.data - дополнительные данные
 */
async function sendNotification(payload) {
  if (!vapidKeys) {
    console.error('[Push] VAPID keys not initialized');
    return { sent: 0, failed: 0, error: 'VAPID ключи не инициализированы' };
  }
  
  if (subscriptions.length === 0) {
    console.log('[Push] No subscriptions to send to');
    return { sent: 0, failed: 0, error: 'Нет подписанных устройств' };
  }
  
  const notification = JSON.stringify({
    title: payload.title || 'HomeDash',
    body: payload.body || '',
    icon: payload.icon || '/favicon.svg',
    badge: '/favicon.svg',
    tag: payload.tag || 'homedash',
    url: payload.url || '/',
    data: payload.data || {},
    timestamp: Date.now()
  });
  
  let sent = 0;
  let failed = 0;
  const failedEndpoints = [];
  const errors = [];
  
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub.subscription, notification);
      sent++;
    } catch (err) {
      failed++;
      const errorDetail = `${sub.deviceName}: ${err.message} (${err.statusCode || 'no code'})`;
      console.error(`[Push] Failed to send to ${sub.deviceName}:`, err.message);
      errors.push(errorDetail);
      
      // Если подписка невалидна (410 Gone или 404), удаляем её
      if (err.statusCode === 410 || err.statusCode === 404) {
        failedEndpoints.push(sub.endpoint);
      }
    }
  }
  
  // Удаляем невалидные подписки
  if (failedEndpoints.length > 0) {
    subscriptions = subscriptions.filter(s => !failedEndpoints.includes(s.endpoint));
    await saveSubscriptions();
    console.log(`[Push] Removed ${failedEndpoints.length} invalid subscription(s)`);
  }
  
  console.log(`[Push] Sent: ${sent}, Failed: ${failed}`);
  
  const result = { sent, failed };
  if (errors.length > 0) {
    result.error = errors.join('; ');
  }
  return result;
}

/**
 * Уведомление о статусе мониторинга
 */
async function sendMonitoringAlert(monitor, status, message) {
  const isDown = status === 'down';
  
  await sendNotification({
    title: isDown ? `${monitor.name} недоступен` : `${monitor.name} восстановлен`,
    body: message,
    tag: `monitor-${monitor.id}`,
    icon: '/favicon.svg',
    url: `/?card=${monitor.id}`,
    data: {
      type: 'monitoring',
      monitorId: monitor.id,
      status
    }
  });
}

/**
 * Напоминание о платеже
 */
async function sendPaymentReminder(payment) {
  await sendNotification({
    title: `Напоминание: ${payment.name}`,
    body: `Платёж ${payment.amount} ${payment.currency} - ${payment.dueDate}`,
    tag: `payment-${payment.id}`,
    icon: '/favicon.svg',
    url: `/?payment=${payment.id}`,
    data: {
      type: 'payment',
      paymentId: payment.id
    }
  });
}

/**
 * Тестовое уведомление
 */
async function sendTestNotification() {
  return await sendNotification({
    title: 'Тестовое уведомление',
    body: 'Push-уведомления работают корректно!',
    tag: 'test',
    url: '/'
  });
}

// Инициализация при загрузке модуля
initPromise = (async () => {
  try {
    await initVapid();
    await loadSubscriptions();
    console.log('[Push] Initialization complete');
  } catch (err) {
    initError = err.message;
    console.error('[Push] Init error:', err.message);
  }
})();

/**
 * Ожидание инициализации
 */
async function waitForInit() {
  if (initPromise) {
    await initPromise;
  }
  return !initError;
}

/**
 * Получение статуса системы
 */
function getStatus() {
  return {
    initialized: !!vapidKeys,
    initError,
    vapidConfigured: !!vapidKeys,
    subscriptionsCount: subscriptions.length
  };
}

module.exports = {
  getPublicKey,
  addSubscription,
  removeSubscription,
  getSubscriptions,
  sendNotification,
  sendMonitoringAlert,
  sendPaymentReminder,
  sendTestNotification,
  waitForInit,
  getStatus
};
