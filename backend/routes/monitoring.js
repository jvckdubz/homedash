const express = require('express');
const router = express.Router();
const { loadConfig, saveConfig } = require('../utils/config');
const { sendTelegramMessage } = require('../utils/telegram');

let monitoringService = null;

function setMonitoringService(service) { 
  monitoringService = service; 
}

// Get all monitoring statuses
router.get('/status', (req, res) => {
  try {
    res.json(monitoringService ? monitoringService.getAllStatuses() : {});
  } catch (err) {
    console.error('[Monitoring] GET /status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get monitoring status for specific card
router.get('/status/:cardId', (req, res) => {
  try {
    const status = monitoringService ? monitoringService.getCardStatus(req.params.cardId) : { status: 'unknown' };
    res.json(status);
  } catch (err) {
    console.error('[Monitoring] GET /status/:cardId error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get monitoring history for card (with pagination)
router.get('/history/:cardId', (req, res) => {
  try {
    const { cardId } = req.params;
    const { limit = 100, offset = 0, period = '24h' } = req.query;
    
    const cardHistory = monitoringService?.history?.[cardId];
    if (!cardHistory) {
      return res.json({ checks: [], stats: null });
    }

    const now = Date.now();
    const periods = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    const cutoff = now - (periods[period] || periods['24h']);
    let checks = (cardHistory.checks || []).filter(c => c.timestamp > cutoff);
    
    // Apply pagination
    const total = checks.length;
    checks = checks.slice(-parseInt(limit)).reverse(); // last N, newest first

    res.json({
      checks,
      total,
      stats: cardHistory.stats,
      lastCheck: cardHistory.lastCheck,
      currentStatus: cardHistory.currentStatus
    });
  } catch (err) {
    console.error('[Monitoring] GET /history/:cardId error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Force check a card now
router.post('/check/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;
    
    const config = await loadConfig();
    const card = config.cards.find(c => c.id === cardId);
    
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    if (!card.url) {
      return res.status(400).json({ error: 'Card has no URL' });
    }

    const timeout = config.settings?.monitoring?.timeout || 10;
    const result = await monitoringService.checkUrl(card.url, timeout * 1000);

    res.json(result);
  } catch (err) {
    console.error('[Monitoring] POST /check/:cardId error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Clear monitoring history for a card
router.delete('/history/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;
    
    if (monitoringService?.history?.[cardId]) {
      monitoringService.history[cardId] = { checks: [], stats: {} };
      delete monitoringService.lastStatus[cardId];
      await monitoringService.saveHistory();
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Monitoring] DELETE /history/:cardId error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get monitoring global settings
router.get('/settings', async (req, res) => {
  try {
    const config = await loadConfig();
    res.json({
      monitoring: config.settings?.monitoring || {},
      telegram: {
        enabled: config.settings?.telegram?.enabled || false,
        chatId: config.settings?.telegram?.chatId || '',
        notifyDown: config.settings?.telegram?.notifyDown ?? true,
        notifyUp: config.settings?.telegram?.notifyUp ?? true,
        notifyDegraded: config.settings?.telegram?.notifyDegraded ?? false,
        hasToken: Boolean(config.settings?.telegram?.botToken)
      }
    });
  } catch (err) {
    console.error('[Monitoring] GET /settings error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update monitoring global settings
router.put('/settings', async (req, res) => {
  const { monitoring, telegram } = req.body;

  try {
    const config = await loadConfig();
    
    if (monitoring) {
      config.settings.monitoring = {
        ...config.settings.monitoring,
        ...monitoring
      };
    }

    if (telegram) {
      config.settings.telegram = {
        ...config.settings.telegram,
        ...telegram
      };
    }

    await saveConfig(config);

    // Restart monitoring with new settings
    if (monitoringService) {
      await monitoringService.restart(config);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Monitoring] PUT /settings error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Test Telegram connection
router.post('/telegram/test', async (req, res) => {
  const { botToken, chatId, topicId, message } = req.body;

  if (!botToken || !chatId) {
    return res.status(400).json({ error: 'botToken and chatId required' });
  }

  try {
    await sendTelegramMessage(
      botToken, 
      chatId, 
      message || 'HomeDash test - connection successful!',
      topicId
    );
    res.json({ success: true, message: 'Test message sent' });
  } catch (err) {
    console.error('[Monitoring] POST /telegram/test error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// Test daily report
router.post('/telegram/test-daily-report', async (req, res) => {
  try {
    if (!monitoringService) {
      return res.status(500).json({ error: 'Monitoring service not initialized' });
    }
    await monitoringService.sendDailyReport();
    res.json({ success: true, message: 'Daily report sent' });
  } catch (err) {
    console.error('[Monitoring] POST /telegram/test-daily-report error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
module.exports.setMonitoringService = setMonitoringService;
