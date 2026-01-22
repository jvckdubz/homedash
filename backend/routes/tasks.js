const express = require('express');
const router = express.Router();
const { loadTasks, saveTasks } = require('../utils/config');

// ============ TASKS ============
router.get('/', async (req, res) => {
  try {
    const data = await loadTasks();
    res.json(data.tasks || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { title, description, dueDate, priority } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const data = await loadTasks();
    if (!data.tasks) data.tasks = [];
    const task = {
      id: Date.now().toString(), title, description: description || '',
      dueDate: dueDate || null, priority: priority || 'medium',
      completed: false, order: data.tasks.length, createdAt: new Date().toISOString()
    };
    data.tasks.push(task);
    await saveTasks(data);
    res.json(task);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// IMPORTANT: /reorder MUST be before /:id to avoid matching "reorder" as an ID
router.put('/reorder', async (req, res) => {
  try {
    const { taskIds } = req.body;
    const data = await loadTasks();
    taskIds.forEach((id, index) => {
      const task = data.tasks.find(t => t.id === id);
      if (task) task.order = index;
    });
    await saveTasks(data);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const data = await loadTasks();
    const idx = data.tasks.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Task not found' });
    data.tasks[idx] = { ...data.tasks[idx], ...req.body, updatedAt: new Date().toISOString() };
    await saveTasks(data);
    res.json(data.tasks[idx]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const data = await loadTasks();
    data.tasks = (data.tasks || []).filter(t => t.id !== req.params.id);
    await saveTasks(data);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
