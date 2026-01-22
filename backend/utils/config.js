const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const https = require('https');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Paths - use /app/data in production (Docker)
const DATA_DIR = process.env.DATA_DIR || (IS_PRODUCTION ? '/app/data' : path.join(__dirname, '..', 'data'));
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const ICONS_DIR = path.join(DATA_DIR, 'icons');
const SSH_KEYS_DIR = path.join(DATA_DIR, 'ssh_keys');
const MONITORING_FILE = path.join(DATA_DIR, 'monitoring.json');
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');

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

// Initialize data directories
async function initData() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(ICONS_DIR, { recursive: true });
    await fs.mkdir(SSH_KEYS_DIR, { recursive: true });
    console.log(`[Config] Data directories initialized at ${DATA_DIR}`);
  } catch (err) {
    console.error('[Config] Error creating data directories:', err);
  }
}

// Load config
async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.log('[Config] No config found, using defaults');
    return {
      settings: {
        title: "HomeDash",
        columns: 4,
        showClock: true,
        showGreeting: true,
        userName: "User",
        weatherCity: "",
        timezone: "Europe/Moscow",
        monitoring: {
          enabled: false,
          interval: 60,
          timeout: 10,
          retries: 2,
          historyDays: 7
        },
        telegram: {
          enabled: false,
          botToken: "",
          chatId: "",
          notifyDown: true,
          notifyUp: true,
          notifyDegraded: false
        }
      },
      categories: [
        { id: "services", name: "Домашние сервисы", icon: "server", order: 0 },
        { id: "monitoring", name: "Мониторинг", icon: "activity", order: 1 },
        { id: "hosting", name: "Хостинг и VPS", icon: "cloud", order: 2 },
        { id: "tools", name: "Инструменты", icon: "wrench", order: 3 }
      ],
      cards: []
    };
  }
}

// Save config
async function saveConfig(config) {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  return config;
}

// Load payments data
async function loadPayments() {
  try {
    const data = await fs.readFile(PAYMENTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return {
      providers: [],
      qrCodes: {},
      history: [],
      purchases: []
    };
  }
}

// Save payments data
async function savePayments(payments) {
  await fs.writeFile(PAYMENTS_FILE, JSON.stringify(payments, null, 2));
}

// Load tasks data
async function loadTasks() {
  try {
    const data = await fs.readFile(TASKS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return {
      tasks: [],
      notes: []
    };
  }
}

// Save tasks data
async function saveTasks(data) {
  await fs.writeFile(TASKS_FILE, JSON.stringify(data, null, 2));
}

// Load custom templates
async function loadTemplates() {
  try {
    const data = await fs.readFile(TEMPLATES_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Save custom templates
async function saveCustomTemplates(templates) {
  await fs.writeFile(TEMPLATES_FILE, JSON.stringify(templates, null, 2));
}

module.exports = {
  IS_PRODUCTION,
  DATA_DIR,
  CONFIG_FILE,
  ICONS_DIR,
  SSH_KEYS_DIR,
  MONITORING_FILE,
  PAYMENTS_FILE,
  TASKS_FILE,
  TEMPLATES_FILE,
  httpsAgent,
  fetchWithSSL,
  initData,
  loadConfig,
  saveConfig,
  loadPayments,
  savePayments,
  loadTasks,
  saveTasks,
  loadTemplates,
  saveCustomTemplates
};
