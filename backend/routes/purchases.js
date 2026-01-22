const express = require('express');
const router = express.Router();
const { loadPayments, savePayments } = require('../utils/config');

router.get('/', async (req, res) => {
  try {
    const payments = await loadPayments();
    res.json(payments.purchases || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, amount, currency, date, note, category } = req.body;
    if (!name || !amount) return res.status(400).json({ error: 'Name and amount required' });
    const payments = await loadPayments();
    if (!payments.purchases) payments.purchases = [];
    const purchase = {
      id: Date.now().toString(), name, amount: parseFloat(amount),
      currency: currency || 'RUB', date: date || new Date().toISOString().split('T')[0],
      note: note || '', category: category || 'other', createdAt: new Date().toISOString()
    };
    payments.purchases.push(purchase);
    await savePayments(payments);
    res.json(purchase);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const payments = await loadPayments();
    payments.purchases = (payments.purchases || []).filter(p => p.id !== req.params.id);
    await savePayments(payments);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
