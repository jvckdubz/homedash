const express = require('express');
const router = express.Router();
const { loadPayments, savePayments } = require('../utils/config');

router.get('/', async (req, res) => {
  try {
    const payments = await loadPayments();
    res.json(payments.providers || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, icon, color, amount, currency, period, nextPayment, note, url, linkedCardId, remindDays } = req.body;
    if (!name || !amount || !nextPayment) return res.status(400).json({ error: 'Name, amount and nextPayment required' });
    const payments = await loadPayments();
    if (!payments.providers) payments.providers = [];
    const provider = {
      id: Date.now().toString(), name, icon: icon || 'receipt', color: color || '#8b5cf6',
      amount: parseFloat(amount), currency: currency || 'RUB', period: period || 'monthly',
      nextPayment, note: note || '', url: url || '', linkedCardId: linkedCardId || null,
      remindDays: remindDays || [], createdAt: new Date().toISOString()
    };
    payments.providers.push(provider);
    await savePayments(payments);
    res.json(provider);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const payments = await loadPayments();
    const idx = payments.providers.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Provider not found' });
    payments.providers[idx] = { ...payments.providers[idx], ...req.body };
    await savePayments(payments);
    res.json(payments.providers[idx]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const payments = await loadPayments();
    payments.providers = (payments.providers || []).filter(p => p.id !== req.params.id);
    delete payments.qrCodes?.['provider_' + req.params.id];
    await savePayments(payments);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/pay', async (req, res) => {
  try {
    const { actualAmount, paidAt } = req.body;
    const payments = await loadPayments();
    const idx = payments.providers.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Provider not found' });
    
    const provider = payments.providers[idx];
    if (!payments.history) payments.history = [];
    payments.history.push({
      id: Date.now().toString(), type: 'provider', providerId: req.params.id,
      providerName: provider.name, amount: actualAmount || provider.amount,
      currency: provider.currency, paidAt: paidAt || new Date().toISOString(),
      period: provider.period, createdAt: new Date().toISOString()
    });
    
    // Calculate next payment
    const currentDate = new Date(provider.nextPayment);
    let nextDate = new Date(currentDate);
    switch (provider.period) {
      case 'weekly': nextDate.setDate(nextDate.getDate() + 7); break;
      case 'monthly': nextDate.setMonth(nextDate.getMonth() + 1); break;
      case 'quarterly': nextDate.setMonth(nextDate.getMonth() + 3); break;
      case 'yearly': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
      default: nextDate.setMonth(nextDate.getMonth() + 1);
    }
    payments.providers[idx].nextPayment = nextDate.toISOString().split('T')[0];
    await savePayments(payments);
    
    res.json({ success: true, nextPayment: payments.providers[idx].nextPayment });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
