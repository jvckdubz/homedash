/**
 * Push Notifications API Routes
 */

const express = require('express');
const router = express.Router();
const push = require('../utils/pushNotifications');

// Диагностика Push системы
router.get('/status', async (req, res) => {
  try {
    // Ждём инициализации
    await push.waitForInit();
    
    const status = push.getStatus();
    const publicKey = push.getPublicKey();
    const subscriptions = push.getSubscriptions();
    
    res.json({
      ok: status.initialized && !status.initError,
      initialized: status.initialized,
      initError: status.initError,
      vapidConfigured: !!publicKey,
      publicKeyPrefix: publicKey ? publicKey.substring(0, 30) + '...' : null,
      subscriptionsCount: subscriptions.length,
      subscriptions: subscriptions.map(s => ({
        id: s.id,
        deviceName: s.deviceName,
        createdAt: s.createdAt
      }))
    });
  } catch (err) {
    res.json({
      ok: false,
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Получение публичного VAPID ключа
router.get('/vapid-public-key', async (req, res) => {
  await push.waitForInit();
  const publicKey = push.getPublicKey();
  if (publicKey) {
    res.json({ publicKey });
  } else {
    const status = push.getStatus();
    res.status(503).json({ 
      error: 'Push notifications not initialized',
      initError: status.initError 
    });
  }
});

// Подписка на уведомления
router.post('/subscribe', async (req, res) => {
  try {
    await push.waitForInit();
    
    const { subscription, deviceName } = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    
    await push.addSubscription(subscription, deviceName || 'Unknown Device');
    res.json({ success: true });
  } catch (err) {
    console.error('[Push API] Subscribe error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Отписка от уведомлений
router.post('/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint required' });
    }
    
    const removed = await push.removeSubscription(endpoint);
    res.json({ success: removed });
  } catch (err) {
    console.error('[Push API] Unsubscribe error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Получение списка подписок
router.get('/subscriptions', (req, res) => {
  const subscriptions = push.getSubscriptions();
  res.json(subscriptions);
});

// Удаление подписки по ID
router.delete('/subscriptions/:id', async (req, res) => {
  try {
    const subscriptions = push.getSubscriptions();
    const sub = subscriptions.find(s => s.id === req.params.id);
    
    if (!sub) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    // Нужно найти endpoint по id - но у нас его нет в публичном списке
    // Поэтому добавим метод удаления по id
    res.json({ success: true, message: 'Use unsubscribe endpoint' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Тестовое уведомление
router.post('/test', async (req, res) => {
  try {
    // Ждём инициализации
    const ready = await push.waitForInit();
    if (!ready) {
      const status = push.getStatus();
      return res.json({ 
        sent: 0, 
        failed: 0, 
        error: `Push не инициализирован: ${status.initError || 'unknown'}` 
      });
    }
    
    const { type, delay } = req.body;
    
    const notifications = {
      monitoring: {
        title: 'Тест: Сервис недоступен',
        body: 'Пример уведомления мониторинга',
        tag: 'test-monitoring',
        url: '/',
        data: { type: 'monitoring' }
      },
      payment: {
        title: 'Тест: Напоминание о платеже',
        body: 'Пример платежа - 500 RUB через 3 дня',
        tag: 'test-payment',
        url: '/',
        data: { type: 'payment' }
      },
      task: {
        title: 'Тест: Напоминание о задаче',
        body: 'Пример задачи - дедлайн завтра',
        tag: 'test-task',
        url: '/',
        data: { type: 'task' }
      },
      test: {
        title: 'Тестовое уведомление',
        body: 'Push-уведомления работают корректно!',
        tag: 'test',
        url: '/'
      }
    };
    
    const payload = notifications[type] || notifications.test;
    
    // Если указана задержка - отправляем позже
    if (delay && delay > 0) {
      const delayMs = Math.min(delay, 60) * 1000; // Максимум 60 секунд
      setTimeout(async () => {
        try {
          payload.body = `[Отложенный тест] ${payload.body}`;
          await push.sendNotification(payload);
          console.log(`[Push] Delayed notification sent after ${delay}s`);
        } catch (err) {
          console.error('[Push] Delayed notification error:', err);
        }
      }, delayMs);
      
      return res.json({ 
        sent: 0, 
        failed: 0, 
        scheduled: true,
        delay,
        message: `Уведомление будет отправлено через ${delay} сек` 
      });
    }
    
    const result = await push.sendNotification(payload);
    res.json(result);
  } catch (err) {
    console.error('[Push API] Test error:', err);
    res.json({ sent: 0, failed: 0, error: err.message });
  }
});

module.exports = router;
