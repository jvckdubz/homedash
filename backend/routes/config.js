const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const AdmZip = require('adm-zip');
const fetch = require('node-fetch');
const https = require('https');
const { 
  loadConfig, saveConfig, loadTemplates, saveCustomTemplates,
  loadPayments, savePayments, loadTasks, saveTasks,
  DATA_DIR, ICONS_DIR, SSH_KEYS_DIR, fetchWithSSL 
} = require('../utils/config');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Backup upload - memory storage for ZIP processing
const backupUpload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// Monitoring service reference (set by server.js)
let monitoringService = null;

// Setter for monitoring service - called from server.js
router.setMonitoringService = (service) => {
  monitoringService = service;
  console.log('[Config] Monitoring service connected');
};

// Get config
router.get('/', async (req, res) => {
  try {
    const config = await loadConfig();
    // Hide sensitive integration data
    const safeConfig = {
      ...config,
      cards: config.cards.map(card => ({
        ...card,
        integration: card.integration ? { type: card.integration.type } : null
      }))
    };
    res.json(safeConfig);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Check URL availability
router.post('/check-url', async (req, res) => {
  const { url, timeout = 5000 } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      agent: url.startsWith('https') ? httpsAgent : undefined,
      redirect: 'follow'
    });
    clearTimeout(timeoutId);
    res.json({
      available: response.ok || response.status < 500,
      status: response.status,
      statusText: response.statusText
    });
  } catch (err) {
    clearTimeout(timeoutId);
    res.json({ available: false, error: err.name === 'AbortError' ? 'Timeout' : err.message });
  }
});

// Export config as ZIP
router.get('/export', async (req, res) => {
  try {
    const config = await loadConfig();
    const templates = await loadTemplates();
    const payments = await loadPayments();
    const tasksData = await loadTasks();
    
    // Create backup data
    const backupData = {
      version: '2.1',
      exportedAt: new Date().toISOString(),
      config,
      customTemplates: templates.filter(t => !t.builtin),
      payments,
      tasks: tasksData
    };
    
    // Create ZIP archive
    const zip = new AdmZip();
    
    // Add backup.json
    zip.addFile('backup.json', Buffer.from(JSON.stringify(backupData, null, 2), 'utf8'));
    
    // Add SSH keys if they exist
    try {
      const files = await fs.readdir(SSH_KEYS_DIR);
      for (const file of files) {
        const filePath = path.join(SSH_KEYS_DIR, file);
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          const content = await fs.readFile(filePath);
          zip.addFile(`ssh_keys/${file}`, content);
        }
      }
    } catch (err) {
      console.log('[Export] No SSH keys to backup');
    }
    
    // Add custom icons if they exist
    try {
      const files = await fs.readdir(ICONS_DIR);
      for (const file of files) {
        const filePath = path.join(ICONS_DIR, file);
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          const content = await fs.readFile(filePath);
          zip.addFile(`icons/${file}`, content);
        }
      }
    } catch (err) {
      console.log('[Export] No custom icons to backup');
    }
    
    // Send ZIP file
    const zipBuffer = zip.toBuffer();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=homedash-backup-${new Date().toISOString().slice(0,10)}.zip`);
    res.send(zipBuffer);
    
  } catch (err) {
    console.error('[Export] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Import config from ZIP
router.post('/import', backupUpload.single('backup'), async (req, res) => {
  try {
    let backupData;
    
    // Check if it's a ZIP file upload
    if (req.file) {
      const zip = new AdmZip(req.file.buffer);
      const entries = zip.getEntries();
      
      // Find and parse backup.json
      const backupEntry = entries.find(e => e.entryName === 'backup.json');
      if (!backupEntry) {
        return res.status(400).json({ error: 'Invalid backup: backup.json not found' });
      }
      
      backupData = JSON.parse(backupEntry.getData().toString('utf8'));
      
      // Restore SSH keys
      const sshKeyEntries = entries.filter(e => e.entryName.startsWith('ssh_keys/') && !e.isDirectory);
      if (sshKeyEntries.length > 0) {
        await fs.mkdir(SSH_KEYS_DIR, { recursive: true });
        for (const entry of sshKeyEntries) {
          const fileName = path.basename(entry.entryName);
          const filePath = path.join(SSH_KEYS_DIR, fileName);
          await fs.writeFile(filePath, entry.getData());
          await fs.chmod(filePath, 0o600);
        }
        console.log(`[Import] Restored ${sshKeyEntries.length} SSH keys`);
      }
      
      // Restore custom icons
      const iconEntries = entries.filter(e => e.entryName.startsWith('icons/') && !e.isDirectory);
      if (iconEntries.length > 0) {
        await fs.mkdir(ICONS_DIR, { recursive: true });
        for (const entry of iconEntries) {
          const fileName = path.basename(entry.entryName);
          const filePath = path.join(ICONS_DIR, fileName);
          await fs.writeFile(filePath, entry.getData());
        }
        console.log(`[Import] Restored ${iconEntries.length} custom icons`);
      }
      
    } else if (req.body && req.body.config) {
      // Legacy JSON import
      backupData = req.body;
    } else {
      return res.status(400).json({ error: 'No backup file provided' });
    }
    
    // Validate and restore config
    const { config, customTemplates, payments, tasks } = backupData;
    
    if (!config) {
      return res.status(400).json({ error: 'Invalid backup format: no config found' });
    }
    
    await saveConfig(config);
    console.log('[Import] Config restored');
    
    if (customTemplates && customTemplates.length > 0) {
      await saveCustomTemplates(customTemplates);
      console.log(`[Import] Restored ${customTemplates.length} custom templates`);
    }
    
    if (payments) {
      await savePayments(payments);
      console.log('[Import] Payments restored');
    }
    
    if (tasks) {
      await saveTasks(tasks);
      console.log('[Import] Tasks and notes restored');
    }
    
    // Restart monitoring with restored config
    console.log('[Import] Restarting monitoring with restored config...');
    if (monitoringService) {
      try {
        // Load fresh config from disk to ensure we have the saved data
        const freshConfig = await loadConfig();
        console.log(`[Import] Fresh config loaded: ${freshConfig.cards?.length} cards, monitoring enabled: ${freshConfig.settings?.monitoring?.enabled}`);
        
        // Count cards with monitoring enabled
        const monitoredCards = (freshConfig.cards || []).filter(c => c.monitoring?.enabled);
        console.log(`[Import] Cards with monitoring enabled: ${monitoredCards.length}`);
        monitoredCards.forEach(c => {
          console.log(`[Import]   - ${c.name}: url=${c.url || 'none'}, ssh=${c.integration?.type === 'ssh' ? c.integration.host : 'none'}`);
        });
        
        monitoringService.updateConfig(freshConfig);
        await monitoringService.start(freshConfig);
        console.log('[Import] Monitoring restarted successfully');
      } catch (e) {
        console.error('[Import] Could not restart monitoring:', e.message);
      }
    } else {
      console.log('[Import] Monitoring service not available');
    }
    
    res.json({ success: true, message: 'Backup restored successfully' });
  } catch (err) {
    console.error('[Import] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
