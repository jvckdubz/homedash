const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const multer = require('multer');
const fetch = require('node-fetch');
const https = require('https');
const crypto = require('crypto');
const { Client: SSHClient, utils: sshUtils } = require('ssh2');
const AdmZip = require('adm-zip');

// Docker management (optional - only if socket is mounted)
let Docker = null;
let docker = null;
try {
  Docker = require('dockerode');
  docker = new Docker({ socketPath: '/var/run/docker.sock' });
  console.log('[Docker] Connected to Docker socket');
} catch (err) {
  console.log('[Docker] Docker socket not available - full update disabled');
}

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// HTTPS agent that ignores self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Helper function for fetch with SSL bypass
const fetchWithSSL = (url, options = {}) => {
  const isHttps = url.startsWith('https');
  return fetch(url, {
    ...options,
    agent: isHttps ? httpsAgent : undefined
  });
};

// ============ Telegram Helper ============
async function sendTelegramMessage(botToken, chatId, text, topicId = null) {
  const body = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    disable_web_page_preview: true
  };
  
  // Добавляем message_thread_id если указан topic
  if (topicId && topicId.toString().trim()) {
    body.message_thread_id = parseInt(topicId);
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || 'Telegram API error');
  }
  return data;
}

// SSH Helper - execute command and return result
const sshExec = (config, command, timeout = 10000) => {
  return new Promise((resolve, reject) => {
    const conn = new SSHClient();
    let output = '';
    let errorOutput = '';
    
    const timeoutId = setTimeout(() => {
      conn.end();
      reject(new Error('SSH connection timeout'));
    }, timeout);

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeoutId);
          conn.end();
          return reject(err);
        }
        
        stream.on('close', (code) => {
          clearTimeout(timeoutId);
          conn.end();
          if (code === 0 || output) {
            resolve(output.trim());
          } else {
            reject(new Error(errorOutput || `Command failed with code ${code}`));
          }
        }).on('data', (data) => {
          output += data.toString();
        }).stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
      });
    }).on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    }).connect(config);
  });
};

// SSH Helper - get system stats with a single connection
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

// Paths - use /app/data in production (Docker)
const DATA_DIR = IS_PRODUCTION ? '/app/data' : path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const ICONS_DIR = path.join(DATA_DIR, 'icons');
const SSH_KEYS_DIR = path.join(DATA_DIR, 'ssh_keys');
const MONITORING_FILE = path.join(DATA_DIR, 'monitoring.json');

// ============ MONITORING SERVICE ============
class MonitoringService {
  constructor() {
    this.history = {};      // cardId -> { checks: [], stats: {} }
    this.intervals = {};    // cardId -> intervalId
    this.lastStatus = {};   // cardId -> 'up' | 'down' | 'unknown'
    this.isRunning = false;
    this.config = null;
  }

  async init() {
    await this.loadHistory();
    console.log('[Monitoring] Service initialized');
  }

  async loadHistory() {
    try {
      const data = await fs.readFile(MONITORING_FILE, 'utf8');
      this.history = JSON.parse(data);
      // Восстанавливаем lastStatus из истории
      Object.keys(this.history).forEach(cardId => {
        const checks = this.history[cardId]?.checks || [];
        if (checks.length > 0) {
          this.lastStatus[cardId] = checks[checks.length - 1].status;
        }
      });
    } catch {
      this.history = {};
    }
  }

  async saveHistory() {
    try {
      await fs.writeFile(MONITORING_FILE, JSON.stringify(this.history, null, 2));
    } catch (err) {
      console.error('[Monitoring] Failed to save history:', err.message);
    }
  }

  // Очистка старой истории
  cleanOldHistory(historyDays = 7) {
    const cutoff = Date.now() - (historyDays * 24 * 60 * 60 * 1000);
    Object.keys(this.history).forEach(cardId => {
      if (this.history[cardId]?.checks) {
        this.history[cardId].checks = this.history[cardId].checks.filter(
          c => c.timestamp > cutoff
        );
      }
    });
  }

  // Проверка одного URL
  async checkUrl(url, timeout = 10000) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Используем GET вместо HEAD, так как многие серверы не поддерживают HEAD (501, 405)
      const response = await fetchWithSSL(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'HomeDash-Monitor/1.0'
        }
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - start;

      // Считаем успешными коды 2xx и 3xx
      const isUp = response.status >= 200 && response.status < 400;

      return {
        status: isUp ? 'up' : 'down',
        statusCode: response.status,
        responseTime,
        timestamp: Date.now()
      };
    } catch (err) {
      return {
        status: 'down',
        statusCode: 0,
        responseTime: Date.now() - start,
        error: err.name === 'AbortError' ? 'Timeout' : err.message,
        timestamp: Date.now()
      };
    }
  }

  // Проверка SSH хоста
  async checkSSH(card, timeout = 10000) {
    const start = Date.now();
    const integration = card.integration;
    
    if (!integration?.host) {
      return {
        status: 'down',
        error: 'No host configured',
        responseTime: 0,
        timestamp: Date.now()
      };
    }

    console.log(`[Monitoring] SSH check for ${card.name}: ${integration.host}`);

    return new Promise((resolve) => {
      const conn = new SSHClient();
      let resolved = false;
      
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          conn.end();
          console.log(`[Monitoring] SSH timeout for ${card.name}`);
          resolve({
            status: 'down',
            error: 'Connection timeout',
            responseTime: Date.now() - start,
            timestamp: Date.now()
          });
        }
      }, timeout);

      conn.on('ready', () => {
        clearTimeout(timeoutId);
        if (!resolved) {
          resolved = true;
          const responseTime = Date.now() - start;
          // Выполняем простую команду для проверки
          conn.exec('echo ok', (err, stream) => {
            conn.end();
            if (err) {
              console.log(`[Monitoring] SSH command failed for ${card.name}: ${err.message}`);
              resolve({
                status: 'down',
                error: 'Command failed',
                responseTime,
                timestamp: Date.now()
              });
            } else {
              console.log(`[Monitoring] SSH OK for ${card.name}: ${responseTime}ms`);
              resolve({
                status: 'up',
                responseTime,
                timestamp: Date.now()
              });
            }
          });
        }
      }).on('error', (err) => {
        clearTimeout(timeoutId);
        if (!resolved) {
          resolved = true;
          console.log(`[Monitoring] SSH error for ${card.name}: ${err.message}`);
          resolve({
            status: 'down',
            error: err.message,
            responseTime: Date.now() - start,
            timestamp: Date.now()
          });
        }
      });

      // Подготавливаем конфигурацию SSH
      const sshConfig = {
        host: integration.host,
        port: parseInt(integration.port) || 22,
        username: integration.username || 'root',
        readyTimeout: timeout
      };

      // Обработка ключа
      if (integration.privateKey) {
        if (integration.privateKey.startsWith('-----')) {
          sshConfig.privateKey = integration.privateKey;
        } else {
          // Это имя файла ключа
          const keyPath = path.join(SSH_KEYS_DIR, integration.privateKey);
          try {
            const keyContent = require('fs').readFileSync(keyPath, 'utf8');
            sshConfig.privateKey = keyContent;
            console.log(`[Monitoring] SSH using key file: ${integration.privateKey}`);
          } catch (e) {
            console.log(`[Monitoring] SSH key not found: ${keyPath}`);
            resolve({
              status: 'down',
              error: 'SSH key not found',
              responseTime: Date.now() - start,
              timestamp: Date.now()
            });
            return;
          }
        }
        if (integration.passphrase) {
          sshConfig.passphrase = integration.passphrase;
        }
      } else if (integration.password) {
        sshConfig.password = integration.password;
        console.log(`[Monitoring] SSH using password auth`);
      } else {
        // Нет ни ключа, ни пароля - пробуем без аутентификации или с дефолтным ключом
        console.log(`[Monitoring] SSH no auth configured for ${card.name}`);
      }

      try {
        conn.connect(sshConfig);
      } catch (err) {
        clearTimeout(timeoutId);
        if (!resolved) {
          resolved = true;
          resolve({
            status: 'down',
            error: err.message,
            responseTime: Date.now() - start,
            timestamp: Date.now()
          });
        }
      }
    });
  }

  // Универсальная проверка (HTTP или SSH)
  async checkCard(card, timeout = 10000) {
    if (card.integration?.type === 'ssh') {
      return this.checkSSH(card, timeout);
    } else if (card.url) {
      return this.checkUrl(card.url, timeout);
    }
    return {
      status: 'down',
      error: 'No URL or SSH configured',
      responseTime: 0,
      timestamp: Date.now()
    };
  }

  // Проверка с ретраями (универсальная)
  async checkWithRetries(card, timeout, retries) {
    let lastResult;
    for (let i = 0; i <= retries; i++) {
      lastResult = await this.checkCard(card, timeout * 1000);
      if (lastResult.status === 'up') {
        return lastResult;
      }
      // Пауза перед ретраем
      if (i < retries) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    return lastResult;
  }

  // Отправка Telegram уведомления
  async sendTelegramNotification(card, check, previousStatus) {
    if (!this.config?.settings?.telegram?.enabled) {
      console.log(`[Monitoring] Telegram disabled, skipping notification for ${card.name}`);
      return;
    }
    
    const { botToken, chatId, notifyDown, notifyUp, notifyDownTopicId, notifyUpTopicId } = this.config.settings.telegram;
    if (!botToken || !chatId) {
      console.log(`[Monitoring] Telegram not configured (no token or chatId)`);
      return;
    }

    // Определяем тип события
    const isFirstDown = previousStatus === 'unknown' && check.status === 'down';
    const isDown = check.status === 'down' && previousStatus !== 'down';
    const isUp = check.status === 'up' && previousStatus === 'down';

    // Проверяем настройки уведомлений
    if ((isDown || isFirstDown) && !notifyDown) {
      console.log(`[Monitoring] notifyDown disabled, skipping`);
      return;
    }
    if (isUp && !notifyUp) {
      console.log(`[Monitoring] notifyUp disabled, skipping`);
      return;
    }

    if (!isDown && !isFirstDown && !isUp) {
      return;
    }

    const emoji = check.status === 'up' ? '✅' : '🔴';
    const statusText = check.status === 'up' ? 'ONLINE' : 'OFFLINE';
    const isSSH = card.integration?.type === 'ssh';
    const target = isSSH ? `SSH: ${card.integration.host}` : `URL: ${card.url}`;
    
    // Используем timezone из настроек
    const timezone = this.config?.settings?.timezone || 'Europe/Moscow';
    const timeStr = new Date().toLocaleString('ru-RU', { timeZone: timezone });
    
    const message = `${emoji} <b>${card.name}</b> is ${statusText}

${check.status === 'up' ? `Response time: ${check.responseTime}ms` : `Error: ${check.error || `HTTP ${check.statusCode}`}`}
${target}
Time: ${timeStr}`;

    // Выбираем topic_id в зависимости от статуса
    const topicId = check.status === 'up' ? notifyUpTopicId : notifyDownTopicId;

    try {
      await sendTelegramMessage(botToken, chatId, message, topicId);
      console.log(`[Monitoring] Telegram notification sent for ${card.name}: ${statusText}`);
    } catch (err) {
      console.error('[Monitoring] Failed to send Telegram:', err.message);
    }
  }

  // Запуск мониторинга для одной карточки
  startCardMonitoring(card) {
    // Проверяем что есть что мониторить (URL или SSH)
    const hasTarget = card.url || (card.integration?.type === 'ssh' && card.integration?.host);
    if (!hasTarget || !card.monitoring?.enabled) return;
    if (this.intervals[card.id]) return; // уже запущен

    const interval = (this.config?.settings?.monitoring?.interval || 60) * 1000;
    const timeout = this.config?.settings?.monitoring?.timeout || 10;
    const retries = this.config?.settings?.monitoring?.retries || 2;

    const target = card.integration?.type === 'ssh' 
      ? `SSH:${card.integration.host}` 
      : card.url;
    console.log(`[Monitoring] Starting monitoring for ${card.name} (${target}) every ${interval/1000}s`);

    // Инициализируем историю если нет
    if (!this.history[card.id]) {
      this.history[card.id] = { checks: [], stats: {} };
    }

    // Сохраняем только ID карточки - данные будем получать при каждой проверке
    const cardId = card.id;

    // Первая проверка сразу
    this.performCheckById(cardId, timeout, retries);

    // Запускаем интервал - при каждой проверке получаем актуальные данные
    this.intervals[card.id] = setInterval(() => {
      this.performCheckById(cardId, timeout, retries);
    }, interval);
  }

  // Проверка по ID - получает актуальные данные карточки
  async performCheckById(cardId, timeout, retries) {
    // Получаем актуальные данные карточки из конфига
    const card = this.config?.cards?.find(c => c.id === cardId);
    if (!card) {
      console.log(`[Monitoring] Card ${cardId} not found, stopping monitoring`);
      this.stopCardMonitoring(cardId);
      return;
    }

    // Проверяем что мониторинг всё ещё включен
    if (!card.monitoring?.enabled) {
      console.log(`[Monitoring] Monitoring disabled for ${card.name}, stopping`);
      this.stopCardMonitoring(cardId);
      return;
    }

    // Проверяем что есть цель для мониторинга
    const hasTarget = card.url || (card.integration?.type === 'ssh' && card.integration?.host);
    if (!hasTarget) {
      console.log(`[Monitoring] No target for ${card.name}, skipping check`);
      return;
    }

    await this.performCheck(card, timeout, retries);
  }

  async performCheck(card, timeout, retries) {
    const result = await this.checkWithRetries(card, timeout, retries);
    
    // Получаем предыдущий статус
    const previousStatus = this.lastStatus[card.id] || 'unknown';
    
    // Логируем результат проверки
    const target = card.integration?.type === 'ssh' ? card.integration.host : card.url;
    console.log(`[Monitoring] Check ${card.name} (${target}): ${result.status} ${result.responseTime ? `(${result.responseTime}ms)` : ''} ${result.error || ''}`);
    
    // Сохраняем результат
    if (!this.history[card.id]) {
      this.history[card.id] = { checks: [], stats: {} };
    }
    
    this.history[card.id].checks.push(result);
    this.lastStatus[card.id] = result.status;

    // Ограничиваем размер истории (max 10000 записей на карточку)
    if (this.history[card.id].checks.length > 10000) {
      this.history[card.id].checks = this.history[card.id].checks.slice(-5000);
    }

    // Пересчитываем статистику
    this.updateStats(card.id);

    // Отправляем уведомление если:
    // 1. Статус изменился с известного на другой
    // 2. ИЛИ первая проверка показала DOWN (важно знать о падении сразу)
    const statusChanged = result.status !== previousStatus && previousStatus !== 'unknown';
    const firstCheckDown = previousStatus === 'unknown' && result.status === 'down';
    
    if (statusChanged || firstCheckDown) {
      console.log(`[Monitoring] Status change for ${card.name}: ${previousStatus} -> ${result.status}`);
      await this.sendTelegramNotification(card, result, previousStatus);
    }

    // Сохраняем каждые 10 проверок
    const totalChecks = Object.values(this.history).reduce((sum, h) => sum + (h.checks?.length || 0), 0);
    if (totalChecks % 10 === 0) {
      await this.saveHistory();
    }
  }

  // Обновление статистики
  updateStats(cardId) {
    const checks = this.history[cardId]?.checks || [];
    if (checks.length === 0) return;

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    
    // Статистика за разные периоды
    const periods = {
      '1h': now - 60 * 60 * 1000,
      '24h': now - day,
      '7d': now - 7 * day,
      '30d': now - 30 * day
    };

    const stats = {};
    Object.entries(periods).forEach(([period, cutoff]) => {
      const periodChecks = checks.filter(c => c.timestamp > cutoff);
      if (periodChecks.length === 0) {
        stats[period] = null;
        return;
      }

      const upChecks = periodChecks.filter(c => c.status === 'up');
      const responseTimes = upChecks.map(c => c.responseTime).filter(t => t > 0);

      stats[period] = {
        uptime: ((upChecks.length / periodChecks.length) * 100).toFixed(2),
        totalChecks: periodChecks.length,
        upCount: upChecks.length,
        downCount: periodChecks.filter(c => c.status === 'down').length,
        avgResponseTime: responseTimes.length > 0 
          ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
          : null
      };
    });

    this.history[cardId].stats = stats;
    this.history[cardId].lastCheck = checks[checks.length - 1];
    this.history[cardId].currentStatus = this.lastStatus[cardId];
  }

  // Остановка мониторинга для карточки
  stopCardMonitoring(cardId) {
    if (this.intervals[cardId]) {
      clearInterval(this.intervals[cardId]);
      delete this.intervals[cardId];
      console.log(`[Monitoring] Stopped monitoring for card ${cardId}`);
    }
  }

  // Обновление конфига (для получения актуальных данных карточек)
  updateConfig(config) {
    this.config = config;
  }

  // Запуск всего мониторинга
  async start(config) {
    // Сначала останавливаем старые интервалы
    this.stop();
    
    this.config = config;
    
    if (!config?.settings?.monitoring?.enabled) {
      console.log('[Monitoring] Monitoring is disabled globally');
      return;
    }

    console.log('[Monitoring] Enabling monitoring...');

    // Очищаем старую историю
    this.cleanOldHistory(config.settings.monitoring.historyDays || 7);

    // Запускаем мониторинг для всех карточек с включённым мониторингом
    const cards = config.cards || [];
    let startedCount = 0;
    cards.forEach(card => {
      if (card.monitoring?.enabled) {
        const hasTarget = card.url || (card.integration?.type === 'ssh' && card.integration?.host);
        if (hasTarget) {
          this.startCardMonitoring(card);
          startedCount++;
        } else {
          console.log(`[Monitoring] Card ${card.name} has monitoring enabled but no target (url or ssh host)`);
        }
      }
    });

    this.isRunning = true;
    console.log(`[Monitoring] Started monitoring for ${startedCount} cards`);
  }

  // Остановка всего мониторинга
  stop() {
    Object.keys(this.intervals).forEach(cardId => {
      this.stopCardMonitoring(cardId);
    });
    this.isRunning = false;
    this.saveHistory();
    console.log('[Monitoring] Stopped all monitoring');
  }

  // Перезапуск с новым конфигом
  async restart(config) {
    this.stop();
    await this.start(config);
  }

  // Обновление мониторинга для одной карточки
  async updateCardMonitoring(card) {
    // Перезагружаем конфиг для актуальных глобальных настроек
    try {
      this.config = await loadConfig();
    } catch (err) {
      console.error('[Monitoring] Failed to reload config:', err.message);
    }
    
    this.stopCardMonitoring(card.id);
    
    if (card.monitoring?.enabled && this.config?.settings?.monitoring?.enabled) {
      const hasTarget = card.url || (card.integration?.type === 'ssh' && card.integration?.host);
      if (hasTarget) {
        this.startCardMonitoring(card);
        console.log(`[Monitoring] Started monitoring for: ${card.name}`);
      } else {
        console.log(`[Monitoring] No target for card: ${card.name}`);
      }
    } else {
      console.log(`[Monitoring] Monitoring disabled for: ${card.name} (card: ${card.monitoring?.enabled}, global: ${this.config?.settings?.monitoring?.enabled})`);
    }
  }

  // Получение статуса карточки
  getCardStatus(cardId) {
    return {
      status: this.lastStatus[cardId] || 'unknown',
      ...this.history[cardId]
    };
  }

  // Получение всех статусов
  getAllStatuses() {
    const result = {};
    Object.keys(this.history).forEach(cardId => {
      result[cardId] = this.getCardStatus(cardId);
    });
    return result;
  }
}

// Создаём глобальный экземпляр мониторинга
const monitoringService = new MonitoringService();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// Serve static frontend in production
if (IS_PRODUCTION) {
  // Middleware для отключения кэша для критичных файлов
  app.use((req, res, next) => {
    // Service Worker и HTML - никогда не кэшировать
    if (req.path === '/sw.js' || req.path === '/' || req.path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    // JS/CSS файлы с хэшами - долгий кэш
    else if (req.path.match(/\.[a-f0-9]{8}\.(js|css)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    next();
  });
  
  app.use(express.static(path.join(__dirname, 'public')));
}

app.use('/icons', express.static(ICONS_DIR));

// Multer for file uploads
const storage = multer.diskStorage({
  destination: ICONS_DIR,
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Default config
const defaultConfig = {
  settings: {
    title: "HomeDash",
    columns: 4,
    showClock: true,
    showGreeting: true,
    userName: "Константин",
    weatherCity: "",
    timezone: "Europe/Moscow",
    // Monitoring settings
    monitoring: {
      enabled: false,
      interval: 60,          // секунд между проверками
      timeout: 10,           // таймаут запроса в секундах
      retries: 2,            // повторных попыток перед down
      historyDays: 7         // дней хранения истории
    },
    // Telegram notifications
    telegram: {
      enabled: false,
      botToken: "",
      chatId: "",
      notifyDown: true,
      notifyUp: true,
      notifyDegraded: false  // уведомлять о медленных ответах
    }
  },
  categories: [
    { id: "services", name: "Домашние сервисы", icon: "server", order: 0 },
    { id: "monitoring", name: "Мониторинг", icon: "activity", order: 1 },
    { id: "hosting", name: "Хостинг и VPS", icon: "cloud", order: 2 },
    { id: "tools", name: "Инструменты", icon: "wrench", order: 3 }
  ],
  cards: [
    {
      id: "1",
      name: "Proxmox",
      description: "Виртуализация",
      url: "https://proxmox.local:8006",
      icon: "proxmox",
      category: "services",
      color: "#e57000",
      integration: {
        type: "proxmox",
        host: "",
        tokenId: "",
        tokenSecret: ""
      },
      order: 0
    },
    {
      id: "2", 
      name: "Home Assistant",
      description: "Умный дом",
      url: "http://homeassistant.local:8123",
      icon: "home-assistant",
      category: "services",
      color: "#41bdf5",
      integration: {
        type: "homeassistant",
        host: "",
        token: ""
      },
      order: 1
    },
    {
      id: "3",
      name: "AdGuard Home",
      description: "DNS фильтрация",
      url: "http://adguard.local",
      icon: "adguard",
      category: "monitoring",
      color: "#68bc71",
      integration: {
        type: "adguard",
        host: "",
        username: "",
        password: ""
      },
      order: 0
    },
    {
      id: "4",
      name: "NPM Plus",
      description: "Reverse Proxy",
      url: "http://npm.local:81",
      icon: "nginx",
      category: "services",
      color: "#009639",
      integration: {
        type: "npm",
        host: "",
        email: "",
        password: ""
      },
      order: 2
    }
  ]
};

// Initialize data directory and config
async function initData() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(ICONS_DIR, { recursive: true });
    
    try {
      await fs.access(CONFIG_FILE);
    } catch {
      await fs.writeFile(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
      console.log('Created default config');
    }
  } catch (err) {
    console.error('Error initializing data:', err);
  }
}

// Load config
async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return defaultConfig;
  }
}

// Save config
async function saveConfig(config) {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  // Обновляем конфиг в мониторинге для актуальных данных карточек
  monitoringService.updateConfig(config);
}

// ============ URL Availability Check ============
app.post('/api/check-url', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.json({ success: false, error: 'URL не указан' });
  }

  const start = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetchWithSSL(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'HomeDash/1.0' }
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

// ============ API Routes ============

// Get full config
app.get('/api/config', async (req, res) => {
  const config = await loadConfig();
  // Remove sensitive data from integration configs
  const safeConfig = {
    ...config,
    cards: config.cards.map(card => ({
      ...card,
      integration: card.integration ? { type: card.integration.type } : null
    }))
  };
  res.json(safeConfig);
});

// Update settings
app.put('/api/settings', async (req, res) => {
  const config = await loadConfig();
  const oldMonitoringEnabled = config.settings?.monitoring?.enabled;
  config.settings = { ...config.settings, ...req.body };
  await saveConfig(config);
  
  // Перезапускаем мониторинг если изменились настройки
  const newMonitoringEnabled = req.body?.monitoring?.enabled ?? config.settings?.monitoring?.enabled;
  console.log(`[Settings] Monitoring: old=${oldMonitoringEnabled}, new=${newMonitoringEnabled}`);
  
  if (oldMonitoringEnabled !== newMonitoringEnabled || req.body?.monitoring) {
    console.log('[Settings] Monitoring settings changed, restarting service...');
    // Перезагружаем конфиг чтобы получить актуальные данные
    const freshConfig = await loadConfig();
    await monitoringService.start(freshConfig);
  }
  
  res.json(config.settings);
});

// ============ Categories ============

app.get('/api/categories', async (req, res) => {
  const config = await loadConfig();
  res.json(config.categories);
});

app.post('/api/categories', async (req, res) => {
  const config = await loadConfig();
  const newCategory = {
    id: Date.now().toString(),
    ...req.body,
    order: config.categories.length
  };
  config.categories.push(newCategory);
  await saveConfig(config);
  res.json(newCategory);
});

app.put('/api/categories/:id', async (req, res) => {
  const config = await loadConfig();
  const idx = config.categories.findIndex(c => c.id === req.params.id);
  if (idx !== -1) {
    config.categories[idx] = { ...config.categories[idx], ...req.body };
    await saveConfig(config);
    res.json(config.categories[idx]);
  } else {
    res.status(404).json({ error: 'Category not found' });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  const config = await loadConfig();
  config.categories = config.categories.filter(c => c.id !== req.params.id);
  // Also remove cards in this category
  config.cards = config.cards.filter(c => c.category !== req.params.id);
  await saveConfig(config);
  res.json({ success: true });
});

// ============ Cards ============

app.get('/api/cards', async (req, res) => {
  const config = await loadConfig();
  res.json(config.cards.map(card => ({
    ...card,
    integration: card.integration ? { type: card.integration.type } : null
  })));
});

app.post('/api/cards', async (req, res) => {
  const config = await loadConfig();
  const newCard = {
    id: Date.now().toString(),
    ...req.body,
    order: config.cards.filter(c => c.category === req.body.category).length
  };
  config.cards.push(newCard);
  await saveConfig(config);
  
  // Запускаем мониторинг для новой карточки если он включен
  if (newCard.monitoring?.enabled && config.settings?.monitoring?.enabled) {
    console.log(`[Cards] Starting monitoring for new card: ${newCard.name}`);
    monitoringService.updateConfig(config);
    monitoringService.updateCardMonitoring(newCard);
  }
  
  res.json(newCard);
});

app.put('/api/cards/:id', async (req, res) => {
  const config = await loadConfig();
  const idx = config.cards.findIndex(c => c.id === req.params.id);
  if (idx !== -1) {
    const oldCard = config.cards[idx];
    const newCard = { ...config.cards[idx], ...req.body };
    
    // Если изменилась категория - обновляем order
    if (oldCard.category !== newCard.category) {
      newCard.order = config.cards.filter(c => c.category === newCard.category).length;
    }
    
    config.cards[idx] = newCard;
    await saveConfig(config);
    
    // Перезапуск мониторинга если изменился URL или настройки мониторинга
    const urlChanged = oldCard.url !== newCard.url;
    const monitoringChanged = JSON.stringify(oldCard.monitoring) !== JSON.stringify(newCard.monitoring);
    const integrationChanged = JSON.stringify(oldCard.integration) !== JSON.stringify(newCard.integration);
    
    if (urlChanged || monitoringChanged || integrationChanged) {
      console.log(`[Cards] Restarting monitoring for ${newCard.name} (url/monitoring/integration changed)`);
      monitoringService.updateCardMonitoring(newCard);
    }
    
    res.json(config.cards[idx]);
  } else {
    res.status(404).json({ error: 'Card not found' });
  }
});

app.delete('/api/cards/:id', async (req, res) => {
  const config = await loadConfig();
  const cardId = req.params.id;
  
  // Останавливаем мониторинг перед удалением
  monitoringService.stopCardMonitoring(cardId);
  
  config.cards = config.cards.filter(c => c.id !== cardId);
  await saveConfig(config);
  res.json({ success: true });
});

// Reorder cards
app.put('/api/cards/reorder', async (req, res) => {
  const config = await loadConfig();
  const { cardIds } = req.body;
  cardIds.forEach((id, index) => {
    const card = config.cards.find(c => c.id === id);
    if (card) card.order = index;
  });
  await saveConfig(config);
  res.json({ success: true });
});

// ============ Icon Upload ============

app.post('/api/icons/upload', upload.single('icon'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ filename: req.file.filename, path: `/icons/${req.file.filename}` });
});

// Fetch favicon from URL
app.post('/api/icons/fetch-favicon', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // Нормализуем URL
    let baseUrl = url.trim();
    if (!baseUrl.startsWith('http')) {
      baseUrl = 'https://' + baseUrl;
    }
    const urlObj = new URL(baseUrl);
    const origin = urlObj.origin;

    // Пробуем разные варианты favicon
    const faviconUrls = [
      `${origin}/favicon.ico`,
      `${origin}/favicon.png`,
      `${origin}/apple-touch-icon.png`,
      `${origin}/apple-touch-icon-precomposed.png`
    ];

    // Сначала пробуем получить HTML и найти link rel="icon"
    try {
      const htmlResponse = await fetchWithSSL(baseUrl, { 
        timeout: 8000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' }
      });
      const html = await htmlResponse.text();
      
      // Ищем link с иконкой (различные форматы)
      const linkMatches = html.match(/<link[^>]*(?:rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']|href=["']([^"']+)["'][^>]*rel=["'][^"']*icon[^"']*["'])[^>]*>/gi) || [];
      
      for (const match of linkMatches) {
        const hrefMatch = match.match(/href=["']([^"']+)["']/i);
        if (hrefMatch) {
          let iconUrl = hrefMatch[1];
          // Пропускаем data: URLs
          if (iconUrl.startsWith('data:')) continue;
          
          // Преобразуем относительный URL в абсолютный
          if (iconUrl.startsWith('//')) {
            iconUrl = urlObj.protocol + iconUrl;
          } else if (iconUrl.startsWith('/')) {
            iconUrl = origin + iconUrl;
          } else if (!iconUrl.startsWith('http')) {
            iconUrl = origin + '/' + iconUrl;
          }
          // Добавляем в начало списка если ещё нет
          if (!faviconUrls.includes(iconUrl)) {
            faviconUrls.unshift(iconUrl);
          }
        }
      }

      // Ищем apple-touch-icon
      const appleTouchMatch = html.match(/<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i);
      if (appleTouchMatch && appleTouchMatch[1] && !appleTouchMatch[1].startsWith('data:')) {
        let iconUrl = appleTouchMatch[1];
        if (iconUrl.startsWith('//')) iconUrl = urlObj.protocol + iconUrl;
        else if (iconUrl.startsWith('/')) iconUrl = origin + iconUrl;
        else if (!iconUrl.startsWith('http')) iconUrl = origin + '/' + iconUrl;
        if (!faviconUrls.includes(iconUrl)) faviconUrls.unshift(iconUrl);
      }

      // Ищем meta og:image
      const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
      if (ogImage && ogImage[1] && !ogImage[1].startsWith('data:')) {
        let imgUrl = ogImage[1];
        if (imgUrl.startsWith('//')) imgUrl = urlObj.protocol + imgUrl;
        else if (imgUrl.startsWith('/')) imgUrl = origin + imgUrl;
        faviconUrls.push(imgUrl);
      }

      // Ищем twitter:image
      const twitterImage = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
      if (twitterImage && twitterImage[1] && !twitterImage[1].startsWith('data:')) {
        let imgUrl = twitterImage[1];
        if (imgUrl.startsWith('//')) imgUrl = urlObj.protocol + imgUrl;
        else if (imgUrl.startsWith('/')) imgUrl = origin + imgUrl;
        faviconUrls.push(imgUrl);
      }

      // Ищем логотипы в img тегах с характерными классами/id
      const logoPatterns = [
        /<img[^>]*(?:class|id)=["'][^"']*logo[^"']*["'][^>]*src=["']([^"']+)["']/gi,
        /<img[^>]*src=["']([^"']+)["'][^>]*(?:class|id)=["'][^"']*logo[^"']*["']/gi,
        /<img[^>]*src=["']([^"']*logo[^"']+)["']/gi,
        /<img[^>]*alt=["'][^"']*logo[^"']*["'][^>]*src=["']([^"']+)["']/gi
      ];

      for (const pattern of logoPatterns) {
        const matches = html.matchAll(pattern);
        for (const match of matches) {
          let imgUrl = match[1];
          if (!imgUrl || imgUrl.startsWith('data:')) continue;
          if (imgUrl.startsWith('//')) imgUrl = urlObj.protocol + imgUrl;
          else if (imgUrl.startsWith('/')) imgUrl = origin + imgUrl;
          else if (!imgUrl.startsWith('http')) imgUrl = origin + '/' + imgUrl;
          if (!faviconUrls.includes(imgUrl)) faviconUrls.push(imgUrl);
        }
      }

      // Ищем SVG иконки
      const svgIconMatch = html.match(/<link[^>]*href=["']([^"']+\.svg)["'][^>]*rel=["'][^"']*icon[^"']*["']/i);
      if (svgIconMatch && svgIconMatch[1]) {
        let svgUrl = svgIconMatch[1];
        if (svgUrl.startsWith('//')) svgUrl = urlObj.protocol + svgUrl;
        else if (svgUrl.startsWith('/')) svgUrl = origin + svgUrl;
        else if (!svgUrl.startsWith('http')) svgUrl = origin + '/' + svgUrl;
        if (!faviconUrls.includes(svgUrl)) faviconUrls.unshift(svgUrl);
      }

    } catch (e) {
      console.log('[Favicon] Failed to parse HTML:', e.message);
    }

    // Пробуем скачать первый доступный favicon
    for (const faviconUrl of faviconUrls) {
      try {
        console.log(`[Favicon] Trying: ${faviconUrl}`);
        const response = await fetchWithSSL(faviconUrl, { 
          timeout: 8000,
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/*,*/*'
          }
        });
        
        if (!response.ok) continue;
        
        const contentType = response.headers.get('content-type') || '';
        // Принимаем любые изображения или .ico файлы
        const isImage = contentType.includes('image') || 
                        faviconUrl.endsWith('.ico') || 
                        faviconUrl.endsWith('.png') || 
                        faviconUrl.endsWith('.svg') ||
                        faviconUrl.endsWith('.jpg') ||
                        faviconUrl.endsWith('.jpeg');
        
        if (!isImage && !contentType.includes('octet-stream')) continue;
        
        const buffer = await response.buffer();
        if (buffer.length < 100) continue; // Слишком маленький файл
        
        // Определяем расширение
        let ext = '.ico';
        if (contentType.includes('png')) ext = '.png';
        else if (contentType.includes('svg')) ext = '.svg';
        else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';
        else if (faviconUrl.includes('.png')) ext = '.png';
        else if (faviconUrl.includes('.svg')) ext = '.svg';
        
        // Сохраняем файл
        const filename = `favicon-${Date.now()}${ext}`;
        const filepath = path.join(ICONS_DIR, filename);
        await fs.writeFile(filepath, buffer);
        
        console.log(`[Favicon] Saved: ${filename} (${buffer.length} bytes)`);
        
        return res.json({ 
          success: true, 
          filename, 
          path: `/icons/${filename}`,
          source: faviconUrl
        });
      } catch (e) {
        console.log(`[Favicon] Failed ${faviconUrl}: ${e.message}`);
        continue;
      }
    }

    // Пробуем внешние API сервисы
    const domain = urlObj.hostname;
    const externalApis = [
      `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
      `https://icons.duckduckgo.com/ip3/${domain}.ico`,
      `https://logo.clearbit.com/${domain}`,
      `https://icon.horse/icon/${domain}`,
      `https://favicone.com/${domain}?s=128`
    ];

    console.log('[Favicon] Trying external APIs...');
    
    for (const apiUrl of externalApis) {
      try {
        console.log(`[Favicon] API: ${apiUrl}`);
        const response = await fetchWithSSL(apiUrl, {
          timeout: 8000,
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/*,*/*'
          }
        });
        
        if (!response.ok) continue;
        
        const buffer = await response.buffer();
        if (buffer.length < 100) continue;
        
        // Google возвращает дефолтную иконку если не нашел - пропускаем маленькие
        if (apiUrl.includes('google.com') && buffer.length < 500) continue;
        
        const contentType = response.headers.get('content-type') || '';
        let ext = '.png';
        if (contentType.includes('ico') || apiUrl.includes('.ico')) ext = '.ico';
        else if (contentType.includes('svg')) ext = '.svg';
        else if (contentType.includes('jpeg')) ext = '.jpg';
        
        const filename = `favicon-${Date.now()}${ext}`;
        const filepath = path.join(ICONS_DIR, filename);
        await fs.writeFile(filepath, buffer);
        
        console.log(`[Favicon] Saved from API: ${filename} (${buffer.length} bytes)`);
        
        return res.json({ 
          success: true, 
          filename, 
          path: `/icons/${filename}`,
          source: apiUrl
        });
      } catch (e) {
        continue;
      }
    }

    res.status(404).json({ error: 'No favicon found' });
  } catch (err) {
    console.error('[Favicon] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============ Integration Config ============

app.put('/api/cards/:id/integration', async (req, res) => {
  const config = await loadConfig();
  const idx = config.cards.findIndex(c => c.id === req.params.id);
  if (idx !== -1) {
    config.cards[idx].integration = req.body;
    await saveConfig(config);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Card not found' });
  }
});

// Get full integration data for a card (for editing)
app.get('/api/cards/:id/integration', async (req, res) => {
  const config = await loadConfig();
  const card = config.cards.find(c => c.id === req.params.id);
  if (card) {
    res.json(card.integration || null);
  } else {
    res.status(404).json({ error: 'Card not found' });
  }
});

// Weather Widget (header, not card-based)
app.get('/api/weather', async (req, res) => {
  const config = await loadConfig();
  const city = config.settings?.weatherCity;
  
  if (!city) {
    return res.json({ configured: false });
  }

  try {
    // Используем wttr.in (бесплатно, без ключа)
    const response = await fetch(
      `https://wttr.in/${encodeURIComponent(city)}?format=j1`
    );
    const data = await response.json();
    const current = data.current_condition[0];

    const desc = current.weatherDesc[0].value.toLowerCase();
    
    // Map description to icon code
    let iconCode = 'default';
    if (desc.includes('sunny') || desc.includes('clear')) {
      const hour = new Date().getHours();
      iconCode = (hour >= 6 && hour < 20) ? 'sunny' : 'clear';
    } else if (desc.includes('partly cloudy')) {
      iconCode = 'partly-cloudy';
    } else if (desc.includes('cloudy')) {
      iconCode = 'cloudy';
    } else if (desc.includes('overcast')) {
      iconCode = 'overcast';
    } else if (desc.includes('mist') || desc.includes('fog')) {
      iconCode = 'fog';
    } else if (desc.includes('rain') || desc.includes('drizzle')) {
      iconCode = 'rain';
    } else if (desc.includes('snow') || desc.includes('sleet')) {
      iconCode = 'snow';
    } else if (desc.includes('thunder')) {
      iconCode = 'thunder';
    }

    res.json({
      configured: true,
      temp: parseInt(current.temp_C),
      feelsLike: parseInt(current.FeelsLikeC),
      humidity: parseInt(current.humidity),
      wind: (parseInt(current.windspeedKmph) / 3.6).toFixed(1),
      description: current.weatherDesc[0].value,
      iconCode,
      city: data.nearest_area[0].areaName[0].value
    });
  } catch (err) {
    console.error('[Weather] Error:', err.message);
    res.json({ configured: true, error: err.message });
  }
});

// ============ Integration Data Fetchers ============

// Helper: get host from integration or card URL (always removes trailing slash)
const getIntegrationHost = (card) => {
  let host = card?.integration?.host || card?.url || null;
  if (host) {
    host = host.replace(/\/+$/, ''); // remove all trailing slashes
  }
  return host;
};

// Proxmox
app.get('/api/integrations/proxmox/:cardId', async (req, res) => {
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
app.get('/api/integrations/adguard/:cardId', async (req, res) => {
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
app.get('/api/integrations/homeassistant/:cardId', async (req, res) => {
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
app.get('/api/integrations/npm/:cardId', async (req, res) => {
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
app.get('/api/integrations/weather/:cardId', async (req, res) => {
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
app.get('/api/integrations/wikijs/:cardId', async (req, res) => {
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
app.get('/api/integrations/ssh/:cardId', async (req, res) => {
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
app.get('/api/integrations/mikrotik/:cardId', async (req, res) => {
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
    // Sanitize filename
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, safeName);
  }
});

const uploadSSHKey = multer({ 
  storage: sshKeyStorage,
  limits: { fileSize: 16384 }, // Max 16KB for SSH keys
  fileFilter: (req, file, cb) => {
    // Only allow text files
    cb(null, true);
  }
});

// List SSH keys
app.get('/api/ssh/keys', async (req, res) => {
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
app.post('/api/ssh/keys', uploadSSHKey.single('key'), async (req, res) => {
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
app.delete('/api/ssh/keys/:name', async (req, res) => {
  try {
    const keyPath = path.join(SSH_KEYS_DIR, req.params.name);
    await fs.unlink(keyPath);
    res.json({ success: true });
  } catch (err) {
    res.status(404).json({ error: 'Key not found' });
  }
});

// Test SSH connection
app.post('/api/ssh/test', async (req, res) => {
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

// Auto-setup SSH keys - generate keypair, install on remote host
app.post('/api/ssh/setup', async (req, res) => {
  const { host, port = 22, username, password, force = false } = req.body;
  
  if (!host || !username || !password) {
    return res.status(400).json({ success: false, error: 'Host, username and password are required' });
  }

  try {
    // Ensure ssh_keys directory exists
    await fs.mkdir(SSH_KEYS_DIR, { recursive: true });
    
    // Check if key already exists for this host
    const sanitizedHost = host.replace(/[^a-zA-Z0-9.-]/g, '_');
    const existingFiles = await fs.readdir(SSH_KEYS_DIR);
    const existingKey = existingFiles.find(f => f.includes(sanitizedHost) && !f.endsWith('.pub'));
    
    if (existingKey && !force) {
      // Try to connect with existing key first
      console.log(`[SSH Setup] Found existing key for ${host}: ${existingKey}, testing...`);
      try {
        const existingKeyPath = path.join(SSH_KEYS_DIR, existingKey);
        const existingPrivateKey = await fs.readFile(existingKeyPath, 'utf8');
        
        const testResult = await sshExec({
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
          message: `Существующий ключ работает: ${existingKey}`,
          existing: true
        });
      } catch (testErr) {
        console.log(`[SSH Setup] Existing key failed: ${testErr.message}, will create new`);
      }
    }
    
    // Generate unique key name based on host
    const keyName = `homedash_${sanitizedHost}_${Date.now()}`;
    const privateKeyPath = path.join(SSH_KEYS_DIR, keyName);
    const publicKeyPath = path.join(SSH_KEYS_DIR, `${keyName}.pub`);
    
    console.log(`[SSH Setup] Generating keypair for ${username}@${host}...`);
    
    // Generate Ed25519 keypair using ssh2 utils
    const keyPair = sshUtils.generateKeyPairSync('ed25519', {
      comment: `homedash@${host}`
    });
    
    const privateKeyPEM = keyPair.private;
    const publicKeySSH = keyPair.public;
    
    console.log(`[SSH Setup] Connecting to ${host} with password...`);
    
    // Connect with password and install public key
    await new Promise((resolve, reject) => {
      const conn = new SSHClient();
      
      const timeout = setTimeout(() => {
        conn.end();
        reject(new Error('Connection timeout'));
      }, 60000);
      
      conn.on('ready', () => {
        console.log(`[SSH Setup] Connected, installing public key...`);
        
        // Commands to install the key
        const commands = [
          'mkdir -p ~/.ssh',
          'chmod 700 ~/.ssh',
          'touch ~/.ssh/authorized_keys',
          'chmod 600 ~/.ssh/authorized_keys',
          `echo "${publicKeySSH}" >> ~/.ssh/authorized_keys`,
          // Remove duplicate lines (in case key was added before)
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
          
          stream.on('data', (data) => {
            stdout += data.toString();
          });
          
          stream.stderr.on('data', (data) => {
            stderr += data.toString();
          });
          
          stream.on('close', (code) => {
            clearTimeout(timeout);
            conn.end();
            console.log(`[SSH Setup] Command finished with code ${code}, stdout: ${stdout.trim()}`);
            if (code === 0 || stdout.includes('done')) {
              resolve();
            } else {
              reject(new Error(stderr || `Command failed with code ${code}`));
            }
          });
          
          stream.on('exit', (code) => {
            // Fallback if 'close' doesn't fire
            if (code === 0 || stdout.includes('done')) {
              clearTimeout(timeout);
              conn.end();
              resolve();
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
        readyTimeout: 30000 // Увеличиваем readyTimeout
      });
    });
    
    console.log(`[SSH Setup] Public key installed, saving private key...`);
    
    // Save private key locally
    await fs.writeFile(privateKeyPath, privateKeyPEM, { mode: 0o600 });
    await fs.writeFile(publicKeyPath, publicKeySSH, { mode: 0o644 });
    
    console.log(`[SSH Setup] Testing key-based authentication...`);
    
    // Test that key auth works
    const testResult = await sshExec({
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
      message: `SSH ключ создан и установлен на ${host}`
    });
    
  } catch (err) {
    console.error('[SSH Setup] Error:', err.message);
    res.json({ success: false, error: err.message });
  }
});

// ============ Integration Templates ============

// Find existing SSH key for host
app.get('/api/ssh/keys/host/:host', async (req, res) => {
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
app.delete('/api/ssh/keys/host/:host', async (req, res) => {
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
      { key: 'entities', label: 'Сущности для отображения', type: 'textarea', placeholder: 'sensor.temperature|Температура\nlight.living_room|Свет\nswitch.heater', hint: 'Формат: entity_id или entity_id|Имя' }
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

const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');

async function loadTemplates() {
  try {
    const data = await fs.readFile(TEMPLATES_FILE, 'utf8');
    const custom = JSON.parse(data);
    return [...builtinTemplates, ...custom];
  } catch {
    return builtinTemplates;
  }
}

async function saveCustomTemplates(templates) {
  const custom = templates.filter(t => !t.builtin);
  await fs.writeFile(TEMPLATES_FILE, JSON.stringify(custom, null, 2));
}

app.get('/api/integrations/templates', async (req, res) => {
  const templates = await loadTemplates();
  res.json(templates);
});

app.post('/api/integrations/templates', async (req, res) => {
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
});

app.delete('/api/integrations/templates/:type', async (req, res) => {
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
});

// ============ Docker Integration ============

app.get('/api/integrations/docker/:cardId', async (req, res) => {
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

// ============ CrowdSec Integration ============

app.get('/api/integrations/crowdsec/:cardId', async (req, res) => {
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

app.get('/api/integrations/openwrt/:cardId', async (req, res) => {
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

app.get('/api/integrations/custom/:cardId', async (req, res) => {
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
      headers['X-Api-Key'] = card.integration.apiKey;
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

// ============ Export/Import Config ============

// Export full backup as ZIP archive
app.get('/api/config/export', async (req, res) => {
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
    
    // Add config.json
    zip.addFile('backup.json', Buffer.from(JSON.stringify(backupData, null, 2), 'utf8'));
    
    // Add SSH keys if they exist
    try {
      const sshKeysExist = await fs.access(SSH_KEYS_DIR).then(() => true).catch(() => false);
      if (sshKeysExist) {
        const files = await fs.readdir(SSH_KEYS_DIR);
        for (const file of files) {
          const filePath = path.join(SSH_KEYS_DIR, file);
          const stat = await fs.stat(filePath);
          if (stat.isFile()) {
            const content = await fs.readFile(filePath);
            zip.addFile(`ssh_keys/${file}`, content);
          }
        }
      }
    } catch (err) {
      console.log('[Export] No SSH keys to backup:', err.message);
    }
    
    // Add custom icons if they exist
    try {
      const iconsExist = await fs.access(ICONS_DIR).then(() => true).catch(() => false);
      if (iconsExist) {
        const files = await fs.readdir(ICONS_DIR);
        for (const file of files) {
          const filePath = path.join(ICONS_DIR, file);
          const stat = await fs.stat(filePath);
          if (stat.isFile()) {
            const content = await fs.readFile(filePath);
            zip.addFile(`icons/${file}`, content);
          }
        }
      }
    } catch (err) {
      console.log('[Export] No custom icons to backup:', err.message);
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

// Import backup from ZIP archive
const backupUpload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

app.post('/api/config/import', backupUpload.single('backup'), async (req, res) => {
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
      // Legacy JSON import (for backwards compatibility)
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
    
    // Перезапускаем мониторинг с восстановленным конфигом
    console.log('[Import] Restarting monitoring with restored config...');
    monitoringService.updateConfig(config);
    await monitoringService.start(config);
    
    res.json({ success: true, message: 'Backup restored successfully' });
  } catch (err) {
    console.error('[Import] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ Auto-Discovery Engine ============

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
    authHint: 'Требуется API Token (Datacenter → Permissions → API Tokens)'
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
    authHint: 'Требуется Long-Lived Access Token (Profile → Security)'
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
    authHint: 'Требуется API Key (Settings → Authentication → API Keys)'
  },
  {
    type: 'openwrt',
    name: 'OpenWRT',
    probes: [
      { path: '/ubus', method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'list', params: ['*'] }) },
      { path: '/cgi-bin/luci/', method: 'GET' }
    ],
    detect: (response, headers, url) => {
      // Check for ubus response
      if (response?.jsonrpc === '2.0' || response?.id) {
        return { confidence: 90, details: 'OpenWRT (ubus API)' };
      }
      // Check for LuCI in response or headers
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
    authHint: 'Требуется API Key (Configuration → API Keys)'
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
    authHint: 'Требуется API Token (Settings → API/Web Interface → API Token)'
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
app.post('/api/discover', async (req, res) => {
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

        const response = await fetchWithSSL(probeUrl, {
          method: probe.method,
          headers,
          signal: controller.signal,
          redirect: 'follow'
        });

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
        // Log error for debugging
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
app.post('/api/discover/scan', async (req, res) => {
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
          // Port is open, try to identify
          const discoverResponse = await fetch(`http://localhost:${PORT}/api/discover`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          });
          const discovery = await discoverResponse.json();

          if (discovery.results?.length > 0) {
            found.push({
              url,
              port,
              protocol,
              ...discovery.results[0]
            });
          } else {
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

// Simple ping check
app.get('/api/ping', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.json({ error: 'No URL provided' });
  }

  try {
    const start = Date.now();
    const response = await fetchWithSSL(url, { 
      method: 'HEAD',
      timeout: 5000 
    });
    const latency = Date.now() - start;
    
    res.json({
      online: response.ok,
      status: response.status,
      latency
    });
  } catch (err) {
    res.json({
      online: false,
      error: err.message
    });
  }
});

// ============ MONITORING API ============

// Get all monitoring statuses
app.get('/api/monitoring/status', (req, res) => {
  res.json(monitoringService.getAllStatuses());
});

// Get monitoring status for specific card
app.get('/api/monitoring/status/:cardId', (req, res) => {
  const status = monitoringService.getCardStatus(req.params.cardId);
  res.json(status);
});

// Get monitoring history for card (with pagination)
app.get('/api/monitoring/history/:cardId', (req, res) => {
  const { cardId } = req.params;
  const { limit = 100, offset = 0, period = '24h' } = req.query;
  
  const cardHistory = monitoringService.history[cardId];
  if (!cardHistory) {
    return res.json({ checks: [], stats: null });
  }

  const now = Date.now();
  const periods = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  };

  const cutoff = now - (periods[period] || periods['24h']);
  let checks = cardHistory.checks.filter(c => c.timestamp > cutoff);
  
  // Применяем пагинацию
  const total = checks.length;
  checks = checks.slice(-parseInt(limit)).reverse(); // последние N, новые сверху

  res.json({
    checks,
    total,
    stats: cardHistory.stats,
    lastCheck: cardHistory.lastCheck,
    currentStatus: cardHistory.currentStatus
  });
});

// Enable/disable monitoring for a card
app.put('/api/cards/:id/monitoring', async (req, res) => {
  const { id } = req.params;
  const { enabled } = req.body;

  try {
    const config = await loadConfig();
    const cardIndex = config.cards.findIndex(c => c.id === id);
    
    if (cardIndex === -1) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Обновляем настройки мониторинга карточки
    config.cards[cardIndex].monitoring = {
      ...config.cards[cardIndex].monitoring,
      enabled: Boolean(enabled)
    };

    await saveConfig(config);

    // Обновляем мониторинг
    monitoringService.config = config;
    monitoringService.updateCardMonitoring(config.cards[cardIndex]);

    res.json({ 
      success: true, 
      monitoring: config.cards[cardIndex].monitoring 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test Telegram connection (legacy endpoint)
app.post('/api/monitoring/telegram/test', async (req, res) => {
  const { botToken, chatId, topicId } = req.body;

  if (!botToken || !chatId) {
    return res.status(400).json({ error: 'botToken and chatId required' });
  }

  try {
    await sendTelegramMessage(
      botToken, 
      chatId, 
      '✅ <b>HomeDash</b> подключен!\n\nТестовое сообщение успешно отправлено.',
      topicId
    );
    res.json({ success: true, message: 'Test message sent' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Test Telegram connection (new endpoint)
app.post('/api/telegram/test', async (req, res) => {
  const { botToken, chatId, topicId, message } = req.body;

  if (!botToken || !chatId) {
    return res.status(400).json({ success: false, error: 'botToken и chatId обязательны' });
  }

  try {
    const topicInfo = topicId ? ` (Topic ID: ${topicId})` : '';
    const testMessage = message || `✅ <b>HomeDash</b> подключен!${topicInfo}\n\nТестовое сообщение успешно отправлено.`;
    await sendTelegramMessage(botToken, chatId, testMessage, topicId);
    res.json({ success: true, message: 'Test message sent' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Force check a card now
app.post('/api/monitoring/check/:cardId', async (req, res) => {
  const { cardId } = req.params;
  
  const config = await loadConfig();
  const card = config.cards.find(c => c.id === cardId);
  
  if (!card) {
    return res.status(404).json({ error: 'Card not found' });
  }

  if (!card.url) {
    return res.status(400).json({ error: 'Card has no URL' });
  }

  const timeout = config.settings?.monitoring?.timeout || 10;
  const result = await monitoringService.checkUrl(card.url, timeout * 1000);

  res.json(result);
});

// Clear monitoring history for a card
app.delete('/api/monitoring/history/:cardId', async (req, res) => {
  const { cardId } = req.params;
  
  if (monitoringService.history[cardId]) {
    monitoringService.history[cardId] = { checks: [], stats: {} };
    delete monitoringService.lastStatus[cardId];
    await monitoringService.saveHistory();
  }

  res.json({ success: true });
});

// Get monitoring global settings
app.get('/api/monitoring/settings', async (req, res) => {
  const config = await loadConfig();
  res.json({
    monitoring: config.settings?.monitoring || {},
    telegram: {
      enabled: config.settings?.telegram?.enabled || false,
      // Не отправляем токен клиенту
      chatId: config.settings?.telegram?.chatId || '',
      notifyDown: config.settings?.telegram?.notifyDown ?? true,
      notifyUp: config.settings?.telegram?.notifyUp ?? true,
      notifyDegraded: config.settings?.telegram?.notifyDegraded ?? false,
      hasToken: Boolean(config.settings?.telegram?.botToken)
    }
  });
});

// Update monitoring global settings
app.put('/api/monitoring/settings', async (req, res) => {
  const { monitoring, telegram } = req.body;

  try {
    const config = await loadConfig();
    
    if (monitoring) {
      config.settings.monitoring = {
        ...config.settings.monitoring,
        ...monitoring
      };
    }

    if (telegram) {
      config.settings.telegram = {
        ...config.settings.telegram,
        ...telegram
      };
    }

    await saveConfig(config);

    // Перезапускаем мониторинг с новыми настройками
    await monitoringService.restart(config);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ PAYMENTS & QR CODES ============

const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json');

async function loadPayments() {
  try {
    const data = await fs.readFile(PAYMENTS_FILE, 'utf8');
    const payments = JSON.parse(data);
    // Ensure all fields exist
    return {
      providers: payments.providers || [],
      purchases: payments.purchases || [],
      qrCodes: payments.qrCodes || {},
      history: payments.history || []
    };
  } catch {
    return { providers: [], purchases: [], qrCodes: {}, history: [] };
  }
}

async function savePayments(payments) {
  await fs.writeFile(PAYMENTS_FILE, JSON.stringify(payments, null, 2));
}

// ============ PURCHASES (разовые покупки) ============

app.get('/api/purchases', async (req, res) => {
  try {
    const payments = await loadPayments();
    res.json(payments.purchases || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/purchases', async (req, res) => {
  try {
    const { name, amount, currency, date, note, category } = req.body;
    const payments = await loadPayments();
    
    const purchase = {
      id: Date.now().toString(),
      name,
      amount: parseFloat(amount),
      currency: currency || 'RUB',
      date,
      note: note || '',
      category: category || 'other',
      createdAt: new Date().toISOString()
    };
    
    payments.purchases = payments.purchases || [];
    payments.purchases.push(purchase);
    
    // Также добавляем в историю для статистики
    payments.history.push({
      id: purchase.id,
      type: 'purchase',
      name: purchase.name,
      amount: purchase.amount,
      currency: purchase.currency,
      category: purchase.category,
      note: purchase.note,
      paidAt: new Date(purchase.date).toISOString()
    });
    
    await savePayments(payments);
    res.json(purchase);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/purchases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const payments = await loadPayments();
    payments.purchases = (payments.purchases || []).filter(p => p.id !== id);
    // Также удаляем из истории
    payments.history = payments.history.filter(h => h.id !== id || h.type !== 'purchase');
    await savePayments(payments);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ SSL Certificate Download ============

app.get('/api/ssl/certificate', (req, res) => {
  const certPath = path.join(DATA_DIR, 'ssl', 'server.crt');
  if (fsSync.existsSync(certPath)) {
    res.setHeader('Content-Type', 'application/x-x509-ca-cert');
    res.setHeader('Content-Disposition', 'attachment; filename="homedash-certificate.crt"');
    res.sendFile(certPath);
  } else {
    res.status(404).json({ error: 'Certificate not found' });
  }
});

// ============ PROVIDERS (отдельные платежи) ============

// Получить всех провайдеров
app.get('/api/providers', async (req, res) => {
  try {
    const payments = await loadPayments();
    res.json(payments.providers || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Создать провайдера
app.post('/api/providers', async (req, res) => {
  try {
    const { name, icon, color, amount, currency, period, nextPayment, note, url } = req.body;
    
    if (!name || !amount || !nextPayment) {
      return res.status(400).json({ error: 'Name, amount and nextPayment required' });
    }

    const payments = await loadPayments();
    
    const provider = {
      id: Date.now().toString(),
      name,
      icon: icon || 'receipt',
      color: color || '#8b5cf6',
      amount: parseFloat(amount),
      currency: currency || 'RUB',
      period: period || 'monthly',
      nextPayment,
      note: note || '',
      url: url || '',
      createdAt: new Date().toISOString()
    };

    payments.providers.push(provider);
    await savePayments(payments);

    res.json(provider);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Обновить провайдера
app.put('/api/providers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const payments = await loadPayments();
    
    const idx = payments.providers.findIndex(p => p.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    payments.providers[idx] = { ...payments.providers[idx], ...req.body };
    await savePayments(payments);

    res.json(payments.providers[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Удалить провайдера
app.delete('/api/providers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const payments = await loadPayments();
    
    payments.providers = payments.providers.filter(p => p.id !== id);
    // Удаляем QR коды провайдера
    delete payments.qrCodes[`provider_${id}`];
    
    await savePayments(payments);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Отметить провайдера как оплаченного
app.post('/api/providers/:id/pay', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, note } = req.body;
    
    console.log('[Pay] Provider payment request:', { id, amount });
    
    const payments = await loadPayments();
    const provider = payments.providers.find(p => p.id === id);
    
    if (!provider) {
      console.log('[Pay] Provider not found:', id);
      return res.status(404).json({ error: 'Provider not found' });
    }

    // Добавляем в историю
    const payment = {
      id: Date.now().toString(),
      providerId: id,
      providerName: provider.name,
      type: 'provider',
      amount: amount || provider.amount,
      currency: provider.currency,
      note: note || '',
      paidAt: new Date().toISOString()
    };

    payments.history.push(payment);
    console.log('[Pay] Added to history:', payment);

    // Сдвигаем дату следующего платежа на 1 период вперед
    if (provider.period !== 'once') {
      let nextDate = new Date(provider.nextPayment);
      console.log('[Pay] Current payment date:', nextDate.toISOString().split('T')[0]);
      
      // Всегда сдвигаем на 1 период после оплаты
      switch (provider.period) {
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case 'quarterly':
          nextDate.setMonth(nextDate.getMonth() + 3);
          break;
        case 'yearly':
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
      }

      provider.nextPayment = nextDate.toISOString().split('T')[0];
      console.log('[Pay] Next payment date updated to:', provider.nextPayment);
    }

    await savePayments(payments);
    console.log('[Pay] Payment saved successfully');
    res.json({ payment, nextPayment: provider.nextPayment });
  } catch (err) {
    console.error('[Pay] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Сохранить QR код для карточки/провайдера
app.post('/api/payments/:cardId/qr', async (req, res) => {
  try {
    const { cardId } = req.params;
    const { data, label, amount } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'QR data required' });
    }

    const payments = await loadPayments();
    if (!payments.qrCodes[cardId]) {
      payments.qrCodes[cardId] = [];
    }

    const qrCode = {
      id: Date.now().toString(),
      data,
      label: label || `QR ${new Date().toLocaleDateString('ru-RU')}`,
      amount: amount || null,
      createdAt: new Date().toISOString()
    };

    payments.qrCodes[cardId].push(qrCode);
    await savePayments(payments);

    res.json(qrCode);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Получить QR коды карточки/провайдера
app.get('/api/payments/:cardId/qr', async (req, res) => {
  try {
    const { cardId } = req.params;
    const payments = await loadPayments();
    res.json(payments.qrCodes[cardId] || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Удалить QR код
app.delete('/api/payments/:cardId/qr/:qrId', async (req, res) => {
  try {
    const { cardId, qrId } = req.params;
    const payments = await loadPayments();
    
    if (payments.qrCodes[cardId]) {
      payments.qrCodes[cardId] = payments.qrCodes[cardId].filter(qr => qr.id !== qrId);
      await savePayments(payments);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Отметить платеж как оплаченный
app.post('/api/payments/:cardId/pay', async (req, res) => {
  try {
    const { cardId } = req.params;
    const { amount, note, qrId } = req.body;
    
    console.log('[Pay] Card payment request:', { cardId, amount });
    
    const config = await loadConfig();
    const card = config.cards.find(c => c.id === cardId);
    
    if (!card) {
      console.log('[Pay] Card not found:', cardId);
      return res.status(404).json({ error: 'Card not found' });
    }

    const payments = await loadPayments();
    
    // Добавляем в историю
    const payment = {
      id: Date.now().toString(),
      cardId,
      cardName: card.name,
      category: card.category,
      amount: amount || card.billing?.amount || 0,
      currency: card.billing?.currency || 'RUB',
      note: note || '',
      qrId: qrId || null,
      paidAt: new Date().toISOString()
    };

    payments.history.push(payment);
    console.log('[Pay] Added to history:', payment);

    // Автоматически сдвигаем дату следующего платежа на 1 период вперед
    if (card.billing?.nextPayment && card.billing?.period && card.billing.period !== 'once') {
      let nextDate = new Date(card.billing.nextPayment);
      console.log('[Pay] Current payment date:', nextDate.toISOString().split('T')[0]);
      
      // Всегда сдвигаем на 1 период после оплаты
      switch (card.billing.period) {
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case 'quarterly':
          nextDate.setMonth(nextDate.getMonth() + 3);
          break;
        case 'yearly':
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
      }

      card.billing.nextPayment = nextDate.toISOString().split('T')[0];
      await saveConfig(config);
      console.log('[Pay] Next payment date updated to:', card.billing.nextPayment);
    }

    await savePayments(payments);
    console.log('[Pay] Payment saved successfully');
    res.json({ payment, nextPayment: card.billing?.nextPayment });
  } catch (err) {
    console.error('[Pay] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// История платежей
app.get('/api/payments/history', async (req, res) => {
  try {
    const { months = 12 } = req.query;
    const payments = await loadPayments();
    
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - parseInt(months));
    
    const history = payments.history
      .filter(p => new Date(p.paidAt) > cutoff)
      .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Удаление записи из истории платежей
app.delete('/api/payments/history/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const payments = await loadPayments();
    
    const index = payments.history.findIndex(p => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    payments.history.splice(index, 1);
    await savePayments(payments);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Статистика платежей
app.get('/api/payments/stats', async (req, res) => {
  try {
    const config = await loadConfig();
    const payments = await loadPayments();
    
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    // Платежи за этот месяц
    const thisMonthPayments = payments.history.filter(p => {
      const d = new Date(p.paidAt);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });

    const thisMonthTotal = thisMonthPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    // Платежи за прошлый месяц
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
    
    const lastMonthPayments = payments.history.filter(p => {
      const d = new Date(p.paidAt);
      return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    });

    const lastMonthTotal = lastMonthPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    // Прогноз на следующий месяц
    const nextMonthStart = new Date(thisYear, thisMonth + 1, 1);
    const nextMonthEnd = new Date(thisYear, thisMonth + 2, 0);

    let forecast = 0;
    const forecastItems = [];

    // Карточки с биллингом
    const billableCards = config.cards.filter(c => 
      c.category === 'hosting' && c.billing?.enabled && c.billing?.nextPayment
    );

    billableCards.forEach(card => {
      const paymentDate = new Date(card.billing.nextPayment);
      const amount = parseFloat(card.billing.amount) || 0;
      
      if (paymentDate >= nextMonthStart && paymentDate <= nextMonthEnd) {
        forecast += amount;
        forecastItems.push({
          id: card.id,
          type: 'card',
          name: card.name,
          amount,
          currency: card.billing.currency,
          date: card.billing.nextPayment
        });
      }
    });

    // Провайдеры
    (payments.providers || []).forEach(provider => {
      const paymentDate = new Date(provider.nextPayment);
      const amount = parseFloat(provider.amount) || 0;
      
      if (paymentDate >= nextMonthStart && paymentDate <= nextMonthEnd) {
        forecast += amount;
        forecastItems.push({
          id: provider.id,
          type: 'provider',
          name: provider.name,
          amount,
          currency: provider.currency,
          date: provider.nextPayment
        });
      }
    });

    // Статистика за календарный год (1 января - 31 декабря)
    const yearStart = new Date(thisYear, 0, 1); // 1 января
    const yearEnd = new Date(thisYear, 11, 31, 23, 59, 59); // 31 декабря
    
    const yearPayments = payments.history.filter(p => {
      const d = new Date(p.paidAt);
      return d >= yearStart && d <= yearEnd;
    });
    
    const yearTotal = yearPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    res.json({
      thisMonth: {
        total: thisMonthTotal,
        count: thisMonthPayments.length
      },
      lastMonth: {
        total: lastMonthTotal,
        count: lastMonthPayments.length
      },
      forecast: {
        total: forecast,
        items: forecastItems
      },
      yearTotal,
      yearCount: yearPayments.length,
      totalPayments: payments.history.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ TASKS & NOTES ============

const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

async function loadTasks() {
  try {
    const data = await fs.readFile(TASKS_FILE, 'utf8');
    const tasks = JSON.parse(data);
    return {
      tasks: tasks.tasks || [],
      notes: tasks.notes || []
    };
  } catch {
    return { tasks: [], notes: [] };
  }
}

async function saveTasks(data) {
  await fs.writeFile(TASKS_FILE, JSON.stringify(data, null, 2));
}

// Get all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const data = await loadTasks();
    res.json(data.tasks || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create task
app.post('/api/tasks', async (req, res) => {
  try {
    const data = await loadTasks();
    const task = {
      id: Date.now().toString(),
      title: req.body.title || '',
      description: req.body.description || '',
      completed: false,
      priority: req.body.priority || 'medium', // low, medium, high
      dueDate: req.body.dueDate || null,
      createdAt: new Date().toISOString(),
      completedAt: null
    };
    data.tasks.push(task);
    await saveTasks(data);
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update task
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await loadTasks();
    const idx = data.tasks.findIndex(t => t.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Task not found' });
    
    const wasCompleted = data.tasks[idx].completed;
    data.tasks[idx] = { ...data.tasks[idx], ...req.body };
    
    // Set completedAt when task is completed
    if (!wasCompleted && req.body.completed) {
      data.tasks[idx].completedAt = new Date().toISOString();
    } else if (wasCompleted && req.body.completed === false) {
      data.tasks[idx].completedAt = null;
    }
    
    await saveTasks(data);
    res.json(data.tasks[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await loadTasks();
    data.tasks = data.tasks.filter(t => t.id !== id);
    await saveTasks(data);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reorder tasks
app.put('/api/tasks/reorder', async (req, res) => {
  try {
    const { taskIds } = req.body;
    const data = await loadTasks();
    const reordered = taskIds.map(id => data.tasks.find(t => t.id === id)).filter(Boolean);
    // Add any tasks not in the reorder list at the end
    const remaining = data.tasks.filter(t => !taskIds.includes(t.id));
    data.tasks = [...reordered, ...remaining];
    await saveTasks(data);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all notes
app.get('/api/notes', async (req, res) => {
  try {
    const data = await loadTasks();
    res.json(data.notes || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create note
app.post('/api/notes', async (req, res) => {
  try {
    const data = await loadTasks();
    const note = {
      id: Date.now().toString(),
      title: req.body.title || '',
      content: req.body.content || '',
      color: req.body.color || '#3b82f6',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.notes.push(note);
    await saveTasks(data);
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update note
app.put('/api/notes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await loadTasks();
    const idx = data.notes.findIndex(n => n.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Note not found' });
    
    data.notes[idx] = { 
      ...data.notes[idx], 
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    await saveTasks(data);
    res.json(data.notes[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete note
app.delete('/api/notes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await loadTasks();
    data.notes = data.notes.filter(n => n.id !== id);
    await saveTasks(data);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ SYSTEM UPDATE ============

const updateUpload = multer({ 
  dest: path.join(DATA_DIR, 'updates'),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// Get current version info
// Build timestamp - генерируется при запуске сервера
const BUILD_TIMESTAMP = Date.now().toString(36);

app.get('/api/system/version', async (req, res) => {
  try {
    const packagePath = path.join(__dirname, 'package.json');
    const pkg = JSON.parse(await fs.readFile(packagePath, 'utf8'));
    res.json({
      version: pkg.version || '1.0.0',
      name: pkg.name,
      isProduction: IS_PRODUCTION,
      buildId: BUILD_TIMESTAMP // Уникальный ID для текущего запуска сервера
    });
  } catch (err) {
    res.json({ version: '1.0.0', isProduction: IS_PRODUCTION, buildId: BUILD_TIMESTAMP });
  }
});

// Upload and apply update
app.post('/api/system/update', updateUpload.single('update'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const zipPath = req.file.path;
  const extractDir = path.join(DATA_DIR, 'updates', `extract-${Date.now()}`);
  const backupDir = path.join(DATA_DIR, 'updates', `backup-${Date.now()}`);
  
  try {
    console.log('[Update] Starting update process...');
    
    // 1. Создаём директории
    await fs.mkdir(extractDir, { recursive: true });
    await fs.mkdir(backupDir, { recursive: true });

    // 2. Распаковываем архив
    const { execSync } = require('child_process');
    execSync(`unzip -q "${zipPath}" -d "${extractDir}"`, { stdio: 'pipe' });
    console.log('[Update] Archive extracted');

    // 3. Находим корневую директорию (может быть homedash/ внутри)
    let sourceDir = extractDir;
    const contents = await fs.readdir(extractDir);
    if (contents.length === 1) {
      const subdir = path.join(extractDir, contents[0]);
      const stat = await fs.stat(subdir);
      if (stat.isDirectory()) {
        sourceDir = subdir;
      }
    }

    // 4. Проверяем структуру
    const hasBackend = await fs.access(path.join(sourceDir, 'backend')).then(() => true).catch(() => false);
    const hasFrontend = await fs.access(path.join(sourceDir, 'frontend')).then(() => true).catch(() => false);
    
    if (!hasBackend) {
      throw new Error('Invalid update package: backend directory not found');
    }

    console.log(`[Update] Found: backend=${hasBackend}, frontend=${hasFrontend}`);

    // 5. Бэкапим текущие файлы (только исходники, не data)
    const filesToBackup = ['server.js', 'package.json'];
    for (const file of filesToBackup) {
      try {
        await fs.copyFile(path.join(__dirname, file), path.join(backupDir, file));
      } catch {}
    }
    console.log('[Update] Backup created');

    // 6. Копируем новые файлы backend
    const backendSource = path.join(sourceDir, 'backend');
    const serverJsPath = path.join(backendSource, 'server.js');
    const packageJsonPath = path.join(backendSource, 'package.json');
    
    if (await fs.access(serverJsPath).then(() => true).catch(() => false)) {
      await fs.copyFile(serverJsPath, path.join(__dirname, 'server.js'));
      console.log('[Update] Updated server.js');
    }
    
    if (await fs.access(packageJsonPath).then(() => true).catch(() => false)) {
      await fs.copyFile(packageJsonPath, path.join(__dirname, 'package.json'));
      console.log('[Update] Updated package.json');
    }

    // 7. Обновляем public (собранный frontend) если есть
    const publicSource = path.join(backendSource, 'public');
    if (await fs.access(publicSource).then(() => true).catch(() => false)) {
      const publicDest = path.join(__dirname, 'public');
      
      // Удаляем старый public (кроме uploads если есть)
      const publicContents = await fs.readdir(publicDest).catch(() => []);
      for (const item of publicContents) {
        if (item !== 'uploads') {
          await fs.rm(path.join(publicDest, item), { recursive: true, force: true });
        }
      }
      
      // Копируем новый
      const copyDir = async (src, dest) => {
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(src, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          if (entry.isDirectory()) {
            await copyDir(srcPath, destPath);
          } else {
            await fs.copyFile(srcPath, destPath);
          }
        }
      };
      await copyDir(publicSource, publicDest);
      console.log('[Update] Updated public directory');
    }

    // 8. Очистка
    await fs.rm(extractDir, { recursive: true, force: true });
    await fs.rm(zipPath, { force: true });
    
    // Удаляем старые бэкапы (оставляем последние 3)
    const updatesDir = path.join(DATA_DIR, 'updates');
    const backups = (await fs.readdir(updatesDir).catch(() => []))
      .filter(d => d.startsWith('backup-'))
      .sort()
      .reverse();
    for (const backup of backups.slice(3)) {
      await fs.rm(path.join(updatesDir, backup), { recursive: true, force: true });
    }

    console.log('[Update] Update completed successfully!');
    
    res.json({ 
      success: true, 
      message: 'Update applied successfully. Server will restart.',
      needsRestart: true
    });

    // 9. Перезапуск сервера (через 2 секунды чтобы ответ успел уйти)
    setTimeout(() => {
      console.log('[Update] Restarting server...');
      process.exit(0); // Docker/nodemon перезапустит
    }, 2000);

  } catch (err) {
    console.error('[Update] Error:', err.message);
    
    // Пробуем откатить
    try {
      for (const file of ['server.js', 'package.json']) {
        const backupPath = path.join(backupDir, file);
        if (await fs.access(backupPath).then(() => true).catch(() => false)) {
          await fs.copyFile(backupPath, path.join(__dirname, file));
        }
      }
      console.log('[Update] Rollback completed');
    } catch (rollbackErr) {
      console.error('[Update] Rollback failed:', rollbackErr.message);
    }

    // Очистка
    await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
    await fs.rm(zipPath, { force: true }).catch(() => {});
    
    res.status(500).json({ error: err.message });
  }
});

// Rollback to previous version
app.post('/api/system/rollback', async (req, res) => {
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
    
    for (const file of ['server.js', 'package.json']) {
      const backupPath = path.join(latestBackup, file);
      if (await fs.access(backupPath).then(() => true).catch(() => false)) {
        await fs.copyFile(backupPath, path.join(__dirname, file));
      }
    }

    res.json({ success: true, message: 'Rollback completed. Server will restart.' });
    
    setTimeout(() => {
      process.exit(0);
    }, 2000);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check Docker availability
app.get('/api/system/docker', async (req, res) => {
  if (!docker) {
    return res.json({ 
      available: false, 
      message: 'Docker socket not mounted. Add to docker-compose.yml: /var/run/docker.sock:/var/run/docker.sock' 
    });
  }
  
  try {
    const info = await docker.info();
    const container = docker.getContainer('homedash');
    const containerInfo = await container.inspect();
    
    res.json({ 
      available: true,
      dockerVersion: info.ServerVersion,
      containerName: containerInfo.Name,
      containerState: containerInfo.State.Status,
      containerId: containerInfo.Id.substring(0, 12)
    });
  } catch (err) {
    res.json({ available: false, error: err.message });
  }
});

// Full update with Docker rebuild
app.post('/api/system/docker-update', updateUpload.single('update'), async (req, res) => {
  if (!docker) {
    return res.status(400).json({ error: 'Docker not available. Mount docker.sock to enable.' });
  }
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const zipPath = req.file.path;
  const sourceDir = '/app/source'; // Mounted from host
  
  try {
    console.log('[Docker Update] Starting full update...');
    
    // Check if source dir is writable (not mounted as :ro)
    const testFile = path.join(sourceDir, '.update-test');
    try {
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
    } catch {
      // Source is read-only, use alternative method
      console.log('[Docker Update] Source is read-only, using data directory');
    }

    // Extract to data/updates/pending
    const pendingDir = path.join(DATA_DIR, 'updates', 'pending');
    await fs.rm(pendingDir, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(pendingDir, { recursive: true });
    
    const { execSync } = require('child_process');
    execSync(`unzip -q "${zipPath}" -d "${pendingDir}"`, { stdio: 'pipe' });
    console.log('[Docker Update] Archive extracted');
    
    // Find root directory
    let updateSource = pendingDir;
    const contents = await fs.readdir(pendingDir);
    if (contents.length === 1) {
      const subdir = path.join(pendingDir, contents[0]);
      const stat = await fs.stat(subdir);
      if (stat.isDirectory()) {
        updateSource = subdir;
      }
    }

    // Copy backend files
    const backendSrc = path.join(updateSource, 'backend');
    if (await fs.access(backendSrc).then(() => true).catch(() => false)) {
      // Update server.js
      const serverSrc = path.join(backendSrc, 'server.js');
      if (await fs.access(serverSrc).then(() => true).catch(() => false)) {
        await fs.copyFile(serverSrc, path.join(__dirname, 'server.js'));
        console.log('[Docker Update] Updated server.js');
      }
      
      // Update package.json
      const pkgSrc = path.join(backendSrc, 'package.json');
      if (await fs.access(pkgSrc).then(() => true).catch(() => false)) {
        await fs.copyFile(pkgSrc, path.join(__dirname, 'package.json'));
        console.log('[Docker Update] Updated package.json');
      }
      
      // Update public directory
      const publicSrc = path.join(backendSrc, 'public');
      if (await fs.access(publicSrc).then(() => true).catch(() => false)) {
        const publicDest = path.join(__dirname, 'public');
        
        // Copy recursively
        const copyDir = async (src, dest) => {
          await fs.mkdir(dest, { recursive: true });
          const entries = await fs.readdir(src, { withFileTypes: true });
          for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
              await copyDir(srcPath, destPath);
            } else {
              await fs.copyFile(srcPath, destPath);
            }
          }
        };
        
        // Clear old public except data-related
        const oldFiles = await fs.readdir(publicDest).catch(() => []);
        for (const f of oldFiles) {
          if (!['uploads'].includes(f)) {
            await fs.rm(path.join(publicDest, f), { recursive: true, force: true });
          }
        }
        
        await copyDir(publicSrc, publicDest);
        console.log('[Docker Update] Updated public directory');
      }
    }

    // Cleanup
    await fs.rm(zipPath, { force: true });
    await fs.rm(pendingDir, { recursive: true, force: true });
    
    console.log('[Docker Update] Update complete, restarting container...');
    
    res.json({ 
      success: true, 
      message: 'Update applied. Container will restart.',
      restartMethod: 'docker'
    });

    // Restart container via Docker API
    setTimeout(async () => {
      try {
        const container = docker.getContainer('homedash');
        await container.restart({ t: 5 });
      } catch (err) {
        console.error('[Docker Update] Restart failed:', err.message);
        // Fallback to process exit
        process.exit(0);
      }
    }, 2000);

  } catch (err) {
    console.error('[Docker Update] Error:', err.message);
    await fs.rm(zipPath, { force: true }).catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// SPA fallback - serve index.html for all non-API routes in production
if (IS_PRODUCTION) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

// ============ BILLING SERVICE ============
class BillingService {
  constructor() {
    this.checkInterval = null;
    this.lastChecked = {};
  }

  async start(config) {
    // Проверяем биллинг раз в час
    this.checkInterval = setInterval(() => this.checkBilling(), 60 * 60 * 1000);
    // Первая проверка через минуту после старта
    setTimeout(() => this.checkBilling(), 60 * 1000);
    console.log('[Billing] Service started');
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  async checkBilling() {
    try {
      const config = await loadConfig();
      const { telegram } = config.settings || {};
      
      if (!telegram?.enabled || !telegram?.botToken || !telegram?.chatId) {
        return; // Telegram не настроен
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      // Проверяем только раз в день для каждой карточки
      for (const card of config.cards || []) {
        if (!card.billing?.enabled || !card.billing?.nextPayment) continue;

        const checkKey = `${card.id}-${todayStr}`;
        if (this.lastChecked[checkKey]) continue;

        const paymentDate = new Date(card.billing.nextPayment);
        paymentDate.setHours(0, 0, 0, 0);
        
        const daysUntil = Math.ceil((paymentDate - today) / (1000 * 60 * 60 * 24));
        const remindDays = card.billing.remindDays || [7, 3, 1];

        // Проверяем нужно ли напомнить
        if (remindDays.includes(daysUntil) || daysUntil === 0) {
          await this.sendBillingReminder(card, daysUntil, telegram);
          this.lastChecked[checkKey] = true;
        }

        // Просрочен платёж
        if (daysUntil < 0 && daysUntil >= -7 && Math.abs(daysUntil) % 7 === 0) {
          await this.sendBillingReminder(card, daysUntil, telegram);
          this.lastChecked[checkKey] = true;
        }
      }
    } catch (err) {
      console.error('[Billing] Check error:', err.message);
    }
  }

  async sendBillingReminder(card, daysUntil, telegram) {
    let emoji, title;
    
    if (daysUntil === 0) {
      emoji = '🔴';
      title = 'СЕГОДНЯ';
    } else if (daysUntil < 0) {
      emoji = '⚠️';
      title = `ПРОСРОЧЕНО на ${Math.abs(daysUntil)} дн.`;
    } else if (daysUntil <= 3) {
      emoji = '🟡';
      title = `через ${daysUntil} ${daysUntil === 1 ? 'день' : 'дня'}`;
    } else {
      emoji = '📅';
      title = `через ${daysUntil} дней`;
    }

    const amount = card.billing.amount 
      ? `${card.billing.amount} ${card.billing.currency || ''}`
      : 'сумма не указана';

    const message = `${emoji} <b>Оплата: ${card.name}</b>

💰 Сумма: ${amount}
📆 Срок: ${title}
📅 Дата: ${card.billing.nextPayment}
${card.billing.note ? `📝 ${card.billing.note}` : ''}`;

    try {
      await fetch(`https://api.telegram.org/bot${telegram.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegram.chatId,
          text: message,
          parse_mode: 'HTML'
        })
      });
      console.log(`[Billing] Reminder sent for ${card.name}: ${title}`);
    } catch (err) {
      console.error('[Billing] Failed to send reminder:', err.message);
    }
  }
}

const billingService = new BillingService();

// ============ TELEGRAM NOTIFICATION SERVICE ============
class TelegramNotificationService {
  constructor() {
    this.config = null;
    this.lastPaymentCheck = null;
    this.lastTaskCheck = null;
    this.lastDailySummary = null;
    this.checkInterval = null;
    this.sentNotifications = new Set(); // Предотвращение дубликатов
  }

  async start(config) {
    this.config = config;
    // Проверка каждую минуту
    this.checkInterval = setInterval(() => this.checkNotifications(), 60000);
    // Первая проверка через 10 секунд после старта
    setTimeout(() => this.checkNotifications(), 10000);
    console.log('[TelegramNotifications] Service started');
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('[TelegramNotifications] Service stopped');
  }

  async reload(config) {
    this.config = config;
  }

  async checkNotifications() {
    try {
      this.config = await loadConfig();
      const telegram = this.config?.settings?.telegram;
      
      if (!telegram?.enabled || !telegram?.botToken || !telegram?.chatId) {
        return;
      }

      const now = new Date();
      const timezone = this.config?.settings?.timezone || 'Europe/Moscow';
      
      // Проверяем платежи (раз в час)
      if (telegram.notifyPayments && (!this.lastPaymentCheck || now - this.lastPaymentCheck > 3600000)) {
        await this.checkPayments(telegram, timezone);
        this.lastPaymentCheck = now;
      }

      // Проверяем задачи (раз в час)
      if (telegram.notifyTasks && (!this.lastTaskCheck || now - this.lastTaskCheck > 3600000)) {
        await this.checkTasks(telegram, timezone);
        this.lastTaskCheck = now;
      }

      // Проверяем ежедневную сводку
      if (telegram.dailySummary) {
        await this.checkDailySummary(telegram, timezone, now);
      }
    } catch (err) {
      console.error('[TelegramNotifications] Check error:', err.message);
    }
  }

  async checkPayments(telegram, timezone) {
    const payments = await loadPayments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const notifyDays = telegram.notifyPaymentsDays || [1, 3, 7];
    const pendingPayments = [];

    // Проверяем карточки с биллингом
    for (const card of this.config?.cards || []) {
      if (!card.billing?.enabled || !card.billing?.nextPayment) continue;
      
      const paymentDate = new Date(card.billing.nextPayment);
      paymentDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((paymentDate - today) / (1000 * 60 * 60 * 24));
      
      if (notifyDays.includes(daysUntil) || (daysUntil <= 0 && daysUntil >= -3)) {
        const key = `payment_${card.id}_${card.billing.nextPayment}`;
        if (!this.sentNotifications.has(key)) {
          pendingPayments.push({
            name: card.name,
            amount: card.billing.amount,
            currency: card.billing.currency || 'RUB',
            daysUntil,
            date: card.billing.nextPayment
          });
          this.sentNotifications.add(key);
        }
      }
    }

    // Проверяем провайдеров
    for (const provider of payments.providers || []) {
      if (!provider.nextPayment) continue;
      
      const paymentDate = new Date(provider.nextPayment);
      paymentDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((paymentDate - today) / (1000 * 60 * 60 * 24));
      
      if (notifyDays.includes(daysUntil) || (daysUntil <= 0 && daysUntil >= -3)) {
        const key = `provider_${provider.id}_${provider.nextPayment}`;
        if (!this.sentNotifications.has(key)) {
          pendingPayments.push({
            name: provider.name,
            amount: provider.amount,
            currency: provider.currency || 'RUB',
            daysUntil,
            date: provider.nextPayment
          });
          this.sentNotifications.add(key);
        }
      }
    }

    // Отправляем уведомления
    for (const payment of pendingPayments) {
      const emoji = payment.daysUntil <= 0 ? '🚨' : payment.daysUntil <= 3 ? '⚠️' : '💳';
      const daysText = payment.daysUntil <= 0 
        ? (payment.daysUntil === 0 ? 'сегодня' : `просрочен на ${Math.abs(payment.daysUntil)} дн.`)
        : `через ${payment.daysUntil} дн.`;
      
      const message = `${emoji} <b>Напоминание о платеже</b>

<b>${payment.name}</b>
Сумма: ${payment.amount} ${payment.currency}
Срок: ${daysText}
Дата: ${new Date(payment.date).toLocaleDateString('ru-RU')}`;

      try {
        await sendTelegramMessage(
          telegram.botToken,
          telegram.chatId,
          message,
          telegram.notifyPaymentsTopicId
        );
        console.log(`[TelegramNotifications] Payment reminder sent: ${payment.name}`);
      } catch (err) {
        console.error(`[TelegramNotifications] Failed to send payment notification:`, err.message);
      }
    }
  }

  async checkTasks(telegram, timezone) {
    const tasks = await loadTasks();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const notifyDays = telegram.notifyTasksDays || [1];
    const pendingTasks = [];

    for (const task of tasks.tasks || []) {
      if (task.completed || !task.dueDate) continue;
      
      const dueDate = new Date(task.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
      
      if (notifyDays.includes(daysUntil) || (daysUntil <= 0 && daysUntil >= -3)) {
        const key = `task_${task.id}_${task.dueDate}`;
        if (!this.sentNotifications.has(key)) {
          pendingTasks.push({
            title: task.title,
            priority: task.priority,
            daysUntil,
            dueDate: task.dueDate
          });
          this.sentNotifications.add(key);
        }
      }
    }

    // Отправляем уведомления
    for (const task of pendingTasks) {
      const emoji = task.daysUntil <= 0 ? '🚨' : task.priority === 'high' ? '❗' : '📋';
      const daysText = task.daysUntil <= 0 
        ? (task.daysUntil === 0 ? 'сегодня' : `просрочена на ${Math.abs(task.daysUntil)} дн.`)
        : `через ${task.daysUntil} дн.`;
      const priorityText = task.priority === 'high' ? '🔴 Высокий' : task.priority === 'medium' ? '🟡 Средний' : '🟢 Низкий';
      
      const message = `${emoji} <b>Напоминание о задаче</b>

<b>${task.title}</b>
Приоритет: ${priorityText}
Срок: ${daysText}
Дата: ${new Date(task.dueDate).toLocaleDateString('ru-RU')}`;

      try {
        await sendTelegramMessage(
          telegram.botToken,
          telegram.chatId,
          message,
          telegram.notifyTasksTopicId
        );
        console.log(`[TelegramNotifications] Task reminder sent: ${task.title}`);
      } catch (err) {
        console.error(`[TelegramNotifications] Failed to send task notification:`, err.message);
      }
    }
  }

  async checkDailySummary(telegram, timezone, now) {
    const summaryTime = telegram.dailySummaryTime || '09:00';
    const [targetHour, targetMinute] = summaryTime.split(':').map(Number);
    
    // Получаем текущее время в нужной timezone
    const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const currentHour = localTime.getHours();
    const currentMinute = localTime.getMinutes();
    
    // Проверяем, пора ли отправлять (в пределах 5 минут от целевого времени)
    const isTime = currentHour === targetHour && currentMinute >= targetMinute && currentMinute < targetMinute + 5;
    
    // Проверяем, не отправляли ли уже сегодня
    const todayKey = `summary_${localTime.toDateString()}`;
    
    if (isTime && !this.sentNotifications.has(todayKey)) {
      this.sentNotifications.add(todayKey);
      await this.sendDailySummary(telegram, timezone);
    }
  }

  async sendDailySummary(telegram, timezone) {
    try {
      const payments = await loadPayments();
      const tasks = await loadTasks();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Собираем данные
      let upcomingPayments = [];
      let upcomingTasks = [];
      let offlineServices = [];

      // Платежи на ближайшие 7 дней
      for (const card of this.config?.cards || []) {
        if (!card.billing?.enabled || !card.billing?.nextPayment) continue;
        const paymentDate = new Date(card.billing.nextPayment);
        paymentDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((paymentDate - today) / (1000 * 60 * 60 * 24));
        if (daysUntil <= 7 && daysUntil >= -3) {
          upcomingPayments.push({ name: card.name, daysUntil, amount: card.billing.amount, currency: card.billing.currency || 'RUB' });
        }
      }

      for (const provider of payments.providers || []) {
        if (!provider.nextPayment) continue;
        const paymentDate = new Date(provider.nextPayment);
        paymentDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((paymentDate - today) / (1000 * 60 * 60 * 24));
        if (daysUntil <= 7 && daysUntil >= -3) {
          upcomingPayments.push({ name: provider.name, daysUntil, amount: provider.amount, currency: provider.currency || 'RUB' });
        }
      }

      // Задачи на ближайшие 7 дней
      for (const task of tasks.tasks || []) {
        if (task.completed || !task.dueDate) continue;
        const dueDate = new Date(task.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        if (daysUntil <= 7 && daysUntil >= -3) {
          upcomingTasks.push({ title: task.title, daysUntil, priority: task.priority });
        }
      }

      // Оффлайн сервисы
      for (const card of this.config?.cards || []) {
        if (!card.monitoring?.enabled) continue;
        const status = monitoringService.getCurrentStatus(card.id);
        if (status?.currentStatus === 'down') {
          offlineServices.push({ name: card.name });
        }
      }

      // Сортируем
      upcomingPayments.sort((a, b) => a.daysUntil - b.daysUntil);
      upcomingTasks.sort((a, b) => a.daysUntil - b.daysUntil);

      // Формируем сообщение
      const dateStr = today.toLocaleDateString('ru-RU', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long',
        timeZone: timezone 
      });
      
      let message = `📊 <b>Ежедневная сводка</b>\n${dateStr}\n`;

      if (offlineServices.length > 0) {
        message += `\n🔴 <b>Недоступные сервисы:</b>\n`;
        offlineServices.forEach(s => {
          message += `• ${s.name}\n`;
        });
      }

      if (upcomingPayments.length > 0) {
        message += `\n💳 <b>Платежи (7 дней):</b>\n`;
        upcomingPayments.slice(0, 5).forEach(p => {
          const days = p.daysUntil <= 0 ? '❗' : p.daysUntil <= 3 ? '⚠️' : '';
          message += `${days}• ${p.name}: ${p.amount} ${p.currency} (${p.daysUntil <= 0 ? 'просрочен' : `через ${p.daysUntil}д`})\n`;
        });
        if (upcomingPayments.length > 5) {
          message += `...и ещё ${upcomingPayments.length - 5}\n`;
        }
      }

      if (upcomingTasks.length > 0) {
        message += `\n📋 <b>Задачи (7 дней):</b>\n`;
        upcomingTasks.slice(0, 5).forEach(t => {
          const days = t.daysUntil <= 0 ? '❗' : t.daysUntil <= 1 ? '⚠️' : '';
          message += `${days}• ${t.title} (${t.daysUntil <= 0 ? 'просрочена' : `через ${t.daysUntil}д`})\n`;
        });
        if (upcomingTasks.length > 5) {
          message += `...и ещё ${upcomingTasks.length - 5}\n`;
        }
      }

      if (offlineServices.length === 0 && upcomingPayments.length === 0 && upcomingTasks.length === 0) {
        message += `\n✅ Всё в порядке! Нет срочных дел.`;
      }

      await sendTelegramMessage(
        telegram.botToken,
        telegram.chatId,
        message,
        telegram.dailySummaryTopicId
      );
      console.log('[TelegramNotifications] Daily summary sent');
    } catch (err) {
      console.error('[TelegramNotifications] Failed to send daily summary:', err.message);
    }
  }
}

const telegramNotificationService = new TelegramNotificationService();

// ============ PWA NOTIFICATIONS API ============
// Get pending notifications for PWA
app.get('/api/notifications/pending', async (req, res) => {
  try {
    const config = await loadConfig();
    const payments = await loadPayments();
    const notifications = [];
    
    // Check if notifications enabled
    if (!config.notifications?.enabled) {
      return res.json({ notifications: [] });
    }
    
    const remindDays = config.notifications.remindDays || [1, 3];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check cards with billing
    for (const card of config.cards || []) {
      if (!card.billing?.enabled || !card.billing?.nextPayment) continue;
      
      const paymentDate = new Date(card.billing.nextPayment);
      paymentDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((paymentDate - today) / (1000 * 60 * 60 * 24));
      
      // Check if should notify
      if (remindDays.includes(daysUntil) || daysUntil <= 0) {
        const amount = card.billing.amount 
          ? `${card.billing.amount} ${card.billing.currency || 'RUB'}`
          : '';
          
        let title, body;
        if (daysUntil === 0) {
          title = `Сегодня: ${card.name}`;
          body = amount ? `Сумма: ${amount}` : 'Срок оплаты сегодня';
        } else if (daysUntil < 0) {
          title = `Просрочено: ${card.name}`;
          body = amount ? `${amount} - просрочено на ${Math.abs(daysUntil)} дн.` : `Просрочено на ${Math.abs(daysUntil)} дн.`;
        } else {
          title = `Оплата через ${daysUntil} ${daysUntil === 1 ? 'день' : daysUntil < 5 ? 'дня' : 'дней'}`;
          body = amount ? `${card.name}: ${amount}` : card.name;
        }
        
        notifications.push({
          id: `card-${card.id}-${card.billing.nextPayment}`,
          type: 'card',
          title,
          body,
          cardId: card.id,
          daysUntil
        });
      }
    }
    
    // Check providers
    for (const provider of payments.providers || []) {
      if (!provider.nextPayment) continue;
      
      const paymentDate = new Date(provider.nextPayment);
      paymentDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((paymentDate - today) / (1000 * 60 * 60 * 24));
      
      // Check provider remindDays or use global setting
      const providerRemindDays = provider.remindDays?.length > 0 ? provider.remindDays : remindDays;
      
      if (providerRemindDays.includes(daysUntil) || daysUntil <= 0) {
        const amount = provider.amount 
          ? `${provider.amount} ${provider.currency || 'RUB'}`
          : '';
          
        let title, body;
        if (daysUntil === 0) {
          title = `Сегодня: ${provider.name}`;
          body = amount ? `Сумма: ${amount}` : 'Срок оплаты сегодня';
        } else if (daysUntil < 0) {
          title = `Просрочено: ${provider.name}`;
          body = amount ? `${amount} - просрочено на ${Math.abs(daysUntil)} дн.` : `Просрочено на ${Math.abs(daysUntil)} дн.`;
        } else {
          title = `Оплата через ${daysUntil} ${daysUntil === 1 ? 'день' : daysUntil < 5 ? 'дня' : 'дней'}`;
          body = amount ? `${provider.name}: ${amount}` : provider.name;
        }
        
        notifications.push({
          id: `provider-${provider.id}-${provider.nextPayment}`,
          type: 'provider',
          title,
          body,
          providerId: provider.id,
          daysUntil
        });
      }
    }
    
    // Sort by urgency (daysUntil ascending)
    notifications.sort((a, b) => a.daysUntil - b.daysUntil);
    
    res.json({ notifications });
  } catch (err) {
    console.error('[Notifications] Error:', err.message);
    res.json({ notifications: [] });
  }
});

// Start server
const LISTEN_PORT = PORT;

async function startServer() {
  await initData();
  await monitoringService.init();
  
  // Загружаем конфиг и запускаем сервисы
  const config = await loadConfig();
  await monitoringService.start(config);
  await billingService.start(config);
  await telegramNotificationService.start(config);

  // HTTP Server
  app.listen(LISTEN_PORT, '0.0.0.0', () => {
    console.log(`HomeDash HTTP running on http://0.0.0.0:${LISTEN_PORT}`);
  });

  // HTTPS Server (if certificates exist)
  const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
  const SSL_KEY = path.join(DATA_DIR, 'ssl', 'server.key');
  const SSL_CERT = path.join(DATA_DIR, 'ssl', 'server.crt');

  try {
    if (fsSync.existsSync(SSL_KEY) && fsSync.existsSync(SSL_CERT)) {
      const httpsOptions = {
        key: fsSync.readFileSync(SSL_KEY),
        cert: fsSync.readFileSync(SSL_CERT)
      };
      
      https.createServer(httpsOptions, app).listen(HTTPS_PORT, '0.0.0.0', () => {
        console.log(`HomeDash HTTPS running on https://0.0.0.0:${HTTPS_PORT}`);
        console.log(`For camera access, use HTTPS: https://your-ip:${HTTPS_PORT}`);
      });
    } else {
      console.log('[SSL] No certificates found, HTTPS disabled');
      console.log('[SSL] To enable: put server.key and server.crt in /app/data/ssl/');
    }
  } catch (err) {
    console.error('[SSL] Failed to start HTTPS server:', err.message);
  }

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    monitoringService.stop();
    billingService.stop();
    telegramNotificationService.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('Shutting down...');
    monitoringService.stop();
    billingService.stop();
    telegramNotificationService.stop();
    process.exit(0);
  });
}

startServer();
