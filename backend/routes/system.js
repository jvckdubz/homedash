const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const multer = require('multer');
const AdmZip = require('adm-zip');
const { DATA_DIR, IS_PRODUCTION } = require('../utils/config');

// Docker (optional)
let Docker = null, docker = null;
try {
  Docker = require('dockerode');
  docker = new Docker({ socketPath: '/var/run/docker.sock' });
} catch (err) {}

// Build ID for update detection
const BUILD_ID = Date.now().toString(36) + Math.random().toString(36).substr(2);

// Update storage - use OS temp directory for cross-platform support
const updateStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, os.tmpdir()),
  filename: (req, file, cb) => cb(null, 'homedash-update-' + Date.now() + '.zip')
});
const updateUpload = multer({ storage: updateStorage, limits: { fileSize: 100 * 1024 * 1024 } });

// Version info
router.get('/version', async (req, res) => {
  try {
    let version = '1.0.0';
    const pkgPath = IS_PRODUCTION ? '/app/package.json' : path.join(__dirname, '..', 'package.json');
    try {
      const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
      version = pkg.version || version;
    } catch {}
    res.json({
      version, buildId: BUILD_ID, environment: IS_PRODUCTION ? 'production' : 'development',
      dockerAvailable: !!docker, nodeVersion: process.version, isProduction: IS_PRODUCTION
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Check latest version from GitHub
router.get('/check-update', async (req, res) => {
  try {
    // Get current version
    let currentVersion = '1.0.0';
    const pkgPath = IS_PRODUCTION ? '/app/package.json' : path.join(__dirname, '..', 'package.json');
    try {
      const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
      currentVersion = pkg.version || currentVersion;
    } catch {}

    // Fetch latest release from GitHub
    const https = require('https');
    const options = {
      hostname: 'api.github.com',
      path: '/repos/jvckdubz/homedash/releases/latest',
      headers: { 'User-Agent': 'HomeDash-Update-Checker' }
    };

    const fetchLatest = () => new Promise((resolve, reject) => {
      https.get(options, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try {
            if (response.statusCode === 404) {
              // No releases yet, try tags
              resolve(null);
            } else if (response.statusCode === 200) {
              resolve(JSON.parse(data));
            } else {
              reject(new Error(`GitHub API error: ${response.statusCode}`));
            }
          } catch (e) { reject(e); }
        });
      }).on('error', reject);
    });

    // Try releases first, then tags
    let latestVersion = null;
    let releaseUrl = null;
    let releaseNotes = null;
    let publishedAt = null;

    try {
      const release = await fetchLatest();
      if (release) {
        latestVersion = release.tag_name?.replace(/^v/, '') || null;
        releaseUrl = release.html_url;
        releaseNotes = release.body;
        publishedAt = release.published_at;
      }
    } catch (e) {
      console.error('GitHub API error:', e.message);
    }

    // Compare versions
    const compareVersions = (v1, v2) => {
      const parts1 = v1.split('.').map(Number);
      const parts2 = v2.split('.').map(Number);
      for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 < p2) return -1;
        if (p1 > p2) return 1;
      }
      return 0;
    };

    const hasUpdate = latestVersion && compareVersions(currentVersion, latestVersion) < 0;

    res.json({
      currentVersion,
      latestVersion,
      hasUpdate,
      releaseUrl,
      releaseNotes: releaseNotes?.substring(0, 500), // Limit notes length
      publishedAt
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Docker info with launch method detection
router.get('/docker', async (req, res) => {
  try {
    if (!docker) return res.json({ available: false });
    const info = await docker.info();
    const containers = await docker.listContainers({ all: true });
    const homedash = containers.find(c => c.Names.some(n => n.includes('homedash')));
    
    if (!homedash) {
      return res.json({ available: true, containerFound: false });
    }

    // Get container details to check labels
    const container = docker.getContainer(homedash.Id);
    const containerInfo = await container.inspect();
    const labels = containerInfo.Config?.Labels || {};

    // Detect launch method
    // docker-compose adds these labels:
    // com.docker.compose.project
    // com.docker.compose.service
    // com.docker.compose.config-hash
    const isCompose = !!(
      labels['com.docker.compose.project'] || 
      labels['com.docker.compose.service'] ||
      labels['com.docker.compose.config-hash']
    );

    const composeProject = labels['com.docker.compose.project'] || null;
    const composeWorkdir = labels['com.docker.compose.project.working_dir'] || null;

    res.json({
      available: true,
      containerFound: true,
      containerId: homedash.Id?.substring(0, 12),
      containerName: homedash.Names?.[0]?.replace('/', ''),
      image: homedash.Image,
      status: homedash.Status,
      state: homedash.State,
      dockerVersion: info.ServerVersion,
      launchMethod: isCompose ? 'compose' : 'run',
      composeProject,
      composeWorkdir
    });
  } catch (err) { res.json({ available: false, error: err.message }); }
});

// Simple update (replace files)
router.post('/update', updateUpload.single('update'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const zip = new AdmZip(req.file.path);
    const entries = zip.getEntries();
    
    // Find root folder
    let rootFolder = '';
    for (const entry of entries) {
      if (entry.entryName.includes('frontend/') || entry.entryName.includes('backend/')) {
        const parts = entry.entryName.split('/');
        if (parts.length > 1 && (parts[1] === 'frontend' || parts[1] === 'backend')) {
          rootFolder = parts[0] + '/';
        }
        break;
      }
    }
    
    const targetDir = IS_PRODUCTION ? '/app' : path.join(__dirname, '..');
    
    // Create backup
    const backupDir = path.join(DATA_DIR, 'backups');
    await fs.mkdir(backupDir, { recursive: true });
    
    // Extract files
    let updated = 0;
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      let relativePath = entry.entryName;
      if (rootFolder && relativePath.startsWith(rootFolder)) {
        relativePath = relativePath.substring(rootFolder.length);
      }
      if (!relativePath.startsWith('frontend/') && !relativePath.startsWith('backend/')) continue;
      
      const targetPath = path.join(targetDir, relativePath);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, entry.getData());
      updated++;
    }
    
    await fs.unlink(req.file.path).catch(() => {});
    res.json({ success: true, updated, message: 'Restart required' });
  } catch (err) {
    await fs.unlink(req.file.path).catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// Docker update
router.post('/docker-update', updateUpload.single('update'), async (req, res) => {
  if (!docker) return res.status(400).json({ error: 'Docker not available' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  try {
    const containers = await docker.listContainers({ all: true });
    const homedash = containers.find(c => c.Names.some(n => n.includes('homedash')));
    if (!homedash) return res.status(400).json({ error: 'HomeDash container not found' });
    
    const container = docker.getContainer(homedash.Id);
    const zip = new AdmZip(req.file.path);
    
    // Extract and copy to container
    const entries = zip.getEntries();
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      let relativePath = entry.entryName;
      // Remove root folder if present
      const parts = relativePath.split('/');
      if (parts.length > 2 && (parts[1] === 'frontend' || parts[1] === 'backend')) {
        relativePath = parts.slice(1).join('/');
      }
      if (!relativePath.startsWith('frontend/') && !relativePath.startsWith('backend/')) continue;
      
      const targetPath = '/app/' + relativePath;
      const tarStream = require('stream').Readable.from([entry.getData()]);
      await container.putArchive(tarStream, { path: path.dirname(targetPath) });
    }
    
    // Restart container
    await container.restart();
    await fs.unlink(req.file.path).catch(() => {});
    res.json({ success: true, message: 'Container restarted' });
  } catch (err) {
    await fs.unlink(req.file.path).catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// Rollback to previous version
router.post('/rollback', async (req, res) => {
  const updatesDir = path.join(DATA_DIR, 'updates');
  
  try {
    const backups = (await fs.readdir(updatesDir).catch(() => []))
      .filter(d => d.startsWith('backup-'))
      .sort()
      .reverse();
    
    if (backups.length === 0) {
      return res.status(404).json({ error: 'No backup found' });
    }

    const latestBackup = path.join(updatesDir, backups[0]);
    const targetDir = IS_PRODUCTION ? '/app' : path.join(__dirname, '..');
    
    for (const file of ['server.js', 'package.json']) {
      const backupPath = path.join(latestBackup, file);
      try {
        await fs.access(backupPath);
        await fs.copyFile(backupPath, path.join(targetDir, file));
      } catch {}
    }

    res.json({ success: true, message: 'Rollback completed. Server will restart.' });
    
    setTimeout(() => {
      process.exit(0);
    }, 2000);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
