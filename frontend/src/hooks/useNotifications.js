import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';

function useNotifications(enabled) {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const lastCheckRef = useRef(null);
  const shownNotificationsRef = useRef(new Set());

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') {
      return 'denied';
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch {
      return 'denied';
    }
  };

  const showNotification = (title, options = {}) => {
    if (permission !== 'granted') return;
    
    // Prevent duplicate notifications
    const notifId = `${title}-${options.tag || Date.now()}`;
    if (shownNotificationsRef.current.has(notifId)) return;
    shownNotificationsRef.current.add(notifId);
    
    // Clean old IDs after 1 hour
    setTimeout(() => shownNotificationsRef.current.delete(notifId), 3600000);

    try {
      const notification = new Notification(title, {
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        ...options
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        if (options.url) {
          window.location.href = options.url;
        }
      };

      // Auto-close after 10 seconds
      setTimeout(() => notification.close(), 10000);
    } catch (err) {
      console.error('[Notifications] Error:', err);
    }
  };

  // Check for upcoming payments
  useEffect(() => {
    if (!enabled || permission !== 'granted') return;

    const checkPayments = async () => {
      try {
        const data = await api.get('/api/notifications/pending');
        if (data?.notifications?.length > 0) {
          data.notifications.forEach(notif => {
            showNotification(notif.title, {
              body: notif.body,
              tag: notif.id,
              data: notif
            });
          });
        }
      } catch (err) {
        console.error('[Notifications] Check failed:', err);
      }
    };

    // Check immediately and then every 30 minutes
    checkPayments();
    const interval = setInterval(checkPayments, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [enabled, permission]);

  return { permission, requestPermission, showNotification };
}

// Notifications Settings Component
export default useNotifications;
