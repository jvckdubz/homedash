const express = require('express');
const router = express.Router();
const { loadPayments, savePayments, loadConfig, saveConfig } = require('../utils/config');

// Helper: group payments by currency
function groupByCurrency(items, amountField = 'amount') {
  const groups = {};
  items.forEach(item => {
    const currency = item.currency || 'RUB';
    if (!groups[currency]) groups[currency] = { total: 0, count: 0, items: [] };
    groups[currency].total += parseFloat(item[amountField]) || 0;
    groups[currency].count++;
    groups[currency].items.push(item);
  });
  return groups;
}

// ============ PAYMENTS STATS & HISTORY ============
router.get('/stats', async (req, res) => {
  try {
    const payments = await loadPayments();
    const config = await loadConfig();
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
    
    // Next month boundaries for forecast
    const nextMonth = thisMonth === 11 ? 0 : thisMonth + 1;
    const nextMonthYear = thisMonth === 11 ? thisYear + 1 : thisYear;
    const nextMonthStart = new Date(nextMonthYear, nextMonth, 1);
    const nextMonthEnd = new Date(nextMonthYear, nextMonth + 1, 0, 23, 59, 59);
    
    // This month payments from history (only paid items count)
    const thisMonthPayments = (payments.history || []).filter(p => {
      const d = new Date(p.paidAt);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });
    const thisMonthByCurrency = groupByCurrency(thisMonthPayments);
    
    // Last month payments from history
    const lastMonthPayments = (payments.history || []).filter(p => {
      const d = new Date(p.paidAt);
      return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    });
    const lastMonthByCurrency = groupByCurrency(lastMonthPayments);
    
    // Forecast - upcoming payments in NEXT MONTH only (not current month)
    const forecastItems = [];
    
    // From providers
    (payments.providers || []).forEach(p => {
      if (p.nextPayment) {
        const nextDate = new Date(p.nextPayment);
        // Only include if nextPayment is in next month
        if (nextDate >= nextMonthStart && nextDate <= nextMonthEnd) {
          forecastItems.push({
            name: p.name,
            amount: parseFloat(p.amount) || 0,
            date: p.nextPayment,
            currency: p.currency || 'RUB'
          });
        }
      }
    });
    
    // From cards with billing
    (config.cards || []).forEach(c => {
      if (c.billing?.enabled && c.billing?.nextPayment) {
        const nextDate = new Date(c.billing.nextPayment);
        // Only include if nextPayment is in next month
        if (nextDate >= nextMonthStart && nextDate <= nextMonthEnd) {
          forecastItems.push({
            name: c.name,
            amount: parseFloat(c.billing.amount) || 0,
            date: c.billing.nextPayment,
            currency: c.billing.currency || 'RUB'
          });
        }
      }
    });
    
    // Sort forecast items by date
    forecastItems.sort((a, b) => new Date(a.date) - new Date(b.date));
    const forecastByCurrency = groupByCurrency(forecastItems);
    
    // Year total (from history only - actual paid amounts)
    const yearPayments = (payments.history || []).filter(p => {
      const d = new Date(p.paidAt);
      return d.getFullYear() === thisYear;
    });
    const yearByCurrency = groupByCurrency(yearPayments);
    
    // Build response with RUB as primary and others separate
    const rubThisMonth = thisMonthByCurrency['RUB'] || { total: 0, count: 0 };
    const rubLastMonth = lastMonthByCurrency['RUB'] || { total: 0, count: 0 };
    const rubForecast = forecastByCurrency['RUB'] || { total: 0, count: 0, items: [] };
    const rubYear = yearByCurrency['RUB'] || { total: 0, count: 0 };
    
    // Other currencies
    const otherCurrencies = [...new Set([
      ...Object.keys(thisMonthByCurrency),
      ...Object.keys(lastMonthByCurrency),
      ...Object.keys(forecastByCurrency),
      ...Object.keys(yearByCurrency)
    ])].filter(c => c !== 'RUB');
    
    const otherStats = otherCurrencies.map(currency => ({
      currency,
      thisMonth: thisMonthByCurrency[currency] || { total: 0, count: 0 },
      lastMonth: lastMonthByCurrency[currency] || { total: 0, count: 0 },
      forecast: forecastByCurrency[currency] || { total: 0, count: 0, items: [] },
      year: yearByCurrency[currency] || { total: 0, count: 0 }
    }));
    
    // Get next month name for display
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    
    res.json({
      // RUB stats (primary)
      thisMonth: {
        total: rubThisMonth.total,
        count: rubThisMonth.count
      },
      lastMonth: {
        total: rubLastMonth.total,
        count: rubLastMonth.count
      },
      forecast: {
        total: rubForecast.total,
        items: rubForecast.items || [],
        monthName: monthNames[nextMonth]
      },
      yearTotal: rubYear.total,
      yearCount: rubYear.count,
      
      // Other currencies
      otherCurrencies: otherStats,
      
      // Legacy fields for compatibility
      monthlyEstimate: Math.round(rubForecast.total),
      upcomingCount: forecastItems.length,
      upcomingTotal: Math.round(forecastItems.reduce((s, i) => s + i.amount, 0)),
      paidThisMonth: Math.round(rubThisMonth.total),
      totalProviders: payments.providers?.length || 0,
      totalCards: config.cards?.filter(c => c.billing?.enabled).length || 0
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/history', async (req, res) => {
  try {
    const payments = await loadPayments();
    res.json((payments.history || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/history/:id', async (req, res) => {
  try {
    const payments = await loadPayments();
    payments.history = (payments.history || []).filter(h => h.id !== req.params.id);
    await savePayments(payments);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============ QR CODES ============
router.post('/:cardId/qr', async (req, res) => {
  try {
    const { cardId } = req.params;
    const { name, data, type } = req.body;
    if (!data) return res.status(400).json({ error: 'QR data required' });
    const payments = await loadPayments();
    if (!payments.qrCodes) payments.qrCodes = {};
    if (!payments.qrCodes[cardId]) payments.qrCodes[cardId] = [];
    const qrCode = { id: Date.now().toString(), name: name || 'QR', data, type: type || 'payment', createdAt: new Date().toISOString() };
    payments.qrCodes[cardId].push(qrCode);
    await savePayments(payments);
    res.json(qrCode);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:cardId/qr', async (req, res) => {
  try {
    const payments = await loadPayments();
    res.json(payments.qrCodes?.[req.params.cardId] || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:cardId/qr/:qrId', async (req, res) => {
  try {
    const payments = await loadPayments();
    if (payments.qrCodes?.[req.params.cardId]) {
      payments.qrCodes[req.params.cardId] = payments.qrCodes[req.params.cardId].filter(qr => qr.id !== req.params.qrId);
      await savePayments(payments);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Card billing payment
router.post('/:cardId/pay', async (req, res) => {
  try {
    const { actualAmount, paidAt } = req.body;
    const config = await loadConfig();
    const card = config.cards.find(c => c.id === req.params.cardId);
    if (!card || !card.billing?.enabled) return res.status(404).json({ error: 'Card or billing not found' });
    
    const payments = await loadPayments();
    if (!payments.history) payments.history = [];
    payments.history.push({
      id: Date.now().toString(), type: 'card', cardId: req.params.cardId, cardName: card.name,
      amount: actualAmount || card.billing.amount, currency: card.billing.currency,
      paidAt: paidAt || new Date().toISOString(),
      period: card.billing.period, createdAt: new Date().toISOString()
    });
    await savePayments(payments);
    
    // Calculate next payment
    const currentDate = new Date(card.billing.nextPayment);
    let nextDate = new Date(currentDate);
    switch (card.billing.period) {
      case 'weekly': nextDate.setDate(nextDate.getDate() + 7); break;
      case 'monthly': nextDate.setMonth(nextDate.getMonth() + 1); break;
      case 'quarterly': nextDate.setMonth(nextDate.getMonth() + 3); break;
      case 'yearly': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
      default: nextDate.setMonth(nextDate.getMonth() + 1);
    }
    card.billing.nextPayment = nextDate.toISOString().split('T')[0];
    await saveConfig(config);
    
    res.json({ success: true, nextPayment: card.billing.nextPayment });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
