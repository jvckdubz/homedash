const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const https = require('https');
const { fetchWithSSL } = require('../utils/config');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Service fingerprints for auto-discovery
const serviceFingerprints = [
  {
    type: 'proxmox',
    name: 'Proxmox VE',
    probes: [
      { path: '/api2/json/version', method: 'GET' },
      { path: '/api2/json', method: 'GET' }
    ],
    detect: (response, headers) => {
      if (response?.data?.release || response?.data?.version) {
        return { 
          confidence: 95, 
          version: response.data.version || response.data.release,
          details: `Proxmox VE ${response.data.version || response.data.release}`
        };
      }
      if (response?.release && response?.repoid) {
        return { confidence: 95, version: response.release };
      }
      return null;
    },
    suggestedIcon: 'proxmox',
    suggestedColor: '#e57000',
    authHint: 'Требуется API Token (Datacenter -> Permissions -> API Tokens)'
  },
  {
    type: 'homeassistant',
    name: 'Home Assistant',
    probes: [
      { path: '/api/', method: 'GET' },
      { path: '/api/config', method: 'GET' }
    ],
    detect: (response, headers) => {
      const haVersion = headers['ha-version'];
      if (haVersion) {
        return { confidence: 98, version: haVersion, details: `Home Assistant ${haVersion}` };
      }
      if (response?.message === 'API running.') {
        return { confidence: 90, details: 'Home Assistant API' };
      }
      if (response?.components || response?.config_dir) {
        return { confidence: 95, version: response.version, details: `Home Assistant ${response.version || ''}` };
      }
      return null;
    },
    suggestedIcon: 'home-assistant',
    suggestedColor: '#41bdf5',
    authHint: 'Требуется Long-Lived Access Token (Profile -> Security)'
  },
  {
    type: 'adguard',
    name: 'AdGuard Home',
    probes: [
      { path: '/control/status', method: 'GET' }
    ],
    detect: (response, headers) => {
      if (response?.dns_addresses !== undefined || response?.protection_enabled !== undefined) {
        return { confidence: 95, version: response.version, details: `AdGuard Home ${response.version || ''}` };
      }
      return null;
    },
    suggestedIcon: 'adguard',
    suggestedColor: '#68bc71',
    authHint: 'Требуется Basic Auth (логин и пароль AdGuard)'
  },
  {
    type: 'npm',
    name: 'Nginx Proxy Manager',
    probes: [
      { path: '/api/', method: 'GET' },
      { path: '/api/schema', method: 'GET' }
    ],
    detect: (response, headers) => {
      if (response?.error?.message?.includes('JWT')) {
        return { confidence: 85, details: 'Nginx Proxy Manager (требуется авторизация)' };
      }
      if (response?.error?.code === 'ERR_JWT_REQUIRED') {
        return { confidence: 90, details: 'Nginx Proxy Manager' };
      }
      return null;
    },
    suggestedIcon: 'nginx',
    suggestedColor: '#009639',
    authHint: 'Требуется Email и пароль администратора'
  },
  {
    type: 'docker',
    name: 'Docker API',
    probes: [
      { path: '/version', method: 'GET' },
      { path: '/v1.41/version', method: 'GET' }
    ],
    detect: (response, headers) => {
      if (response?.ApiVersion && response?.Os) {
        return { 
          confidence: 98, 
          version: response.Version,
          details: `Docker ${response.Version} (${response.Os}/${response.Arch})`
        };
      }
      return null;
    },
    suggestedIcon: 'docker',
    suggestedColor: '#2496ed',
    authHint: 'Docker API обычно не требует авторизации'
  },
  {
    type: 'portainer',
    name: 'Portainer',
    probes: [
      { path: '/api/status', method: 'GET' },
      { path: '/api/system/status', method: 'GET' }
    ],
    detect: (response, headers) => {
      if (response?.Version && response?.InstanceID) {
        return { confidence: 95, version: response.Version, details: `Portainer ${response.Version}` };
      }
      return null;
    },
    suggestedIcon: 'container',
    suggestedColor: '#13bef9',
    authHint: 'Требуется API Key (Settings -> Authentication -> API Keys)'
  },
  {
    type: 'openwrt',
    name: 'OpenWRT',
    probes: [
      { path: '/ubus', method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'list', params: ['*'] }) },
      { path: '/cgi-bin/luci/', method: 'GET' }
    ],
    detect: (response, headers, url) => {
      if (response?.jsonrpc === '2.0' || response?.id) {
        return { confidence: 90, details: 'OpenWRT (ubus API)' };
      }
      const responseStr = typeof response === 'string' ? response : JSON.stringify(response);
      if (responseStr?.includes('LuCI') || responseStr?.includes('OpenWrt')) {
        return { confidence: 85, details: 'OpenWRT (LuCI)' };
      }
      return null;
    },
    suggestedIcon: 'router',
    suggestedColor: '#00a3e0',
    authHint: 'Требуется логин и пароль root'
  },
  {
    type: 'grafana',
    name: 'Grafana',
    probes: [
      { path: '/api/health', method: 'GET' },
      { path: '/api/frontend/settings', method: 'GET' }
    ],
    detect: (response, headers) => {
      if (response?.database === 'ok' || response?.commit) {
        return { confidence: 90, version: response.version, details: `Grafana ${response.version || ''}` };
      }
      if (response?.buildInfo?.version) {
        return { confidence: 95, version: response.buildInfo.version, details: `Grafana ${response.buildInfo.version}` };
      }
      return null;
    },
    suggestedIcon: 'activity',
    suggestedColor: '#f46800',
    authHint: 'Требуется API Key (Configuration -> API Keys)'
  },
  {
    type: 'pihole',
    name: 'Pi-hole',
    probes: [
      { path: '/admin/api.php', method: 'GET' },
      { path: '/admin/api.php?summary', method: 'GET' }
    ],
    detect: (response, headers) => {
      if (response?.status !== undefined && (response?.gravity_last_updated || response?.domains_being_blocked !== undefined)) {
        return { confidence: 95, details: 'Pi-hole' };
      }
      return null;
    },
    suggestedIcon: 'shield',
    suggestedColor: '#96060c',
    authHint: 'Требуется API Token (Settings -> API/Web Interface -> API Token)'
  },
  {
    type: 'traefik',
    name: 'Traefik',
    probes: [
      { path: '/api/version', method: 'GET' },
      { path: '/api/overview', method: 'GET' }
    ],
    detect: (response, headers) => {
      if (response?.Version && response?.Codename) {
        return { confidence: 95, version: response.Version, details: `Traefik ${response.Version} "${response.Codename}"` };
      }
      if (response?.http || response?.tcp) {
        return { confidence: 85, details: 'Traefik API' };
      }
      return null;
    },
    suggestedIcon: 'network',
    suggestedColor: '#24a1c1',
    authHint: 'Обычно не требует авторизации при локальном доступе'
  },
  {
    type: 'crowdsec',
    name: 'CrowdSec',
    probes: [
      { path: '/health', method: 'GET' },
      { path: '/v1/decisions', method: 'GET' }
    ],
    detect: (response, headers) => {
      if (response?.message === 'Unauthorized') {
        return { confidence: 75, details: 'CrowdSec LAPI (требуется API Key)' };
      }
      if (Array.isArray(response)) {
        return { confidence: 85, details: 'CrowdSec LAPI' };
      }
      return null;
    },
    suggestedIcon: 'crowdsec',
    suggestedColor: '#f39c12',
    authHint: 'Требуется Bouncer API Key (cscli bouncers add)'
  },
  {
    type: 'unifi',
    name: 'UniFi Controller',
    probes: [
      { path: '/api/s/default/stat/health', method: 'GET' },
      { path: '/status', method: 'GET' }
    ],
    detect: (response, headers) => {
      if (response?.meta?.rc === 'ok' || response?.data?.[0]?.subsystem) {
        return { confidence: 90, details: 'UniFi Controller' };
      }
      if (headers['x-frame-options'] && response?.meta) {
        return { confidence: 70, details: 'UniFi Controller (возможно)' };
      }
      return null;
    },
    suggestedIcon: 'router',
    suggestedColor: '#0559c9',
    authHint: 'Требуется логин и пароль UniFi'
  },
  {
    type: 'jellyfin',
    name: 'Jellyfin',
    probes: [
      { path: '/System/Info/Public', method: 'GET' },
      { path: '/health', method: 'GET' }
    ],
    detect: (response, headers) => {
      if (response?.ServerName && response?.Version && response?.ProductName?.includes('Jellyfin')) {
        return { confidence: 98, version: response.Version, details: `Jellyfin ${response.Version}` };
      }
      if (response?.ServerName && response?.LocalAddress) {
        return { confidence: 85, version: response.Version, details: `Media Server ${response.Version || ''}` };
      }
      return null;
    },
    suggestedIcon: 'server',
    suggestedColor: '#00a4dc',
    authHint: 'Публичная информация доступна без авторизации'
  },
  {
    type: 'plex',
    name: 'Plex Media Server',
    probes: [
      { path: '/identity', method: 'GET' },
      { path: '/', method: 'GET' }
    ],
    detect: (response, headers) => {
      if (response?.MediaContainer?.machineIdentifier) {
        return { confidence: 95, version: response.MediaContainer.version, details: `Plex ${response.MediaContainer.version || ''}` };
      }
      return null;
    },
    suggestedIcon: 'server',
    suggestedColor: '#e5a00d',
    authHint: 'Требуется X-Plex-Token'
  },
  {
    type: 'synology',
    name: 'Synology DSM',
    probes: [
      { path: '/webapi/query.cgi?api=SYNO.API.Info&version=1&method=query', method: 'GET' }
    ],
    detect: (response, headers) => {
      if (response?.data?.['SYNO.API.Auth'] || response?.success === true) {
        return { confidence: 90, details: 'Synology DSM' };
      }
      return null;
    },
    suggestedIcon: 'database',
    suggestedColor: '#000000',
    authHint: 'Требуется логин и пароль DSM'
  }
];

// Discovery endpoint
router.post('/', async (req, res) => {
  const { url, username, password, token, apiKey } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Normalize URL
  let baseUrl = url.trim();
  if (!baseUrl.startsWith('http')) {
    baseUrl = 'http://' + baseUrl;
  }
  baseUrl = baseUrl.replace(/\/+$/, '');

  const results = [];
  const errors = [];
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'HomeDash/1.0'
  };

  // Add auth headers if provided
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (apiKey) {
    headers['X-Api-Key'] = apiKey;
  } else if (username && password) {
    headers['Authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }

  console.log(`[Discovery] Scanning ${baseUrl}...`);

  // Probe each service
  for (const service of serviceFingerprints) {
    for (const probe of service.probes) {
      try {
        const probeUrl = baseUrl + probe.path;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        console.log(`[Discovery] Probing ${probeUrl} for ${service.type}...`);

        const fetchOptions = {
          method: probe.method,
          headers,
          signal: controller.signal,
          redirect: 'follow',
          agent: probeUrl.startsWith('https') ? httpsAgent : undefined
        };

        if (probe.body) {
          fetchOptions.body = probe.body;
          fetchOptions.headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(probeUrl, fetchOptions);
        clearTimeout(timeout);

        console.log(`[Discovery] ${probeUrl} responded with ${response.status}`);

        // Get response headers
        const respHeaders = {};
        response.headers.forEach((value, key) => {
          respHeaders[key.toLowerCase()] = value;
        });

        // Try to parse JSON
        let data = null;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('json')) {
          try {
            data = await response.json();
          } catch {}
        }

        // Run detection
        const detection = service.detect(data, respHeaders);
        if (detection) {
          console.log(`[Discovery] Detected ${service.name} with ${detection.confidence}% confidence`);
          results.push({
            type: service.type,
            name: service.name,
            confidence: detection.confidence,
            version: detection.version,
            details: detection.details,
            suggestedIcon: service.suggestedIcon,
            suggestedColor: service.suggestedColor,
            authHint: service.authHint,
            probeUrl
          });
          break; // Found match, no need to probe more
        }
      } catch (err) {
        const errMsg = err.name === 'AbortError' ? 'Timeout' : err.message;
        console.log(`[Discovery] Probe ${service.type} failed: ${errMsg}`);
        if (!errors.includes(errMsg)) errors.push(errMsg);
      }
    }
  }

  // Sort by confidence
  results.sort((a, b) => b.confidence - a.confidence);

  // Also try to detect from HTML title or common patterns if no match
  if (results.length === 0) {
    try {
      const response = await fetchWithSSL(baseUrl, { headers: { 'User-Agent': 'HomeDash/1.0' }, timeout: 5000 });
      const html = await response.text();
      
      // Check HTML for clues
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : '';

      // Check server header
      const server = response.headers.get('server') || '';

      results.push({
        type: 'unknown',
        name: 'Unknown Service',
        confidence: 30,
        details: title || server || 'Сервис доступен, но не удалось определить тип',
        suggestedIcon: 'server',
        suggestedColor: '#6366f1',
        authHint: null,
        htmlTitle: title,
        serverHeader: server
      });
    } catch (fallbackErr) {
      console.log(`[Discovery] Fallback probe failed: ${fallbackErr.message}`);
    }
  }

  console.log(`[Discovery] Completed. Found ${results.length} services. Errors: ${errors.length}`);

  res.json({
    url: baseUrl,
    discovered: results.length > 0 && results[0].type !== 'unknown',
    results,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString()
  });
});

// Batch discovery (scan multiple ports on a host)
router.post('/scan', async (req, res) => {
  const { host, ports = [80, 443, 8080, 8123, 8443, 9000, 3000, 5000, 81, 8006] } = req.body;

  if (!host) {
    return res.status(400).json({ error: 'Host is required' });
  }

  const found = [];
  const protocols = ['http', 'https'];

  for (const port of ports) {
    for (const protocol of protocols) {
      // Skip obvious mismatches
      if (port === 443 && protocol === 'http') continue;
      if (port === 80 && protocol === 'https') continue;

      const url = `${protocol}://${host}:${port}`;
      
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        const response = await fetchWithSSL(url, {
          method: 'GET',
          signal: controller.signal,
          redirect: 'follow'
        });

        clearTimeout(timeout);

        if (response.ok || response.status === 401 || response.status === 403) {
          // Port is open, try to identify using internal discover
          // We'll do a simplified detection here
          for (const service of serviceFingerprints) {
            for (const probe of service.probes) {
              try {
                const probeUrl = url + probe.path;
                const probeController = new AbortController();
                const probeTimeout = setTimeout(() => probeController.abort(), 3000);

                const probeResponse = await fetchWithSSL(probeUrl, {
                  method: probe.method,
                  signal: probeController.signal,
                  redirect: 'follow',
                  headers: { 'Accept': 'application/json', 'User-Agent': 'HomeDash/1.0' }
                });

                clearTimeout(probeTimeout);

                const respHeaders = {};
                probeResponse.headers.forEach((value, key) => {
                  respHeaders[key.toLowerCase()] = value;
                });

                let data = null;
                const contentType = probeResponse.headers.get('content-type') || '';
                if (contentType.includes('json')) {
                  try { data = await probeResponse.json(); } catch {}
                }

                const detection = service.detect(data, respHeaders);
                if (detection) {
                  found.push({
                    url,
                    port,
                    protocol,
                    type: service.type,
                    name: service.name,
                    confidence: detection.confidence,
                    version: detection.version,
                    details: detection.details,
                    suggestedIcon: service.suggestedIcon,
                    suggestedColor: service.suggestedColor
                  });
                  break;
                }
              } catch {}
            }
            if (found.some(f => f.url === url)) break;
          }

          // If no service detected, add as unknown
          if (!found.some(f => f.url === url)) {
            found.push({
              url,
              port,
              protocol,
              type: 'unknown',
              name: 'Unknown Service',
              confidence: 20,
              details: `Service on port ${port}`
            });
          }
        }
      } catch {
        // Port not accessible
      }
    }
  }

  res.json({
    host,
    portsScanned: ports.length,
    found,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
