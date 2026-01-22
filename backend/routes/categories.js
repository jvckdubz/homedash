const express = require('express');
const router = express.Router();
const { loadConfig, saveConfig } = require('../utils/config');

// Get all categories
router.get('/', async (req, res) => {
  try {
    const config = await loadConfig();
    res.json(config.categories || []);
  } catch (err) {
    console.error('[Categories] GET / error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Create category
router.post('/', async (req, res) => {
  try {
    const config = await loadConfig();
    const newCategory = {
      id: Date.now().toString(),
      ...req.body,
      order: config.categories.length
    };
    config.categories.push(newCategory);
    await saveConfig(config);
    res.json(newCategory);
  } catch (err) {
    console.error('[Categories] POST / error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update category
router.put('/:id', async (req, res) => {
  try {
    const config = await loadConfig();
    const idx = config.categories.findIndex(c => c.id === req.params.id);
    if (idx !== -1) {
      config.categories[idx] = { ...config.categories[idx], ...req.body };
      await saveConfig(config);
      res.json(config.categories[idx]);
    } else {
      res.status(404).json({ error: 'Category not found' });
    }
  } catch (err) {
    console.error('[Categories] PUT /:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Delete category
router.delete('/:id', async (req, res) => {
  try {
    const config = await loadConfig();
    config.categories = config.categories.filter(c => c.id !== req.params.id);
    // Also remove cards in this category
    config.cards = config.cards.filter(c => c.category !== req.params.id);
    await saveConfig(config);
    res.json({ success: true });
  } catch (err) {
    console.error('[Categories] DELETE /:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
