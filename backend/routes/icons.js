const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const multer = require('multer');
const fetch = require('node-fetch');
const https = require('https');
const { ICONS_DIR, fetchWithSSL } = require('../utils/config');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Icon upload storage
const iconStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ICONS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, 'icon-' + Date.now() + ext);
  }
});
const upload = multer({ storage: iconStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// Upload icon
router.post('/upload', upload.single('icon'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ filename: req.file.filename, path: '/icons/' + req.file.filename });
});

// Fetch favicon from URL
router.post('/fetch-favicon', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  
  try {
    const urlObj = new URL(url);
    const baseUrl = urlObj.origin;
    
    // Try multiple favicon locations
    const locations = [
      '/favicon.ico',
      '/favicon.png',
      '/apple-touch-icon.png',
      '/apple-touch-icon-precomposed.png'
    ];
    
    // Also try to parse HTML for favicon link
    try {
      const htmlResponse = await fetchWithSSL(url, { timeout: 5000 });
      const html = await htmlResponse.text();
      const matches = html.match(/<link[^>]*rel=["'](?:icon|shortcut icon|apple-touch-icon)[^>]*href=["']([^"']+)["']/gi);
      if (matches) {
        for (const match of matches) {
          const href = match.match(/href=["']([^"']+)["']/i);
          if (href && href[1]) {
            const faviconUrl = href[1].startsWith('http') ? href[1] : new URL(href[1], baseUrl).href;
            locations.unshift(faviconUrl.replace(baseUrl, ''));
          }
        }
      }
    } catch {}
    
    // Try each location
    for (const loc of locations) {
      try {
        const faviconUrl = loc.startsWith('http') ? loc : baseUrl + loc;
        const response = await fetchWithSSL(faviconUrl, { timeout: 5000 });
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && (contentType.includes('image') || contentType.includes('icon'))) {
            const buffer = await response.buffer();
            if (buffer.length > 100) { // Minimum valid image size
              const ext = contentType.includes('png') ? '.png' : 
                         contentType.includes('svg') ? '.svg' : '.ico';
              const filename = 'favicon-' + Date.now() + ext;
              await fs.writeFile(path.join(ICONS_DIR, filename), buffer);
              return res.json({ success: true, filename, path: '/icons/' + filename });
            }
          }
        }
      } catch {}
    }
    
    res.status(404).json({ error: 'No favicon found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
