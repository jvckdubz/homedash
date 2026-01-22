const express = require('express');
const router = express.Router();
const { loadConfig, saveConfig } = require('../utils/config');

// Reference to monitoring service (set via setMonitoringService)
let monitoringService = null;

function setMonitoringService(service) {
  monitoringService = service;
}

// Get all cards (with truncated integration data for security)
router.get('/', async (req, res) => {
  try {
    const config = await loadConfig();
    res.json(config.cards.map(card => ({
      ...card,
      integration: card.integration ? { type: card.integration.type } : null
    })));
  } catch (err) {
    console.error('[Cards] GET / error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Reorder cards - MUST be before /:id routes!
router.put('/reorder', async (req, res) => {
  try {
    const config = await loadConfig();
    const { cardIds } = req.body;
    cardIds.forEach((id, index) => {
      const card = config.cards.find(c => c.id === id);
      if (card) card.order = index;
    });
    await saveConfig(config);
    res.json({ success: true });
  } catch (err) {
    console.error('[Cards] PUT /reorder error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Create card
router.post('/', async (req, res) => {
  try {
    const config = await loadConfig();
    const newCard = {
      id: Date.now().toString(),
      ...req.body,
      order: config.cards.filter(c => c.category === req.body.category).length
    };
    config.cards.push(newCard);
    await saveConfig(config);
    
    // Start monitoring for new card if enabled
    if (newCard.monitoring?.enabled && config.settings?.monitoring?.enabled && monitoringService) {
      console.log(`[Cards] Starting monitoring for new card: ${newCard.name}`);
      monitoringService.updateConfig(config);
      monitoringService.updateCardMonitoring(newCard);
    }
    
    res.json(newCard);
  } catch (err) {
    console.error('[Cards] POST / error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get card integration (full data)
router.get('/:id/integration', async (req, res) => {
  try {
    const config = await loadConfig();
    const card = config.cards.find(c => c.id === req.params.id);
    if (card) {
      res.json(card.integration || null);
    } else {
      res.status(404).json({ error: 'Card not found' });
    }
  } catch (err) {
    console.error('[Cards] GET /:id/integration error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update card integration
router.put('/:id/integration', async (req, res) => {
  try {
    const config = await loadConfig();
    const idx = config.cards.findIndex(c => c.id === req.params.id);
    
    if (idx === -1) {
      return res.status(404).json({ error: 'Card not found' });
    }
    
    // Protect against truncated integration data
    const integrationKeys = Object.keys(req.body || {});
    if (integrationKeys.length === 1 && integrationKeys[0] === 'type') {
      console.log(`[Cards] Ignoring truncated integration data for card ${req.params.id}`);
      return res.json({ success: true, skipped: true });
    }
    
    config.cards[idx].integration = req.body;
    await saveConfig(config);
    
    res.json({ success: true });
  } catch (err) {
    console.error('[Cards] PUT /:id/integration error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update card monitoring settings
router.put('/:id/monitoring', async (req, res) => {
  try {
    const config = await loadConfig();
    const idx = config.cards.findIndex(c => c.id === req.params.id);
    
    if (idx === -1) {
      return res.status(404).json({ error: 'Card not found' });
    }
    
    config.cards[idx].monitoring = req.body;
    await saveConfig(config);
    
    // Update monitoring service
    if (monitoringService) {
      monitoringService.updateConfig(config);
      monitoringService.updateCardMonitoring(config.cards[idx]);
    }
    
    res.json({ success: true, monitoring: req.body });
  } catch (err) {
    console.error('[Cards] PUT /:id/monitoring error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update card
router.put('/:id', async (req, res) => {
  try {
    const config = await loadConfig();
    const idx = config.cards.findIndex(c => c.id === req.params.id);
    if (idx !== -1) {
      const oldCard = config.cards[idx];
      
      // Protect against overwriting integration with truncated data
      // If integration contains only type (no other fields) - ignore it
      let updateData = { ...req.body };
      if (updateData.integration) {
        const integrationKeys = Object.keys(updateData.integration);
        // If integration contains only type - this is truncated data, ignore
        if (integrationKeys.length === 1 && integrationKeys[0] === 'type') {
          console.log(`[Cards] Ignoring truncated integration data for ${oldCard.name}`);
          delete updateData.integration;
        }
      }
      
      const newCard = { ...config.cards[idx], ...updateData };
      
      // If category changed - update order
      if (oldCard.category !== newCard.category) {
        newCard.order = config.cards.filter(c => c.category === newCard.category).length;
      }
      
      config.cards[idx] = newCard;
      await saveConfig(config);
      
      // Restart monitoring if URL or monitoring settings changed
      if (monitoringService) {
        const urlChanged = oldCard.url !== newCard.url;
        const monitoringChanged = JSON.stringify(oldCard.monitoring) !== JSON.stringify(newCard.monitoring);
        const integrationChanged = JSON.stringify(oldCard.integration) !== JSON.stringify(newCard.integration);
        
        if (urlChanged || monitoringChanged || integrationChanged) {
          console.log(`[Cards] Restarting monitoring for ${newCard.name} (url/monitoring/integration changed)`);
          monitoringService.updateCardMonitoring(newCard);
        }
      }
      
      res.json(config.cards[idx]);
    } else {
      res.status(404).json({ error: 'Card not found' });
    }
  } catch (err) {
    console.error('[Cards] PUT /:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Delete card
router.delete('/:id', async (req, res) => {
  try {
    const config = await loadConfig();
    const cardId = req.params.id;
    
    // Stop monitoring before deletion
    if (monitoringService) {
      monitoringService.stopCardMonitoring(cardId);
    }
    
    config.cards = config.cards.filter(c => c.id !== cardId);
    await saveConfig(config);
    res.json({ success: true });
  } catch (err) {
    console.error('[Cards] DELETE /:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.setMonitoringService = setMonitoringService;
