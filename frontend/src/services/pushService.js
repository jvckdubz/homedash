/**
 * Push Notifications Service
 * Работа с Push API на клиенте
 */

class PushService {
  constructor() {
    this.swRegistration = null;
    this.subscription = null;
    this.initialized = false;
  }

  /**
   * Проверка поддержки Push API
   */
  isSupported() {
    return 'serviceWorker' in navigator && 
           'PushManager' in window && 
           'Notification' in window;
  }

  /**
   * Проверка, разрешены ли уведомления
   */
  getPermissionState() {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission; // 'granted', 'denied', 'default'
  }

  /**
   * Проверка, является ли контекст безопасным (HTTPS)
   */
  isSecureContext() {
    return window.isSecureContext;
  }

  /**
   * Регистрация Service Worker
   */
  async registerServiceWorker() {
    try {
      // Проверяем, есть ли уже активный SW
      const existingReg = await navigator.serviceWorker.getRegistration('/');
      if (existingReg && existingReg.active) {
        console.log('[Push] Using existing SW registration');
        return existingReg;
      }
      
      // Регистрируем новый
      console.log('[Push] Registering SW...');
      const registration = await navigator.serviceWorker.register('/sw.js');
      
      // Ждём активации
      if (registration.installing || registration.waiting) {
        await new Promise((resolve) => {
          const sw = registration.installing || registration.waiting;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'activated') {
              resolve();
            }
          });
          // Таймаут на случай если уже активен
          setTimeout(resolve, 1000);
        });
      }
      
      console.log('[Push] SW registered and active');
      return registration;
    } catch (err) {
      console.error('[Push] SW registration failed:', err);
      return null;
    }
  }

  /**
   * Инициализация
   */
  async init() {
    if (this.initialized) {
      return !!this.swRegistration;
    }
    
    if (!this.isSupported()) {
      console.log('[Push] Not supported');
      this.initialized = true;
      return false;
    }

    if (!this.isSecureContext()) {
      console.log('[Push] Requires HTTPS');
      this.initialized = true;
      return false;
    }

    try {
      // Регистрируем SW сами
      this.swRegistration = await this.registerServiceWorker();
      
      if (!this.swRegistration) {
        this.initialized = true;
        return false;
      }
      
      // Получаем существующую подписку
      this.subscription = await this.swRegistration.pushManager.getSubscription();
      console.log('[Push] Initialized, subscribed:', !!this.subscription);
      this.initialized = true;
      return true;
    } catch (err) {
      console.error('[Push] Init error:', err.message);
      this.initialized = true;
      return false;
    }
  }

  /**
   * Получение публичного VAPID ключа с сервера
   */
  async getVapidPublicKey() {
    try {
      const response = await fetch('/api/push/vapid-public-key');
      if (!response.ok) throw new Error('Failed to get VAPID key');
      const data = await response.json();
      return data.publicKey;
    } catch (err) {
      console.error('[Push] Failed to get VAPID key:', err);
      return null;
    }
  }

  /**
   * Конвертация base64 в Uint8Array для VAPID ключа
   */
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Подписка на уведомления
   */
  async subscribe(deviceName = 'Unknown Device') {
    if (!this.swRegistration) {
      await this.init();
    }
    
    // Проверяем что SW зарегистрирован
    if (!this.swRegistration) {
      console.error('[Push] No SW registration');
      return { success: false, error: 'Service Worker не зарегистрирован' };
    }

    // Запрашиваем разрешение
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[Push] Permission denied');
      return { success: false, error: 'Permission denied' };
    }

    try {
      // Получаем VAPID ключ
      const vapidPublicKey = await this.getVapidPublicKey();
      if (!vapidPublicKey) {
        return { success: false, error: 'Failed to get VAPID key' };
      }

      // Подписываемся
      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
      });

      // Отправляем подписку на сервер
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription, deviceName })
      });

      if (!response.ok) {
        throw new Error('Failed to save subscription');
      }

      this.subscription = subscription;
      console.log('[Push] Subscribed successfully');
      return { success: true };
    } catch (err) {
      console.error('[Push] Subscribe error:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Отписка от уведомлений
   */
  async unsubscribe() {
    if (!this.subscription) {
      return { success: true };
    }

    try {
      // Удаляем на сервере
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: this.subscription.endpoint })
      });

      // Отписываемся локально
      await this.subscription.unsubscribe();
      this.subscription = null;

      console.log('[Push] Unsubscribed');
      return { success: true };
    } catch (err) {
      console.error('[Push] Unsubscribe error:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Проверка, подписан ли пользователь
   */
  isSubscribed() {
    return !!this.subscription;
  }

  /**
   * Отправка тестового уведомления
   */
  async sendTest() {
    try {
      const response = await fetch('/api/push/test', { method: 'POST' });
      const data = await response.json();
      return data;
    } catch (err) {
      console.error('[Push] Test error:', err);
      return { sent: 0, failed: 0, error: err.message };
    }
  }

  /**
   * Получение списка подписок
   */
  async getSubscriptions() {
    try {
      const response = await fetch('/api/push/subscriptions');
      return await response.json();
    } catch (err) {
      console.error('[Push] Get subscriptions error:', err);
      return [];
    }
  }
}

// Синглтон
const pushService = new PushService();
export default pushService;
