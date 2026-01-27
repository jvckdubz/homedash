const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const multer = require('multer');
const fetch = require('node-fetch');
const https = require('https');
const { spawn } = require('child_process');
const { ICONS_DIR, fetchWithSSL } = require('../utils/config');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// SVG иконка приложения
const APP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#8b5cf6"/>
      <stop offset="100%" style="stop-color:#ec4899"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="20" fill="#202123"/>
  <path d="M15 42 L50 15 L85 42" fill="none" stroke="url(#grad)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M22 38 L22 82 A4 4 0 0 0 26 86 L74 86 A4 4 0 0 0 78 82 L78 38" fill="none" stroke="url(#grad)" stroke-width="6" stroke-linecap="round"/>
  <polyline points="32 62 40 62 45 50 55 74 60 58 68 58" fill="none" stroke="url(#grad)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Генерация PNG из SVG через ImageMagick
async function generatePng(size) {
  return new Promise((resolve, reject) => {
    const convert = spawn('convert', [
      '-background', 'none',
      '-density', '300',
      'svg:-',
      '-resize', `${size}x${size}`,
      'png:-'
    ]);
    
    const chunks = [];
    convert.stdout.on('data', chunk => chunks.push(chunk));
    convert.stderr.on('data', data => console.error('[Icons] convert stderr:', data.toString()));
    convert.on('close', code => {
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`convert exited with code ${code}`));
      }
    });
    convert.on('error', reject);
    
    convert.stdin.write(APP_ICON_SVG);
    convert.stdin.end();
  });
}

// PWA иконка - динамическая генерация
router.get('/pwa/:size.png', async (req, res) => {
  const size = parseInt(req.params.size) || 192;
  if (size < 16 || size > 1024) {
    return res.status(400).send('Invalid size');
  }
  
  try {
    const png = await generatePng(size);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.send(png);
  } catch (err) {
    console.error('[Icons] PNG generation failed:', err.message);
    // Fallback - отдаём SVG
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(APP_ICON_SVG);
  }
});

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
