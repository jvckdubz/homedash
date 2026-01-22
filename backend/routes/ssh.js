const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const multer = require('multer');
const { Client: SSHClient, utils: sshUtils } = require('ssh2');
const { SSH_KEYS_DIR } = require('../utils/config');

// SSH key upload storage
const sshKeyStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(SSH_KEYS_DIR, { recursive: true });
      cb(null, SSH_KEYS_DIR);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, safeName);
  }
});

const uploadSSHKey = multer({ 
  storage: sshKeyStorage,
  limits: { fileSize: 16384 }
});

// SSH exec helper
const sshExec = (config, command, timeout = 10000) => {
  return new Promise((resolve, reject) => {
    const conn = new SSHClient();
    let output = '', errorOutput = '';
    const timeoutId = setTimeout(() => { conn.end(); reject(new Error('SSH timeout')); }, timeout);
    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) { clearTimeout(timeoutId); conn.end(); return reject(err); }
        stream.on('close', (code) => {
          clearTimeout(timeoutId); conn.end();
          if (code === 0 || output) resolve(output.trim());
          else reject(new Error(errorOutput || 'Command failed'));
        }).on('data', d => output += d).stderr.on('data', d => errorOutput += d);
      });
    }).on('error', err => { clearTimeout(timeoutId); reject(err); }).connect(config);
  });
};

// List SSH keys
router.get('/keys', async (req, res) => {
  try {
    await fs.mkdir(SSH_KEYS_DIR, { recursive: true });
    const files = await fs.readdir(SSH_KEYS_DIR);
    const keys = [];
    
    for (const file of files) {
      const stat = await fs.stat(path.join(SSH_KEYS_DIR, file));
      keys.push({
        name: file,
        size: stat.size,
        modified: stat.mtime
      });
    }
    
    res.json(keys);
  } catch (err) {
    res.json([]);
  }
});

// Upload SSH key
router.post('/keys', uploadSSHKey.single('key'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  res.json({ 
    success: true, 
    name: req.file.filename,
    message: `Key "${req.file.filename}" uploaded successfully`
  });
});

// Delete SSH key
router.delete('/keys/:name', async (req, res) => {
  try {
    const keyPath = path.join(SSH_KEYS_DIR, req.params.name);
    await fs.unlink(keyPath);
    res.json({ success: true });
  } catch (err) {
    res.status(404).json({ error: 'Key not found' });
  }
});

// Get SSH keys for specific host
router.get('/keys/host/:host', async (req, res) => {
  try {
    const sanitizedHost = req.params.host.replace(/[^a-zA-Z0-9.-]/g, '_');
    await fs.mkdir(SSH_KEYS_DIR, { recursive: true });
    const files = await fs.readdir(SSH_KEYS_DIR);
    const matchingKeys = files.filter(f => f.includes(sanitizedHost) && !f.endsWith('.pub'));
    
    res.json({
      found: matchingKeys.length > 0,
      keys: matchingKeys
    });
  } catch (err) {
    res.json({ found: false, keys: [] });
  }
});

// Delete all SSH keys for a host
router.delete('/keys/host/:host', async (req, res) => {
  try {
    const sanitizedHost = req.params.host.replace(/[^a-zA-Z0-9.-]/g, '_');
    await fs.mkdir(SSH_KEYS_DIR, { recursive: true });
    const files = await fs.readdir(SSH_KEYS_DIR);
    const matchingFiles = files.filter(f => f.includes(sanitizedHost));
    
    let deleted = 0;
    for (const file of matchingFiles) {
      await fs.unlink(path.join(SSH_KEYS_DIR, file));
      deleted++;
    }
    
    console.log(`[SSH] Deleted ${deleted} key files for host ${req.params.host}`);
    res.json({ success: true, deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test SSH connection
router.post('/test', async (req, res) => {
  const { host, port = 22, username, password, privateKey } = req.body;
  
  try {
    const sshConfig = {
      host,
      port: parseInt(port),
      username,
      readyTimeout: 10000
    };

    if (privateKey) {
      if (privateKey.startsWith('-----')) {
        sshConfig.privateKey = privateKey;
      } else {
        const keyPath = path.join(SSH_KEYS_DIR, privateKey);
        sshConfig.privateKey = await fs.readFile(keyPath, 'utf8');
      }
    } else if (password) {
      sshConfig.password = password;
    }

    const result = await sshExec(sshConfig, 'hostname');
    res.json({ success: true, hostname: result });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Auto-setup SSH keys
router.post('/setup', async (req, res) => {
  const { host, port = 22, username, password, force = false } = req.body;
  
  if (!host || !username || !password) {
    return res.status(400).json({ success: false, error: 'Host, username and password are required' });
  }

  try {
    await fs.mkdir(SSH_KEYS_DIR, { recursive: true });
    
    const sanitizedHost = host.replace(/[^a-zA-Z0-9.-]/g, '_');
    const existingFiles = await fs.readdir(SSH_KEYS_DIR);
    const existingKey = existingFiles.find(f => f.includes(sanitizedHost) && !f.endsWith('.pub'));
    
    if (existingKey && !force) {
      console.log(`[SSH Setup] Found existing key for ${host}: ${existingKey}, testing...`);
      try {
        const existingKeyPath = path.join(SSH_KEYS_DIR, existingKey);
        const existingPrivateKey = await fs.readFile(existingKeyPath, 'utf8');
        
        await sshExec({
          host,
          port: parseInt(port),
          username,
          privateKey: existingPrivateKey,
          readyTimeout: 10000
        }, 'echo "Key auth successful"');
        
        console.log(`[SSH Setup] Existing key works! Using: ${existingKey}`);
        return res.json({
          success: true,
          keyName: existingKey,
          message: `Existing key works: ${existingKey}`,
          existing: true
        });
      } catch (testErr) {
        console.log(`[SSH Setup] Existing key failed: ${testErr.message}, will create new`);
      }
    }
    
    const keyName = `homedash_${sanitizedHost}_${Date.now()}`;
    const privateKeyPath = path.join(SSH_KEYS_DIR, keyName);
    const publicKeyPath = path.join(SSH_KEYS_DIR, `${keyName}.pub`);
    
    console.log(`[SSH Setup] Generating keypair for ${username}@${host}...`);
    
    const keyPair = sshUtils.generateKeyPairSync('ed25519', {
      comment: `homedash@${host}`
    });
    
    const privateKeyPEM = keyPair.private;
    const publicKeySSH = keyPair.public;
    
    console.log(`[SSH Setup] Connecting to ${host} with password...`);
    
    await new Promise((resolve, reject) => {
      const conn = new SSHClient();
      
      const timeout = setTimeout(() => {
        conn.end();
        reject(new Error('Connection timeout'));
      }, 60000);
      
      conn.on('ready', () => {
        console.log(`[SSH Setup] Connected, installing public key...`);
        
        const commands = [
          'mkdir -p ~/.ssh',
          'chmod 700 ~/.ssh',
          'touch ~/.ssh/authorized_keys',
          'chmod 600 ~/.ssh/authorized_keys',
          `echo "${publicKeySSH}" >> ~/.ssh/authorized_keys`,
          'sort -u ~/.ssh/authorized_keys -o ~/.ssh/authorized_keys',
          'echo "done"'
        ].join(' && ');
        
        conn.exec(commands, (err, stream) => {
          if (err) {
            clearTimeout(timeout);
            conn.end();
            return reject(err);
          }
          
          let stderr = '';
          let stdout = '';
          
          stream.on('data', (data) => { stdout += data.toString(); });
          stream.stderr.on('data', (data) => { stderr += data.toString(); });
          
          stream.on('close', (code) => {
            clearTimeout(timeout);
            conn.end();
            if (code === 0 || stdout.includes('done')) {
              resolve();
            } else {
              reject(new Error(stderr || `Command failed with code ${code}`));
            }
          });
        });
      }).on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      }).connect({
        host,
        port: parseInt(port),
        username,
        password,
        readyTimeout: 30000
      });
    });
    
    console.log(`[SSH Setup] Public key installed, saving private key...`);
    
    await fs.writeFile(privateKeyPath, privateKeyPEM, { mode: 0o600 });
    await fs.writeFile(publicKeyPath, publicKeySSH, { mode: 0o644 });
    
    console.log(`[SSH Setup] Testing key-based authentication...`);
    
    await sshExec({
      host,
      port: parseInt(port),
      username,
      privateKey: privateKeyPEM,
      readyTimeout: 10000
    }, 'echo "Key auth successful"');
    
    console.log(`[SSH Setup] Success! Key: ${keyName}`);
    
    res.json({
      success: true,
      keyName,
      message: `SSH key created and installed on ${host}`
    });
    
  } catch (err) {
    console.error('[SSH Setup] Error:', err.message);
    res.json({ success: false, error: err.message });
  }
});

module.exports = router;
