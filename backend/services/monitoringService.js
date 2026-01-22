const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const https = require('https');
const { Client: SSHClient } = require('ssh2');
const { MONITORING_FILE, SSH_KEYS_DIR, fetchWithSSL, loadConfig, loadPayments, loadTasks } = require('../utils/config');
const { sendTelegramMessage } = require('../utils/telegram');

class MonitoringService {
  constructor() {
    this.history = {};      // cardId -> { checks: [], stats: {} }
    this.intervals = {};    // cardId -> intervalId
    this.lastStatus = {};   // cardId -> 'up' | 'down' | 'unknown'
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
    
    console.log(`[Monitoring] Starting with config: ${config?.cards?.length || 0} cards`);
    console.log(`[Monitoring] Global monitoring enabled: ${config?.settings?.monitoring?.enabled}`);
    
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
    let skippedCount = 0;
    
    cards.forEach(card => {
      if (card.monitoring?.enabled) {
        const hasTarget = card.url || (card.integration?.type === 'ssh' && card.integration?.host);
        if (hasTarget) {
          console.log(`[Monitoring] Starting for: ${card.name} (${card.url || card.integration?.host})`);
          this.startCardMonitoring(card);
          startedCount++;
        } else {
          console.log(`[Monitoring] Card ${card.name} has monitoring enabled but no target (url or ssh host)`);
          skippedCount++;
        }
      }
    });

    this.isRunning = true;
    console.log(`[Monitoring] Started monitoring for ${startedCount} cards (skipped ${skippedCount})`);
    
    // Запускаем планировщик ежедневного отчёта
    this.scheduleDailyReport();
  }

  // Остановка всего мониторинга
  stop() {
    this.stopDailyReport();
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

  // ==================== ЕЖЕДНЕВНЫЙ ОТЧЁТ ====================

  // Отправка ежедневного отчёта
  async sendDailyReport() {
    if (!this.config?.settings?.telegram?.enabled) {
      console.log('[DailyReport] Telegram disabled, skipping');
      return;
    }

    const { botToken, chatId, dailySummaryTopicId } = this.config.settings.telegram;
    if (!botToken || !chatId) {
      console.log('[DailyReport] Telegram not configured');
      return;
    }

    try {
      const lines = ['📊 <b>Ежедневный отчёт HomeDash</b>', ''];
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      // === 1. Приближающиеся платежи ===
      const payments = await loadPayments();
      const upcomingPayments = [];

      // Провайдеры
      for (const provider of (payments.providers || [])) {
        if (!provider.nextPayment) continue;
        const paymentDate = new Date(provider.nextPayment);
        paymentDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((paymentDate - now) / (1000 * 60 * 60 * 24));
        
        if (daysUntil <= 7) {
          upcomingPayments.push({
            name: provider.name,
            amount: `${provider.amount} ${provider.currency || '₽'}`,
            daysUntil
          });
        }
      }

      // Карточки с биллингом
      for (const card of (this.config.cards || [])) {
        if (!card.billing?.enabled || !card.billing?.nextPayment) continue;
        const paymentDate = new Date(card.billing.nextPayment);
        paymentDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((paymentDate - now) / (1000 * 60 * 60 * 24));
        
        if (daysUntil <= 7) {
          upcomingPayments.push({
            name: card.name,
            amount: `${card.billing.amount} ${card.billing.currency || '₽'}`,
            daysUntil
          });
        }
      }

      if (upcomingPayments.length > 0) {
        lines.push('💳 <b>Платежи (ближайшие 7 дней):</b>');
        upcomingPayments
          .sort((a, b) => a.daysUntil - b.daysUntil)
          .forEach(p => {
            const status = p.daysUntil <= 0 ? '🔴' : p.daysUntil <= 3 ? '🟡' : '🟢';
            const daysText = p.daysUntil <= 0 
              ? 'просрочен' 
              : p.daysUntil === 1 
                ? 'завтра' 
                : `через ${p.daysUntil} дн.`;
            lines.push(`${status} ${p.name}: ${p.amount} (${daysText})`);
          });
        lines.push('');
      }

      // === 2. Задачи с дедлайнами ===
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
        lines.push('📋 <b>Задачи (ближайшие 7 дней):</b>');
        upcomingTasks.forEach(t => {
          const status = t.daysUntil <= 0 ? '🔴' : t.daysUntil <= 3 ? '🟡' : '🟢';
          const daysText = t.daysUntil <= 0 
            ? 'просрочена' 
            : t.daysUntil === 1 
              ? 'завтра' 
              : `через ${t.daysUntil} дн.`;
          lines.push(`${status} ${t.title} (${daysText})`);
        });
        lines.push('');
      }

      // === 3. Статус сервисов ===
      const statuses = this.getAllStatuses();
      const statusCounts = { up: 0, down: 0, unknown: 0 };
      const downServices = [];

      Object.entries(statuses).forEach(([cardId, data]) => {
        const status = data.status || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        if (status === 'down') {
          const card = (this.config.cards || []).find(c => c.id === cardId);
          if (card) downServices.push(card.name);
        }
      });

      const totalMonitored = statusCounts.up + statusCounts.down + statusCounts.unknown;
      if (totalMonitored > 0) {
        lines.push(`🖥 <b>Сервисы:</b> ${statusCounts.up}/${totalMonitored} онлайн`);
        if (downServices.length > 0) {
          lines.push(`⚠️ Недоступны: ${downServices.join(', ')}`);
        }
        lines.push('');
      }

      // === 4. Проверка обновлений ===
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
          lines.push(`🆕 <b>Доступно обновление:</b> v${currentVersion} → v${latestVersion}`);
          lines.push('');
        }
      } catch (err) {
        console.log('[DailyReport] Update check failed:', err.message);
      }

      // === Отправка ===
      if (lines.length <= 2) {
        lines.push('✅ Нет приближающихся платежей и задач');
      }

      const message = lines.join('\n');
      await sendTelegramMessage(botToken, chatId, message, dailySummaryTopicId);
      console.log('[DailyReport] Daily report sent');

    } catch (err) {
      console.error('[DailyReport] Failed to send:', err.message);
    }
  }

  // Проверка обновлений на GitHub
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

  // Сравнение версий
  compareVersions(v1, v2) {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      if ((p1[i] || 0) < (p2[i] || 0)) return -1;
      if ((p1[i] || 0) > (p2[i] || 0)) return 1;
    }
    return 0;
  }

  // Планирование ежедневного отчёта
  scheduleDailyReport() {
    if (!this.config?.settings?.telegram?.dailySummary) {
      console.log('[DailyReport] Daily report disabled');
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
      console.log(`[DailyReport] Next report scheduled at ${next.toLocaleString()}`);

      this.dailySummaryTimeout = setTimeout(async () => {
        await this.sendDailyReport();
        scheduleNext();
      }, delay);
    };

    scheduleNext();
  }

  // Остановка планировщика
  stopDailyReport() {
    if (this.dailySummaryTimeout) {
      clearTimeout(this.dailySummaryTimeout);
      this.dailySummaryTimeout = null;
      console.log('[DailyReport] Scheduler stopped');
    }
  }
}


module.exports = MonitoringService;
