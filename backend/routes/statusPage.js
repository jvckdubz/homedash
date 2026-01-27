const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');

const STATUS_PAGE_FILE = process.env.NODE_ENV === 'production' 
  ? '/app/data/status-page.json' 
  : path.join(__dirname, '../../data/status-page.json');

const LOGOS_DIR = process.env.NODE_ENV === 'production'
  ? '/app/data/status-logos'
  : path.join(__dirname, '../../data/status-logos');

let monitoringService = null;

// Rate limiting для публичного API
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 минута
const RATE_LIMIT_MAX = 60; // 60 запросов в минуту

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now - record.start > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  record.count++;
  return true;
}

// Очистка старых записей rate limit каждые 5 минут
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap) {
    if (now - record.start > RATE_LIMIT_WINDOW * 2) {
      rateLimitMap.delete(ip);
    }
  }
}, 300000);

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(LOGOS_DIR, { recursive: true });
      cb(null, LOGOS_DIR);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const type = req.body.type || 'main';
    const cardId = req.body.cardId || '';
    // Используем хэш вместо cardId для безопасности
    const hash = cardId ? crypto.createHash('md5').update(cardId).digest('hex').slice(0, 8) : '';
    const filename = type === 'main' 
      ? `main-logo${ext}`
      : `monitor-${hash}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Недопустимый тип файла'));
    }
  }
});

// Установка ссылки на MonitoringService
router.setMonitoringService = (service) => {
  monitoringService = service;
};

// Загрузка конфигурации
async function loadStatusPageConfig() {
  try {
    const data = await fs.readFile(STATUS_PAGE_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// Сохранение конфигурации
async function saveStatusPageConfig(config) {
  await fs.writeFile(STATUS_PAGE_FILE, JSON.stringify(config, null, 2));
}

// ==================== ПУБЛИЧНЫЙ API (безопасный) ====================

// Публичный эндпоинт - минимальные данные, без внутренней информации
router.get('/public', async (req, res) => {
  try {
    // Rate limiting
    const ip = req.ip || req.connection.remoteAddress;
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: 'Слишком много запросов' });
    }

    const config = await loadStatusPageConfig();
    
    if (!config || !config.enabled) {
      return res.status(404).json({ error: 'Страница статуса не настроена' });
    }

    // Получаем статусы
    const allStatuses = monitoringService ? monitoringService.getAllStatuses() : {};

    // Формируем безопасный ответ - без cardId и внутренних данных
    const monitors = (config.monitors || []).map((monitor, index) => {
      const status = allStatuses[monitor.cardId] || {};
      
      // Если монитор в режиме обслуживания
      if (monitor.maintenance) {
        return {
          name: monitor.customName || 'Сервис',
          description: monitor.customDescription || '',
          logo: monitor.customLogo || '',
          link: monitor.showLink ? (monitor.customUrl || '') : null,
          status: 'maintenance',
          uptime: null,
          heartbeat: []
        };
      }

      // Heartbeat с timestamp для tooltip (последние 90)
      const heartbeat = (status.checks || [])
        .slice(-90)
        .map(c => ({
          s: typeof c.status === 'number' ? c.status : 1,
          t: c.timestamp || null
        }));

      return {
        name: monitor.customName || 'Сервис',
        description: monitor.customDescription || '',
        logo: monitor.customLogo || '',
        link: monitor.showLink ? (monitor.customUrl || '') : null,
        status: status.status || 'unknown',
        uptime: status.stats?.['24h']?.uptime || null,
        heartbeat
      };
    });

    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'");

    res.json({
      config: {
        title: config.title || 'Статус сервисов',
        description: config.description || '',
        logo: config.logo || '',
        footerText: config.footerText || '',
        pageTitle: config.pageTitle || config.title || 'Статус сервисов',
        lang: config.lang || 'ru'
      },
      monitors
    });
  } catch (err) {
    console.error('Error loading public status page:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Старый endpoint для обратной совместимости - редирект на public
router.get('/', async (req, res) => {
  res.redirect('/api/status-page/public');
});

// ==================== ЗАЩИЩЁННЫЕ ENDPOINTS ====================

// Получение полной конфигурации (для админки)
router.get('/config', async (req, res) => {
  try {
    const config = await loadStatusPageConfig();
    res.json(config || { enabled: false, monitors: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Сохранение конфигурации
router.post('/config', async (req, res) => {
  try {
    const config = req.body;
    await saveStatusPageConfig(config);
    
    // Обновляем мониторинг если нужно (для режима обслуживания)
    if (monitoringService && config.monitors) {
      for (const monitor of config.monitors) {
        if (monitor.maintenance) {
          monitoringService.pauseMonitor(monitor.cardId);
        } else {
          monitoringService.resumeMonitor(monitor.cardId);
        }
      }
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Установка/снятие режима обслуживания
router.post('/maintenance/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;
    const { enabled } = req.body;
    
    const config = await loadStatusPageConfig();
    if (!config) {
      return res.status(404).json({ error: 'Конфигурация не найдена' });
    }
    
    const monitor = config.monitors?.find(m => m.cardId === cardId);
    if (!monitor) {
      return res.status(404).json({ error: 'Монитор не найден' });
    }
    
    monitor.maintenance = enabled;
    monitor.maintenanceStarted = enabled ? new Date().toISOString() : null;
    
    await saveStatusPageConfig(config);
    
    // Приостанавливаем/возобновляем мониторинг
    if (monitoringService) {
      if (enabled) {
        monitoringService.pauseMonitor(cardId);
      } else {
        monitoringService.resumeMonitor(cardId);
      }
    }
    
    res.json({ success: true, maintenance: enabled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Загрузка логотипа
router.post('/upload-logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }
    
    const url = `/api/status-page/logos/${req.file.filename}`;
    res.json({ url, filename: req.file.filename });
  } catch (err) {
    console.error('Error uploading logo:', err);
    res.status(500).json({ error: err.message });
  }
});

// Отдача логотипов (публичный)
router.get('/logos/:filename', async (req, res) => {
  try {
    // Защита от path traversal
    const filename = path.basename(req.params.filename);
    const filepath = path.join(LOGOS_DIR, filename);
    
    await fs.access(filepath);
    
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };
    
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    const fileBuffer = await fs.readFile(filepath);
    res.send(fileBuffer);
  } catch (err) {
    res.status(404).json({ error: 'Файл не найден' });
  }
});

module.exports = router;
