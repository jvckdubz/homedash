const express = require('express');
const router = express.Router();
const { loadTasks, saveTasks } = require('../utils/config');

router.get('/', async (req, res) => {
  try {
    const data = await loadTasks();
    res.json(data.notes || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { title, content, color } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const data = await loadTasks();
    if (!data.notes) data.notes = [];
    const note = {
      id: Date.now().toString(), title, content: content || '',
      color: color || '#fbbf24', createdAt: new Date().toISOString()
    };
    data.notes.push(note);
    await saveTasks(data);
    res.json(note);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const data = await loadTasks();
    const idx = data.notes.findIndex(n => n.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Note not found' });
    data.notes[idx] = { ...data.notes[idx], ...req.body, updatedAt: new Date().toISOString() };
    await saveTasks(data);
    res.json(data.notes[idx]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const data = await loadTasks();
    data.notes = (data.notes || []).filter(n => n.id !== req.params.id);
    await saveTasks(data);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
