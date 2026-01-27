/**
 * HomeDash Monitoring Service
 * HomeDash Monitoring System v2.0
 * 
 */

const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const https = require('https');
const net = require('net');
const dns = require('dns').promises;
const { Client: SSHClient } = require('ssh2');
const { MONITORING_FILE, SSH_KEYS_DIR, fetchWithSSL, loadConfig, loadPayments, loadTasks } = require('../utils/config');
const { sendTelegramMessage } = require('../utils/telegram');
const push = require('../utils/pushNotifications');

// ==================== КОНСТАНТЫ (как в Uptime Kuma) ====================

const STATUS = {
  DOWN: 0,
  UP: 1,
  PENDING: 2,
  MAINTENANCE: 3
};

const STATUS_NAMES = {
  [STATUS.DOWN]: 'down',
  [STATUS.UP]: 'up',
  [STATUS.PENDING]: 'pending',
  [STATUS.MAINTENANCE]: 'maintenance'
};

// Минимальные и максимальные значения
const MIN_INTERVAL_SECOND = 20;
const MAX_INTERVAL_SECOND = 86400; // 24 часа
const DEFAULT_INTERVAL = 60;
const DEFAULT_RETRY_INTERVAL = 60;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 10;
const DEFAULT_RESEND_INTERVAL = 0; // 0 = выключено

// ==================== MONITOR CLASS ====================

class Monitor {
  constructor(card, globalSettings) {
    this.id = card.id;
    this.name = card.name;
    this.url = card.url;
    this.type = this.detectType(card);
    this.active = card.monitoring?.enabled || false;
    
    // Per-monitor настройки с fallback на глобальные
    const monitorSettings = card.monitoring || {};
    this.interval = this.clampInterval(monitorSettings.interval || globalSettings.interval || DEFAULT_INTERVAL);
    this.retryInterval = this.clampInterval(monitorSettings.retryInterval || globalSettings.retryInterval || this.interval);
    this.maxretries = monitorSettings.maxretries ?? globalSettings.retries ?? DEFAULT_MAX_RETRIES;
    this.timeout = (monitorSettings.timeout || globalSettings.timeout || DEFAULT_TIMEOUT) * 1000;
    this.resendInterval = monitorSettings.resendInterval ?? globalSettings.resendInterval ?? DEFAULT_RESEND_INTERVAL;
    
    // HTTP настройки
    this.method = monitorSettings.method || 'GET';
    this.headers = monitorSettings.headers || {};
    this.body = monitorSettings.body || null;
    this.acceptedStatusCodes = monitorSettings.acceptedStatusCodes || ['200-299', '300-399'];
    this.keyword = monitorSettings.keyword || null;
    this.invertKeyword = monitorSettings.invertKeyword || false;
    this.ignoreTls = monitorSettings.ignoreTls !== false; // default true
    this.maxRedirects = monitorSettings.maxRedirects ?? 10;
    
    // SSH настройки (из интеграции)
    this.integration = card.integration || {};
    
    // Runtime состояние
    this.heartbeatInterval = null;
    this.retries = 0;
    this.lastHeartbeat = null;
  }
  
  detectType(card) {
    if (card.integration?.type === 'ssh') return 'ssh';
    if (card.integration?.type === 'tcp' || card.monitoring?.type === 'tcp') return 'tcp';
    if (card.integration?.type === 'ping' || card.monitoring?.type === 'ping') return 'ping';
    if (card.integration?.type === 'dns' || card.monitoring?.type === 'dns') return 'dns';
    if (card.url) return 'http';
    return 'unknown';
  }
  
  clampInterval(value) {
    return Math.max(MIN_INTERVAL_SECOND, Math.min(MAX_INTERVAL_SECOND, value));
  }
  
  /**
   * Проверка, входит ли статус код в допустимые
   */
  isAcceptedStatusCode(statusCode) {
    for (const range of this.acceptedStatusCodes) {
      if (range.includes('-')) {
        const [min, max] = range.split('-').map(Number);
        if (statusCode >= min && statusCode <= max) return true;
      } else {
        if (statusCode === Number(range)) return true;
      }
    }
    return false;
  }
}

// ==================== HEARTBEAT CLASS ====================

class Heartbeat {
  constructor(monitorId) {
    this.monitorId = monitorId;
    this.status = STATUS.PENDING;
    this.time = new Date().toISOString();
    this.timestamp = Date.now();
    this.msg = '';
    this.ping = null; // response time in ms
    this.important = false;
    this.duration = 0;
    this.retries = 0;
    this.downCount = 0;
  }
  
  toJSON() {
    return {
      monitorId: this.monitorId,
      status: this.status,
      statusName: STATUS_NAMES[this.status],
      time: this.time,
      timestamp: this.timestamp,
      msg: this.msg,
      ping: this.ping,
      important: this.important,
      duration: this.duration,
      retries: this.retries,
      downCount: this.downCount
    };
  }
}

// ==================== MONITORING SERVICE ====================

class MonitoringService {
  constructor() {
    this.monitors = new Map(); // monitorId -> Monitor
    this.history = {};         // monitorId -> { checks: [], stats: {}, lastCheck: null }
    this.isRunning = false;
    this.config = null;
    this.dailySummaryTimeout = null;
  }

  async init() {
    await this.loadHistory();
    console.log('[Monitoring] Service initialized');
  }

  async loadHistory() {
    try {
      const data = await fs.readFile(MONITORING_FILE, 'utf8');
      this.history = JSON.parse(data);
      
      // Восстанавливаем currentStatus из lastCheck для каждого монитора
      for (const monitorId of Object.keys(this.history)) {
        const lastCheck = this.history[monitorId].lastCheck;
        if (lastCheck && typeof lastCheck.status !== 'undefined') {
          this.history[monitorId].currentStatus = STATUS_NAMES[lastCheck.status] || 'unknown';
        }
      }
      
      console.log('[Monitoring] Loaded history for', Object.keys(this.history).length, 'monitors');
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

  // ==================== ПРОВЕРКИ ПО ТИПАМ ====================

  /**
   * HTTP/HTTPS проверка
   */
  async checkHttp(monitor) {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), monitor.timeout);
      
      const options = {
        method: monitor.method,
        signal: controller.signal,
        redirect: monitor.maxRedirects > 0 ? 'follow' : 'manual',
        headers: {
          'User-Agent': 'HomeDash-Monitor/2.0',
          ...monitor.headers
        }
      };
      
      if (monitor.body && ['POST', 'PUT', 'PATCH'].includes(monitor.method)) {
        options.body = monitor.body;
      }
      
      const response = await fetchWithSSL(monitor.url, options);
      clearTimeout(timeoutId);
      
      const ping = Date.now() - startTime;
      const statusCode = response.status;
      
      // Проверка статус кода
      if (!monitor.isAcceptedStatusCode(statusCode)) {
        return {
          status: STATUS.DOWN,
          msg: `HTTP ${statusCode}`,
          ping,
          statusCode
        };
      }
      
      // Проверка keyword (если задан)
      if (monitor.keyword) {
        const body = await response.text();
        const keywordFound = body.includes(monitor.keyword);
        const keywordOk = monitor.invertKeyword ? !keywordFound : keywordFound;
        
        if (!keywordOk) {
          return {
            status: STATUS.DOWN,
            msg: monitor.invertKeyword 
              ? `Keyword "${monitor.keyword}" found (should be absent)`
              : `Keyword "${monitor.keyword}" not found`,
            ping,
            statusCode
          };
        }
      }
      
      return {
        status: STATUS.UP,
        msg: `HTTP ${statusCode}`,
        ping,
        statusCode
      };
      
    } catch (err) {
      return {
        status: STATUS.DOWN,
        msg: err.name === 'AbortError' ? 'Timeout' : err.message,
        ping: Date.now() - startTime,
        statusCode: 0
      };
    }
  }

  /**
   * TCP Port проверка
   */
  async checkTcp(monitor) {
    const startTime = Date.now();
    const host = monitor.integration?.host || new URL(monitor.url).hostname;
    const port = monitor.integration?.port || 80;
    
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false;
      
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve({
            status: STATUS.DOWN,
            msg: 'Connection timeout',
            ping: Date.now() - startTime
          });
        }
      }, monitor.timeout);
      
      socket.connect(port, host, () => {
        clearTimeout(timeoutId);
        if (!resolved) {
          resolved = true;
          const ping = Date.now() - startTime;
          socket.destroy();
          resolve({
            status: STATUS.UP,
            msg: `Port ${port} is open`,
            ping
          });
        }
      });
      
      socket.on('error', (err) => {
        clearTimeout(timeoutId);
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve({
            status: STATUS.DOWN,
            msg: err.message,
            ping: Date.now() - startTime
          });
        }
      });
    });
  }

  /**
   * DNS проверка
   */
  async checkDns(monitor) {
    const startTime = Date.now();
    const hostname = monitor.integration?.hostname || monitor.url?.replace(/^https?:\/\//, '').split('/')[0];
    const recordType = monitor.integration?.dnsRecordType || 'A';
    
    try {
      let result;
      switch (recordType) {
        case 'A':
          result = await dns.resolve4(hostname);
          break;
        case 'AAAA':
          result = await dns.resolve6(hostname);
          break;
        case 'MX':
          result = await dns.resolveMx(hostname);
          break;
        case 'TXT':
          result = await dns.resolveTxt(hostname);
          break;
        case 'CNAME':
          result = await dns.resolveCname(hostname);
          break;
        default:
          result = await dns.resolve(hostname, recordType);
      }
      
      const ping = Date.now() - startTime;
      const resultStr = Array.isArray(result) ? result.flat().join(', ') : String(result);
      
      return {
        status: STATUS.UP,
        msg: `${recordType}: ${resultStr.substring(0, 100)}`,
        ping
      };
      
    } catch (err) {
      return {
        status: STATUS.DOWN,
        msg: err.message,
        ping: Date.now() - startTime
      };
    }
  }

  /**
   * SSH проверка
   */
  async checkSsh(monitor) {
    const startTime = Date.now();
    const integration = monitor.integration;
    
    if (!integration?.host) {
      return {
        status: STATUS.DOWN,
        msg: 'No host configured',
        ping: 0
      };
    }
    
    return new Promise((resolve) => {
      const conn = new SSHClient();
      let resolved = false;
      
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          conn.end();
          resolve({
            status: STATUS.DOWN,
            msg: 'Connection timeout',
            ping: Date.now() - startTime
          });
        }
      }, monitor.timeout);
      
      conn.on('ready', () => {
        clearTimeout(timeoutId);
        if (!resolved) {
          resolved = true;
          const ping = Date.now() - startTime;
          
          // Выполняем простую команду для проверки
          conn.exec('echo ok', (err, stream) => {
            conn.end();
            if (err) {
              resolve({
                status: STATUS.DOWN,
                msg: 'Command failed: ' + err.message,
                ping
              });
            } else {
              resolve({
                status: STATUS.UP,
                msg: 'SSH connection OK',
                ping
              });
            }
          });
        }
      });
      
      conn.on('error', (err) => {
        clearTimeout(timeoutId);
        if (!resolved) {
          resolved = true;
          resolve({
            status: STATUS.DOWN,
            msg: err.message,
            ping: Date.now() - startTime
          });
        }
      });
      
      // Конфигурация SSH
      const sshConfig = {
        host: integration.host,
        port: parseInt(integration.port) || 22,
        username: integration.username || 'root',
        readyTimeout: monitor.timeout
      };
      
      // Аутентификация
      if (integration.privateKey) {
        if (integration.privateKey.startsWith('-----')) {
          sshConfig.privateKey = integration.privateKey;
        } else {
          // Имя файла ключа
          try {
            const keyPath = path.join(SSH_KEYS_DIR, integration.privateKey);
            sshConfig.privateKey = require('fs').readFileSync(keyPath, 'utf8');
          } catch (e) {
            resolve({
              status: STATUS.DOWN,
              msg: 'SSH key not found',
              ping: Date.now() - startTime
            });
            return;
          }
        }
        if (integration.passphrase) {
          sshConfig.passphrase = integration.passphrase;
        }
      } else if (integration.password) {
        sshConfig.password = integration.password;
      }
      
      try {
        conn.connect(sshConfig);
      } catch (err) {
        clearTimeout(timeoutId);
        if (!resolved) {
          resolved = true;
          resolve({
            status: STATUS.DOWN,
            msg: err.message,
            ping: Date.now() - startTime
          });
        }
      }
    });
  }

  /**
   * Универсальная проверка монитора
   */
  async check(monitor) {
    switch (monitor.type) {
      case 'http':
        return this.checkHttp(monitor);
      case 'tcp':
        return this.checkTcp(monitor);
      case 'dns':
        return this.checkDns(monitor);
      case 'ssh':
        return this.checkSsh(monitor);
      default:
        if (monitor.url) {
          return this.checkHttp(monitor);
        }
        return {
          status: STATUS.DOWN,
          msg: 'Unknown monitor type',
          ping: 0
        };
    }
  }

  // ==================== BEAT ЛОГИКА (КАК В UPTIME KUMA) ====================

  /**
   * Главная функция проверки (beat)
   * Реализует логику Uptime Kuma с retries между интервалами
   */
  async beat(monitor) {
    // Получаем актуальные данные карточки
    const card = this.config?.cards?.find(c => c.id === monitor.id);
    if (!card) {
      console.log(`[Monitoring] Card ${monitor.id} not found, stopping`);
      this.stopMonitor(monitor.id);
      return;
    }
    
    // Проверяем что мониторинг всё ещё включен
    if (!card.monitoring?.enabled) {
      console.log(`[Monitoring] Monitoring disabled for ${monitor.name}, stopping`);
      this.stopMonitor(monitor.id);
      return;
    }
    
    // Инициализируем историю
    if (!this.history[monitor.id]) {
      this.history[monitor.id] = { checks: [], stats: {}, lastCheck: null };
    }
    
    // ==================== РЕЖИМ ОБСЛУЖИВАНИЯ ====================
    // Если монитор в режиме обслуживания - записываем maintenance heartbeat без проверки
    if (monitor.maintenance) {
      const heartbeat = new Heartbeat(monitor.id);
      heartbeat.status = STATUS.MAINTENANCE;
      heartbeat.msg = 'Плановое обслуживание';
      heartbeat.ping = 0;
      
      // Сохраняем
      this.history[monitor.id].checks.push(heartbeat.toJSON());
      this.history[monitor.id].lastCheck = heartbeat.toJSON();
      this.history[monitor.id].currentStatus = 'maintenance';
      
      // Ограничиваем размер истории
      if (this.history[monitor.id].checks.length > 10000) {
        this.history[monitor.id].checks = this.history[monitor.id].checks.slice(-5000);
      }
      
      // Сохраняем периодически
      this.saveCounter++;
      if (this.saveCounter >= 10) {
        this.saveCounter = 0;
        this.saveHistory();
      }
      
      return;
    }
    
    // ==================== ИМИТАЦИЯ НЕДОСТУПНОСТИ (DEBUG) ====================
    // Если включена имитация недоступности - записываем DOWN и отправляем уведомления
    if (card.monitoring?.simulateDown) {
      const previousHeartbeat = this.history[monitor.id].lastCheck;
      const isFirstBeat = !previousHeartbeat;
      
      const heartbeat = new Heartbeat(monitor.id);
      heartbeat.status = STATUS.DOWN;
      heartbeat.msg = '[DEBUG] Имитация недоступности';
      heartbeat.ping = 0;
      
      // Считаем downCount для повторных уведомлений
      if (previousHeartbeat?.status === STATUS.DOWN) {
        heartbeat.downCount = (previousHeartbeat.downCount || 0) + 1;
      } else {
        heartbeat.downCount = 1;
        // Первый DOWN - сохраняем время начала простоя
        this.history[monitor.id].downtimeStart = heartbeat.timestamp;
      }
      
      // Сохраняем
      this.history[monitor.id].checks.push(heartbeat.toJSON());
      this.history[monitor.id].lastCheck = heartbeat.toJSON();
      this.history[monitor.id].currentStatus = 'down';
      
      // Ограничиваем размер истории
      if (this.history[monitor.id].checks.length > 10000) {
        this.history[monitor.id].checks = this.history[monitor.id].checks.slice(-5000);
      }
      
      this.updateStats(monitor.id);
      
      // Отправляем уведомление если нужно
      if (this.shouldSendNotification(isFirstBeat, previousHeartbeat, heartbeat, monitor)) {
        await this.sendNotification(monitor, heartbeat, previousHeartbeat);
      }
      
      this.saveCounter++;
      if (this.saveCounter >= 10) {
        this.saveCounter = 0;
        this.saveHistory();
      }
      
      // Планируем следующую проверку
      this.scheduleNextBeat(monitor, heartbeat);
      return;
    }
    
    // Получаем предыдущий heartbeat
    const previousHeartbeat = this.history[monitor.id].lastCheck;
    const isFirstBeat = !previousHeartbeat;
    
    // Создаем новый heartbeat
    const heartbeat = new Heartbeat(monitor.id);
    
    // Рассчитываем duration (время с прошлого heartbeat)
    if (previousHeartbeat) {
      heartbeat.duration = Math.floor((heartbeat.timestamp - previousHeartbeat.timestamp) / 1000);
    }
    
    try {
      // Выполняем проверку
      const result = await this.check(monitor);
      
      heartbeat.ping = result.ping;
      heartbeat.msg = result.msg;
      
      // ==================== ЛОГИКА СТАТУСОВ (КАК В UPTIME KUMA) ====================
      
      if (result.status === STATUS.UP) {
        // Успешная проверка
        heartbeat.status = STATUS.UP;
        heartbeat.retries = 0;
        heartbeat.downCount = 0;
        
      } else {
        // Неуспешная проверка - применяем логику retries
        
        if (previousHeartbeat) {
          if (previousHeartbeat.status === STATUS.UP) {
            // Был UP, стал DOWN - начинаем отсчёт retries
            if (monitor.maxretries > 0) {
              heartbeat.status = STATUS.PENDING;
              heartbeat.retries = 1;
              heartbeat.downCount = 1;
            } else {
              // Нет retries - сразу DOWN
              heartbeat.status = STATUS.DOWN;
              heartbeat.retries = 0;
              heartbeat.downCount = 1;
            }
            
          } else if (previousHeartbeat.status === STATUS.PENDING) {
            // Был PENDING - инкрементируем счётчик
            heartbeat.retries = previousHeartbeat.retries + 1;
            heartbeat.downCount = (previousHeartbeat.downCount || 0) + 1;
            
            if (heartbeat.retries >= monitor.maxretries) {
              // Исчерпали retries - переходим в DOWN
              heartbeat.status = STATUS.DOWN;
            } else {
              // Продолжаем PENDING
              heartbeat.status = STATUS.PENDING;
            }
            
          } else if (previousHeartbeat.status === STATUS.DOWN) {
            // Уже был DOWN - продолжаем
            heartbeat.status = STATUS.DOWN;
            heartbeat.retries = previousHeartbeat.retries;
            heartbeat.downCount = (previousHeartbeat.downCount || 0) + 1;
          }
        } else {
          // Первая проверка и она DOWN
          if (monitor.maxretries > 0) {
            heartbeat.status = STATUS.PENDING;
            heartbeat.retries = 1;
          } else {
            heartbeat.status = STATUS.DOWN;
          }
          heartbeat.downCount = 1;
        }
      }
      
    } catch (err) {
      // Критическая ошибка
      heartbeat.status = STATUS.DOWN;
      heartbeat.msg = `Error: ${err.message}`;
      heartbeat.downCount = (previousHeartbeat?.downCount || 0) + 1;
    }
    
    // ==================== ОПРЕДЕЛЕНИЕ ВАЖНОСТИ (important) ====================
    
    heartbeat.important = this.isImportantBeat(isFirstBeat, previousHeartbeat?.status, heartbeat.status);
    
    // ==================== ЛОГИРОВАНИЕ ====================
    
    const statusStr = STATUS_NAMES[heartbeat.status] || 'unknown';
    const prevStatusStr = previousHeartbeat ? (STATUS_NAMES[previousHeartbeat.status] || 'unknown') : 'none';
    
    if (heartbeat.important) {
      console.log(`[Monitoring] ${monitor.name}: ${prevStatusStr} -> ${statusStr} (${heartbeat.msg}) [IMPORTANT]`);
    } else if (heartbeat.status === STATUS.PENDING) {
      console.log(`[Monitoring] ${monitor.name}: PENDING (retry ${heartbeat.retries}/${monitor.maxretries})`);
    } else {
      console.log(`[Monitoring] ${monitor.name}: ${statusStr} (${heartbeat.ping}ms)`);
    }
    
    // ==================== СОХРАНЕНИЕ ====================
    
    this.history[monitor.id].checks.push(heartbeat.toJSON());
    this.history[monitor.id].lastCheck = heartbeat.toJSON();
    this.history[monitor.id].currentStatus = STATUS_NAMES[heartbeat.status] || 'unknown';
    
    // Сохраняем время начала простоя при первом сбое (UP -> PENDING или UP -> DOWN)
    const isProblematic = heartbeat.status === STATUS.DOWN || heartbeat.status === STATUS.PENDING;
    const wasOk = !previousHeartbeat || previousHeartbeat.status === STATUS.UP;
    if (isProblematic && wasOk) {
      this.history[monitor.id].downtimeStart = heartbeat.timestamp;
    }
    
    // Ограничиваем размер истории
    if (this.history[monitor.id].checks.length > 10000) {
      this.history[monitor.id].checks = this.history[monitor.id].checks.slice(-5000);
    }
    
    // Обновляем статистику
    this.updateStats(monitor.id);
    
    // ==================== УВЕДОМЛЕНИЯ ====================
    
    if (this.shouldSendNotification(isFirstBeat, previousHeartbeat, heartbeat, monitor)) {
      await this.sendNotification(monitor, heartbeat, previousHeartbeat);
    }
    
    // Сохраняем периодически
    const totalChecks = Object.values(this.history).reduce((sum, h) => sum + (h.checks?.length || 0), 0);
    if (totalChecks % 10 === 0) {
      await this.saveHistory();
    }
    
    // ==================== ПЛАНИРОВАНИЕ СЛЕДУЮЩЕЙ ПРОВЕРКИ ====================
    
    this.scheduleNextBeat(monitor, heartbeat);
  }

  /**
   * Определяет, является ли heartbeat важным (смена статуса)
   * Как в Uptime Kuma: server/model/monitor.js -> isImportantBeat
   */
  isImportantBeat(isFirstBeat, previousStatus, currentStatus) {
    // Первый heartbeat всегда важный
    if (isFirstBeat) {
      return true;
    }
    
    // Переход в DOWN или из DOWN - важный
    if (currentStatus === STATUS.DOWN && previousStatus !== STATUS.DOWN) {
      return true;
    }
    
    // Переход в UP из DOWN/PENDING - важный
    if (currentStatus === STATUS.UP && (previousStatus === STATUS.DOWN || previousStatus === STATUS.PENDING)) {
      return true;
    }
    
    return false;
  }

  /**
   * Определяет, нужно ли отправлять уведомление
   * Как в Uptime Kuma: server/model/monitor.js -> isImportantForNotification
   */
  shouldSendNotification(isFirstBeat, previousHeartbeat, heartbeat, monitor) {
    const previousStatus = previousHeartbeat?.status;
    const currentStatus = heartbeat.status;
    
    // При первом heartbeat с DOWN - уведомляем
    if (isFirstBeat && currentStatus === STATUS.DOWN) {
      return true;
    }
    
    // Переход в подтверждённый DOWN (из PENDING или UP)
    if (currentStatus === STATUS.DOWN && previousStatus !== STATUS.DOWN) {
      return true;
    }
    
    // Переход в UP из DOWN
    if (currentStatus === STATUS.UP && previousStatus === STATUS.DOWN) {
      return true;
    }
    
    // Resend уведомления о DOWN
    if (currentStatus === STATUS.DOWN && monitor.resendInterval > 0) {
      const downCount = heartbeat.downCount || 0;
      if (downCount > 0 && downCount % monitor.resendInterval === 0) {
        console.log(`[Monitoring] ${monitor.name}: Resend notification (downCount: ${downCount})`);
        return true;
      }
    }
    
    // PENDING не вызывает уведомлений
    return false;
  }

  /**
   * Планирует следующую проверку
   * Как в Uptime Kuma: использует retryInterval при PENDING/DOWN
   */
  scheduleNextBeat(monitor, heartbeat) {
    // Определяем интервал
    let interval;
    
    if (heartbeat.status === STATUS.PENDING || heartbeat.status === STATUS.DOWN) {
      // При проблемах используем retryInterval (более частые проверки)
      interval = monitor.retryInterval;
    } else {
      // Нормальный интервал
      interval = monitor.interval;
    }
    
    // Планируем следующий beat
    monitor.heartbeatInterval = setTimeout(() => {
      this.safeBeat(monitor);
    }, interval * 1000);
  }

  /**
   * Безопасная обёртка для beat (как в Uptime Kuma)
   */
  async safeBeat(monitor) {
    try {
      await this.beat(monitor);
    } catch (err) {
      console.error(`[Monitoring] Error in beat for ${monitor.name}:`, err.message);
      
      // Пытаемся продолжить мониторинг
      setTimeout(() => {
        if (this.monitors.has(monitor.id)) {
          this.safeBeat(monitor);
        }
      }, monitor.interval * 1000);
    }
  }

  // ==================== УВЕДОМЛЕНИЯ ====================

  async sendNotification(monitor, heartbeat, previousHeartbeat) {
    const isDown = heartbeat.status === STATUS.DOWN;
    const isUp = heartbeat.status === STATUS.UP && previousHeartbeat?.status === STATUS.DOWN;
    
    // Telegram уведомления
    await this.sendTelegramNotification(monitor, heartbeat, previousHeartbeat, isDown, isUp);
    
    // Push уведомления (независимо от Telegram)
    await this.sendPushNotification(monitor, heartbeat, isDown, isUp);
  }
  
  async sendTelegramNotification(monitor, heartbeat, previousHeartbeat, isDown, isUp) {
    if (!this.config?.settings?.telegram?.enabled) {
      return;
    }
    
    const { botToken, chatId, notifyDown, notifyUp, notifyDownTopicId, notifyUpTopicId } = this.config.settings.telegram;
    if (!botToken || !chatId) {
      return;
    }
    
    // Проверяем настройки уведомлений
    if (isDown && !notifyDown) return;
    if (isUp && !notifyUp) return;
    
    const emoji = isUp ? '\u2705' : '\u{1F534}';
    const statusText = isUp ? 'ONLINE' : 'OFFLINE';
    
    const timezone = this.config?.settings?.timezone || 'Europe/Moscow';
    const timeStr = new Date().toLocaleString('ru-RU', { timeZone: timezone });
    
    let target = monitor.url || '';
    if (monitor.type === 'ssh') {
      target = `SSH: ${monitor.integration?.host || 'unknown'}`;
    } else if (monitor.type === 'tcp') {
      target = `TCP: ${monitor.integration?.host}:${monitor.integration?.port}`;
    }
    
    let message = `${emoji} <b>${monitor.name}</b> is ${statusText}\n\n`;
    
    if (isUp) {
      message += `Response time: ${heartbeat.ping}ms\n`;
      // Добавляем время простоя - от начала DOWN до восстановления
      const downtimeStart = this.history[monitor.id]?.downtimeStart;
      if (downtimeStart) {
        const downtimeMs = heartbeat.timestamp - downtimeStart;
        const downtimeStr = this.formatDuration(downtimeMs);
        message += `Downtime: ${downtimeStr}\n`;
        // Очищаем после использования
        delete this.history[monitor.id].downtimeStart;
      }
    } else {
      message += `Error: ${heartbeat.msg}\n`;
      if (heartbeat.downCount > 1) {
        message += `Down count: ${heartbeat.downCount}\n`;
      }
    }
    
    message += `${target}\n`;
    message += `Time: ${timeStr}`;
    
    const topicId = isUp ? notifyUpTopicId : notifyDownTopicId;
    
    try {
      await sendTelegramMessage(botToken, chatId, message, topicId);
      console.log(`[Monitoring] Telegram notification sent for ${monitor.name}: ${statusText}`);
    } catch (err) {
      console.error('[Monitoring] Failed to send Telegram:', err.message);
    }
  }
  
  async sendPushNotification(monitor, heartbeat, isDown, isUp) {
    try {
      await push.sendMonitoringAlert(
        monitor,
        isDown ? 'down' : 'up',
        isDown ? heartbeat.msg : `Время ответа: ${heartbeat.ping}ms`
      );
    } catch (err) {
      // Молча игнорируем если push не инициализирован
      if (!err.message?.includes('not initialized')) {
        console.error('[Monitoring] Failed to send Push:', err.message);
      }
    }
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${minutes % 60}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }

  // ==================== СТАТИСТИКА ====================

  updateStats(monitorId) {
    const checks = this.history[monitorId]?.checks || [];
    if (checks.length === 0) return;
    
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    
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
      
      // Считаем только UP и DOWN для uptime (игнорируем PENDING)
      const upChecks = periodChecks.filter(c => c.status === STATUS.UP);
      const downChecks = periodChecks.filter(c => c.status === STATUS.DOWN);
      const validChecks = upChecks.length + downChecks.length;
      
      const responseTimes = upChecks.map(c => c.ping).filter(t => t > 0);
      
      stats[period] = {
        uptime: validChecks > 0 ? ((upChecks.length / validChecks) * 100).toFixed(2) : '0.00',
        totalChecks: periodChecks.length,
        upCount: upChecks.length,
        downCount: downChecks.length,
        pendingCount: periodChecks.filter(c => c.status === STATUS.PENDING).length,
        avgResponseTime: responseTimes.length > 0
          ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
          : null,
        minResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes) : null,
        maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : null
      };
    });
    
    this.history[monitorId].stats = stats;
    
    // Текущий статус
    const lastCheck = this.history[monitorId].lastCheck;
    if (lastCheck) {
      this.history[monitorId].currentStatus = STATUS_NAMES[lastCheck.status] || 'unknown';
    }
  }

  // ==================== УПРАВЛЕНИЕ МОНИТОРАМИ ====================

  startMonitor(card) {
    // Проверяем что есть что мониторить
    const hasTarget = card.url || (card.integration?.type === 'ssh' && card.integration?.host);
    if (!hasTarget || !card.monitoring?.enabled) return;
    
    // Уже запущен?
    if (this.monitors.has(card.id)) return;
    
    // Создаём монитор
    const globalSettings = this.config?.settings?.monitoring || {};
    const monitor = new Monitor(card, globalSettings);
    
    this.monitors.set(card.id, monitor);
    
    const target = monitor.type === 'ssh' 
      ? `SSH:${monitor.integration.host}` 
      : monitor.url;
    
    console.log(`[Monitoring] Starting: ${monitor.name} (${target}) every ${monitor.interval}s`);
    
    // Инициализируем историю
    if (!this.history[monitor.id]) {
      this.history[monitor.id] = { checks: [], stats: {} };
    }
    
    // Восстанавливаем retries из истории
    const lastCheck = this.history[monitor.id].lastCheck;
    if (lastCheck) {
      monitor.retries = lastCheck.retries || 0;
      monitor.lastHeartbeat = lastCheck;
    }
    
    // Первая проверка с небольшой случайной задержкой (как в Uptime Kuma)
    const initialDelay = Math.random() * 1000 + 500; // 0.5-1.5s
    setTimeout(() => {
      this.safeBeat(monitor);
    }, initialDelay);
  }

  stopMonitor(monitorId) {
    const monitor = this.monitors.get(monitorId);
    if (monitor) {
      if (monitor.heartbeatInterval) {
        clearTimeout(monitor.heartbeatInterval);
      }
      this.monitors.delete(monitorId);
      console.log(`[Monitoring] Stopped: ${monitor.name}`);
    }
  }

  // Приостановка монитора (для режима обслуживания)
  // Проверки продолжаются, но записываются как maintenance
  pauseMonitor(monitorId) {
    const monitor = this.monitors.get(monitorId);
    if (monitor) {
      monitor.maintenance = true;
      
      // Устанавливаем статус maintenance
      if (this.history[monitorId]) {
        this.history[monitorId].currentStatus = 'maintenance';
        this.history[monitorId].maintenanceStarted = new Date().toISOString();
      }
      
      console.log(`[Monitoring] Maintenance mode ON: ${monitor.name}`);
    }
  }

  // Возобновление монитора после обслуживания
  resumeMonitor(monitorId) {
    const monitor = this.monitors.get(monitorId);
    if (monitor && monitor.maintenance) {
      monitor.maintenance = false;
      
      // Убираем метку обслуживания
      if (this.history[monitorId]) {
        delete this.history[monitorId].maintenanceStarted;
      }
      
      console.log(`[Monitoring] Maintenance mode OFF: ${monitor.name}`);
    } else if (!monitor) {
      // Монитор не запущен - пробуем найти карточку и запустить
      const card = this.config?.cards?.find(c => c.id === monitorId);
      if (card && card.monitoring?.enabled) {
        this.startMonitor(card);
        console.log(`[Monitoring] Started after maintenance: ${card.name}`);
      }
    }
  }

  async start(config) {
    // Останавливаем старые мониторы
    this.stop();
    
    this.config = config;
    
    console.log(`[Monitoring] Starting with ${config?.cards?.length || 0} cards`);
    console.log(`[Monitoring] Global monitoring enabled: ${config?.settings?.monitoring?.enabled}`);
    
    if (!config?.settings?.monitoring?.enabled) {
      console.log('[Monitoring] Monitoring is disabled globally');
      return;
    }
    
    // Очищаем старую историю
    this.cleanOldHistory(config.settings.monitoring.historyDays || 7);
    
    // Запускаем мониторы
    const cards = config.cards || [];
    let startedCount = 0;
    
    for (const card of cards) {
      if (card.monitoring?.enabled) {
        this.startMonitor(card);
        startedCount++;
      }
    }
    
    this.isRunning = true;
    console.log(`[Monitoring] Started ${startedCount} monitors`);
    
    // Планируем ежедневный отчёт
    this.scheduleDailyReport();
  }

  // Применение флагов обслуживания из конфига status-page
  applyMaintenanceFlags(statusPageConfig) {
    if (!statusPageConfig?.monitors) return;
    
    for (const monitorConfig of statusPageConfig.monitors) {
      if (monitorConfig.maintenance && monitorConfig.cardId) {
        const monitor = this.monitors.get(monitorConfig.cardId);
        if (monitor) {
          monitor.maintenance = true;
          if (this.history[monitorConfig.cardId]) {
            this.history[monitorConfig.cardId].currentStatus = 'maintenance';
          }
          console.log(`[Monitoring] Restored maintenance mode: ${monitor.name}`);
        }
      }
    }
  }

  stop() {
    this.stopDailyReport();
    
    for (const [id, monitor] of this.monitors) {
      if (monitor.heartbeatInterval) {
        clearTimeout(monitor.heartbeatInterval);
      }
    }
    
    this.monitors.clear();
    this.isRunning = false;
    this.saveHistory();
    console.log('[Monitoring] Stopped all monitors');
  }

  async restart(config) {
    this.stop();
    await this.start(config);
  }

  updateConfig(config) {
    this.config = config;
  }

  async updateCardMonitoring(card) {
    // Перезагружаем конфиг
    try {
      this.config = await loadConfig();
    } catch (err) {
      console.error('[Monitoring] Failed to reload config:', err.message);
    }
    
    // Останавливаем старый монитор
    this.stopMonitor(card.id);
    
    // Запускаем новый если нужно
    if (card.monitoring?.enabled && this.config?.settings?.monitoring?.enabled) {
      this.startMonitor(card);
    }
  }

  cleanOldHistory(historyDays = 7) {
    const cutoff = Date.now() - (historyDays * 24 * 60 * 60 * 1000);
    
    Object.keys(this.history).forEach(monitorId => {
      if (this.history[monitorId]?.checks) {
        this.history[monitorId].checks = this.history[monitorId].checks.filter(
          c => c.timestamp > cutoff
        );
      }
    });
  }

  // ==================== ГЕТТЕРЫ ====================

  getCardStatus(cardId) {
    const history = this.history[cardId];
    if (!history) {
      return { status: 'unknown', checks: [] };
    }
    
    return {
      status: history.currentStatus || 'unknown',
      lastCheck: history.lastCheck,
      stats: history.stats,
      checks: history.checks || []
    };
  }

  getAllStatuses() {
    const result = {};
    
    for (const cardId of Object.keys(this.history)) {
      result[cardId] = this.getCardStatus(cardId);
    }
    
    return result;
  }

  // ==================== ЕЖЕДНЕВНЫЙ ОТЧЁТ ====================

  async sendDailyReport() {
    if (!this.config?.settings?.telegram?.enabled) {
      return;
    }

    const { botToken, chatId, dailySummaryTopicId } = this.config.settings.telegram;
    if (!botToken || !chatId) {
      return;
    }

    try {
      const lines = ['<b>HomeDash Daily Report</b>', ''];
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      // === 1. Платежи ===
      const payments = await loadPayments();
      const upcomingPayments = [];

      for (const provider of (payments.providers || [])) {
        if (!provider.nextPayment) continue;
        const paymentDate = new Date(provider.nextPayment);
        paymentDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((paymentDate - now) / (1000 * 60 * 60 * 24));
        
        if (daysUntil <= 7) {
          upcomingPayments.push({
            name: provider.name,
            amount: `${provider.amount} ${provider.currency || 'RUB'}`,
            daysUntil
          });
        }
      }

      for (const card of (this.config.cards || [])) {
        if (!card.billing?.enabled || !card.billing?.nextPayment) continue;
        const paymentDate = new Date(card.billing.nextPayment);
        paymentDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((paymentDate - now) / (1000 * 60 * 60 * 24));
        
        if (daysUntil <= 7) {
          upcomingPayments.push({
            name: card.name,
            amount: `${card.billing.amount} ${card.billing.currency || 'RUB'}`,
            daysUntil
          });
        }
      }

      if (upcomingPayments.length > 0) {
        lines.push('<b>Payments (next 7 days):</b>');
        upcomingPayments
          .sort((a, b) => a.daysUntil - b.daysUntil)
          .forEach(p => {
            const status = p.daysUntil <= 0 ? '!' : p.daysUntil <= 3 ? '~' : '+';
            const daysText = p.daysUntil <= 0 ? 'overdue' : p.daysUntil === 1 ? 'tomorrow' : `in ${p.daysUntil}d`;
            lines.push(`[${status}] ${p.name}: ${p.amount} (${daysText})`);
          });
        lines.push('');
      }

      // === 2. Задачи ===
      const tasksData = await loadTasks();
      const upcomingTasks = (tasksData.tasks || [])
        .filter(t => !t.completed && t.dueDate)
        .map(t => {
          const dueDate = new Date(t.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          const daysUntil = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
          return { ...t, daysUntil };
        })
        .filter(t => t.daysUntil <= 7)
        .sort((a, b) => a.daysUntil - b.daysUntil);

      if (upcomingTasks.length > 0) {
        lines.push('<b>Tasks (next 7 days):</b>');
        upcomingTasks.forEach(t => {
          const status = t.daysUntil <= 0 ? '!' : t.daysUntil <= 3 ? '~' : '+';
          const daysText = t.daysUntil <= 0 ? 'overdue' : t.daysUntil === 1 ? 'tomorrow' : `in ${t.daysUntil}d`;
          lines.push(`[${status}] ${t.title} (${daysText})`);
        });
        lines.push('');
      }

      // === 3. Статус сервисов ===
      const statuses = this.getAllStatuses();
      const statusCounts = { up: 0, down: 0, pending: 0, unknown: 0 };
      const downServices = [];

      Object.entries(statuses).forEach(([cardId, data]) => {
        const status = data.status || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        if (status === 'down') {
          const card = (this.config.cards || []).find(c => c.id === cardId);
          if (card) downServices.push(card.name);
        }
      });

      const totalMonitored = statusCounts.up + statusCounts.down + statusCounts.pending;
      if (totalMonitored > 0) {
        lines.push(`<b>Services:</b> ${statusCounts.up}/${totalMonitored} online`);
        if (downServices.length > 0) {
          lines.push(`Offline: ${downServices.join(', ')}`);
        }
        lines.push('');
      }

      // === 4. Обновления ===
      try {
        const latestVersion = await this.checkGitHubUpdate();
        
        let currentVersion = '1.0.0';
        const pkgPath = process.env.NODE_ENV === 'production' 
          ? '/app/package.json' 
          : path.join(__dirname, '..', 'package.json');
        try {
          const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
          currentVersion = pkg.version || currentVersion;
        } catch {}

        if (latestVersion && this.compareVersions(currentVersion, latestVersion) < 0) {
          lines.push(`<b>Update available:</b> v${currentVersion} -> v${latestVersion}`);
          lines.push('');
        }
      } catch {}

      // === Отправка ===
      if (lines.length <= 2) {
        lines.push('No upcoming payments or tasks');
      }

      const message = lines.join('\n');
      await sendTelegramMessage(botToken, chatId, message, dailySummaryTopicId);
      console.log('[DailyReport] Report sent');

    } catch (err) {
      console.error('[DailyReport] Failed:', err.message);
    }
  }

  checkGitHubUpdate() {
    return new Promise((resolve) => {
      const options = {
        hostname: 'api.github.com',
        path: '/repos/jvckdubz/homedash/releases/latest',
        headers: { 'User-Agent': 'HomeDash-Update-Checker' }
      };

      https.get(options, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try {
            if (response.statusCode === 200) {
              const release = JSON.parse(data);
              resolve(release.tag_name?.replace(/^v/, '') || null);
            } else {
              resolve(null);
            }
          } catch { resolve(null); }
        });
      }).on('error', () => resolve(null));
    });
  }

  compareVersions(v1, v2) {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      if ((p1[i] || 0) < (p2[i] || 0)) return -1;
      if ((p1[i] || 0) > (p2[i] || 0)) return 1;
    }
    return 0;
  }

  scheduleDailyReport() {
    if (!this.config?.settings?.telegram?.dailySummary) {
      return;
    }

    const reportTime = this.config?.settings?.telegram?.dailySummaryTime || '09:00';
    const [hours, minutes] = reportTime.split(':').map(Number);

    const scheduleNext = () => {
      const now = new Date();
      const next = new Date();
      next.setHours(hours, minutes, 0, 0);
      
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }

      const delay = next - now;
      console.log(`[DailyReport] Next: ${next.toLocaleString()}`);

      this.dailySummaryTimeout = setTimeout(async () => {
        await this.sendDailyReport();
        scheduleNext();
      }, delay);
    };

    scheduleNext();
  }

  stopDailyReport() {
    if (this.dailySummaryTimeout) {
      clearTimeout(this.dailySummaryTimeout);
      this.dailySummaryTimeout = null;
    }
  }
}

// Экспортируем константы для использования в других модулях
MonitoringService.STATUS = STATUS;
MonitoringService.STATUS_NAMES = STATUS_NAMES;

module.exports = MonitoringService;
