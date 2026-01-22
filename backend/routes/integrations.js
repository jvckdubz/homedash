const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const https = require('https');
const { Client: SSHClient } = require('ssh2');
const { 
  loadConfig, saveConfig, SSH_KEYS_DIR, DATA_DIR, TEMPLATES_FILE, fetchWithSSL 
} = require('../utils/config');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Helper: get host from card
const getIntegrationHost = (card) => {
  let host = card?.integration?.host || card?.url || null;
  if (host) host = host.replace(/\/+$/, '');
  return host;
};

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

// Get SSH stats for SSH integration card (original implementation)
const getSSHStats = async (sshConfig) => {
  return new Promise((resolve, reject) => {
    const conn = new SSHClient();
    const stats = {};
    let commandsCompleted = 0;
    const totalCommands = 5;
    
    const commands = {
      uptime: "cat /proc/uptime | awk '{print $1}'",
      loadavg: "cat /proc/loadavg",
      memory: "cat /proc/meminfo | grep -E '^(MemTotal|MemAvailable|MemFree|Buffers|Cached):' | awk '{print $1, $2}'",
      disk: "df -B1 / | tail -1 | awk '{print $2, $3, $4, $5}'",
      cpu: "grep -c ^processor /proc/cpuinfo && head -1 /proc/stat"
    };

    const timeoutId = setTimeout(() => {
      conn.end();
      reject(new Error('SSH connection timeout'));
    }, 15000);

    conn.on('ready', () => {
      // Execute all commands
      Object.entries(commands).forEach(([key, cmd]) => {
        conn.exec(cmd, (err, stream) => {
          if (err) {
            stats[key] = null;
            commandsCompleted++;
            if (commandsCompleted === totalCommands) {
              clearTimeout(timeoutId);
              conn.end();
              resolve(stats);
            }
            return;
          }

          let output = '';
          stream.on('close', () => {
            stats[key] = output.trim();
            commandsCompleted++;
            if (commandsCompleted === totalCommands) {
              clearTimeout(timeoutId);
              conn.end();
              resolve(stats);
            }
          }).on('data', (data) => {
            output += data.toString();
          });
        });
      });
    }).on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    }).connect(sshConfig);
  });
};

// Built-in integration templates
const builtinTemplates = [
  {
    type: 'proxmox',
    name: 'Proxmox VE',
    builtin: true,
    fields: [
      { key: 'host', label: 'API Host', type: 'url', placeholder: 'https://192.168.1.100:8006', hint: 'Оставьте пустым чтобы использовать URL карточки' },
      { key: 'tokenId', label: 'Token ID', type: 'text', placeholder: 'user@pam!token', hint: 'Формат: user@realm!tokenname' },
      { key: 'tokenSecret', label: 'Token Secret', type: 'password', placeholder: '' }
    ],
    defaultConfig: { host: '', tokenId: '', tokenSecret: '' }
  },
  {
    type: 'homeassistant',
    name: 'Home Assistant',
    builtin: true,
    fields: [
      { key: 'host', label: 'Host', type: 'url', placeholder: 'http://192.168.1.x:8123' },
      { key: 'token', label: 'Long-Lived Access Token', type: 'password', placeholder: '', hint: 'Создайте в Profile → Security' },
      { key: 'entities', label: 'Сущности для отображения', type: 'textarea', placeholder: 'sensor.temperature|Температура\\nlight.living_room|Свет\\nswitch.heater', hint: 'Формат: entity_id или entity_id|Имя' }
    ],
    defaultConfig: { host: '', token: '', entities: '' }
  },
  {
    type: 'adguard',
    name: 'AdGuard Home',
    builtin: true,
    fields: [
      { key: 'host', label: 'Host', type: 'url', placeholder: 'http://192.168.1.x:3000' },
      { key: 'username', label: 'Username', type: 'text', placeholder: '' },
      { key: 'password', label: 'Password', type: 'password', placeholder: '' }
    ],
    defaultConfig: { host: '', username: '', password: '' }
  },
  {
    type: 'npm',
    name: 'NPM Plus',
    builtin: true,
    fields: [
      { key: 'host', label: 'Host', type: 'url', placeholder: 'http://192.168.1.x:81' },
      { key: 'email', label: 'Email', type: 'text', placeholder: '' },
      { key: 'password', label: 'Password', type: 'password', placeholder: '' }
    ],
    defaultConfig: { host: '', email: '', password: '' }
  },
  {
    type: 'docker',
    name: 'Docker',
    builtin: true,
    fields: [
      { key: 'host', label: 'Docker API Host', type: 'url', placeholder: 'http://192.168.1.x:2375', hint: 'Требуется включить Docker API' }
    ],
    defaultConfig: { host: '' }
  },
  {
    type: 'portainer',
    name: 'Portainer',
    builtin: true,
    fields: [
      { key: 'host', label: 'Portainer URL', type: 'url', placeholder: 'http://192.168.1.x:9000', hint: 'Адрес Portainer' },
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '', hint: 'Settings → Users → Access tokens' }
    ],
    defaultConfig: { host: '', apiKey: '' }
  },
  {
    type: 'crowdsec',
    name: 'CrowdSec',
    builtin: true,
    fields: [
      { key: 'host', label: 'LAPI Host', type: 'url', placeholder: 'http://192.168.1.x:8080' },
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '', hint: 'Bouncer API key' }
    ],
    defaultConfig: { host: '', apiKey: '' }
  },
  {
    type: 'openwrt',
    name: 'OpenWRT',
    builtin: true,
    fields: [
      { key: 'host', label: 'Router IP', type: 'url', placeholder: 'http://192.168.1.1', hint: 'HTTP/HTTPS адрес роутера' },
      { key: 'username', label: 'Username', type: 'text', placeholder: 'root' },
      { key: 'password', label: 'Password', type: 'password', placeholder: '' }
    ],
    defaultConfig: { host: '', username: 'root', password: '' }
  },
  {
    type: 'wikijs',
    name: 'Wiki.js',
    builtin: true,
    fields: [
      { key: 'host', label: 'Host', type: 'url', placeholder: 'https://192.168.1.x' },
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '', hint: 'Admin → API Access → Create API Key' }
    ],
    defaultConfig: { host: '', apiKey: '' }
  },
  {
    type: 'weather',
    name: 'Погода',
    builtin: true,
    fields: [
      { key: 'city', label: 'Город', type: 'text', placeholder: 'Moscow', hint: 'Название города на английском' },
      { key: 'apiKey', label: 'OpenWeatherMap API Key', type: 'password', placeholder: '', hint: 'Опционально. Без ключа используется wttr.in' }
    ],
    defaultConfig: { city: '', apiKey: '' }
  },
  {
    type: 'ssh',
    name: 'SSH Host',
    builtin: true,
    fields: [
      { key: 'host', label: 'Host', type: 'text', placeholder: '192.168.1.x' },
      { key: 'port', label: 'Port', type: 'text', placeholder: '22' },
      { key: 'username', label: 'Username', type: 'text', placeholder: 'root' },
      { key: 'password', label: 'Password', type: 'password', placeholder: '', hint: 'Для автонастройки ключа. После настройки можно очистить.' },
      { key: 'privateKey', label: 'SSH Key', type: 'select', placeholder: '', hint: 'Создаётся автоматически при нажатии "Настроить"', options: 'ssh_keys' }
    ],
    defaultConfig: { host: '', port: '22', username: 'root', password: '', privateKey: '' }
  },
  {
    type: 'mikrotik',
    name: 'MikroTik RouterOS',
    builtin: true,
    fields: [
      { key: 'host', label: 'Router IP', type: 'url', placeholder: 'http://192.168.88.1', hint: 'HTTP/HTTPS адрес роутера (REST API)' },
      { key: 'username', label: 'Username', type: 'text', placeholder: 'admin' },
      { key: 'password', label: 'Password', type: 'password', placeholder: '' }
    ],
    defaultConfig: { host: '', username: 'admin', password: '' }
  }
];

// Load templates (builtin + custom)
async function loadTemplates() {
  try {
    const data = await fs.readFile(TEMPLATES_FILE, 'utf8');
    const custom = JSON.parse(data);
    return [...builtinTemplates, ...custom];
  } catch {
    return builtinTemplates;
  }
}

// Save custom templates only
async function saveCustomTemplates(templates) {
  const custom = templates.filter(t => !t.builtin);
  await fs.writeFile(TEMPLATES_FILE, JSON.stringify(custom, null, 2));
}

router.get('/proxmox/:cardId', async (req, res) => {
  const config = await loadConfig();
  const card = config.cards.find(c => c.id === req.params.cardId);
  
  const host = getIntegrationHost(card);
  if (!host) {
    return res.json({ configured: false });
  }

  try {
    const { tokenId, tokenSecret } = card.integration;
    console.log('[Proxmox] Connecting to:', host);
    
    const headers = {
      'Authorization': `PVEAPIToken=${tokenId}=${tokenSecret}`
    };
    
    // Get nodes
    const nodesResponse = await fetchWithSSL(`${host}/api2/json/nodes`, { headers });
    const nodesData = await nodesResponse.json();
    
    if (!nodesData.data || nodesData.data.length === 0) {
      return res.json({ configured: true, error: 'No nodes found' });
    }

    const node = nodesData.data[0];
    const nodeName = node.node;

    // Get VMs
    let vms = { running: 0, stopped: 0, total: 0 };
    try {
      const vmsResponse = await fetchWithSSL(`${host}/api2/json/nodes/${nodeName}/qemu`, { headers });
      const vmsData = await vmsResponse.json();
      if (vmsData.data) {
        vms.total = vmsData.data.length;
        vms.running = vmsData.data.filter(vm => vm.status === 'running').length;
        vms.stopped = vms.total - vms.running;
      }
    } catch (e) { console.log('[Proxmox] Failed to get VMs:', e.message); }

    // Get containers (LXC)
    let containers = { running: 0, stopped: 0, total: 0 };
    try {
      const lxcResponse = await fetchWithSSL(`${host}/api2/json/nodes/${nodeName}/lxc`, { headers });
      const lxcData = await lxcResponse.json();
      if (lxcData.data) {
        containers.total = lxcData.data.length;
        containers.running = lxcData.data.filter(ct => ct.status === 'running').length;
        containers.stopped = containers.total - containers.running;
      }
    } catch (e) { console.log('[Proxmox] Failed to get LXC:', e.message); }

    // Get storage
    let storage = [];
    try {
      const storageResponse = await fetchWithSSL(`${host}/api2/json/nodes/${nodeName}/storage`, { headers });
      const storageData = await storageResponse.json();
      if (storageData.data) {
        storage = storageData.data.filter(s => s.active).map(s => ({
          name: s.storage,
          type: s.type,
          used: s.used || 0,
          total: s.total || 0,
          percent: s.total ? ((s.used / s.total) * 100).toFixed(1) : 0
        }));
      }
    } catch (e) { console.log('[Proxmox] Failed to get storage:', e.message); }

    // Get temperatures (from node status)
    let temps = [];
    try {
      const statusResponse = await fetchWithSSL(`${host}/api2/json/nodes/${nodeName}/status`, { headers });
      const statusData = await statusResponse.json();
      if (statusData.data?.thermalstate) {
        temps = Object.entries(statusData.data.thermalstate).map(([name, val]) => ({
          name,
          temp: val
        }));
      }
      // Try sensors too
      if (statusData.data?.pveversion) {
        // PVE 8+ - use different endpoint for sensors
        try {
          const sensorsResponse = await fetchWithSSL(`${host}/api2/json/nodes/${nodeName}/hardware/pci`, { headers });
          // sensors may not be directly available, this is a fallback
        } catch (e) {}
      }
    } catch (e) { console.log('[Proxmox] Failed to get temps:', e.message); }

    res.json({
      configured: true,
      node: nodeName,
      status: node.status,
      cpu: (node.cpu * 100).toFixed(1),
      memory: {
        used: node.mem,
        total: node.maxmem,
        percent: ((node.mem / node.maxmem) * 100).toFixed(1)
      },
      uptime: node.uptime,
      vms,
      containers,
      storage,
      temps
    });
  } catch (err) {
    console.error('[Proxmox] Error:', err.message);
    res.json({ configured: true, error: err.message });
  }
});

// AdGuard Home
router.get('/adguard/:cardId', async (req, res) => {
  const config = await loadConfig();
  const card = config.cards.find(c => c.id === req.params.cardId);
  
  const host = getIntegrationHost(card);
  if (!host) {
    return res.json({ configured: false });
  }

  try {
    const { username, password } = card.integration;
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    
    const statsResponse = await fetchWithSSL(`${host}/control/stats`, {
      headers: { 'Authorization': `Basic ${auth}` }
    });
    const stats = await statsResponse.json();

    const statusResponse = await fetchWithSSL(`${host}/control/status`, {
      headers: { 'Authorization': `Basic ${auth}` }
    });
    const status = await statusResponse.json();

    res.json({
      configured: true,
      enabled: status.protection_enabled,
      totalQueries: stats.num_dns_queries,
      blockedQueries: stats.num_blocked_filtering,
      blockPercent: parseFloat(((stats.num_blocked_filtering / stats.num_dns_queries) * 100).toFixed(1)),
      avgProcessingTime: parseFloat((stats.avg_processing_time * 1000).toFixed(2))
    });
  } catch (err) {
    res.json({ configured: true, error: err.message });
  }
});

// Home Assistant
router.get('/homeassistant/:cardId', async (req, res) => {
  const config = await loadConfig();
  const card = config.cards.find(c => c.id === req.params.cardId);
  
  const host = getIntegrationHost(card);
  if (!host) {
    return res.json({ configured: false });
  }

  try {
    const { token } = card.integration;
    
    const response = await fetchWithSSL(`${host}/api/`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();

    // Get states count
    const statesResponse = await fetchWithSSL(`${host}/api/states`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const states = await statesResponse.json();

    const entityCounts = states.reduce((acc, entity) => {
      const domain = entity.entity_id.split('.')[0];
      acc[domain] = (acc[domain] || 0) + 1;
      return acc;
    }, {});

    // Get custom entities if specified
    // Format: entity_id or entity_id|Custom Name
    const entities = card.integration.entities || '';
    const entityLines = entities.split('\n').map(e => e.trim()).filter(e => e);
    let customEntities = [];
    
    if (entityLines.length > 0) {
      customEntities = entityLines.map(line => {
        // Parse entity_id|Custom Name format
        const parts = line.split('|');
        const entityId = parts[0].trim();
        const customName = parts[1]?.trim() || null;
        
        const state = states.find(s => s.entity_id === entityId);
        if (state) {
          return {
            entity_id: entityId,
            state: state.state,
            name: customName || state.attributes?.friendly_name || entityId,
            unit: state.attributes?.unit_of_measurement || '',
            icon: state.attributes?.icon || null,
            domain: entityId.split('.')[0]
          };
        }
        return { 
          entity_id: entityId, 
          state: 'unavailable', 
          name: customName || entityId, 
          domain: entityId.split('.')[0] 
        };
      });
    }

    // Count lights that are on
    const lightsOn = states.filter(s => s.entity_id.startsWith('light.') && s.state === 'on').length;
    const switchesOn = states.filter(s => s.entity_id.startsWith('switch.') && s.state === 'on').length;

    res.json({
      configured: true,
      message: data.message,
      version: data.version,
      totalEntities: states.length,
      entityCounts: {
        lights: entityCounts.light || 0,
        lightsOn,
        switches: entityCounts.switch || 0,
        switchesOn,
        sensors: entityCounts.sensor || 0,
        automations: entityCounts.automation || 0
      },
      customEntities
    });
  } catch (err) {
    res.json({ configured: true, error: err.message });
  }
});

// NPM Plus - proxy hosts count
router.get('/npm/:cardId', async (req, res) => {
  const config = await loadConfig();
  const card = config.cards.find(c => c.id === req.params.cardId);
  
  const host = getIntegrationHost(card);
  if (!host) {
    return res.json({ configured: false });
  }

  try {
    const { email, password } = card.integration;
    
    // Get token
    const tokenResponse = await fetchWithSSL(`${host}/api/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: email, secret: password })
    });
    const tokenData = await tokenResponse.json();

    // Get proxy hosts
    const hostsResponse = await fetchWithSSL(`${host}/api/nginx/proxy-hosts`, {
      headers: { 'Authorization': `Bearer ${tokenData.token}` }
    });
    const hosts = await hostsResponse.json();

    const enabledHosts = hosts.filter(h => h.enabled).length;

    res.json({
      configured: true,
      totalHosts: hosts.length,
      enabledHosts,
      disabledHosts: hosts.length - enabledHosts
    });
  } catch (err) {
    res.json({ configured: true, error: err.message });
  }
});

// Weather - OpenWeatherMap
router.get('/weather/:cardId', async (req, res) => {
  const config = await loadConfig();
  const card = config.cards.find(c => c.id === req.params.cardId);
  
  if (!card?.integration?.city) {
    return res.json({ configured: false });
  }

  try {
    const { city, apiKey, units = 'metric' } = card.integration;
    
    // Если есть API ключ - используем OpenWeatherMap
    if (apiKey) {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=${units}&lang=ru`
      );
      const data = await response.json();
      
      if (data.cod !== 200) {
        return res.json({ configured: true, error: data.message });
      }

      // Маппинг иконок погоды
      const weatherIcons = {
        '01d': '☀️', '01n': '🌙',
        '02d': '⛅', '02n': '☁️',
        '03d': '☁️', '03n': '☁️',
        '04d': '☁️', '04n': '☁️',
        '09d': '🌧️', '09n': '🌧️',
        '10d': '🌦️', '10n': '🌧️',
        '11d': '⛈️', '11n': '⛈️',
        '13d': '❄️', '13n': '❄️',
        '50d': '🌫️', '50n': '🌫️'
      };

      res.json({
        configured: true,
        temp: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        wind: data.wind.speed.toFixed(1),
        description: data.weather[0].description,
        icon: weatherIcons[data.weather[0].icon] || '🌡️',
        city: data.name
      });
    } else {
      // Бесплатный wttr.in без API ключа
      const response = await fetch(
        `https://wttr.in/${encodeURIComponent(city)}?format=j1`
      );
      const data = await response.json();
      const current = data.current_condition[0];

      const weatherIcons = {
        'Sunny': '☀️', 'Clear': '🌙',
        'Partly cloudy': '⛅', 'Cloudy': '☁️', 'Overcast': '☁️',
        'Mist': '🌫️', 'Fog': '🌫️',
        'Light rain': '🌦️', 'Rain': '🌧️', 'Heavy rain': '🌧️',
        'Light snow': '🌨️', 'Snow': '❄️', 'Heavy snow': '❄️',
        'Thunderstorm': '⛈️'
      };

      const desc = current.weatherDesc[0].value;
      
      res.json({
        configured: true,
        temp: parseInt(current.temp_C),
        feelsLike: parseInt(current.FeelsLikeC),
        humidity: parseInt(current.humidity),
        wind: (parseInt(current.windspeedKmph) / 3.6).toFixed(1),
        description: desc,
        icon: weatherIcons[desc] || '🌡️',
        city: data.nearest_area[0].areaName[0].value
      });
    }
  } catch (err) {
    console.error('[Weather] Error:', err.message);
    res.json({ configured: true, error: err.message });
  }
});

// Wiki.js - страницы и пользователи
router.get('/wikijs/:cardId', async (req, res) => {
  const config = await loadConfig();
  const card = config.cards.find(c => c.id === req.params.cardId);
  
  const host = getIntegrationHost(card);
  if (!host) {
    return res.json({ configured: false });
  }

  try {
    const { apiKey } = card.integration;
    
    // GraphQL запрос для получения статистики
    const query = `
      query {
        pages {
          list(limit: 1000, orderBy: CREATED, orderByDirection: DESC) {
            id
            title
            updatedAt
          }
        }
        users {
          list {
            id
            name
            isActive
          }
        }
        site {
          config {
            title
          }
        }
      }
    `;

    const response = await fetchWithSSL(`${host}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ query })
    });
    
    const data = await response.json();
    
    if (data.errors) {
      return res.json({ configured: true, error: data.errors[0].message });
    }

    const pages = data.data?.pages?.list || [];
    const users = data.data?.users?.list || [];
    const siteTitle = data.data?.site?.config?.title || 'Wiki.js';

    // Подсчёт страниц обновлённых за последнюю неделю
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentPages = pages.filter(p => new Date(p.updatedAt) > weekAgo).length;

    res.json({
      configured: true,
      siteTitle,
      totalPages: pages.length,
      recentPages,
      totalUsers: users.length,
      activeUsers: users.filter(u => u.isActive).length
    });
  } catch (err) {
    console.error('[WikiJS] Error:', err.message);
    res.json({ configured: true, error: err.message });
  }
});

// SSH Host Monitoring
router.get('/ssh/:cardId', async (req, res) => {
  const config = await loadConfig();
  const card = config.cards.find(c => c.id === req.params.cardId);
  
  if (!card?.integration?.host) {
    return res.json({ configured: false });
  }

  try {
    const { host, port = 22, username, password, privateKey } = card.integration;
    
    // Build SSH config
    const sshConfig = {
      host,
      port: parseInt(port),
      username,
      readyTimeout: 10000,
      keepaliveInterval: 0
    };

    // Auth: private key or password
    if (privateKey) {
      // Check if it's a key name (file) or inline key
      if (privateKey.startsWith('-----')) {
        sshConfig.privateKey = privateKey;
      } else {
        // Load key from file
        const keyPath = path.join(SSH_KEYS_DIR, privateKey);
        try {
          sshConfig.privateKey = await fs.readFile(keyPath, 'utf8');
        } catch (e) {
          return res.json({ configured: true, error: `SSH key not found: ${privateKey}` });
        }
      }
    } else if (password) {
      sshConfig.password = password;
    } else {
      return res.json({ configured: true, error: 'No authentication method provided' });
    }

    // Get stats
    const rawStats = await getSSHStats(sshConfig);
    
    // Parse uptime
    const uptimeSeconds = parseFloat(rawStats.uptime) || 0;
    const uptimeDays = Math.floor(uptimeSeconds / 86400);
    const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);
    const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);

    // Parse load average
    const loadParts = (rawStats.loadavg || '0 0 0').split(' ');
    const load1 = parseFloat(loadParts[0]) || 0;
    const load5 = parseFloat(loadParts[1]) || 0;
    const load15 = parseFloat(loadParts[2]) || 0;

    // Parse memory
    const memLines = (rawStats.memory || '').split('\n');
    const memInfo = {};
    memLines.forEach(line => {
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        const key = parts[0].replace(':', '');
        memInfo[key] = parseInt(parts[1]) * 1024; // Convert from kB to bytes
      }
    });
    
    const memTotal = memInfo.MemTotal || 0;
    const memAvailable = memInfo.MemAvailable || memInfo.MemFree || 0;
    const memUsed = memTotal - memAvailable;
    const memPercent = memTotal > 0 ? ((memUsed / memTotal) * 100).toFixed(1) : 0;

    // Parse disk
    const diskParts = (rawStats.disk || '0 0 0 0%').split(/\s+/);
    const diskTotal = parseInt(diskParts[0]) || 0;
    const diskUsed = parseInt(diskParts[1]) || 0;
    const diskPercent = diskParts[3] ? parseInt(diskParts[3]) : 0;

    // Parse CPU cores
    const cpuLines = (rawStats.cpu || '1').split('\n');
    const cpuCores = parseInt(cpuLines[0]) || 1;

    res.json({
      configured: true,
      hostname: host,
      uptime: {
        seconds: Math.floor(uptimeSeconds),
        formatted: uptimeDays > 0 
          ? `${uptimeDays}d ${uptimeHours}h` 
          : `${uptimeHours}h ${uptimeMinutes}m`
      },
      load: {
        load1: load1.toFixed(2),
        load5: load5.toFixed(2),
        load15: load15.toFixed(2),
        cores: cpuCores,
        percent: ((load1 / cpuCores) * 100).toFixed(1)
      },
      memory: {
        total: memTotal,
        used: memUsed,
        available: memAvailable,
        percent: parseFloat(memPercent)
      },
      disk: {
        total: diskTotal,
        used: diskUsed,
        percent: diskPercent
      }
    });
  } catch (err) {
    console.error('[SSH] Error:', err.message);
    res.json({ configured: true, error: err.message });
  }
});

// MikroTik RouterOS (REST API)
router.get('/mikrotik/:cardId', async (req, res) => {
  const config = await loadConfig();
  const card = config.cards.find(c => c.id === req.params.cardId);
  
  const host = getIntegrationHost(card);
  if (!host) {
    return res.json({ configured: false });
  }

  try {
    const { username, password } = card.integration;
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    
    const headers = {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    };

    console.log('[MikroTik] Connecting to:', host);

    // Get system resource info
    const resourceResponse = await fetchWithSSL(`${host}/rest/system/resource`, { headers });
    
    if (!resourceResponse.ok) {
      throw new Error(`HTTP ${resourceResponse.status}: ${resourceResponse.statusText}`);
    }
    
    const resource = await resourceResponse.json();

    // Parse uptime (format: "1w2d3h4m5s" or "3d4h5m6s")
    const uptimeStr = resource.uptime || '0s';
    let uptimeSeconds = 0;
    const weekMatch = uptimeStr.match(/(\d+)w/);
    const dayMatch = uptimeStr.match(/(\d+)d/);
    const hourMatch = uptimeStr.match(/(\d+)h/);
    const minMatch = uptimeStr.match(/(\d+)m/);
    const secMatch = uptimeStr.match(/(\d+)s/);
    
    if (weekMatch) uptimeSeconds += parseInt(weekMatch[1]) * 7 * 24 * 3600;
    if (dayMatch) uptimeSeconds += parseInt(dayMatch[1]) * 24 * 3600;
    if (hourMatch) uptimeSeconds += parseInt(hourMatch[1]) * 3600;
    if (minMatch) uptimeSeconds += parseInt(minMatch[1]) * 60;
    if (secMatch) uptimeSeconds += parseInt(secMatch[1]);

    const uptimeDays = Math.floor(uptimeSeconds / 86400);
    const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);

    // Calculate memory percent
    const totalMemory = parseInt(resource['total-memory']) || 0;
    const freeMemory = parseInt(resource['free-memory']) || 0;
    const usedMemory = totalMemory - freeMemory;
    const memPercent = totalMemory > 0 ? ((usedMemory / totalMemory) * 100).toFixed(1) : 0;

    // Calculate HDD percent if available
    const totalHdd = parseInt(resource['total-hdd-space']) || 0;
    const freeHdd = parseInt(resource['free-hdd-space']) || 0;
    const usedHdd = totalHdd - freeHdd;
    const hddPercent = totalHdd > 0 ? ((usedHdd / totalHdd) * 100).toFixed(1) : 0;

    // Get interfaces count
    let interfacesUp = 0;
    let interfacesTotal = 0;
    try {
      const ifResponse = await fetchWithSSL(`${host}/rest/interface`, { headers });
      const ifData = await ifResponse.json();
      if (Array.isArray(ifData)) {
        interfacesTotal = ifData.length;
        interfacesUp = ifData.filter(i => i.running === 'true' || i.running === true).length;
      }
    } catch (e) {
      console.log('[MikroTik] Failed to get interfaces:', e.message);
    }

    res.json({
      configured: true,
      boardName: resource['board-name'] || 'Unknown',
      version: resource.version || 'Unknown',
      cpu: resource['cpu-load'] || 0,
      cpuCount: parseInt(resource['cpu-count']) || 1,
      architecture: resource['architecture-name'] || '',
      uptime: {
        seconds: uptimeSeconds,
        formatted: uptimeDays > 0 ? `${uptimeDays}d ${uptimeHours}h` : `${uptimeHours}h`,
        raw: uptimeStr
      },
      memory: {
        total: totalMemory,
        free: freeMemory,
        used: usedMemory,
        percent: parseFloat(memPercent)
      },
      hdd: totalHdd > 0 ? {
        total: totalHdd,
        free: freeHdd,
        used: usedHdd,
        percent: parseFloat(hddPercent)
      } : null,
      interfaces: {
        up: interfacesUp,
        total: interfacesTotal
      }
    });
  } catch (err) {
    console.error('[MikroTik] Error:', err.message);
    res.json({ configured: true, error: err.message });
  }
});

// SSH Keys Management
router.get('/templates', async (req, res) => {
  try {
    const templates = await loadTemplates();
    res.json(templates);
  } catch (err) {
    console.error('[Integrations] GET /templates error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/templates', async (req, res) => {
  try {
    const templates = await loadTemplates();
    const existing = templates.findIndex(t => t.type === req.body.type);
    
    if (existing !== -1 && templates[existing].builtin) {
      return res.status(400).json({ error: 'Cannot modify builtin template' });
    }
    
    const newTemplate = { ...req.body, builtin: false };
    
    if (existing !== -1) {
      templates[existing] = newTemplate;
    } else {
      templates.push(newTemplate);
    }
    
    await saveCustomTemplates(templates);
    res.json(newTemplate);
  } catch (err) {
    console.error('[Integrations] POST /templates error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/templates/:type', async (req, res) => {
  try {
    const templates = await loadTemplates();
    const template = templates.find(t => t.type === req.params.type);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    if (template.builtin) {
      return res.status(400).json({ error: 'Cannot delete builtin template' });
    }
    
    await saveCustomTemplates(templates.filter(t => t.type !== req.params.type));
    res.json({ success: true });
  } catch (err) {
    console.error('[Integrations] DELETE /templates error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
router.get('/docker/:cardId', async (req, res) => {
  const config = await loadConfig();
  const card = config.cards.find(c => c.id === req.params.cardId);
  
  const host = getIntegrationHost(card);
  if (!host) {
    return res.json({ configured: false });
  }

  try {
    const response = await fetchWithSSL(`${host}/containers/json?all=true`);
    const containers = await response.json();
    
    const running = containers.filter(c => c.State === 'running').length;
    const stopped = containers.filter(c => c.State !== 'running').length;
    
    // Собираем информацию о контейнерах
    const containerList = containers.map(c => ({
      id: c.Id?.substring(0, 12),
      name: (c.Names?.[0] || '').replace(/^\//, ''),
      image: c.Image?.split(':')[0]?.split('/').pop() || c.Image,
      state: c.State,
      status: c.Status
    })).sort((a, b) => {
      // Running first, then by name
      if (a.state === 'running' && b.state !== 'running') return -1;
      if (a.state !== 'running' && b.state === 'running') return 1;
      return a.name.localeCompare(b.name);
    });
    
    res.json({
      configured: true,
      total: containers.length,
      running,
      stopped,
      containers: containerList
    });
  } catch (err) {
    res.json({ configured: true, error: err.message });
  }
});

// ============ Portainer Integration ============

router.get('/portainer/:cardId', async (req, res) => {
  const config = await loadConfig();
  const card = config.cards.find(c => c.id === req.params.cardId);
  
  const host = getIntegrationHost(card);
  if (!host) {
    return res.json({ configured: false });
  }

  try {
    const { apiKey } = card.integration;
    if (!apiKey) {
      return res.json({ configured: false, error: 'API Key не указан' });
    }
    
    const headers = { 'X-API-Key': apiKey };
    
    // Получаем endpoints (окружения)
    const endpointsResponse = await fetchWithSSL(`${host}/api/endpoints`, { headers });
    const endpoints = await endpointsResponse.json();
    
    if (!Array.isArray(endpoints) || endpoints.length === 0) {
      return res.json({ configured: true, error: 'Нет доступных окружений' });
    }
    
    // Собираем статистику по всем endpoints
    let totalContainers = 0;
    let runningContainers = 0;
    let stoppedContainers = 0;
    let totalStacks = 0;
    const allContainers = [];
    const allStacks = [];
    const endpointsList = [];
    
    for (const endpoint of endpoints) {
      try {
        // Получаем контейнеры для каждого endpoint
        const containersResponse = await fetchWithSSL(
          `${host}/api/endpoints/${endpoint.Id}/docker/containers/json?all=true`, 
          { headers }
        );
        const containers = await containersResponse.json();
        
        if (Array.isArray(containers)) {
          const running = containers.filter(c => c.State === 'running').length;
          const stopped = containers.length - running;
          
          totalContainers += containers.length;
          runningContainers += running;
          stoppedContainers += stopped;
          
          // Добавляем контейнеры с информацией об endpoint
          containers.forEach(c => {
            allContainers.push({
              id: c.Id?.substring(0, 12),
              name: (c.Names?.[0] || '').replace(/^\//, ''),
              image: c.Image?.split(':')[0]?.split('/').pop() || c.Image,
              state: c.State,
              status: c.Status,
              endpoint: endpoint.Name
            });
          });
        }
        
        // Получаем стеки
        const stacksResponse = await fetchWithSSL(
          `${host}/api/stacks?filters={"EndpointId":${endpoint.Id}}`,
          { headers }
        );
        const stacks = await stacksResponse.json();
        
        if (Array.isArray(stacks)) {
          totalStacks += stacks.length;
          stacks.forEach(s => {
            allStacks.push({
              id: s.Id,
              name: s.Name,
              status: s.Status === 1 ? 'active' : 'inactive',
              type: s.Type === 1 ? 'swarm' : s.Type === 2 ? 'compose' : 'unknown',
              endpoint: endpoint.Name
            });
          });
        }
        
        endpointsList.push({
          id: endpoint.Id,
          name: endpoint.Name,
          type: endpoint.Type === 1 ? 'docker' : endpoint.Type === 2 ? 'agent' : endpoint.Type === 4 ? 'edge' : 'unknown',
          status: endpoint.Status === 1 ? 'up' : 'down',
          containers: Array.isArray(containers) ? containers.length : 0,
          running: Array.isArray(containers) ? containers.filter(c => c.State === 'running').length : 0
        });
        
      } catch (endpointErr) {
        console.log(`[Portainer] Error fetching endpoint ${endpoint.Name}:`, endpointErr.message);
        endpointsList.push({
          id: endpoint.Id,
          name: endpoint.Name,
          status: 'error',
          error: endpointErr.message
        });
      }
    }
    
    // Сортируем контейнеры: running first, then by name
    allContainers.sort((a, b) => {
      if (a.state === 'running' && b.state !== 'running') return -1;
      if (a.state !== 'running' && b.state === 'running') return 1;
      return a.name.localeCompare(b.name);
    });
    
    res.json({
      configured: true,
      endpoints: endpointsList,
      totalEndpoints: endpoints.length,
      total: totalContainers,
      running: runningContainers,
      stopped: stoppedContainers,
      stacks: totalStacks,
      containers: allContainers.slice(0, 20), // Лимит для UI
      stacksList: allStacks
    });
    
  } catch (err) {
    console.error('[Portainer] Error:', err.message);
    res.json({ configured: true, error: err.message });
  }
});

// ============ CrowdSec Integration ============

router.get('/crowdsec/:cardId', async (req, res) => {
  const config = await loadConfig();
  const card = config.cards.find(c => c.id === req.params.cardId);
  
  const host = getIntegrationHost(card);
  if (!host) {
    return res.json({ configured: false });
  }

  try {
    const { apiKey } = card.integration;
    const headers = { 'X-Api-Key': apiKey };
    
    // Get active decisions (banned IPs)
    const decisionsResponse = await fetchWithSSL(`${host}/v1/decisions`, { headers });
    const decisions = await decisionsResponse.json();

    // Count decisions by type and scenario
    const decisionTypes = {};
    const decisionScenarios = {};
    const uniqueIPs = new Set();
    
    if (Array.isArray(decisions)) {
      decisions.forEach(d => {
        const type = d.type || 'unknown';
        const scenario = d.scenario || 'unknown';
        decisionTypes[type] = (decisionTypes[type] || 0) + 1;
        decisionScenarios[scenario] = (decisionScenarios[scenario] || 0) + 1;
        if (d.value) uniqueIPs.add(d.value);
      });
    }

    // Get top scenarios
    const topScenarios = Object.entries(decisionScenarios)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name: name.replace('crowdsecurity/', ''), count }));
    
    res.json({
      configured: true,
      blockedIPs: uniqueIPs.size,
      totalDecisions: Array.isArray(decisions) ? decisions.length : 0,
      decisionTypes,
      topScenarios,
      bans: decisionTypes['ban'] || 0,
      captchas: decisionTypes['captcha'] || 0
    });
  } catch (err) {
    console.error('[CrowdSec] Error:', err.message);
    res.json({ configured: true, error: err.message });
  }
});

// ============ OpenWRT Integration ============

router.get('/openwrt/:cardId', async (req, res) => {
  const config = await loadConfig();
  const card = config.cards.find(c => c.id === req.params.cardId);
  
  const host = getIntegrationHost(card);
  if (!host) {
    return res.json({ configured: false });
  }

  try {
    const { username, password } = card.integration;
    
    // Try ubus API first (requires uhttpd-mod-ubus)
    // Login to get session
    const loginResponse = await fetchWithSSL(`${host}/ubus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'call',
        params: ['00000000000000000000000000000000', 'session', 'login', { username, password }]
      })
    });
    
    const loginData = await loginResponse.json();
    
    if (loginData.error || !loginData.result?.[1]?.ubus_rpc_session) {
      // Fallback to LuCI RPC
      const luciLoginResponse = await fetchWithSSL(`${host}/cgi-bin/luci/rpc/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 1, method: 'login', params: [username, password] })
      });
      
      const luciLogin = await luciLoginResponse.json();
      if (!luciLogin.result) {
        throw new Error('Authentication failed');
      }
      
      const authToken = luciLogin.result;
      
      // Get system info via LuCI
      const sysResponse = await fetchWithSSL(`${host}/cgi-bin/luci/rpc/sys?auth=${authToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 1, method: 'exec', params: ['cat /proc/loadavg && free && uptime -s'] })
      });
      
      const sysData = await sysResponse.json();
      
      // Parse basic info from exec output
      const output = sysData.result || '';
      const lines = output.split('\n');
      
      // Parse load average
      let cpu = 0;
      if (lines[0]) {
        const loadParts = lines[0].split(' ');
        cpu = Math.min(100, parseFloat(loadParts[0]) * 100 / 4).toFixed(0); // Rough estimate
      }
      
      res.json({
        configured: true,
        cpu: parseFloat(cpu),
        memory: { percent: 0 },
        uptime: { formatted: 'N/A' },
        method: 'luci-rpc'
      });
      return;
    }
    
    const sessionId = loginData.result[1].ubus_rpc_session;
    
    // Get system info
    const sysInfoResponse = await fetchWithSSL(`${host}/ubus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'call',
        params: [sessionId, 'system', 'info', {}]
      })
    });
    
    const sysInfo = await sysInfoResponse.json();
    const info = sysInfo.result?.[1] || {};
    
    // Get board info
    const boardResponse = await fetchWithSSL(`${host}/ubus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'call',
        params: [sessionId, 'system', 'board', {}]
      })
    });
    
    const boardInfo = await boardResponse.json();
    const board = boardInfo.result?.[1] || {};
    
    // Calculate memory
    const totalMem = info.memory?.total || 0;
    const freeMem = (info.memory?.free || 0) + (info.memory?.buffered || 0) + (info.memory?.cached || 0);
    const usedMem = totalMem - freeMem;
    const memPercent = totalMem > 0 ? ((usedMem / totalMem) * 100).toFixed(1) : 0;
    
    // Calculate uptime
    const uptimeSeconds = info.uptime || 0;
    const uptimeDays = Math.floor(uptimeSeconds / 86400);
    const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);
    
    // Calculate CPU from load
    const load = info.load?.[0] || 0;
    const cpuPercent = Math.min(100, (load / 65536) * 100).toFixed(0);
    
    res.json({
      configured: true,
      boardName: board.model || board.board_name || 'OpenWRT',
      hostname: board.hostname || 'OpenWRT',
      version: board.release?.version || board.release?.description || 'Unknown',
      kernel: board.kernel || '',
      cpu: parseFloat(cpuPercent),
      load: {
        avg1: (load / 65536).toFixed(2),
        avg5: ((info.load?.[1] || 0) / 65536).toFixed(2),
        avg15: ((info.load?.[2] || 0) / 65536).toFixed(2)
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        percent: parseFloat(memPercent)
      },
      uptime: {
        seconds: uptimeSeconds,
        formatted: uptimeDays > 0 ? `${uptimeDays}d ${uptimeHours}h` : `${uptimeHours}h`
      },
      localtime: info.localtime ? new Date(info.localtime * 1000).toLocaleString() : null
    });
  } catch (err) {
    console.error('[OpenWRT] Error:', err.message);
    res.json({ configured: true, error: err.message });
  }
});

// ============ Custom Integration (dynamic) ============

router.get('/custom/:cardId', async (req, res) => {
  const config = await loadConfig();
  const card = config.cards.find(c => c.id === req.params.cardId);
  
  const host = getIntegrationHost(card);
  if (!host) {
    return res.json({ configured: false });
  }

  const templates = await loadTemplates();
  const template = templates.find(t => t.type === card.integration.type);
  
  if (!template || template.builtin) {
    return res.json({ configured: false });
  }

  try {
    let endpoint = template.endpoint.replace('{{host}}', host);
    
    const headers = {};
    if (template.authType === 'bearer' && card.integration.token) {
      headers['Authorization'] = `Bearer ${card.integration.token}`;
    } else if (template.authType === 'basic' && card.integration.username) {
      headers['Authorization'] = `Basic ${Buffer.from(`${card.integration.username}:${card.integration.password}`).toString('base64')}`;
    } else if (template.authType === 'apikey' && card.integration.apiKey) {
      headers['X-API-Key'] = card.integration.apiKey;
    }

    const response = await fetchWithSSL(endpoint, { method: template.method, headers });
    const data = await response.json();

    // Execute response mapping if provided
    let result = { configured: true };
    if (template.responseMapping) {
      try {
        const fn = new Function('data', template.responseMapping);
        result = fn(data);
      } catch (evalErr) {
        result.error = 'Mapping error: ' + evalErr.message;
      }
    } else {
      result.display = JSON.stringify(data).slice(0, 100);
    }

    res.json(result);
  } catch (err) {
    res.json({ configured: true, error: err.message });
  }
});

// Universal handler for custom integration types (must be after all specific handlers)
router.get('/:type/:cardId', async (req, res) => {
  console.log(`[Custom Integration] type=${req.params.type}, cardId=${req.params.cardId}`);
  const config = await loadConfig();
  const card = config.cards.find(c => String(c.id) === String(req.params.cardId));
  
  if (!card) {
    console.log('[Custom Integration] Card not found');
    return res.json({ configured: false, error: 'Card not found' });
  }
  
  const host = getIntegrationHost(card);
  console.log('[Custom Integration] host:', host);
  if (!host) {
    return res.json({ configured: false });
  }

  const templates = await loadTemplates();
  const template = templates.find(t => t.type === req.params.type);
  console.log('[Custom Integration] template:', template);
  
  if (!template) {
    return res.json({ configured: false, error: 'Template not found' });
  }
  
  // If builtin template, it should have been handled by specific route
  if (template.builtin) {
    return res.json({ configured: false, error: 'Unknown integration type' });
  }

  try {
    let endpoint = template.endpoint.replace('{{host}}', host);
    console.log('[Custom Integration] endpoint:', endpoint);
    
    const headers = {};
    if (template.authType === 'bearer' && card.integration.token) {
      headers['Authorization'] = `Bearer ${card.integration.token}`;
    } else if (template.authType === 'basic' && card.integration.username) {
      headers['Authorization'] = `Basic ${Buffer.from(`${card.integration.username}:${card.integration.password}`).toString('base64')}`;
    } else if (template.authType === 'apikey' && card.integration.apiKey) {
      headers['X-API-Key'] = card.integration.apiKey;
    }
    console.log('[Custom Integration] headers:', headers);

    const response = await fetchWithSSL(endpoint, { method: template.method, headers });
    const data = await response.json();
    console.log('[Custom Integration] response data:', data);

    // Execute response mapping if provided
    let result = { configured: true };
    if (template.responseMapping) {
      try {
        const fn = new Function('data', template.responseMapping);
        result = fn(data);
      } catch (evalErr) {
        result.error = 'Mapping error: ' + evalErr.message;
      }
    } else {
      result.display = JSON.stringify(data).slice(0, 100);
    }

    res.json(result);
  } catch (err) {
    res.json({ configured: true, error: err.message });
  }
});

module.exports = router;
