const express = require('express');
const router = express.Router();
const { loadConfig, loadPayments } = require('../utils/config');

// Get pending payment notifications
router.get('/pending', async (req, res) => {
  try {
    const config = await loadConfig();
    const payments = await loadPayments();
    
    if (!config.settings?.notifications?.enabled) {
      return res.json({ notifications: [] });
    }
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const notifications = [];
    
    // Check providers
    for (const provider of (payments.providers || [])) {
      if (!provider.nextPayment) continue;
      
      const paymentDate = new Date(provider.nextPayment);
      paymentDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((paymentDate - now) / (1000 * 60 * 60 * 24));
      
      const remindDays = provider.remindDays || [3, 7];
      if (remindDays.includes(daysUntil) || daysUntil <= 0) {
        notifications.push({
          id: `provider_${provider.id}_${daysUntil}`,
          type: 'payment',
          title: daysUntil <= 0 ? 'Просрочен платеж' : 'Скоро платеж',
          body: `${provider.name}: ${provider.amount} ${provider.currency}`,
          daysUntil,
          data: { providerId: provider.id, type: 'provider' }
        });
      }
    }
    
    // Check cards with billing
    for (const card of (config.cards || [])) {
      if (!card.billing?.enabled || !card.billing?.nextPayment) continue;
      
      const paymentDate = new Date(card.billing.nextPayment);
      paymentDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((paymentDate - now) / (1000 * 60 * 60 * 24));
      
      const remindDays = card.billing.remindDays || [3, 7];
      if (remindDays.includes(daysUntil) || daysUntil <= 0) {
        notifications.push({
          id: `card_${card.id}_${daysUntil}`,
          type: 'payment',
          title: daysUntil <= 0 ? 'Просрочен платеж' : 'Скоро платеж',
          body: `${card.name}: ${card.billing.amount} ${card.billing.currency}`,
          daysUntil,
          data: { cardId: card.id, type: 'card' }
        });
      }
    }
    
    res.json({ notifications });
  } catch (err) {
    console.error('[Notifications] Error:', err);
    res.json({ notifications: [] });
  }
});

module.exports = router;
