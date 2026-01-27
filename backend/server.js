const express = require('express');
const cors = require('cors');
const path = require('path');

// Utils
const { initData, loadConfig, saveConfig, ICONS_DIR, IS_PRODUCTION, DATA_DIR } = require('./utils/config');

// Services
const MonitoringService = require('./services/monitoringService');

// Routes
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  if (!req.path.includes('/api/monitoring/status') && !req.path.includes('/api/integrations/')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// Static files with cache control
app.use('/icons', express.static(ICONS_DIR));

// PWA icons from persistent volume (with correct Content-Type for iOS)
const PWA_DIR = path.join(DATA_DIR, 'pwa');

// Helper function to serve PWA icons
const servePwaIcon = (filename) => (req, res) => {
  const iconPath = path.join(PWA_DIR, filename);
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day cache
  res.sendFile(iconPath, err => {
    if (err) {
      console.error(`[PWA] Icon not found: ${filename}`);
      res.status(404).send('Icon not found');
    }
  });
};

// Apple Touch Icons
app.get('/apple-touch-icon.png', servePwaIcon('apple-touch-icon.png'));
app.get('/apple-touch-icon-152.png', servePwaIcon('apple-touch-icon-152.png'));
app.get('/apple-touch-icon-120.png', servePwaIcon('apple-touch-icon-120.png'));
app.get('/apple-touch-icon-precomposed.png', servePwaIcon('apple-touch-icon.png'));

// PWA icons
app.get('/icon-192.png', servePwaIcon('icon-192.png'));
app.get('/icon-512.png', servePwaIcon('icon-512.png'));

// Disable caching for HTML and JS files to ensure updates are applied
app.use((req, res, next) => {
  if (req.path.endsWith('.html') || req.path.endsWith('.js') || req.path === '/') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Initialize monitoring service
const monitoringService = new MonitoringService();

// Connect monitoring service to routes that need it
routes.cards.setMonitoringService(monitoringService);
routes.monitoring.setMonitoringService(monitoringService);
routes.config.setMonitoringService(monitoringService);
routes.statusPage.setMonitoringService(monitoringService);

// Mount routes
app.use('/api/config', routes.config);
app.use('/api/categories', routes.categories);
app.use('/api/cards', routes.cards);
app.use('/api/payments', routes.payments);
app.use('/api/providers', routes.providers);
app.use('/api/purchases', routes.purchases);
app.use('/api/tasks', routes.tasks);
app.use('/api/notes', routes.notes);
app.use('/api/integrations', routes.integrations);
app.use('/api/monitoring', routes.monitoring);
app.use('/api/system', routes.system);
app.use('/api/icons', routes.icons);
app.use('/api/weather', routes.weather);
app.use('/api/ssh', routes.ssh);
app.use('/api/notifications', routes.notifications);
app.use('/api/discover', routes.discover);
app.use('/api/status-page', routes.statusPage);
app.use('/api/push', routes.push);

// Check URL availability (original path for frontend compatibility)
app.post('/api/check-url', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.json({ success: false, error: 'URL не указан' });
  }

  const start = Date.now();
  const fetch = require('node-fetch');
  const https = require('https');
  const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'HomeDash/1.0' },
      agent: url.startsWith('https') ? httpsAgent : undefined
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - start;

    res.json({
      success: true,
      statusCode: response.status,
      responseTime
    });
  } catch (err) {
    res.json({
      success: false,
      error: err.name === 'AbortError' ? 'Таймаут (10 сек)' : err.message,
      responseTime: Date.now() - start
    });
  }
});

// Settings endpoint (used by frontend directly)
app.put('/api/settings', async (req, res) => {
  try {
    console.log('[Settings] Saving settings:', JSON.stringify(req.body).substring(0, 200));
    
    const config = await loadConfig();
    const oldMonitoringEnabled = config.settings?.monitoring?.enabled;
    config.settings = { ...config.settings, ...req.body };
    await saveConfig(config);
    
    console.log(`[Settings] Saved. Monitoring: old=${oldMonitoringEnabled}, new=${config.settings?.monitoring?.enabled}`);
    
    // Restart monitoring if settings changed
    const newMonitoringEnabled = req.body?.monitoring?.enabled ?? config.settings?.monitoring?.enabled;
    if (oldMonitoringEnabled !== newMonitoringEnabled || req.body?.monitoring) {
      console.log('[Settings] Monitoring settings changed, restarting service...');
      const freshConfig = await loadConfig();
      await monitoringService.start(freshConfig);
    }
    
    res.json(config.settings);
  } catch (err) { 
    console.error('[Settings] Error:', err);
    res.status(500).json({ error: err.message }); 
  }
});

// Telegram test endpoint (used by monitoring settings)
app.post('/api/telegram/test', async (req, res) => {
  const { sendTelegramMessage } = require('./utils/telegram');
  try {
    const { botToken, chatId, topicId } = req.body;
    if (!botToken || !chatId) return res.status(400).json({ error: 'Bot token and chat ID required' });
    await sendTelegramMessage(botToken, chatId, 'HomeDash test message', topicId);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Ping endpoint
app.get('/api/ping', (req, res) => {
  res.json({ pong: true, timestamp: Date.now() });
});

// SSL certificate download (как в оригинале)
app.get('/api/ssl/certificate', (req, res) => {
  const fs = require('fs');
  const certPath = path.join(DATA_DIR, 'ssl', 'server.crt');
  if (fs.existsSync(certPath)) {
    res.setHeader('Content-Type', 'application/x-x509-ca-cert');
    res.setHeader('Content-Disposition', 'attachment; filename="homedash-certificate.crt"');
    res.sendFile(certPath);
  } else {
    res.status(404).json({ error: 'Certificate not found. HTTPS not enabled.' });
  }
});

// Global error handler for unhandled errors in routes
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Catch-all for SPA
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Start server
async function startServer() {
  await initData();
  await monitoringService.init();
  
  const config = await loadConfig();
  console.log(`[Server] Loaded config with ${config.cards?.length || 0} cards`);
  
  monitoringService.updateConfig(config);
  
  // Always call start - it will check if monitoring is enabled
  await monitoringService.start(config);
  
  // Restore maintenance flags from status-page config
  try {
    const statusPageFile = IS_PRODUCTION 
      ? '/app/data/status-page.json' 
      : path.join(__dirname, '../data/status-page.json');
    const fs = require('fs').promises;
    const statusPageConfig = JSON.parse(await fs.readFile(statusPageFile, 'utf8'));
    monitoringService.applyMaintenanceFlags(statusPageConfig);
  } catch {
    // Status page config doesn't exist yet - that's fine
  }
  
  // HTTPS support (certificates generated by entrypoint.sh)
  const fs = require('fs');
  const https = require('https');
  const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
  const SSL_KEY = path.join(DATA_DIR, 'ssl', 'server.key');
  const SSL_CERT = path.join(DATA_DIR, 'ssl', 'server.crt');
  
  if (fs.existsSync(SSL_KEY) && fs.existsSync(SSL_CERT)) {
    try {
      const httpsOptions = {
        key: fs.readFileSync(SSL_KEY),
        cert: fs.readFileSync(SSL_CERT)
      };
      
      https.createServer(httpsOptions, app).listen(HTTPS_PORT, '0.0.0.0', () => {
        console.log(`[Server] HTTPS server running on https://0.0.0.0:${HTTPS_PORT}`);
        console.log(`[Server] For camera access, use HTTPS: https://your-ip:${HTTPS_PORT}`);
      });
    } catch (err) {
      console.error('[Server] Failed to start HTTPS:', err.message);
    }
  } else {
    console.log('[SSL] No certificates found, HTTPS disabled');
    console.log('[SSL] To enable: put server.key and server.crt in /data/ssl/');
  }
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] HTTP server running on port ${PORT}`);
    console.log(`[Server] Environment: ${IS_PRODUCTION ? 'production' : 'development'}`);
  });
}

startServer().catch(err => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
