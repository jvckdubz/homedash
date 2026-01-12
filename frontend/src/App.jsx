import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Settings, Plus, Edit3, Trash2, ExternalLink, X, Save,
  Server, Activity, Cloud, Wrench, Home, Shield, Globe,
  Cpu, HardDrive, Clock as ClockIcon, Zap, Users, Lock, Check, AlertCircle,
  Grid, List, RefreshCw, ChevronDown, Upload, Link as LinkIcon,
  Download, Folder, FolderPlus, GripVertical, Lightbulb, ToggleRight,
  Gauge, Cog, Database, Container, Eye, EyeOff, Copy, FileJson,
  MonitorCheck, Network, Wifi, Router, Box, Layers, BarChart3,
  ThermometerSun, Droplets, Wind, Power, PlayCircle, PauseCircle, Terminal, Key,
  Bell, BellOff, Radio, Signal, Send, MessageCircle, Timer, TrendingUp,
  Palette, FileText, Receipt, CreditCard, Banknote, ShoppingCart, Cat,
  Smartphone, Tv, Car, Fuel, Pill, Heart, Baby, Utensils, Coffee,
  Building2, Zap as Electric, Flame, Waves, Phone, QrCode, Camera,
  Calendar, History, PieChart, ArrowLeft, CheckCircle2, ScanLine, Ban,
  Sun, Moon, CloudSun, CloudRain, CloudSnow, CloudLightning, CloudFog, Cloudy,
  Search
} from 'lucide-react';

// ============ i18n Translations ============
const translations = {
  ru: {
    // Navigation
    home: 'Главная',
    monitoring: 'Мониторинг',
    settings: 'Настройки',
    payments: 'Платежи',
    status: 'Статус',
    
    // Actions
    save: 'Сохранить',
    saveAndClose: 'Сохранить и закрыть',
    cancel: 'Отмена',
    close: 'Закрыть',
    delete: 'Удалить',
    edit: 'Редактировать',
    add: 'Добавить',
    open: 'Открыть',
    refresh: 'Обновить',
    done: 'Готово',
    back: 'Назад',
    
    // Cards
    newCard: 'Новая карточка',
    editCard: 'Редактировать',
    deleteCard: 'Удалить карточку',
    noCards: 'Нет карточек',
    allCategories: 'Все',
    services: 'Сервисов',
    
    // Card Editor
    general: 'Основное',
    appearance: 'Внешний вид',
    integration: 'Интеграция',
    billing: 'Оплата',
    name: 'Название',
    description: 'Описание',
    url: 'URL',
    category: 'Категория',
    color: 'Цвет',
    icon: 'Иконка',
    
    // Integration
    integrationType: 'Тип интеграции',
    noIntegration: 'Без интеграции',
    refreshData: 'Обновить данные',
    
    // Settings
    language: 'Язык',
    categories: 'Категории',
    integrations: 'Интеграции',
    importExport: 'Импорт/Экспорт',
    about: 'О программе',
    notifications: 'Уведомления',
    sshKeys: 'SSH ключи',
    quickActions: 'Быстрые действия',
    appSettings: 'Конфигурация приложения',
    manageSubscriptions: 'Управление подписками',
    addService: 'Добавить сервис',
    statistics: 'Статистика',
    
    // Status
    online: 'Онлайн',
    offline: 'Оффлайн',
    unknown: 'Неизвестно',
    checking: 'Проверка...',
    currentStatus: 'Текущий статус',
    lastCheck: 'Последняя проверка',
    recentChecks: 'Последние проверки',
    noMonitoring: 'Мониторинг не настроен',
    
    // Metrics
    cpu: 'CPU',
    ram: 'RAM',
    disk: 'Диск',
    uptime: 'Uptime',
    running: 'Запущено',
    stopped: 'Остановлено',
    total: 'Всего',
    blocked: 'Заблокировано',
    alerts: 'Алерты',
    queries: 'Запросы',
    enabled: 'Включено',
    disabled: 'Отключено',
    pages: 'Страницы',
    users: 'Пользователи',
    
    // Payments
    nextPayment: 'Следующий платеж',
    date: 'Дата',
    daysUntil: 'дней до платежа',
    
    // Settings tabs
    backup: 'Бэкап',
    system: 'Система',
    
    // Misc
    search: 'Поиск',
    loading: 'Загрузка...',
    error: 'Ошибка',
    noData: 'Нет данных',
    version: 'Версия',
    confirmDelete: 'Удалить'
  },
  en: {
    // Navigation
    home: 'Home',
    monitoring: 'Monitoring',
    settings: 'Settings',
    payments: 'Payments',
    status: 'Status',
    
    // Actions
    save: 'Save',
    saveAndClose: 'Save and close',
    cancel: 'Cancel',
    close: 'Close',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    open: 'Open',
    refresh: 'Refresh',
    done: 'Done',
    back: 'Back',
    
    // Cards
    newCard: 'New card',
    editCard: 'Edit',
    deleteCard: 'Delete card',
    noCards: 'No cards',
    allCategories: 'All',
    services: 'Services',
    
    // Card Editor
    general: 'General',
    appearance: 'Appearance',
    integration: 'Integration',
    billing: 'Billing',
    name: 'Name',
    description: 'Description',
    url: 'URL',
    category: 'Category',
    color: 'Color',
    icon: 'Icon',
    
    // Integration
    integrationType: 'Integration type',
    noIntegration: 'No integration',
    refreshData: 'Refresh data',
    
    // Settings
    language: 'Language',
    categories: 'Categories',
    integrations: 'Integrations',
    importExport: 'Import/Export',
    about: 'About',
    notifications: 'Notifications',
    sshKeys: 'SSH Keys',
    quickActions: 'Quick actions',
    appSettings: 'Application settings',
    manageSubscriptions: 'Manage subscriptions',
    addService: 'Add service',
    statistics: 'Statistics',
    
    // Status
    online: 'Online',
    offline: 'Offline',
    unknown: 'Unknown',
    checking: 'Checking...',
    currentStatus: 'Current status',
    lastCheck: 'Last check',
    recentChecks: 'Recent checks',
    noMonitoring: 'No monitoring configured',
    
    // Metrics
    cpu: 'CPU',
    ram: 'RAM',
    disk: 'Disk',
    uptime: 'Uptime',
    running: 'Running',
    stopped: 'Stopped',
    total: 'Total',
    blocked: 'Blocked',
    alerts: 'Alerts',
    queries: 'Queries',
    enabled: 'Enabled',
    disabled: 'Disabled',
    pages: 'Pages',
    users: 'Users',
    
    // Payments
    nextPayment: 'Next payment',
    date: 'Date',
    daysUntil: 'days until payment',
    
    // Settings tabs
    backup: 'Backup',
    system: 'System',
    
    // Misc
    search: 'Search',
    loading: 'Loading...',
    error: 'Error',
    noData: 'No data',
    version: 'Version',
    confirmDelete: 'Delete'
  }
};

// i18n Context
const I18nContext = React.createContext({ t: (k) => k, lang: 'ru', setLang: () => {} });
const useI18n = () => React.useContext(I18nContext);

// Weather Icon Component
const WeatherIcon = ({ code, className }) => {
  const icons = {
    'sunny': Sun,
    'clear': Moon,
    'partly-cloudy': CloudSun,
    'cloudy': Cloudy,
    'overcast': Cloud,
    'mist': CloudFog,
    'fog': CloudFog,
    'rain': CloudRain,
    'snow': CloudSnow,
    'thunder': CloudLightning,
    'default': ThermometerSun
  };
  const Icon = icons[code] || icons['default'];
  return <Icon className={`${className} text-yellow-400`} />;
};

// ============ Service Icons ============
const serviceIcons = {
  'proxmox': () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" fill="currentColor" opacity="0.2"/>
      <polygon points="50,15 85,32.5 85,67.5 50,85 15,67.5 15,32.5" fill="none" stroke="currentColor" strokeWidth="3"/>
      <circle cx="50" cy="50" r="15" fill="currentColor"/>
    </svg>
  ),
  'home-assistant': () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <path d="M50 10 L85 40 L85 90 L15 90 L15 40 Z" fill="currentColor" opacity="0.2"/>
      <path d="M50 20 L80 45 L80 85 L20 85 L20 45 Z" fill="none" stroke="currentColor" strokeWidth="3"/>
      <circle cx="50" cy="55" r="12" fill="currentColor"/>
    </svg>
  ),
  'adguard': () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <path d="M50 5 L90 25 L90 55 C90 75 70 90 50 95 C30 90 10 75 10 55 L10 25 Z" fill="currentColor" opacity="0.2"/>
      <path d="M50 15 L80 30 L80 55 C80 70 65 82 50 87 C35 82 20 70 20 55 L20 30 Z" fill="none" stroke="currentColor" strokeWidth="3"/>
      <path d="M35 50 L47 62 L65 40" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  'nginx': () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <polygon points="50,10 90,30 90,70 50,90 10,70 10,30" fill="currentColor" opacity="0.2"/>
      <text x="50" y="60" textAnchor="middle" fontSize="30" fontWeight="bold" fill="currentColor">N</text>
    </svg>
  ),
  'docker': () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <rect x="10" y="40" width="80" height="45" rx="5" fill="currentColor" opacity="0.2"/>
      <rect x="15" y="25" width="12" height="12" fill="currentColor" opacity="0.5"/>
      <rect x="30" y="25" width="12" height="12" fill="currentColor" opacity="0.5"/>
      <rect x="45" y="25" width="12" height="12" fill="currentColor" opacity="0.5"/>
      <rect x="30" y="10" width="12" height="12" fill="currentColor" opacity="0.5"/>
    </svg>
  ),
  'crowdsec': () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="40" fill="currentColor" opacity="0.2"/>
      <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="3"/>
      <circle cx="50" cy="50" r="15" fill="none" stroke="currentColor" strokeWidth="3"/>
      <circle cx="50" cy="50" r="5" fill="currentColor"/>
    </svg>
  ),
  'uptime-kuma': () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <rect x="15" y="25" width="70" height="50" rx="5" fill="currentColor" opacity="0.2"/>
      <polyline points="25,55 35,45 50,60 65,35 75,50" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  'server': () => <Server className="w-full h-full" />,
  'activity': () => <Activity className="w-full h-full" />,
  'cloud': () => <Cloud className="w-full h-full" />,
  'wrench': () => <Wrench className="w-full h-full" />,
  'home': () => <Home className="w-full h-full" />,
  'shield': () => <Shield className="w-full h-full" />,
  'globe': () => <Globe className="w-full h-full" />,
  'database': () => <Database className="w-full h-full" />,
  'container': () => <Container className="w-full h-full" />,
  'network': () => <Network className="w-full h-full" />,
  'router': () => <Router className="w-full h-full" />,
  'mikrotik': () => (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <rect x="10" y="30" width="80" height="40" rx="5" fill="currentColor" opacity="0.2"/>
      <rect x="15" y="35" width="70" height="30" rx="3" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="25" cy="50" r="4" fill="currentColor"/>
      <circle cx="40" cy="50" r="4" fill="currentColor"/>
      <circle cx="55" cy="50" r="4" fill="currentColor"/>
      <circle cx="70" cy="50" r="4" fill="currentColor"/>
      <rect x="78" y="44" width="4" height="12" fill="currentColor"/>
    </svg>
  ),
  'layers': () => <Layers className="w-full h-full" />,
  'monitor': () => <MonitorCheck className="w-full h-full" />,
  'gauge': () => <Gauge className="w-full h-full" />,
  'cog': () => <Cog className="w-full h-full" />,
  'weather': () => <ThermometerSun className="w-full h-full" />,
  'wiki': () => <FileJson className="w-full h-full" />,
  'terminal': () => <Terminal className="w-full h-full" />,
  'ssh': () => <Terminal className="w-full h-full" />,
  // Провайдеры и услуги
  'receipt': () => <Receipt className="w-full h-full" />,
  'credit-card': () => <CreditCard className="w-full h-full" />,
  'banknote': () => <Banknote className="w-full h-full" />,
  'internet': () => <Wifi className="w-full h-full" />,
  'wifi': () => <Wifi className="w-full h-full" />,
  'phone': () => <Phone className="w-full h-full" />,
  'mobile': () => <Smartphone className="w-full h-full" />,
  'tv': () => <Tv className="w-full h-full" />,
  'electric': () => <Zap className="w-full h-full" />,
  'gas': () => <Flame className="w-full h-full" />,
  'water': () => <Waves className="w-full h-full" />,
  'utilities': () => <Building2 className="w-full h-full" />,
  'cat': () => <Cat className="w-full h-full" />,
  'pet': () => <Cat className="w-full h-full" />,
  'shopping': () => <ShoppingCart className="w-full h-full" />,
  'car': () => <Car className="w-full h-full" />,
  'fuel': () => <Fuel className="w-full h-full" />,
  'health': () => <Heart className="w-full h-full" />,
  'medicine': () => <Pill className="w-full h-full" />,
  'baby': () => <Baby className="w-full h-full" />,
  'food': () => <Utensils className="w-full h-full" />,
  'coffee': () => <Coffee className="w-full h-full" />,
  'default': () => <Server className="w-full h-full" />
};

// Category icons mapping
const categoryIcons = {
  server: Server,
  activity: Activity,
  cloud: Cloud,
  wrench: Wrench,
  home: Home,
  shield: Shield,
  globe: Globe,
  database: Database,
  container: Container,
  network: Network,
  layers: Layers,
  folder: Folder,
  gauge: Gauge,
  cog: Cog,
  receipt: Receipt
};

// ============ API Helper ============
const api = {
  async get(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  async post(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  async put(url, data) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  async delete(url) {
    const res = await fetch(url, { method: 'DELETE', cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
};

// ============ Color Picker Component ============
const presetColors = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#78716c', '#71717a', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a'
];

function ColorPicker({ value, onChange, label }) {
  const [showPicker, setShowPicker] = useState(false);
  const [customColor, setCustomColor] = useState(value || '#8b5cf6');
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleColorSelect = (color) => {
    onChange(color);
    setShowPicker(false);
  };

  return (
    <div className="relative" ref={pickerRef}>
      {label && <label className="block text-sm text-dark-400 mb-2">{label}</label>}
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        className="w-full h-12 rounded-xl border border-dark-600 flex items-center gap-3 px-3 hover:border-dark-500 transition-colors"
      >
        <div 
          className="w-8 h-8 rounded-lg flex-shrink-0" 
          style={{ backgroundColor: value || '#8b5cf6' }} 
        />
        <span className="text-dark-300 text-sm">{value || '#8b5cf6'}</span>
      </button>

      {showPicker && (
        <motion.div 
          className="absolute z-50 top-full left-0 right-0 mt-2 p-4 bg-dark-800 border border-dark-600 rounded-xl shadow-xl"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="color-picker-grid mb-4">
            {presetColors.map(color => (
              <button
                key={color}
                type="button"
                className={`color-swatch ${value === color ? 'selected' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => handleColorSelect(color)}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              placeholder="#hex"
              className="input-field flex-1 text-sm"
            />
            <button
              type="button"
              onClick={() => handleColorSelect(customColor)}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-sm font-medium transition-colors"
            >
              OK
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ============ iOS-style Toggle Component ============
function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`toggle-switch ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}`}
    >
      <motion.div
        className="toggle-knob"
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

// ============ Clock Component ============
function Clock({ weatherData }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-center mb-8">
      <div className="flex items-center justify-center gap-6">
        <div>
          <motion.div 
            className="text-6xl font-light tracking-tight bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </motion.div>
          <motion.div 
            className="text-dark-400 mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {time.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
          </motion.div>
        </div>
        {weatherData?.configured && !weatherData?.error && (
          <motion.div 
            className="flex items-center gap-3 px-5 py-3 glass-card"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <WeatherIcon code={weatherData.iconCode} className="w-10 h-10" />
            <div>
              <div className="text-2xl font-medium text-white">{weatherData.temp}°C</div>
              <div className="text-xs text-dark-400">{weatherData.city}</div>
            </div>
            <div className="text-xs text-dark-500 ml-2 space-y-0.5">
              <div className="flex items-center gap-1">
                <Droplets size={12} />
                {weatherData.humidity}%
              </div>
              <div className="flex items-center gap-1">
                <Wind size={12} />
                {weatherData.wind} м/с
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ============ Greeting Component ============
function Greeting({ name }) {
  const hour = new Date().getHours();
  let greeting = 'Доброй ночи';
  if (hour >= 5 && hour < 12) greeting = 'Доброе утро';
  else if (hour >= 12 && hour < 17) greeting = 'Добрый день';
  else if (hour >= 17 && hour < 22) greeting = 'Добрый вечер';

  return (
    <motion.h1 
      className="text-2xl font-light text-dark-300 mb-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
    >
      {greeting}, <span className="text-white font-normal">{name}</span>
    </motion.h1>
  );
}

// ============ Integration Stats Display ============
function IntegrationStats({ card, data }) {
  if (!data || data.error || !data.configured) return null;

  const integrationType = card.integration?.type;

  if (integrationType === 'proxmox') {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {/* CPU */}
        <div className="flex items-center gap-2">
          <Cpu size={12} className="text-blue-400 flex-shrink-0" />
          <div className="progress-bar flex-1 h-1.5">
            <div className="progress-fill bg-blue-500 h-1.5" style={{ width: `${data.cpu}%` }} />
          </div>
          <span className="text-dark-300 text-[11px] w-9 text-right">{data.cpu}%</span>
        </div>
        {/* RAM */}
        <div className="flex items-center gap-2">
          <HardDrive size={12} className="text-purple-400 flex-shrink-0" />
          <div className="progress-bar flex-1 h-1.5">
            <div className="progress-fill bg-purple-500 h-1.5" style={{ width: `${data.memory?.percent}%` }} />
          </div>
          <span className="text-dark-300 text-[11px] w-9 text-right">{data.memory?.percent}%</span>
        </div>
        {/* VMs */}
        <div className="flex items-center gap-1.5" title="Virtual Machines">
          <Server size={12} className="text-blue-400 flex-shrink-0" />
          <span className="text-green-400">{data.vms?.running || 0}</span>
          <span className="text-dark-600">/</span>
          <span className="text-dark-500">{data.vms?.total || 0}</span>
        </div>
        {/* Containers */}
        <div className="flex items-center gap-1.5" title="LXC Containers">
          <Container size={12} className="text-cyan-400 flex-shrink-0" />
          <span className="text-green-400">{data.containers?.running || 0}</span>
          <span className="text-dark-600">/</span>
          <span className="text-dark-500">{data.containers?.total || 0}</span>
        </div>
      </div>
    );
  }

  if (integrationType === 'adguard') {
    return (
      <div className="space-y-2 text-xs">
        {/* Blocked progress with percent */}
        <div className="flex items-center gap-2">
          <Shield size={12} className="text-green-400 flex-shrink-0" />
          <div className="progress-bar flex-1 h-1.5">
            <div className="progress-fill bg-green-500 h-1.5" style={{ width: `${data.blockPercent}%` }} />
          </div>
          <span className="text-green-400 text-[11px] w-9 text-right">{data.blockPercent}%</span>
        </div>
        {/* Stats row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5" title="Всего запросов">
            <Globe size={12} className="text-blue-400 flex-shrink-0" />
            <span className="text-dark-300">{data.totalQueries?.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5" title="Заблокировано">
            <Shield size={12} className="text-green-400 flex-shrink-0" />
            <span className="text-green-400">{data.blockedQueries?.toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  }

  if (integrationType === 'homeassistant') {
    // Если есть custom entities - показываем их
    if (data.customEntities && data.customEntities.length > 0) {
      return (
        <div className="space-y-1 text-xs">
          {data.customEntities.slice(0, 3).map((entity, idx) => (
            <div key={idx} className="flex items-center justify-between gap-2">
              <span className="text-dark-400 truncate">{entity.name}</span>
              <span className={`font-medium ${
                entity.state === 'on' ? 'text-yellow-400' : 
                entity.state === 'off' ? 'text-dark-500' : 
                entity.domain === 'sensor' ? 'text-cyan-400' : 'text-white'
              }`}>
                {entity.state}{entity.unit ? ` ${entity.unit}` : ''}
              </span>
            </div>
          ))}
        </div>
      );
    }
    
    // Иначе показываем общую статистику
    return (
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5" title="Освещение (вкл/всего)">
            <Lightbulb size={13} className="text-yellow-400" />
            <span className="text-yellow-400 font-medium">{data.entityCounts?.lightsOn || 0}</span>
            <span className="text-dark-500">/ {data.entityCounts?.lights || 0}</span>
          </div>
          <div className="flex items-center gap-1.5" title="Выключатели (вкл/всего)">
            <ToggleRight size={13} className="text-blue-400" />
            <span className="text-blue-400 font-medium">{data.entityCounts?.switchesOn || 0}</span>
            <span className="text-dark-500">/ {data.entityCounts?.switches || 0}</span>
          </div>
          <div className="flex items-center gap-1.5" title="Датчики">
            <Gauge size={13} className="text-purple-400" />
            <span className="text-dark-300">{data.entityCounts?.sensors || 0}</span>
          </div>
        </div>
      </div>
    );
  }

  if (integrationType === 'npm') {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div className="flex items-center gap-1.5" title="Активные хосты">
          <Globe size={12} className="text-green-400 flex-shrink-0" />
          <span className="text-green-400">{data.enabledHosts}</span>
          <span className="text-dark-600">active</span>
        </div>
        <div className="flex items-center gap-1.5" title="Всего хостов">
          <Server size={12} className="text-dark-500 flex-shrink-0" />
          <span className="text-dark-400">{data.totalHosts || data.enabledHosts}</span>
          <span className="text-dark-600">total</span>
        </div>
      </div>
    );
  }

  if (integrationType === 'docker') {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div className="flex items-center gap-1.5" title="Работает">
          <PlayCircle size={12} className="text-green-400 flex-shrink-0" />
          <span className="text-green-400">{data.running}</span>
          <span className="text-dark-600">running</span>
        </div>
        <div className="flex items-center gap-1.5" title="Остановлено">
          <PauseCircle size={12} className="text-gray-500 flex-shrink-0" />
          <span className="text-dark-400">{data.stopped}</span>
          <span className="text-dark-600">stopped</span>
        </div>
      </div>
    );
  }

  if (integrationType === 'crowdsec') {
    return (
      <div className="flex items-center gap-1.5 text-xs" title="Заблокировано IP">
        <Shield size={12} className="text-orange-400 flex-shrink-0" />
        <span className="text-orange-400">{data.blockedIPs}</span>
        <span className="text-dark-600">blocked</span>
      </div>
    );
  }

  if (integrationType === 'openwrt') {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {/* CPU */}
        <div className="flex items-center gap-2">
          <Cpu size={12} className="text-orange-400 flex-shrink-0" />
          <div className="progress-bar flex-1 h-1.5">
            <div className="progress-fill bg-orange-500 h-1.5" style={{ width: `${data.cpu || 0}%` }} />
          </div>
          <span className="text-dark-300 text-[11px] w-9 text-right">{data.cpu || 0}%</span>
        </div>
        {/* RAM */}
        <div className="flex items-center gap-2">
          <HardDrive size={12} className="text-blue-400 flex-shrink-0" />
          <div className="progress-bar flex-1 h-1.5">
            <div className="progress-fill bg-blue-500 h-1.5" style={{ width: `${data.memory?.percent || 0}%` }} />
          </div>
          <span className="text-dark-300 text-[11px] w-9 text-right">{parseFloat(data.memory?.percent || 0).toFixed(0)}%</span>
        </div>
        {/* Uptime */}
        {data.uptime?.formatted && (
          <div className="col-span-2 flex items-center gap-1.5" title="Uptime">
            <ClockIcon size={12} className="text-green-400 flex-shrink-0" />
            <span className="text-dark-300">{data.uptime.formatted}</span>
          </div>
        )}
      </div>
    );
  }

  if (integrationType === 'weather') {
    return (
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{data.icon}</span>
          <div>
            <div className="text-base font-medium text-white">{data.temp}°C</div>
            <div className="text-dark-500 text-[11px]">{data.description}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-dark-400">
          <div className="flex items-center gap-1" title="Влажность">
            <Droplets size={10} />
            <span>{data.humidity}%</span>
          </div>
          <div className="flex items-center gap-1" title="Ветер">
            <Wind size={10} />
            <span>{data.wind} м/с</span>
          </div>
        </div>
      </div>
    );
  }

  if (integrationType === 'wikijs') {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div className="flex items-center gap-1.5" title="Страниц">
          <FileJson size={12} className="text-blue-400 flex-shrink-0" />
          <span className="text-dark-300">{data.totalPages}</span>
          <span className="text-dark-600">pages</span>
        </div>
        <div className="flex items-center gap-1.5" title="Обновлено за неделю">
          <RefreshCw size={12} className="text-green-400 flex-shrink-0" />
          <span className="text-green-400">{data.recentPages}</span>
          <span className="text-dark-600">recent</span>
        </div>
      </div>
    );
  }

  if (integrationType === 'ssh') {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {/* Load */}
        <div className="flex items-center gap-2">
          <Activity size={12} className="text-orange-400 flex-shrink-0" />
          <div className="progress-bar flex-1 h-1.5">
            <div className="progress-fill bg-orange-500 h-1.5" 
              style={{ width: `${Math.min(parseFloat(data.load?.percent || 0), 100)}%` }} />
          </div>
          <span className="text-dark-300 text-[11px] w-8 text-right">{data.load?.load1}</span>
        </div>
        {/* RAM */}
        <div className="flex items-center gap-2">
          <HardDrive size={12} className="text-blue-400 flex-shrink-0" />
          <div className="progress-bar flex-1 h-1.5">
            <div className="progress-fill bg-blue-500 h-1.5" 
              style={{ width: `${data.memory?.percent || 0}%` }} />
          </div>
          <span className="text-dark-300 text-[11px] w-9 text-right">{data.memory?.percent}%</span>
        </div>
        {/* Uptime */}
        <div className="flex items-center gap-1.5" title="Uptime">
          <ClockIcon size={12} className="text-green-400 flex-shrink-0" />
          <span className="text-dark-300">{data.uptime?.formatted}</span>
        </div>
        {/* Disk */}
        <div className="flex items-center gap-1.5" title="Disk">
          <Database size={12} className="text-purple-400 flex-shrink-0" />
          <span className="text-dark-300">{data.disk?.percent}%</span>
        </div>
      </div>
    );
  }

  if (integrationType === 'mikrotik') {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {/* CPU */}
        <div className="flex items-center gap-2">
          <Cpu size={12} className="text-orange-400 flex-shrink-0" />
          <div className="progress-bar flex-1 h-1.5">
            <div className="progress-fill bg-orange-500 h-1.5" style={{ width: `${data.cpu}%` }} />
          </div>
          <span className="text-dark-300 text-[11px] w-9 text-right">{data.cpu}%</span>
        </div>
        {/* RAM */}
        <div className="flex items-center gap-2">
          <HardDrive size={12} className="text-blue-400 flex-shrink-0" />
          <div className="progress-bar flex-1 h-1.5">
            <div className="progress-fill bg-blue-500 h-1.5" style={{ width: `${data.memory?.percent}%` }} />
          </div>
          <span className="text-dark-300 text-[11px] w-9 text-right">{data.memory?.percent}%</span>
        </div>
        {/* Uptime */}
        <div className="flex items-center gap-1.5" title="Uptime">
          <ClockIcon size={12} className="text-green-400 flex-shrink-0" />
          <span className="text-dark-300">{data.uptime?.formatted}</span>
        </div>
        {/* Interfaces */}
        <div className="flex items-center gap-1.5" title="Интерфейсы">
          <Wifi size={12} className="text-cyan-400 flex-shrink-0" />
          <span className="text-green-400">{data.interfaces?.up}</span>
          <span className="text-dark-600">/</span>
          <span className="text-dark-500">{data.interfaces?.total}</span>
        </div>
      </div>
    );
  }

  if (integrationType === 'custom' && data.display) {
    return <div className="text-xs text-dark-400">{data.display}</div>;
  }

  return null;
}

// ============ Card Detail Modal ============
// ============ Payments Page ============

// Иконки для провайдеров
const providerIcons = [
  { id: 'wifi', name: 'Интернет' },
  { id: 'phone', name: 'Телефон' },
  { id: 'mobile', name: 'Мобильный' },
  { id: 'tv', name: 'ТВ' },
  { id: 'electric', name: 'Электричество' },
  { id: 'gas', name: 'Газ' },
  { id: 'water', name: 'Вода' },
  { id: 'utilities', name: 'Коммуналка' },
  { id: 'cat', name: 'Питомцы' },
  { id: 'car', name: 'Авто' },
  { id: 'fuel', name: 'Топливо' },
  { id: 'health', name: 'Здоровье' },
  { id: 'medicine', name: 'Лекарства' },
  { id: 'food', name: 'Еда' },
  { id: 'shopping', name: 'Покупки' },
  { id: 'receipt', name: 'Другое' }
];

// ============ Mobile Dashboard (Liquid Glass Style) ============
function MobileDashboard({ 
  config, settings, categories, cards, 
  integrationData, monitoringStatuses, weatherData,
  onRefresh, refreshing, onEditCard, onNewCard, onOpenSettings, onDeleteCard,
  loadIntegrationData, activeTab, lang, setLang
}) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showTranslate, setShowTranslate] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null); // Для контекстного меню
  const [collapsedCategories, setCollapsedCategories] = useState({}); // Сворачивание категорий
  const [detailCard, setDetailCard] = useState(null); // Для детального просмотра мониторинга
  
  // Local translation function based on lang prop
  const t = (key) => translations[lang]?.[key] || translations['ru']?.[key] || key;

  // Переключение свернутости категории
  const toggleCategory = (catId) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  // Фильтрация карточек
  const filteredCards = cards.filter(card => {
    const matchesCategory = selectedCategory === 'all' || card.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Группировка по категориям
  const groupedCards = categories.map(cat => ({
    ...cat,
    cards: filteredCards.filter(c => c.category === cat.id).sort((a, b) => (a.order || 0) - (b.order || 0))
  })).filter(cat => cat.cards.length > 0);

  // Render card
  const renderCard = (card) => {
    const intData = integrationData[card.id];
    const monStatus = monitoringStatuses[card.id]?.status;
    const isMonitoringEnabled = card.monitoring?.enabled && (card.url || card.integration?.type === 'ssh');
    const IconComp = serviceIcons[card.icon] || Server;

    // Формируем строку с данными интеграции
    const getIntegrationPreview = () => {
      if (!intData || intData.error) return null;
      
      const parts = [];
      const intType = card.integration?.type;
      
      // Форматирование uptime из секунд
      const formatUptime = (seconds) => {
        if (!seconds) return null;
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        if (days > 0) return `${days}d ${hours}h`;
        return `${hours}h`;
      };
      
      // Home Assistant - customEntities (отслеживаемые сущности)
      if (intData.customEntities && Array.isArray(intData.customEntities) && intData.customEntities.length > 0) {
        intData.customEntities.slice(0, 2).forEach(e => {
          if (e.name && e.state !== undefined && e.state !== 'unavailable') {
            parts.push(`${e.name}: ${e.state}${e.unit || ''}`);
          }
        });
      }
      
      // Home Assistant - sensors (альтернативное поле)
      if (intData.sensors && Array.isArray(intData.sensors) && parts.length === 0) {
        intData.sensors.slice(0, 2).forEach(s => {
          if (s.name && s.state !== undefined) {
            parts.push(`${s.name}: ${s.state}${s.unit || ''}`);
          }
        });
      }
      
      // Proxmox - uptime снаружи
      if (intType === 'proxmox') {
        if (intData.uptime) {
          parts.push(formatUptime(intData.uptime));
        }
        if (intData.vms?.running !== undefined || intData.containers?.running !== undefined) {
          const vmCount = intData.vms?.running || 0;
          const lxcCount = intData.containers?.running || 0;
          parts.push(`${vmCount} VM | ${lxcCount} LXC`);
        }
        return parts.length > 0 ? parts.slice(0, 2).join(' | ') : null;
      }
      
      // SSH - uptime снаружи
      if (intType === 'ssh') {
        if (intData.uptime?.formatted) {
          parts.push(intData.uptime.formatted);
        }
        if (intData.load?.percent !== undefined) {
          parts.push(`CPU ${parseFloat(intData.load.percent).toFixed(0)}%`);
        }
        return parts.length > 0 ? parts.slice(0, 2).join(' | ') : null;
      }
      
      // Mikrotik - CPU, RAM, uptime
      if (intType === 'mikrotik') {
        if (intData.cpu !== undefined) {
          parts.push(`CPU ${intData.cpu}%`);
        }
        if (intData.memory?.percent !== undefined) {
          parts.push(`RAM ${parseFloat(intData.memory.percent).toFixed(0)}%`);
        }
        if (intData.uptime?.formatted) {
          parts.push(intData.uptime.formatted);
        }
        return parts.length > 0 ? parts.join(' | ') : null;
      }
      
      // Docker
      if (intData.running !== undefined && intData.total !== undefined) {
        parts.push(`${intData.running}/${intData.total} running`);
      }
      
      // CrowdSec
      if (intData.blockedIPs !== undefined) {
        parts.push(`${intData.blockedIPs} blocked`);
      }
      
      // OpenWRT
      if (intType === 'openwrt') {
        if (intData.cpu !== undefined) {
          parts.push(`CPU ${intData.cpu}%`);
        }
        if (intData.memory?.percent !== undefined) {
          parts.push(`RAM ${parseFloat(intData.memory.percent).toFixed(0)}%`);
        }
        if (intData.uptime?.formatted) {
          parts.push(intData.uptime.formatted);
        }
        return parts.length > 0 ? parts.join(' | ') : null;
      }
      
      // Wiki.js
      if (intData.totalPages !== undefined) {
        parts.push(`${intData.totalPages} pages`);
      }
      if (intData.activeUsers !== undefined && parts.length < 2) {
        parts.push(`${intData.activeUsers} users`);
      }
      
      // Nginx Proxy Manager - enabledHosts
      if (intData.enabledHosts !== undefined) {
        parts.push(`${intData.enabledHosts} hosts`);
      }
      
      // AdGuard Home
      if (intData.totalQueries !== undefined && intData.totalQueries !== null) {
        parts.push(`${Number(intData.totalQueries).toLocaleString()} queries`);
      }
      if (intData.blockPercent !== undefined && intData.blockPercent !== null) {
        parts.push(`${intData.blockPercent}% blocked`);
      }
      
      // VPN/Remnawave nodes
      if (intData.nodesOnline !== undefined) {
        parts.push(`${intData.nodesOnline} nodes`);
      }
      if (intData.usersOnline !== undefined && parts.length < 2) {
        parts.push(`${intData.usersOnline} users`);
      }
      
      return parts.length > 0 ? parts.slice(0, 2).join(' | ') : null;
    };

    const integrationPreview = getIntegrationPreview();

    return (
      <motion.div
        key={card.id}
        className="mobile-card p-4"
        whileTap={{ scale: 0.98 }}
        onClick={() => setSelectedCard(card)}
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div 
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${card.color}20`, color: card.color }}
          >
            {card.customIcon ? (
              <img src={card.customIcon} alt="" className="w-7 h-7 object-contain" />
            ) : (
              <IconComp className="w-6 h-6" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold truncate">{card.name}</span>
              {isMonitoringEnabled && (
                <div className={`status-indicator ${monStatus === 'up' ? 'online' : monStatus === 'down' ? 'offline' : 'unknown'}`} />
              )}
            </div>
            {card.description && (
              <p className="text-sm text-white/50 truncate">{card.description}</p>
            )}
            {/* Integration data preview */}
            {integrationPreview && (
              <p className="text-xs text-white/40 mt-1 truncate">{integrationPreview}</p>
            )}
          </div>

          {/* Chevron */}
          <ChevronDown size={20} className="-rotate-90 text-white/30 flex-shrink-0" />
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-animated">
      {/* Header */}
      <header className="mobile-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
              <Grid size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate">{settings.title}</h1>
              {weatherData && (
                <p className="text-xs text-white/50">
                  {weatherData.temp}° {weatherData.condition}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button 
              onClick={() => setShowSearch(!showSearch)}
              className="p-2.5 rounded-xl hover:bg-white/10 transition-colors"
            >
              <Search size={20} className="text-white/70" />
            </button>
            <div className="relative">
              <button 
                onClick={() => setShowTranslate(!showTranslate)}
                className={`p-2.5 rounded-xl hover:bg-white/10 transition-colors ${showTranslate ? 'bg-white/10' : ''}`}
              >
                <Globe size={20} className="text-white/70" />
              </button>
              <AnimatePresence>
                {showTranslate && (
                  <TranslateWidget show={showTranslate} onClose={() => setShowTranslate(false)} />
                )}
              </AnimatePresence>
            </div>
            <button 
              onClick={onRefresh}
              disabled={refreshing}
              className="p-2.5 rounded-xl hover:bg-white/10 transition-colors"
            >
              <motion.div animate={refreshing ? { rotate: 360 } : {}} transition={refreshing ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}>
                <RefreshCw size={20} className={`text-white/70 ${refreshing ? 'opacity-50' : ''}`} />
              </motion.div>
            </button>
          </div>
        </div>

        {/* Search bar */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="search-bar mt-3">
                <Search size={18} className="text-white/40 flex-shrink-0" />
                <input
                  type="text"
                  placeholder={t('search') + '...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="flex-shrink-0">
                    <X size={18} className="text-white/40" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Content */}
      <main className="mobile-content px-4 py-4">
        {activeTab === 'home' && (
          <div className="space-y-4">
            {/* Category filter - вынесен из header */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
              <button
                className={`category-pill whitespace-nowrap flex-shrink-0 ${selectedCategory === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('all')}
              >
                {t('allCategories')}
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  className={`category-pill whitespace-nowrap flex-shrink-0 ${selectedCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            {/* Clock & Greeting */}
            {(settings.showClock || settings.showGreeting) && (
              <div className="text-center py-6">
                {settings.showClock && (
                  <Clock weatherData={weatherData} />
                )}
                {settings.showGreeting && (
                  <Greeting name={settings.userName} />
                )}
              </div>
            )}

            {/* Cards by category */}
            {selectedCategory === 'all' ? (
              groupedCards.map(cat => (
                <div key={cat.id} className="mb-4">
                  {/* Category header - clickable to collapse */}
                  <button 
                    onClick={() => toggleCategory(cat.id)}
                    className="flex items-center gap-2 mb-3 px-1 w-full text-left"
                  >
                    {categoryIcons[cat.icon] && React.createElement(categoryIcons[cat.icon], { size: 18, className: 'text-white/50' })}
                    <h2 className="text-sm font-medium text-white/70">{cat.name}</h2>
                    <span className="text-xs text-white/30">{cat.cards.length}</span>
                    <ChevronDown 
                      size={16} 
                      className={`ml-auto text-white/30 transition-transform ${collapsedCategories[cat.id] ? '-rotate-90' : ''}`} 
                    />
                  </button>
                  {/* Cards - collapsible */}
                  <AnimatePresence initial={false}>
                    {!collapsedCategories[cat.id] && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-2 overflow-hidden"
                      >
                        {cat.cards.map(renderCard)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            ) : (
              <div className="space-y-2">
                {filteredCards.map(renderCard)}
              </div>
            )}

            {filteredCards.length === 0 && (
              <div className="text-center py-16">
                <Server size={48} className="mx-auto text-white/20 mb-4" />
                <p className="text-white/50">
                  {searchQuery ? 'Ничего не найдено' : 'Нет карточек'}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'monitoring' && !detailCard && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold px-1">{t('monitoring')}</h2>
            {cards.filter(c => c.monitoring?.enabled).length === 0 ? (
              <div className="text-center py-16">
                <Activity size={48} className="mx-auto text-white/20 mb-4" />
                <p className="text-white/50">{t('noMonitoring')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cards.filter(c => c.monitoring?.enabled).map(card => {
                  const status = monitoringStatuses[card.id];
                  const isUp = status?.status === 'up';
                  const isDown = status?.status === 'down';
                  return (
                    <div 
                      key={card.id} 
                      className="mobile-card p-4 active:scale-[0.98] transition-transform cursor-pointer"
                      onClick={() => setDetailCard(card)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`status-indicator ${isUp ? 'online' : isDown ? 'offline' : 'unknown'}`} />
                        <div className="flex-1">
                          <span className="font-medium">{card.name}</span>
                          <p className="text-xs text-white/50">
                            {isUp ? `${status?.lastCheck?.responseTime || 0}ms` : isDown ? (status?.lastCheck?.error || t('offline')) : t('checking')}
                          </p>
                        </div>
                        <span className={`text-sm font-medium ${isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-gray-400'}`}>
                          {isUp ? t('online') : isDown ? t('offline') : '...'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Detail View for Monitoring */}
        {activeTab === 'monitoring' && detailCard && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setDetailCard(null)}
                className="p-2 -ml-2 rounded-xl hover:bg-white/10"
              >
                <ArrowLeft size={24} />
              </button>
              <h2 className="text-lg font-semibold">{detailCard.name}</h2>
            </div>

            {/* Monitoring Section */}
            {(() => {
              const status = monitoringStatuses[detailCard.id];
              const isUp = status?.status === 'up';
              const isDown = status?.status === 'down';
              
              return (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-white/50 uppercase tracking-wide">{t('monitoring')}</h3>
                  
                  {/* Current Status */}
                  <div className="mobile-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/60">{t('currentStatus')}</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        isUp ? 'bg-green-500/20 text-green-400' :
                        isDown ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {isUp ? t('online') : isDown ? t('offline') : t('checking')}
                      </span>
                    </div>
                    {status?.checks?.length > 0 && (
                      <div className="text-sm text-white/40">
                        {t('lastCheck')}: {new Date(status.checks[status.checks.length - 1]?.timestamp).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US')}
                      </div>
                    )}
                  </div>

                  {/* Stats Grid */}
                  {status?.stats && (
                    <div className="grid grid-cols-2 gap-3">
                      {['1h', '24h', '7d', '30d'].map(period => {
                        const stats = status.stats[period];
                        if (!stats) return null;
                        return (
                          <div key={period} className="mobile-card p-4 text-center">
                            <div className="text-white/50 text-sm mb-1">Uptime {period}</div>
                            <div className={`text-2xl font-bold ${
                              parseFloat(stats.uptime) >= 99 ? 'text-green-400' :
                              parseFloat(stats.uptime) >= 95 ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {stats.uptime}%
                            </div>
                            {stats.avgResponseTime && (
                              <div className="text-xs text-white/40 mt-1">~{stats.avgResponseTime}ms</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Recent Checks */}
                  {status?.checks?.length > 0 && (
                    <div className="mobile-card p-4">
                      <h4 className="text-sm text-white/50 mb-3">{t('recentChecks')}</h4>
                      <div className="flex gap-1 flex-wrap">
                        {status.checks.slice(-30).map((check, i) => (
                          <div 
                            key={i}
                            className={`w-2 h-6 rounded-sm ${
                              check.status === 'up' ? 'bg-green-500' :
                              check.status === 'down' ? 'bg-red-500' :
                              'bg-yellow-500'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Billing Section */}
            {detailCard.billing?.enabled && detailCard.billing?.nextPayment && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-white/50 uppercase tracking-wide">{t('payments')}</h3>
                <div className="mobile-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white/60">{t('nextPayment')}</span>
                    <span className="text-xl font-bold">
                      {detailCard.billing.amount} {detailCard.billing.currency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">{t('date')}</span>
                    <span>{detailCard.billing.nextPayment}</span>
                  </div>
                </div>
                
                {/* Days until payment */}
                {(() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const paymentDate = new Date(detailCard.billing.nextPayment);
                  paymentDate.setHours(0, 0, 0, 0);
                  const daysUntil = Math.ceil((paymentDate - today) / (1000 * 60 * 60 * 24));
                  
                  if (daysUntil >= 0) {
                    return (
                      <div className="mobile-card p-4 text-center">
                        <div className={`text-4xl font-bold ${daysUntil <= 3 ? 'text-red-400' : daysUntil <= 7 ? 'text-yellow-400' : 'text-green-400'}`}>
                          {daysUntil}
                        </div>
                        <div className="text-white/50 text-sm mt-1">
                          {t('daysUntil')}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

            {/* Integration Data */}
            {detailCard.integration?.type && integrationData[detailCard.id] && !integrationData[detailCard.id].error && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-white/50 uppercase tracking-wide">{t('integration')}</h3>
                <div className="mobile-card p-4">
                  {/* Reuse existing MetricCard logic */}
                  {(() => {
                    const data = integrationData[detailCard.id];
                    const intType = detailCard.integration?.type;
                    
                    const MetricItem = ({ label, value, color }) => (
                      <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                        <span className="text-white/60">{label}</span>
                        <span className={`font-medium ${color || ''}`}>{value}</span>
                      </div>
                    );
                    
                    if (intType === 'proxmox') {
                      return (
                        <>
                          <MetricItem label="VM" value={`${data.vms?.running || 0}/${data.vms?.total || 0}`} />
                          <MetricItem label="LXC" value={`${data.containers?.running || 0}/${data.containers?.total || 0}`} />
                          <MetricItem label="CPU" value={`${data.cpu || 0}%`} />
                          <MetricItem label="RAM" value={`${data.memory?.percent || 0}%`} />
                        </>
                      );
                    }
                    
                    if (intType === 'ssh') {
                      return (
                        <>
                          <MetricItem label="CPU" value={`${parseFloat(data.load?.percent || 0).toFixed(0)}%`} />
                          <MetricItem label="RAM" value={`${parseFloat(data.memory?.percent || 0).toFixed(0)}%`} />
                          <MetricItem label="Uptime" value={data.uptime?.formatted || 'N/A'} />
                          {data.disk && <MetricItem label="Disk" value={`${data.disk.percent}%`} />}
                        </>
                      );
                    }
                    
                    if (intType === 'docker') {
                      return (
                        <>
                          <MetricItem label={t('running')} value={data.running || 0} color="text-green-400" />
                          <MetricItem label={t('stopped')} value={data.stopped || 0} color="text-red-400" />
                          <MetricItem label={t('total')} value={data.total || 0} />
                          {data.containers && data.containers.length > 0 && (
                            <div className="pt-2 mt-2 border-t border-white/5">
                              <div className="text-xs text-white/40 mb-2">Containers</div>
                              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                {data.containers.map((c, i) => (
                                  <div key={i} className="flex items-center gap-2 text-xs">
                                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.state === 'running' ? 'bg-green-400' : 'bg-gray-500'}`} />
                                    <span className="text-white/80 truncate flex-1">{c.name}</span>
                                    <span className="text-white/40 text-[10px]">{c.status?.split(' ')[0]}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    }
                    
                    if (intType === 'adguard') {
                      return (
                        <>
                          <MetricItem label={t('queries')} value={Number(data.totalQueries || 0).toLocaleString()} />
                          <MetricItem label={t('blocked')} value={`${data.blockPercent || 0}%`} color="text-red-400" />
                          <MetricItem label="Avg Time" value={`${Number(data.avgProcessingTime || 0).toFixed(1)}ms`} />
                        </>
                      );
                    }
                    
                    if (intType === 'mikrotik') {
                      return (
                        <>
                          <MetricItem label="Model" value={data.boardName || 'Unknown'} />
                          <MetricItem label="Version" value={data.version || 'N/A'} />
                          <MetricItem label="CPU" value={`${data.cpu || 0}%`} />
                          <MetricItem label="RAM" value={`${data.memory?.percent || 0}%`} />
                          <MetricItem label="Uptime" value={data.uptime?.formatted || 'N/A'} color="text-green-400" />
                          <MetricItem label="Interfaces" value={`${data.interfaces?.up || 0}/${data.interfaces?.total || 0}`} />
                        </>
                      );
                    }

                    if (intType === 'crowdsec') {
                      return (
                        <>
                          <MetricItem label="Blocked IPs" value={data.blockedIPs || 0} color="text-red-400" />
                          {data.decisionTypes && Object.keys(data.decisionTypes).length > 0 && (
                            <div className="pt-2 mt-2 border-t border-white/5">
                              <div className="text-xs text-white/40 mb-1">Decision Types</div>
                              {Object.entries(data.decisionTypes).map(([type, count]) => (
                                <MetricItem key={type} label={type} value={count} />
                              ))}
                            </div>
                          )}
                          {data.topScenarios && data.topScenarios.length > 0 && (
                            <div className="pt-2 mt-2 border-t border-white/5">
                              <div className="text-xs text-white/40 mb-1">Top Scenarios</div>
                              {data.topScenarios.slice(0, 3).map((s, i) => (
                                <MetricItem key={i} label={s.name} value={s.count} />
                              ))}
                            </div>
                          )}
                        </>
                      );
                    }

                    if (intType === 'openwrt') {
                      return (
                        <>
                          <MetricItem label="Model" value={data.boardName || 'OpenWRT'} />
                          <MetricItem label="Version" value={data.version || 'N/A'} />
                          <MetricItem label="CPU" value={`${data.cpu || 0}%`} />
                          <MetricItem label="RAM" value={`${data.memory?.percent || 0}%`} />
                          <MetricItem label="Uptime" value={data.uptime?.formatted || 'N/A'} color="text-green-400" />
                          {data.hostname && <MetricItem label="Hostname" value={data.hostname} />}
                        </>
                      );
                    }
                    
                    return <div className="text-white/50 text-sm">{intType}</div>;
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold px-1">{t('quickActions')}</h2>
            <div className="space-y-2">
              <button 
                onClick={onOpenSettings}
                className="mobile-card p-4 w-full text-left flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-gray-500/20 flex items-center justify-center">
                  <Settings size={20} className="text-gray-400" />
                </div>
                <div className="flex-1">
                  <span className="font-medium">{t('settings')}</span>
                  <p className="text-xs text-white/50">{t('appSettings')}</p>
                </div>
                <ChevronDown size={20} className="-rotate-90 text-white/30" />
              </button>

              <button 
                onClick={onOpenPayments}
                className="mobile-card p-4 w-full text-left flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Receipt size={20} className="text-blue-400" />
                </div>
                <div className="flex-1">
                  <span className="font-medium">{t('payments')}</span>
                  <p className="text-xs text-white/50">{t('manageSubscriptions')}</p>
                </div>
                <ChevronDown size={20} className="-rotate-90 text-white/30" />
              </button>

              <button 
                onClick={onNewCard}
                className="mobile-card p-4 w-full text-left flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <Plus size={20} className="text-green-400" />
                </div>
                <div className="flex-1">
                  <span className="font-medium">{t('newCard')}</span>
                  <p className="text-xs text-white/50">{t('addService')}</p>
                </div>
                <ChevronDown size={20} className="-rotate-90 text-white/30" />
              </button>
            </div>

            {/* Stats */}
            <div className="mt-8">
              <h3 className="text-sm font-medium text-white/70 mb-3 px-1">{t('statistics')}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="mobile-card p-4 text-center">
                  <div className="text-2xl font-bold">{cards.length}</div>
                  <div className="text-xs text-white/50">{t('services')}</div>
                </div>
                <div className="mobile-card p-4 text-center">
                  <div className="text-2xl font-bold">{categories.length}</div>
                  <div className="text-xs text-white/50">{t('categories')}</div>
                </div>
                <div className="mobile-card p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {Object.values(monitoringStatuses).filter(s => s?.status === 'up').length}
                  </div>
                  <div className="text-xs text-white/50">{t('online')}</div>
                </div>
                <div className="mobile-card p-4 text-center">
                  <div className="text-2xl font-bold text-red-400">
                    {Object.values(monitoringStatuses).filter(s => s?.status === 'down').length}
                  </div>
                  <div className="text-xs text-white/50">{t('offline')}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FAB - Add new card */}
      {activeTab === 'home' && (
        <motion.button
          className="fab"
          whileTap={{ scale: 0.92 }}
          onClick={onNewCard}
        >
          <Plus size={26} />
        </motion.button>
      )}

      {/* Card Action Sheet */}
      <AnimatePresence>
        {selectedCard && (
          <motion.div
            className="mobile-sheet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedCard(null)}
          >
            <motion.div
              className="mobile-sheet-content"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mobile-sheet-handle" />
              
              {/* Card Preview */}
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${selectedCard.color || '#666'}20`, color: selectedCard.color || '#666' }}
                  >
                    {selectedCard.customIcon ? (
                      <img src={selectedCard.customIcon} alt="" className="w-8 h-8 object-contain" />
                    ) : (
                      React.createElement(serviceIcons[selectedCard.icon] || Server, { className: 'w-7 h-7' })
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg">{selectedCard.name || 'Unknown'}</h3>
                    {selectedCard.description && (
                      <p className="text-sm text-white/50">{selectedCard.description}</p>
                    )}
                  </div>
                </div>
                
                {/* Integration data */}
                {integrationData[selectedCard.id] && !integrationData[selectedCard.id].error && (
                  <div className="mt-3 p-3 bg-white/5 rounded-xl">
                    {(() => {
                      try {
                        const data = integrationData[selectedCard.id];
                        const intType = selectedCard.integration?.type;
                        
                        const formatUptime = (seconds) => {
                          if (!seconds) return 'N/A';
                          const days = Math.floor(seconds / 86400);
                          const hours = Math.floor((seconds % 86400) / 3600);
                          if (days > 0) return `${days}d ${hours}h`;
                          return `${hours}h`;
                        };
                        
                        // Иконка по типу сущности Home Assistant
                        const getEntityIcon = (name, entityId) => {
                          const n = (name || '').toLowerCase();
                          const id = (entityId || '').toLowerCase();
                          if (n.includes('темп') || n.includes('temp') || id.includes('temperature')) return <ThermometerSun size={18} />;
                          if (n.includes('влаж') || n.includes('humid') || id.includes('humidity')) return <Droplets size={18} />;
                          if (n.includes('давлен') || n.includes('pressure')) return <Gauge size={18} />;
                          if (n.includes('ветер') || n.includes('wind')) return <Wind size={18} />;
                          if (n.includes('свет') || n.includes('light') || id.includes('light')) return <Lightbulb size={18} />;
                          if (n.includes('питан') || n.includes('power') || n.includes('энерг')) return <Zap size={18} />;
                          if (n.includes('батар') || n.includes('battery')) return <Activity size={18} />;
                          if (n.includes('движен') || n.includes('motion')) return <Radio size={18} />;
                          if (n.includes('дверь') || n.includes('door') || n.includes('окно') || n.includes('window')) return <Lock size={18} />;
                          if (id.includes('sensor')) return <Activity size={18} />;
                          if (id.includes('switch') || id.includes('input_boolean')) return <Power size={18} />;
                          return <Activity size={18} />;
                        };

                        // Компонент метрики с иконкой
                        const MetricCard = ({ icon, value, label, color }) => (
                          <div className="flex flex-col items-center text-center p-2 bg-white/5 rounded-xl">
                            <div className={`mb-1 ${color || 'text-white/50'}`}>{icon}</div>
                            <div className={`text-lg font-semibold ${color || ''}`}>{value}</div>
                            <div className="text-xs text-white/40">{label}</div>
                          </div>
                        );
                        
                        // Home Assistant - customEntities (max 3)
                        if (data.customEntities?.length > 0) {
                          const entities = data.customEntities.slice(0, 3);
                          const cols = entities.length === 1 ? 'grid-cols-1' : 
                                       entities.length === 2 ? 'grid-cols-2' : 'grid-cols-3';
                          return (
                            <div className={`grid ${cols} gap-2`}>
                              {entities.map((entity, idx) => (
                                <div key={idx} className="flex flex-col items-center text-center p-2 bg-white/5 rounded-xl">
                                  <div className="text-white/50 mb-1">{getEntityIcon(entity.name, entity.entity_id)}</div>
                                  <div className="text-lg font-semibold">{entity.state}{entity.unit || ''}</div>
                                  <div className="text-xs text-white/40 truncate w-full">{entity.name}</div>
                                </div>
                              ))}
                            </div>
                          );
                        }
                        
                        // Proxmox (3 metrics)
                        if (intType === 'proxmox') {
                          return (
                            <div className="grid grid-cols-3 gap-2">
                              <MetricCard icon={<Server size={18} />} value={`${data.vms?.running || 0}/${data.vms?.total || 0}`} label="VM" />
                              <MetricCard icon={<Container size={18} />} value={`${data.containers?.running || 0}/${data.containers?.total || 0}`} label="LXC" />
                              <MetricCard icon={<Cpu size={18} />} value={`${data.cpu || 0}%`} label="CPU" />
                            </div>
                          );
                        }
                        
                        // SSH (3 metrics)
                        if (intType === 'ssh') {
                          return (
                            <div className="grid grid-cols-3 gap-2">
                              <MetricCard icon={<Cpu size={18} />} value={`${parseFloat(data.load?.percent || 0).toFixed(0)}%`} label="CPU" />
                              <MetricCard icon={<HardDrive size={18} />} value={`${parseFloat(data.memory?.percent || 0).toFixed(0)}%`} label="RAM" />
                              <MetricCard icon={<ClockIcon size={18} />} value={data.uptime?.formatted || 'N/A'} label="Uptime" />
                            </div>
                          );
                        }
                        
                        // Mikrotik (4 metrics)
                        if (intType === 'mikrotik') {
                          return (
                            <div className="grid grid-cols-4 gap-2">
                              <MetricCard icon={<Cpu size={18} />} value={`${data.cpu || 0}%`} label="CPU" />
                              <MetricCard icon={<HardDrive size={18} />} value={`${parseFloat(data.memory?.percent || 0).toFixed(0)}%`} label="RAM" />
                              <MetricCard icon={<ClockIcon size={18} />} value={data.uptime?.formatted || 'N/A'} label="Uptime" />
                              <MetricCard icon={<Network size={18} />} value={`${data.interfaces?.up || 0}/${data.interfaces?.total || 0}`} label="Ifaces" />
                            </div>
                          );
                        }
                        
                        // Docker
                        if (intType === 'docker') {
                          return (
                            <div className="grid grid-cols-3 gap-2">
                              <MetricCard icon={<PlayCircle size={18} />} value={data.running || 0} label="Running" color="text-green-400" />
                              <MetricCard icon={<PauseCircle size={18} />} value={data.stopped || 0} label="Stopped" color="text-red-400" />
                              <MetricCard icon={<Container size={18} />} value={data.total || 0} label="Total" />
                            </div>
                          );
                        }
                        
                        // CrowdSec
                        if (intType === 'crowdsec') {
                          return (
                            <div className="flex justify-center">
                              <MetricCard icon={<Shield size={18} />} value={data.blockedIPs || 0} label="Blocked IPs" color="text-red-400" />
                            </div>
                          );
                        }
                        
                        // OpenWRT
                        if (intType === 'openwrt') {
                          return (
                            <div className="grid grid-cols-4 gap-2">
                              <MetricCard icon={<Cpu size={18} />} value={`${data.cpu || 0}%`} label="CPU" />
                              <MetricCard icon={<HardDrive size={18} />} value={`${parseFloat(data.memory?.percent || 0).toFixed(0)}%`} label="RAM" />
                              <MetricCard icon={<ClockIcon size={18} />} value={data.uptime?.formatted || 'N/A'} label="Uptime" />
                              <MetricCard icon={<Router size={18} />} value={data.hostname || 'WRT'} label="Host" />
                            </div>
                          );
                        }
                        
                        // NPM
                        if (intType === 'npm') {
                          return (
                            <div className="grid grid-cols-3 gap-2">
                              <MetricCard icon={<CheckCircle2 size={18} />} value={data.enabledHosts || 0} label="Enabled" color="text-green-400" />
                              <MetricCard icon={<PauseCircle size={18} />} value={data.disabledHosts || 0} label="Disabled" color="text-gray-400" />
                              <MetricCard icon={<Globe size={18} />} value={data.totalHosts || 0} label="Total" />
                            </div>
                          );
                        }
                        
                        // Wiki.js
                        if (intType === 'wikijs') {
                          return (
                            <div className="grid grid-cols-3 gap-2">
                              <MetricCard icon={<FileText size={18} />} value={data.totalPages || 0} label="Pages" />
                              <MetricCard icon={<ClockIcon size={18} />} value={data.recentPages || 0} label="Recent" />
                              <MetricCard icon={<Users size={18} />} value={data.activeUsers || 0} label="Users" />
                            </div>
                          );
                        }
                        
                        // AdGuard
                        if (intType === 'adguard') {
                          return (
                            <div className="grid grid-cols-3 gap-2">
                              <MetricCard icon={<Activity size={18} />} value={Number(data.totalQueries || 0).toLocaleString()} label="Queries" />
                              <MetricCard icon={<Shield size={18} />} value={`${data.blockPercent || 0}%`} label="Blocked" color="text-red-400" />
                              <MetricCard icon={<Zap size={18} />} value={`${Number(data.avgProcessingTime || 0).toFixed(1)}ms`} label="Avg Time" />
                            </div>
                          );
                        }
                        
                        return null;
                      } catch (e) {
                        console.error('Error rendering integration data:', e);
                        return <div className="text-sm text-red-400">Error loading data</div>;
                      }
                    })()}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-2">
                {selectedCard.url && (
                  <button
                    className="context-menu-item w-full"
                    onClick={() => {
                      window.open(selectedCard.url, '_blank');
                      setSelectedCard(null);
                    }}
                  >
                    <ExternalLink size={20} className="text-blue-400" />
                    <span>{t('open')}</span>
                  </button>
                )}
                <button
                  className="context-menu-item w-full"
                  onClick={() => {
                    onEditCard(selectedCard);
                    setSelectedCard(null);
                  }}
                >
                  <Edit3 size={20} className="text-white/70" />
                  <span>{t('edit')}</span>
                </button>
                {selectedCard.integration?.type && (
                  <button
                    className="context-menu-item w-full"
                    onClick={() => {
                      loadIntegrationData(selectedCard);
                      setSelectedCard(null);
                    }}
                  >
                    <RefreshCw size={20} className="text-white/70" />
                    <span>{t('refreshData')}</span>
                  </button>
                )}
                <button
                  className="context-menu-item w-full text-red-400"
                  onClick={() => {
                    if (confirm(lang === 'ru' ? `Удалить "${selectedCard.name}"?` : `Delete "${selectedCard.name}"?`)) {
                      onDeleteCard(selectedCard.id);
                      setSelectedCard(null);
                    }
                  }}
                >
                  <Trash2 size={20} />
                  <span>{t('delete')}</span>
                </button>
              </div>

              {/* Close button */}
              <div className="p-4 pt-2" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
                <button
                  className="w-full p-3 bg-white/10 rounded-xl font-medium"
                  onClick={() => setSelectedCard(null)}
                >
                  {t('close')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PaymentsPage({ cards: initialCards, onBack, onEditCard, onRefreshCards }) {
  const [activeTab, setActiveTab] = useState('payments');
  const [providers, setProviders] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [localCards, setLocalCards] = useState(initialCards || []);
  const [selectedItem, setSelectedItem] = useState(null); // {type: 'card'|'provider', data: ...}
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [showAddPurchase, setShowAddPurchase] = useState(false);
  const [showAddChoice, setShowAddChoice] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [showQrViewer, setShowQrViewer] = useState(null); // QR data for viewing
  const [qrCodes, setQrCodes] = useState({});
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [showPayModal, setShowPayModal] = useState(null);
  const [qrError, setQrError] = useState(null);
  const [showTranslate, setShowTranslate] = useState(false);
  const [editingBilling, setEditingBilling] = useState(null); // карточка для редактирования биллинга
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // Форма нового провайдера
  const [newProvider, setNewProvider] = useState({
    name: '', icon: 'receipt', color: '#8b5cf6',
    amount: '', currency: 'RUB', period: 'monthly',
    nextPayment: '', note: '', url: '', remindDays: [3, 7]
  });

  // Форма новой покупки
  const [newPurchase, setNewPurchase] = useState({
    name: '', amount: '', currency: 'RUB', date: new Date().toISOString().split('T')[0], note: '', category: 'other'
  });

  const purchaseCategories = [
    { id: 'food', name: 'Еда', icon: 'utensils' },
    { id: 'transport', name: 'Транспорт', icon: 'car' },
    { id: 'health', name: 'Здоровье', icon: 'pill' },
    { id: 'entertainment', name: 'Развлечения', icon: 'tv' },
    { id: 'shopping', name: 'Покупки', icon: 'shopping-cart' },
    { id: 'other', name: 'Другое', icon: 'receipt' }
  ];

  // Синхронизируем с пропсами
  useEffect(() => {
    setLocalCards(initialCards || []);
  }, [initialCards]);

  // Загрузка данных
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [providersData, statsData, historyData, configData, purchasesData] = await Promise.all([
        api.get('/api/providers').catch(() => []),
        api.get('/api/payments/stats').catch(() => null),
        api.get('/api/payments/history').catch(() => []),
        api.get('/api/config').catch(() => null),
        api.get('/api/purchases').catch(() => [])
      ]);
      setProviders(providersData || []);
      setStats(statsData);
      setHistory(historyData || []);
      setPurchases(purchasesData || []);
      // Обновляем локальные карточки из свежего конфига
      if (configData?.cards) {
        setLocalCards(configData.cards);
      }
    } catch (err) {
      console.error('Failed to load payments data:', err);
    }
  };

  // Загрузка QR кодов
  useEffect(() => {
    if (selectedItem) {
      const key = selectedItem.type === 'provider' 
        ? `provider_${selectedItem.data.id}` 
        : selectedItem.data.id;
      api.get(`/api/payments/${key}/qr`).then(codes => {
        setQrCodes(prev => ({ ...prev, [key]: codes }));
      });
    }
  }, [selectedItem]);

  // Объединяем карточки хостинга и провайдеров
  const allPayments = [
    // Карточки с биллингом
    ...localCards
      .filter(c => c.category === 'hosting' && c.billing?.enabled && c.billing?.nextPayment)
      .map(card => ({
        type: 'card',
        id: card.id,
        name: card.name,
        icon: card.icon,
        customIcon: card.customIcon,
        color: card.color,
        amount: card.billing.amount,
        currency: card.billing.currency,
        period: card.billing.period,
        nextPayment: card.billing.nextPayment,
        note: card.billing.note,
        url: card.billing.paymentUrl || card.url,
        data: card
      })),
    // Провайдеры
    ...providers.map(p => ({
      type: 'provider',
      id: p.id,
      name: p.name,
      icon: p.icon,
      color: p.color,
      amount: p.amount,
      currency: p.currency,
      period: p.period,
      nextPayment: p.nextPayment,
      note: p.note,
      url: p.url,
      data: p
    }))
  ].map(item => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const paymentDate = new Date(item.nextPayment);
    paymentDate.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((paymentDate - today) / (1000 * 60 * 60 * 24));
    return { ...item, daysUntil };
  }).sort((a, b) => a.daysUntil - b.daysUntil);

  const getStatusColor = (days) => {
    if (days < 0) return 'text-red-400 bg-red-500/10 border-red-500/30';
    if (days === 0) return 'text-red-400 bg-red-500/10 border-red-500/30';
    if (days <= 3) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    if (days <= 7) return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    return 'text-dark-300 bg-dark-800/50 border-dark-700';
  };

  const getStatusText = (days) => {
    if (days < 0) return `Просрочено ${Math.abs(days)} дн.`;
    if (days === 0) return 'Сегодня';
    if (days === 1) return 'Завтра';
    return `через ${days} дн.`;
  };

  const getPeriodText = (period) => {
    const map = { monthly: 'мес.', quarterly: 'квартал', yearly: 'год', once: 'разово' };
    return map[period] || period;
  };

  // QR Scanner
  const startQrScanner = async () => {
    setQrError(null);
    
    // Проверка HTTPS
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      setQrError('Камера доступна только через HTTPS');
      return;
    }

    setShowQrScanner(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        scanIntervalRef.current = setInterval(scanQrCode, 200);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setQrError(`Ошибка камеры: ${err.message}`);
      setShowQrScanner(false);
    }
  };

  const stopQrScanner = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setShowQrScanner(false);
  };

  const scanQrCode = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    if (window.jsQR) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR(imageData.data, imageData.width, imageData.height);
      if (code) {
        stopQrScanner();
        saveQrCode(code.data);
      }
    }
  };

  const saveQrCode = async (data) => {
    if (!selectedItem) return;
    const label = prompt('Название для QR кода:', `Квитанция ${new Date().toLocaleDateString('ru-RU')}`);
    if (!label) return;
    
    const key = selectedItem.type === 'provider' 
      ? `provider_${selectedItem.data.id}` 
      : selectedItem.data.id;
    
    const result = await api.post(`/api/payments/${key}/qr`, { data, label });
    setQrCodes(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), result]
    }));
  };

  const deleteQrCode = async (qrId) => {
    if (!selectedItem || !confirm('Удалить QR код?')) return;
    const key = selectedItem.type === 'provider' 
      ? `provider_${selectedItem.data.id}` 
      : selectedItem.data.id;
    
    await api.delete(`/api/payments/${key}/qr/${qrId}`);
    setQrCodes(prev => ({
      ...prev,
      [key]: prev[key].filter(qr => qr.id !== qrId)
    }));
  };

  // Провайдеры CRUD
  const addProvider = async () => {
    if (!newProvider.name || !newProvider.amount || !newProvider.nextPayment) {
      alert('Заполните название, сумму и дату');
      return;
    }
    const result = await api.post('/api/providers', newProvider);
    setProviders(prev => [...prev, result]);
    setNewProvider({
      name: '', icon: 'receipt', color: '#8b5cf6',
      amount: '', currency: 'RUB', period: 'monthly',
      nextPayment: '', note: '', url: '', remindDays: [3, 7]
    });
    setShowAddProvider(false);
    loadData();
  };

  const addPurchase = async () => {
    if (!newPurchase.name || !newPurchase.amount || !newPurchase.date) {
      alert('Заполните название, сумму и дату');
      return;
    }
    const result = await api.post('/api/purchases', newPurchase);
    setPurchases(prev => [...prev, result]);
    setNewPurchase({
      name: '', amount: '', currency: 'RUB', date: new Date().toISOString().split('T')[0], note: '', category: 'other'
    });
    setShowAddPurchase(false);
    loadData();
  };

  const deletePurchase = async (id) => {
    if (!confirm('Удалить покупку?')) return;
    await api.delete(`/api/purchases/${id}`);
    setPurchases(prev => prev.filter(p => p.id !== id));
    loadData();
  };

  const deleteHistoryItem = async (id) => {
    if (!confirm('Удалить запись из истории?')) return;
    await api.delete(`/api/payments/history/${id}`);
    setHistory(prev => prev.filter(p => p.id !== id));
  };

  const deleteProvider = async (id) => {
    if (!confirm('Удалить платеж?')) return;
    await api.delete(`/api/providers/${id}`);
    setProviders(prev => prev.filter(p => p.id !== id));
    setSelectedItem(null);
    loadData();
  };

  // Отключить биллинг у карточки (удалить из платежей)
  const disableBilling = async (card) => {
    if (!confirm('Удалить этот платеж? Карточка останется, но напоминание об оплате будет отключено.')) return;
    try {
      // Обновляем карточку - отключаем billing
      const updatedCard = { 
        ...card, 
        billing: { ...card.billing, enabled: false } 
      };
      await api.put(`/api/cards/${card.id}`, updatedCard);
      
      if (onRefreshCards) await onRefreshCards();
      await loadData();
      setSelectedItem(null);
    } catch (err) {
      console.error('Failed to disable billing:', err);
      alert('Ошибка при удалении платежа');
    }
  };

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const markAsPaid = async (item) => {
    if (isProcessingPayment) {
      console.log('[markAsPaid] Already processing, skipping');
      return;
    }
    
    setIsProcessingPayment(true);
    console.log('[markAsPaid] Called with item:', item);
    
    try {
      const endpoint = item.type === 'provider' 
        ? `/api/providers/${item.id}/pay`
        : `/api/payments/${item.id}/pay`;
      
      console.log('[markAsPaid] Endpoint:', endpoint, 'Amount:', item.amount);
      
      const result = await api.post(endpoint, { amount: item.amount });
      console.log('[markAsPaid] Result:', result);
      
      // Удаляем все QR-коды для этого платежа
      const key = item.type === 'provider' ? `provider_${item.id}` : item.id;
      const itemQrs = qrCodes[key] || [];
      for (const qr of itemQrs) {
        try {
          await api.delete(`/api/payments/${key}/qr/${qr.id}`);
        } catch (e) {
          console.log('[markAsPaid] Failed to delete QR:', e);
        }
      }
      setQrCodes(prev => ({ ...prev, [key]: [] }));
      
      // Закрываем модалки
      setShowPayModal(null);
      setSelectedItem(null);
      
      // Обновляем только локальные данные PaymentsPage
      await loadData();
      
    } catch (err) {
      console.error('[markAsPaid] Error:', err);
      alert('Ошибка при отметке платежа: ' + err.message);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Группировка
  const overdue = allPayments.filter(c => c.daysUntil < 0);
  const todayPayments = allPayments.filter(c => c.daysUntil === 0);
  const thisWeek = allPayments.filter(c => c.daysUntil > 0 && c.daysUntil <= 7);
  const thisMonth = allPayments.filter(c => c.daysUntil > 7 && c.daysUntil <= 30);
  const later = allPayments.filter(c => c.daysUntil > 30);

  const monthlyTotal = allPayments.reduce((sum, item) => {
    const amount = parseFloat(item.amount) || 0;
    if (item.period === 'monthly') return sum + amount;
    if (item.period === 'quarterly') return sum + amount / 3;
    if (item.period === 'yearly') return sum + amount / 12;
    return sum;
  }, 0);

  const renderPaymentItem = (item) => {
    const IconComponent = serviceIcons[item.icon] || serviceIcons.default;
    const key = item.type === 'provider' ? `provider_${item.id}` : item.id;
    const itemQrCodes = qrCodes[key] || [];
    
    return (
      <motion.div 
        key={`${item.type}-${item.id}`}
        className={`p-3 sm:p-4 rounded-xl border cursor-pointer transition-all 
          hover:brightness-110 hover:shadow-lg active:scale-[0.99] ${getStatusColor(item.daysUntil)}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => setSelectedItem({ type: item.type, data: item.data })}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${item.color}20`, color: item.color }}
          >
            {item.customIcon ? (
              <img src={item.customIcon} alt="" className="w-6 h-6 object-contain" />
            ) : (
              <div className="w-5 h-5"><IconComponent /></div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-white text-sm truncate">{item.name}</h3>
              {itemQrCodes.length > 0 && <QrCode size={12} className="text-dark-400 flex-shrink-0" />}
              {item.type === 'provider' && (
                <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">провайдер</span>
              )}
            </div>
            <div className="text-xs text-dark-400 mt-0.5">
              {item.nextPayment} / {getPeriodText(item.period)}
            </div>
          </div>
          
          <div className="text-right flex-shrink-0">
            <div className="text-sm sm:text-base font-semibold">
              {item.amount} <span className="text-xs text-dark-400">{item.currency}</span>
            </div>
            <div className="text-xs">{getStatusText(item.daysUntil)}</div>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderSection = (title, items, icon) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-5">
        <h3 className="text-xs font-medium text-dark-400 uppercase tracking-wide mb-2 flex items-center gap-2">
          {icon} {title} <span className="text-dark-500">({items.length})</span>
        </h3>
        <div className="space-y-2">{items.map(renderPaymentItem)}</div>
      </div>
    );
  };

  // Детальный просмотр
  if (selectedItem) {
    // Находим полные данные из allPayments для правильного доступа к amount и другим полям
    const paymentItem = allPayments.find(p => p.id === selectedItem.data.id && p.type === selectedItem.type);
    // Гарантируем что item всегда имеет type
    const item = paymentItem || { ...selectedItem.data, type: selectedItem.type };
    const key = selectedItem.type === 'provider' ? `provider_${item.id}` : item.id;
    const itemQrCodes = qrCodes[key] || [];
    const IconComponent = serviceIcons[item.icon] || serviceIcons.default;
    const itemColor = item.color;
    const daysUntil = paymentItem?.daysUntil || 0;
    
    return (
      <div className="min-h-screen bg-animated">
        {/* QR Scanner Modal */}
        {showQrScanner && (
          <div className="fixed inset-0 z-50 bg-black flex flex-col">
            <div className="p-4 flex items-center justify-between bg-dark-900">
              <h2 className="text-lg font-medium">Сканирование QR</h2>
              <button onClick={stopQrScanner} className="p-2"><X size={24} /></button>
            </div>
            <div className="flex-1 relative">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 border-2 border-white/50 rounded-2xl">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-2xl" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-2xl" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-2xl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-2xl" />
                </div>
              </div>
            </div>
            <div className="p-4 text-center text-dark-400 bg-dark-900">
              Наведите камеру на QR код квитанции
            </div>
          </div>
        )}

        <header className="sticky top-0 z-40 backdrop-blur-xl bg-dark-900/80 border-b border-dark-800">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-dark-700 rounded-lg">
              <ArrowLeft size={20} />
            </button>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${itemColor}20`, color: itemColor }}>
              <div className="w-5 h-5"><IconComponent /></div>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold truncate">{item.name}</h1>
              <p className="text-sm text-dark-400">{getStatusText(daysUntil)}</p>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {/* Информация */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-2xl sm:text-3xl font-bold">
                  {item.amount} <span className="text-lg text-dark-400">{item.currency || 'RUB'}</span>
                </div>
                <div className="text-dark-400 text-sm mt-1">
                  {item.nextPayment} - {getPeriodText(item.period || 'monthly')}
                </div>
              </div>
              <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${getStatusColor(daysUntil)}`}>
                {getStatusText(daysUntil)}
              </div>
            </div>
            
            {item.note && <p className="text-dark-400 text-sm mb-3">{item.note}</p>}

            <div className="flex flex-wrap gap-2">
              {item.url && (
                <a href={item.url} target="_blank" rel="noopener noreferrer"
                  className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 rounded-xl text-center font-medium transition-colors flex items-center justify-center gap-2">
                  <ExternalLink size={18} /> Оплатить
                </a>
              )}
              <button onClick={() => setShowPayModal(item)}
                className="flex-1 px-4 py-2.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-xl font-medium flex items-center justify-center gap-2">
                <CheckCircle2 size={18} /> Оплачено
              </button>
            </div>
            
            {/* Вторая строка кнопок */}
            <div className="flex gap-2 mt-2">
              {selectedItem.type === 'card' && item.data && (
                <>
                  <button onClick={() => setEditingBilling(item.data)} className="flex-1 px-4 py-2.5 bg-dark-700 hover:bg-dark-600 rounded-xl flex items-center justify-center gap-2">
                    <Edit3 size={18} /> Редактировать
                  </button>
                  <button onClick={() => disableBilling(item.data)} className="flex-1 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl flex items-center justify-center gap-2">
                    <Trash2 size={18} /> Удалить платеж
                  </button>
                </>
              )}
              {selectedItem.type === 'provider' && (
                <>
                  <button onClick={() => setEditingBilling({...selectedItem.data, isProvider: true})} className="flex-1 px-4 py-2.5 bg-dark-700 hover:bg-dark-600 rounded-xl flex items-center justify-center gap-2">
                    <Edit3 size={18} /> Редактировать
                  </button>
                  <button onClick={() => deleteProvider(item.id)} className="flex-1 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl flex items-center justify-center gap-2">
                    <Trash2 size={18} /> Удалить платеж
                  </button>
                </>
              )}
            </div>
          </div>

          {/* QR коды */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium flex items-center gap-2">
                <QrCode size={18} /> QR коды
              </h3>
              <button onClick={startQrScanner}
                className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm font-medium flex items-center gap-2">
                <Camera size={16} /> Сканировать
              </button>
            </div>

            {qrError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm mb-3">
                {qrError}
              </div>
            )}

            {itemQrCodes.length === 0 ? (
              <div className="text-center py-6 text-dark-500">
                <QrCode size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Нет сохраненных QR кодов</p>
              </div>
            ) : (
              <div className="space-y-2">
                {itemQrCodes.map(qr => (
                  <div key={qr.id} className="p-3 bg-dark-800/50 rounded-xl flex items-center gap-3">
                    <button onClick={() => setShowQrViewer(qr)} className="w-12 h-12 bg-white rounded-lg flex items-center justify-center flex-shrink-0 hover:ring-2 ring-purple-500 transition-all">
                      <QrCode size={24} className="text-dark-600" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{qr.label}</div>
                      <div className="text-xs text-dark-400">{new Date(qr.createdAt).toLocaleDateString('ru-RU')}</div>
                    </div>
                    <button onClick={() => setShowQrViewer(qr)} className="p-2 hover:bg-dark-700 rounded-lg" title="Показать QR"><Eye size={16} /></button>
                    <button onClick={() => { navigator.clipboard.writeText(qr.data); alert('Скопировано!'); }}
                      className="p-2 hover:bg-dark-700 rounded-lg" title="Копировать"><Copy size={16} /></button>
                    <button onClick={() => deleteQrCode(qr.id)}
                      className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg" title="Удалить"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Pay Modal */}
        <AnimatePresence>
          {showPayModal && (
            <motion.div className="fixed inset-0 z-50 modal-overlay flex items-end sm:items-center justify-center p-4"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowPayModal(null)}>
              <motion.div className="glass-card w-full max-w-sm p-6"
                initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-semibold mb-3">Отметить как оплачено?</h3>
                <p className="text-dark-400 mb-4">{showPayModal.name} - {showPayModal.amount} {showPayModal.currency}</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowPayModal(null)} className="flex-1 px-4 py-2.5 bg-dark-700 hover:bg-dark-600 rounded-xl transition-colors">Отмена</button>
                  <button 
                    onClick={() => markAsPaid(showPayModal)} 
                    disabled={isProcessingPayment}
                    className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors ${
                      isProcessingPayment 
                        ? 'bg-dark-600 text-dark-400 cursor-not-allowed' 
                        : 'bg-green-500 hover:bg-green-600'
                    }`}
                  >
                    {isProcessingPayment ? 'Обработка...' : 'Подтвердить'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* QR Viewer Modal */}
          {showQrViewer && (
            <motion.div className="fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowQrViewer(null)}>
              <motion.div className="glass-card w-full max-w-md p-6"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">QR код</h3>
                  <button onClick={() => setShowQrViewer(null)} className="p-2 hover:bg-dark-700 rounded-lg"><X size={20} /></button>
                </div>
                <div className="bg-white p-6 rounded-xl mb-4 flex items-center justify-center">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(showQrViewer.data)}`} 
                    alt="QR Code" className="w-48 h-48" />
                </div>
                <div className="mb-4">
                  <div className="text-sm text-dark-400 mb-1">{showQrViewer.label}</div>
                  <div className="text-xs text-dark-500 break-all bg-dark-800 p-2 rounded-lg max-h-24 overflow-y-auto">{showQrViewer.data}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { navigator.clipboard.writeText(showQrViewer.data); alert('Скопировано!'); }}
                    className="flex-1 px-4 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-xl flex items-center justify-center gap-2">
                    <Copy size={18} /> Копировать
                  </button>
                  <a href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(showQrViewer.data)}`} 
                    download={`qr-${showQrViewer.label}.png`} target="_blank" rel="noopener noreferrer"
                    className="flex-1 px-4 py-2.5 bg-dark-700 hover:bg-dark-600 rounded-xl flex items-center justify-center gap-2">
                    <Download size={18} /> Скачать
                  </a>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Edit Billing Modal */}
          {editingBilling && (
            <motion.div className="fixed inset-0 z-50 modal-overlay flex items-end sm:items-center justify-center p-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setEditingBilling(null)}>
              <motion.div className="glass-card w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
                initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Редактировать платеж</h3>
                  <button onClick={() => setEditingBilling(null)} className="p-2 hover:bg-dark-700 rounded-lg"><X size={20} /></button>
                </div>
                
                {editingBilling.isProvider ? (
                  // Редактирование провайдера
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-dark-400 mb-1">Название</label>
                      <input type="text" className="input-field" value={editingBilling.name || ''}
                        onChange={e => setEditingBilling({...editingBilling, name: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm text-dark-400 mb-1">Сумма</label>
                        <input type="number" className="input-field" value={editingBilling.amount || ''}
                          onChange={e => setEditingBilling({...editingBilling, amount: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-sm text-dark-400 mb-1">Валюта</label>
                        <select className="input-field" value={editingBilling.currency || 'RUB'}
                          onChange={e => setEditingBilling({...editingBilling, currency: e.target.value})}>
                          <option value="RUB">RUB</option>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm text-dark-400 mb-1">Период</label>
                        <select className="input-field" value={editingBilling.period || 'monthly'}
                          onChange={e => setEditingBilling({...editingBilling, period: e.target.value})}>
                          <option value="monthly">Ежемесячно</option>
                          <option value="yearly">Ежегодно</option>
                          <option value="quarterly">Ежеквартально</option>
                          <option value="weekly">Еженедельно</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-dark-400 mb-1">Дата платежа</label>
                        <input type="date" className="input-field" value={editingBilling.nextPayment || ''}
                          onChange={e => setEditingBilling({...editingBilling, nextPayment: e.target.value})} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-dark-400 mb-1">Ссылка на оплату</label>
                      <input type="url" className="input-field" value={editingBilling.url || ''} placeholder="https://..."
                        onChange={e => setEditingBilling({...editingBilling, url: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-sm text-dark-400 mb-1">Заметка</label>
                      <textarea className="input-field" rows={2} value={editingBilling.note || ''} placeholder="Примечание..."
                        onChange={e => setEditingBilling({...editingBilling, note: e.target.value})} />
                    </div>
                    <button onClick={async () => {
                      try {
                        const { isProvider, ...providerData } = editingBilling;
                        await api.put(`/api/providers/${editingBilling.id}`, providerData);
                        setProviders(prev => prev.map(p => p.id === editingBilling.id ? providerData : p));
                        setEditingBilling(null);
                        setSelectedItem(null);
                      } catch (err) { alert('Ошибка сохранения'); }
                    }} className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 rounded-xl font-medium">
                      Сохранить
                    </button>
                  </div>
                ) : (
                  // Редактирование биллинга карточки
                  <div className="space-y-4">
                    <div className="text-sm text-dark-400 mb-2">Карточка: <span className="text-white">{editingBilling.name}</span></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm text-dark-400 mb-1">Сумма</label>
                        <input type="number" className="input-field" value={editingBilling.billing?.amount || ''}
                          onChange={e => setEditingBilling({...editingBilling, billing: {...editingBilling.billing, amount: e.target.value}})} />
                      </div>
                      <div>
                        <label className="block text-sm text-dark-400 mb-1">Валюта</label>
                        <select className="input-field" value={editingBilling.billing?.currency || 'RUB'}
                          onChange={e => setEditingBilling({...editingBilling, billing: {...editingBilling.billing, currency: e.target.value}})}>
                          <option value="RUB">RUB</option>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm text-dark-400 mb-1">Период</label>
                        <select className="input-field" value={editingBilling.billing?.period || 'monthly'}
                          onChange={e => setEditingBilling({...editingBilling, billing: {...editingBilling.billing, period: e.target.value}})}>
                          <option value="monthly">Ежемесячно</option>
                          <option value="yearly">Ежегодно</option>
                          <option value="quarterly">Ежеквартально</option>
                          <option value="weekly">Еженедельно</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-dark-400 mb-1">Дата платежа</label>
                        <input type="date" className="input-field" value={editingBilling.billing?.nextPayment || ''}
                          onChange={e => setEditingBilling({...editingBilling, billing: {...editingBilling.billing, nextPayment: e.target.value}})} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-dark-400 mb-1">Ссылка на оплату</label>
                      <input type="url" className="input-field" value={editingBilling.billing?.payUrl || ''} placeholder="https://..."
                        onChange={e => setEditingBilling({...editingBilling, billing: {...editingBilling.billing, payUrl: e.target.value}})} />
                    </div>
                    <button onClick={async () => {
                      try {
                        await api.put(`/api/cards/${editingBilling.id}`, { billing: editingBilling.billing });
                        setLocalCards(prev => prev.map(c => c.id === editingBilling.id ? {...c, billing: editingBilling.billing} : c));
                        if (onRefreshCards) onRefreshCards();
                        setEditingBilling(null);
                        setSelectedItem(null);
                      } catch (err) { alert('Ошибка сохранения'); }
                    }} className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 rounded-xl font-medium">
                      Сохранить
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}

          {/* Add Choice Modal */}
          {showAddChoice && (
            <motion.div className="fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowAddChoice(false)}>
              <motion.div className="glass-card w-full max-w-sm p-6"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-semibold mb-4">Что добавить?</h3>
                <div className="space-y-2">
                  <button onClick={() => { setShowAddChoice(false); setShowAddProvider(true); }}
                    className="w-full p-4 bg-dark-800 hover:bg-dark-700 rounded-xl text-left flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                      <Receipt size={20} />
                    </div>
                    <div>
                      <div className="font-medium">Регулярный платеж</div>
                      <div className="text-sm text-dark-400">Интернет, телефон, коммуналка...</div>
                    </div>
                  </button>
                  <button onClick={() => { setShowAddChoice(false); setShowAddPurchase(true); }}
                    className="w-full p-4 bg-dark-800 hover:bg-dark-700 rounded-xl text-left flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                      <ShoppingCart size={20} />
                    </div>
                    <div>
                      <div className="font-medium">Разовая покупка</div>
                      <div className="text-sm text-dark-400">Для учета расходов</div>
                    </div>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Форма добавления провайдера
  if (showAddProvider) {
    return (
      <div className="min-h-screen bg-animated">
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-dark-900/80 border-b border-dark-800">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={() => setShowAddProvider(false)} className="p-2 hover:bg-dark-700 rounded-lg">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-semibold">Новый платеж</h1>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          <div className="glass-card p-4 space-y-4">
            <div>
              <label className="block text-sm text-dark-400 mb-1">Название *</label>
              <input type="text" value={newProvider.name} onChange={e => setNewProvider({...newProvider, name: e.target.value})}
                placeholder="Интернет Ростелеком" className="input-field w-full" />
            </div>

            <div>
              <label className="block text-sm text-dark-400 mb-2">Иконка</label>
              <div className="grid grid-cols-8 gap-2">
                {providerIcons.map(icon => {
                  const IconComp = serviceIcons[icon.id] || serviceIcons.default;
                  return (
                    <button key={icon.id} onClick={() => setNewProvider({...newProvider, icon: icon.id})}
                      className={`aspect-square flex items-center justify-center rounded-lg transition-colors ${newProvider.icon === icon.id ? 'bg-purple-500/30 ring-2 ring-purple-500' : 'bg-dark-700 hover:bg-dark-600'}`}
                      title={icon.name}>
                      <div className="w-5 h-5" style={{ color: newProvider.color }}><IconComp /></div>
                    </button>
                  );
                })}
              </div>
            </div>

            <ColorPicker 
              label="Цвет"
              value={newProvider.color} 
              onChange={color => setNewProvider({...newProvider, color})}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-dark-400 mb-1">Сумма *</label>
                <input type="number" value={newProvider.amount} onChange={e => setNewProvider({...newProvider, amount: e.target.value})}
                  placeholder="500" className="input-field w-full" />
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">Валюта</label>
                <select value={newProvider.currency} onChange={e => setNewProvider({...newProvider, currency: e.target.value})}
                  className="input-field w-full">
                  <option value="RUB">RUB</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-dark-400 mb-1">Дата платежа *</label>
                <input type="date" value={newProvider.nextPayment} onChange={e => setNewProvider({...newProvider, nextPayment: e.target.value})}
                  className="input-field w-full" />
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">Период</label>
                <select value={newProvider.period} onChange={e => setNewProvider({...newProvider, period: e.target.value})}
                  className="input-field w-full">
                  <option value="monthly">Ежемесячно</option>
                  <option value="quarterly">Ежеквартально</option>
                  <option value="yearly">Ежегодно</option>
                  <option value="once">Разово</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-dark-400 mb-1">Ссылка для оплаты</label>
              <input type="url" value={newProvider.url} onChange={e => setNewProvider({...newProvider, url: e.target.value})}
                placeholder="https://..." className="input-field w-full" />
            </div>

            <div>
              <label className="block text-sm text-dark-400 mb-1">Заметка</label>
              <input type="text" value={newProvider.note} onChange={e => setNewProvider({...newProvider, note: e.target.value})}
                placeholder="Лицевой счет: 123456" className="input-field w-full" />
            </div>

            <div>
              <label className="block text-sm text-dark-400 mb-2">Напомнить за (дней)</label>
              <div className="flex flex-wrap gap-2">
                {[1, 3, 7, 14, 30].map(days => (
                  <button key={days} type="button"
                    onClick={() => {
                      const current = newProvider.remindDays || [];
                      const newDays = current.includes(days) 
                        ? current.filter(d => d !== days)
                        : [...current, days].sort((a,b) => a-b);
                      setNewProvider({...newProvider, remindDays: newDays});
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      (newProvider.remindDays || []).includes(days)
                        ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500'
                        : 'bg-dark-800 hover:bg-dark-700'
                    }`}>
                    {days} {days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-dark-500 mt-2">Уведомления отправляются в Telegram</p>
            </div>

            <button onClick={addProvider}
              className="w-full py-3 bg-purple-500 hover:bg-purple-600 rounded-xl font-medium flex items-center justify-center gap-2">
              <Plus size={20} /> Добавить платеж
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Форма добавления покупки
  if (showAddPurchase) {
    return (
      <div className="min-h-screen bg-animated">
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-dark-900/80 border-b border-dark-800">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={() => setShowAddPurchase(false)} className="p-2 hover:bg-dark-700 rounded-lg">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-semibold">Новая покупка</h1>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          <div className="glass-card p-4 space-y-4">
            <div>
              <label className="block text-sm text-dark-400 mb-1">Название *</label>
              <input type="text" value={newPurchase.name} onChange={e => setNewPurchase({...newPurchase, name: e.target.value})}
                placeholder="Продукты, такси..." className="input-field w-full" />
            </div>

            <div>
              <label className="block text-sm text-dark-400 mb-2">Категория</label>
              <div className="flex flex-wrap gap-2">
                {purchaseCategories.map(cat => {
                  const IconComp = serviceIcons[cat.icon] || serviceIcons.default;
                  return (
                    <button key={cat.id} onClick={() => setNewPurchase({...newPurchase, category: cat.id})}
                      className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                        newPurchase.category === cat.id 
                          ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500' 
                          : 'bg-dark-800 hover:bg-dark-700'
                      }`}>
                      <div className="w-4 h-4"><IconComp /></div>
                      <span className="text-sm">{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-dark-400 mb-1">Сумма *</label>
                <input type="number" value={newPurchase.amount} onChange={e => setNewPurchase({...newPurchase, amount: e.target.value})}
                  placeholder="500" className="input-field w-full" />
              </div>
              <div>
                <label className="block text-sm text-dark-400 mb-1">Валюта</label>
                <select value={newPurchase.currency} onChange={e => setNewPurchase({...newPurchase, currency: e.target.value})}
                  className="input-field w-full">
                  <option value="RUB">RUB</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-dark-400 mb-1">Дата *</label>
              <input type="date" value={newPurchase.date} onChange={e => setNewPurchase({...newPurchase, date: e.target.value})}
                className="input-field w-full" />
            </div>

            <div>
              <label className="block text-sm text-dark-400 mb-1">Заметка</label>
              <input type="text" value={newPurchase.note} onChange={e => setNewPurchase({...newPurchase, note: e.target.value})}
                placeholder="Дополнительная информация" className="input-field w-full" />
            </div>

            <button onClick={addPurchase}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-xl font-medium flex items-center justify-center gap-2">
              <Plus size={20} /> Добавить покупку
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Основная страница
  return (
    <div className="min-h-screen bg-animated">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-dark-900/80 border-b border-dark-800">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={onBack} className="p-2 hover:bg-dark-700 rounded-lg"><ArrowLeft size={20} /></button>
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Receipt size={18} className="text-purple-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Платежи</h1>
                <p className="text-xs text-dark-400">{allPayments.length} активных</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {monthlyTotal > 0 && (
                <div className="text-right mr-2">
                  <div className="text-xs text-dark-400">В месяц</div>
                  <div className="text-lg font-semibold">~{monthlyTotal.toFixed(0)}</div>
                </div>
              )}
              <div className="relative">
                <button 
                  onClick={() => setShowTranslate(!showTranslate)}
                  className={`w-10 h-10 hover:bg-dark-700 rounded-xl flex items-center justify-center ${showTranslate ? 'bg-dark-700' : ''}`}
                >
                  <Globe size={20} />
                </button>
                <AnimatePresence>
                  {showTranslate && (
                    <TranslateWidget show={showTranslate} onClose={() => setShowTranslate(false)} />
                  )}
                </AnimatePresence>
              </div>
              <button onClick={() => setShowAddChoice(true)}
                className="w-10 h-10 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-xl flex items-center justify-center">
                <Plus size={20} />
              </button>
            </div>
          </div>
          
          <div className="flex gap-1 mt-3 bg-dark-800/50 p-1 rounded-xl">
            {[
              { id: 'payments', label: 'Платежи', icon: Receipt },
              { id: 'history', label: 'История', icon: History },
              { id: 'stats', label: 'Статистика', icon: PieChart }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5
                  ${activeTab === tab.id ? 'bg-dark-700 text-white' : 'text-dark-400'}`}>
                <tab.icon size={16} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 pb-24">
        {activeTab === 'payments' && (
          allPayments.length === 0 ? (
            <div className="text-center py-16">
              <Receipt size={64} className="mx-auto mb-4 text-dark-600" />
              <h2 className="text-xl font-medium text-dark-300 mb-2">Нет активных платежей</h2>
              <p className="text-dark-500 mb-4">Добавьте первый платеж или покупку</p>
              <button onClick={() => setShowAddChoice(true)}
                className="px-6 py-3 bg-purple-500 hover:bg-purple-600 rounded-xl font-medium inline-flex items-center gap-2">
                <Plus size={20} /> Добавить
              </button>
            </div>
          ) : (
            <>
              {renderSection('Просрочено', overdue, <AlertCircle size={14} className="text-red-400" />)}
              {renderSection('Сегодня', todayPayments, <AlertCircle size={14} className="text-red-400" />)}
              {renderSection('На этой неделе', thisWeek, <ClockIcon size={14} className="text-yellow-400" />)}
              {renderSection('В этом месяце', thisMonth, <ClockIcon size={14} className="text-blue-400" />)}
              {renderSection('Позже', later, <ClockIcon size={14} className="text-dark-400" />)}
            </>
          )
        )}

        {activeTab === 'history' && (
          history.length === 0 ? (
            <div className="text-center py-16">
              <History size={64} className="mx-auto mb-4 text-dark-600" />
              <h2 className="text-xl font-medium text-dark-300">История пуста</h2>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(p => {
                const name = p.cardName || p.providerName || p.name || 'Платеж';
                const typeLabel = p.type === 'purchase' ? 'Покупка' : p.type === 'provider' ? 'Провайдер' : 'Сервис';
                const paidDate = new Date(p.paidAt);
                return (
                  <div key={p.id} className="p-3 bg-dark-800/50 rounded-xl flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center text-green-400">
                      <CheckCircle2 size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{name}</div>
                      <div className="text-xs text-dark-400">
                        {typeLabel} - {paidDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {p.note && <span className="text-dark-500"> - {p.note}</span>}
                      </div>
                    </div>
                    <div className="font-semibold text-right mr-2">
                      <div>{p.amount} {p.currency}</div>
                    </div>
                    <button 
                      onClick={() => deleteHistoryItem(p.id)}
                      className="p-2 rounded-lg text-dark-500 hover:text-red-400 hover:bg-dark-700 opacity-0 group-hover:opacity-100 transition-all"
                      title="Удалить из истории"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )
        )}

        {activeTab === 'stats' && stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-card p-4">
                <div className="text-sm text-dark-400 mb-1">Этот месяц</div>
                <div className="text-2xl font-bold">{stats.thisMonth.total.toFixed(0)}</div>
                <div className="text-xs text-dark-500">{stats.thisMonth.count} платежей</div>
              </div>
              <div className="glass-card p-4">
                <div className="text-sm text-dark-400 mb-1">Прошлый месяц</div>
                <div className="text-2xl font-bold">{stats.lastMonth.total.toFixed(0)}</div>
                <div className="text-xs text-dark-500">{stats.lastMonth.count} платежей</div>
              </div>
            </div>

            <div className="glass-card p-4">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-400" /> Прогноз
              </h3>
              <div className="text-3xl font-bold mb-3">{stats.forecast.total.toFixed(0)} RUB</div>
              {stats.forecast.items?.length > 0 && (
                <div className="space-y-1">
                  {stats.forecast.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-dark-400">{item.name}</span>
                      <span>{item.amount} {item.currency}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-card p-4">
              <div className="text-sm text-dark-400 mb-1">За год</div>
              <div className="text-2xl font-bold">{stats.yearTotal?.toFixed(0) || 0}</div>
              <div className="text-xs text-dark-500">{stats.yearCount || 0} платежей</div>
            </div>
          </div>
        )}
      </main>

      {/* Add Choice Modal */}
      <AnimatePresence>
        {showAddChoice && (
          <motion.div className="fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowAddChoice(false)}>
            <motion.div className="glass-card w-full max-w-sm p-6"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">Что добавить?</h3>
              <div className="space-y-2">
                <button onClick={() => { setShowAddChoice(false); setShowAddProvider(true); }}
                  className="w-full p-4 bg-dark-800 hover:bg-dark-700 rounded-xl text-left flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <Receipt size={20} />
                  </div>
                  <div>
                    <div className="font-medium">Регулярный платеж</div>
                    <div className="text-sm text-dark-400">Интернет, телефон, коммуналка...</div>
                  </div>
                </button>
                <button onClick={() => { setShowAddChoice(false); setShowAddPurchase(true); }}
                  className="w-full p-4 bg-dark-800 hover:bg-dark-700 rounded-xl text-left flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <ShoppingCart size={20} />
                  </div>
                  <div>
                    <div className="font-medium">Разовая покупка</div>
                    <div className="text-sm text-dark-400">Для учета расходов</div>
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============ TASKS PAGE ============
function TasksPage({ onBack }) {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('homedash-tasks-tab') || 'tasks');
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [filter, setFilter] = useState('active'); // active | completed
  const [showTranslate, setShowTranslate] = useState(false);

  // Save activeTab to localStorage
  useEffect(() => {
    localStorage.setItem('homedash-tasks-tab', activeTab);
  }, [activeTab]);
  
  // New task form
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: ''
  });
  
  // New note form
  const [newNote, setNewNote] = useState({
    title: '',
    content: '',
    color: '#3b82f6'
  });

  const noteColors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', 
    '#f97316', '#eab308', '#22c55e', '#06b6d4'
  ];

  const priorityColors = {
    low: 'bg-green-500/20 text-green-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    high: 'bg-red-500/20 text-red-400'
  };

  const priorityLabels = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий'
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tasksData, notesData] = await Promise.all([
        api.get('/api/tasks').catch(() => []),
        api.get('/api/notes').catch(() => [])
      ]);
      setTasks(tasksData || []);
      setNotes(notesData || []);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  // Tasks handlers
  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;
    try {
      const task = await api.post('/api/tasks', newTask);
      setTasks(prev => [...prev, task]);
      setNewTask({ title: '', description: '', priority: 'medium', dueDate: '' });
      setShowAddTask(false);
    } catch (err) {
      console.error('Failed to add task:', err);
    }
  };

  const handleUpdateTask = async (id, updates) => {
    try {
      const updated = await api.put(`/api/tasks/${id}`, updates);
      setTasks(prev => prev.map(t => t.id === id ? updated : t));
      setEditingTask(null);
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const handleToggleTask = async (task) => {
    await handleUpdateTask(task.id, { completed: !task.completed });
  };

  const handleDeleteTask = async (id) => {
    if (!confirm('Удалить задачу?')) return;
    try {
      await api.delete(`/api/tasks/${id}`);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  // Notes handlers
  const handleAddNote = async () => {
    if (!newNote.title.trim() && !newNote.content.trim()) return;
    try {
      const note = await api.post('/api/notes', newNote);
      setNotes(prev => [...prev, note]);
      setNewNote({ title: '', content: '', color: '#3b82f6' });
      setShowAddNote(false);
    } catch (err) {
      console.error('Failed to add note:', err);
    }
  };

  const handleUpdateNote = async (id, updates) => {
    try {
      const updated = await api.put(`/api/notes/${id}`, updates);
      setNotes(prev => prev.map(n => n.id === id ? updated : n));
      setEditingNote(null);
    } catch (err) {
      console.error('Failed to update note:', err);
    }
  };

  const handleDeleteNote = async (id) => {
    if (!confirm('Удалить заметку?')) return;
    try {
      await api.delete(`/api/notes/${id}`);
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (filter === 'active') return !task.completed;
    if (filter === 'completed') return task.completed;
    return !task.completed; // default to active
  }).sort((a, b) => {
    // Sort: incomplete first, then by priority, then by due date
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  const completedCount = tasks.filter(t => t.completed).length;
  const activeCount = tasks.filter(t => !t.completed).length;

  // Format due date
  const formatDueDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date < today) return { text: 'Просрочено', class: 'text-red-400' };
    if (date.toDateString() === today.toDateString()) return { text: 'Сегодня', class: 'text-yellow-400' };
    if (date.toDateString() === tomorrow.toDateString()) return { text: 'Завтра', class: 'text-blue-400' };
    return { text: date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }), class: 'text-dark-400' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-animated flex items-center justify-center">
        <motion.div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full"
          animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-animated pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-dark-900/80 border-b border-dark-800">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-dark-700 transition-colors">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-xl font-semibold">Задачи</h1>
          </div>
          <div className="relative">
            <button 
              onClick={() => setShowTranslate(!showTranslate)}
              className={`p-2.5 rounded-xl hover:bg-dark-700 transition-colors ${showTranslate ? 'bg-dark-700' : ''}`}
            >
              <Globe size={20} />
            </button>
            <AnimatePresence>
              {showTranslate && (
                <TranslateWidget show={showTranslate} onClose={() => setShowTranslate(false)} />
              )}
            </AnimatePresence>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="px-4 pb-3 flex gap-2">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 py-2.5 px-4 rounded-xl font-medium transition-all ${
              activeTab === 'tasks' 
                ? 'bg-blue-500 text-white' 
                : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 size={18} />
              <span>Задачи</span>
              {activeCount > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === 'tasks' ? 'bg-white/20' : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {activeCount}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex-1 py-2.5 px-4 rounded-xl font-medium transition-all ${
              activeTab === 'notes' 
                ? 'bg-purple-500 text-white' 
                : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <FileText size={18} />
              <span>Заметки</span>
              {notes.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === 'notes' ? 'bg-white/20' : 'bg-purple-500/20 text-purple-400'
                }`}>
                  {notes.length}
                </span>
              )}
            </div>
          </button>
        </div>
      </header>

      {/* Tasks Tab */}
      {activeTab === 'tasks' && (
        <div className="p-4">
          {/* Filter */}
          {tasks.length > 0 && (
            <div className="flex gap-2 mb-4">
              {[
                { id: 'active', label: 'Активные', count: activeCount },
                { id: 'completed', label: 'Выполненные', count: completedCount }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    filter === f.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
                  }`}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
          )}

          {/* Tasks List */}
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filteredTasks.map(task => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`bg-dark-800/50 backdrop-blur rounded-xl p-4 border border-dark-700 cursor-pointer hover:border-dark-600 transition-colors ${
                    task.completed ? 'opacity-60' : ''
                  }`}
                  onClick={() => setEditingTask(task)}
                >
                  <div className="flex gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleTask(task); }}
                      className={`w-6 h-6 rounded-lg border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        task.completed
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-dark-500 hover:border-blue-500'
                      }`}
                    >
                      {task.completed && <Check size={14} />}
                    </button>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className={`font-medium ${task.completed ? 'line-through text-dark-400' : ''}`}>
                          {task.title}
                        </h3>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-dark-400 hover:text-red-400 transition-colors flex-shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      
                      {task.description && (
                        <p className="text-sm text-dark-400 mt-1 line-clamp-2">{task.description}</p>
                      )}
                      
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[task.priority]}`}>
                          {priorityLabels[task.priority]}
                        </span>
                        {task.dueDate && (() => {
                          const due = formatDueDate(task.dueDate);
                          return due && (
                            <span className={`flex items-center gap-1 text-xs ${due.class}`}>
                              <Calendar size={12} />
                              {due.text}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Empty State */}
          {filteredTasks.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle2 size={48} className="mx-auto text-dark-600 mb-4" />
              <p className="text-dark-400 mb-4">
                {filter === 'completed' ? 'Нет выполненных задач' : 'Все задачи выполнены!'}
              </p>
              {filter === 'active' && (
                <button
                  onClick={() => setShowAddTask(true)}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-xl text-sm font-medium transition-colors"
                >
                  Добавить задачу
                </button>
              )}
            </div>
          )}

          {/* Add Button */}
          {(tasks.length > 0 || filter === 'active') && filteredTasks.length > 0 && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAddTask(true)}
              className="fixed bottom-24 right-4 w-14 h-14 bg-blue-500 hover:bg-blue-600 rounded-full shadow-lg flex items-center justify-center transition-colors z-50"
            >
              <Plus size={24} />
            </motion.button>
          )}
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <div className="p-4">
          {/* Notes Grid */}
          <div className="grid grid-cols-2 gap-3">
            <AnimatePresence mode="popLayout">
              {notes.map(note => (
                <motion.div
                  key={note.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => setEditingNote(note)}
                  className="bg-dark-800/50 backdrop-blur rounded-xl p-4 border border-dark-700 cursor-pointer hover:border-dark-600 transition-colors"
                  style={{ borderLeftWidth: '3px', borderLeftColor: note.color }}
                >
                  {note.title && (
                    <h3 className="font-medium mb-1 line-clamp-1">{note.title}</h3>
                  )}
                  <p className="text-sm text-dark-400 line-clamp-4 whitespace-pre-wrap">
                    {note.content || 'Пустая заметка'}
                  </p>
                  <p className="text-xs text-dark-500 mt-2">
                    {new Date(note.updatedAt).toLocaleDateString('ru-RU')}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Empty State */}
          {notes.length === 0 && (
            <div className="text-center py-12">
              <FileText size={48} className="mx-auto text-dark-600 mb-4" />
              <p className="text-dark-400">Нет заметок</p>
              <button
                onClick={() => setShowAddNote(true)}
                className="mt-4 px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-xl text-sm font-medium transition-colors"
              >
                Создать заметку
              </button>
            </div>
          )}

          {/* Add Button */}
          {notes.length > 0 && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAddNote(true)}
              className="fixed bottom-24 right-4 w-14 h-14 bg-purple-500 hover:bg-purple-600 rounded-full shadow-lg flex items-center justify-center transition-colors z-50"
            >
              <Plus size={24} />
            </motion.button>
          )}
        </div>
      )}

      {/* Add Task Modal */}
      <AnimatePresence>
        {showAddTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 pb-24 sm:pb-4"
            onClick={() => setShowAddTask(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-dark-800 rounded-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-dark-700 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Новая задача</h2>
                <button onClick={() => setShowAddTask(false)} className="p-2 hover:bg-dark-700 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm text-dark-400 mb-1.5">Название</label>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                    placeholder="Что нужно сделать?"
                    className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl focus:border-blue-500 focus:outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm text-dark-400 mb-1.5">Описание</label>
                  <textarea
                    value={newTask.description}
                    onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                    placeholder="Подробности (необязательно)"
                    rows={3}
                    className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-dark-400 mb-1.5">Приоритет</label>
                    <select
                      value={newTask.priority}
                      onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl focus:border-blue-500 focus:outline-none"
                    >
                      <option value="low">Низкий</option>
                      <option value="medium">Средний</option>
                      <option value="high">Высокий</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-dark-400 mb-1.5">Срок</label>
                    <input
                      type="date"
                      value={newTask.dueDate}
                      onChange={e => setNewTask(p => ({ ...p, dueDate: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  onClick={handleAddTask}
                  disabled={!newTask.title.trim()}
                  className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
                >
                  Добавить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Task Modal */}
      <AnimatePresence>
        {editingTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 pb-24 sm:pb-4"
            onClick={() => setEditingTask(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-dark-800 rounded-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-dark-700 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Редактировать</h2>
                <button onClick={() => setEditingTask(null)} className="p-2 hover:bg-dark-700 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm text-dark-400 mb-1.5">Название</label>
                  <input
                    type="text"
                    value={editingTask.title}
                    onChange={e => setEditingTask(p => ({ ...p, title: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-dark-400 mb-1.5">Описание</label>
                  <textarea
                    value={editingTask.description}
                    onChange={e => setEditingTask(p => ({ ...p, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-dark-400 mb-1.5">Приоритет</label>
                    <select
                      value={editingTask.priority}
                      onChange={e => setEditingTask(p => ({ ...p, priority: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl focus:border-blue-500 focus:outline-none"
                    >
                      <option value="low">Низкий</option>
                      <option value="medium">Средний</option>
                      <option value="high">Высокий</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-dark-400 mb-1.5">Срок</label>
                    <input
                      type="date"
                      value={editingTask.dueDate || ''}
                      onChange={e => setEditingTask(p => ({ ...p, dueDate: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDeleteTask(editingTask.id)}
                    className="flex-1 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl font-medium transition-colors"
                  >
                    Удалить
                  </button>
                  <button
                    onClick={() => handleUpdateTask(editingTask.id, editingTask)}
                    className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 rounded-xl font-medium transition-colors"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Note Modal */}
      <AnimatePresence>
        {showAddNote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 pb-24 sm:pb-4 overflow-hidden"
            onClick={() => setShowAddNote(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-dark-800 rounded-2xl overflow-hidden max-h-[60vh] sm:max-h-[80vh] flex flex-col"
            >
              <div className="p-4 border-b border-dark-700 flex items-center justify-between flex-shrink-0">
                <h2 className="text-lg font-semibold">Новая заметка</h2>
                <button onClick={() => setShowAddNote(false)} className="p-2 hover:bg-dark-700 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 space-y-4 flex-1 overflow-y-auto overflow-x-hidden">
                <div>
                  <label className="block text-sm text-dark-400 mb-1.5">Заголовок</label>
                  <input
                    type="text"
                    value={newNote.title}
                    onChange={e => setNewNote(p => ({ ...p, title: e.target.value }))}
                    placeholder="Заголовок (необязательно)"
                    className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-dark-400 mb-1.5">Содержание</label>
                  <textarea
                    value={newNote.content}
                    onChange={e => setNewNote(p => ({ ...p, content: e.target.value }))}
                    placeholder="Текст заметки..."
                    rows={6}
                    className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl focus:border-purple-500 focus:outline-none resize-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm text-dark-400 mb-1.5">Цвет</label>
                  <div className="flex flex-wrap gap-2">
                    {noteColors.map(color => (
                      <button
                        key={color}
                        onClick={() => setNewNote(p => ({ ...p, color }))}
                        className={`w-8 h-8 rounded-lg transition-transform ${
                          newNote.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-800 scale-110' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.title.trim() && !newNote.content.trim()}
                  className="w-full py-3 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
                >
                  Создать
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Note Modal */}
      <AnimatePresence>
        {editingNote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 pb-24 sm:pb-4 overflow-hidden"
            onClick={() => setEditingNote(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-dark-800 rounded-2xl overflow-hidden max-h-[60vh] sm:max-h-[80vh] flex flex-col"
            >
              <div className="p-4 border-b border-dark-700 flex items-center justify-between flex-shrink-0">
                <h2 className="text-lg font-semibold">Редактировать</h2>
                <button onClick={() => setEditingNote(null)} className="p-2 hover:bg-dark-700 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 space-y-4 flex-1 overflow-y-auto overflow-x-hidden">
                <div>
                  <label className="block text-sm text-dark-400 mb-1.5">Заголовок</label>
                  <input
                    type="text"
                    value={editingNote.title}
                    onChange={e => setEditingNote(p => ({ ...p, title: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-dark-400 mb-1.5">Содержание</label>
                  <textarea
                    value={editingNote.content}
                    onChange={e => setEditingNote(p => ({ ...p, content: e.target.value }))}
                    rows={8}
                    className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl focus:border-purple-500 focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-dark-400 mb-1.5">Цвет</label>
                  <div className="flex flex-wrap gap-2">
                    {noteColors.map(color => (
                      <button
                        key={color}
                        onClick={() => setEditingNote(p => ({ ...p, color }))}
                        className={`w-8 h-8 rounded-lg transition-transform ${
                          editingNote.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-800 scale-110' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDeleteNote(editingNote.id)}
                    className="flex-1 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl font-medium transition-colors"
                  >
                    Удалить
                  </button>
                  <button
                    onClick={() => handleUpdateNote(editingNote.id, editingNote)}
                    className="flex-1 py-3 bg-purple-500 hover:bg-purple-600 rounded-xl font-medium transition-colors"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CardDetailModal({ card, data, onClose }) {
  const overlayRef = useRef(null);
  const mouseDownTarget = useRef(null);
  const IconComponent = serviceIcons[card.icon] || serviceIcons.default;

  const handleOverlayMouseDown = (e) => { mouseDownTarget.current = e.target; };
  const handleOverlayMouseUp = (e) => {
    if (mouseDownTarget.current === overlayRef.current && e.target === overlayRef.current) onClose();
    mouseDownTarget.current = null;
  };

  const formatUptime = (seconds) => {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}д ${hours}ч`;
  };

  const formatBytes = (bytes) => {
    if (!bytes) return 'N/A';
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  return (
    <motion.div
      ref={overlayRef}
      className="fixed inset-0 modal-overlay flex items-start justify-center z-50 p-4 py-8 overflow-y-auto"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onMouseDown={handleOverlayMouseDown} onMouseUp={handleOverlayMouseUp}
    >
      <motion.div
        className="glass-card w-full max-w-2xl my-auto"
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${card.color}20`, color: card.color }}>
                <div className="w-10 h-10"><IconComponent /></div>
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white">{card.name}</h2>
                <p className="text-dark-400">{card.description}</p>
                {card.url && (
                  <a href={card.url} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1">
                    <ExternalLink size={12} /> {card.url}
                  </a>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-dark-700 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Content based on integration type */}
          {data && !data.error && (
            <div className="space-y-6">
              {/* Integration section - только если настроена */}
              {data.configured && (
                <>
                  {card.integration?.type && (
                    <h3 className="text-sm font-medium text-dark-400 uppercase tracking-wide">Интеграция</h3>
                  )}
                  
                  {/* Proxmox Details */}
                  {card.integration?.type === 'proxmox' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Cpu size={16} className="text-blue-400" />
                        <span className="text-dark-400">CPU</span>
                      </div>
                      <div className="text-3xl font-bold text-white">{data.cpu}%</div>
                      <div className="progress-bar mt-2 h-2">
                        <div className="progress-fill bg-gradient-to-r from-blue-500 to-cyan-500 h-2" style={{ width: `${data.cpu}%` }} />
                      </div>
                    </div>
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <HardDrive size={16} className="text-purple-400" />
                        <span className="text-dark-400">RAM</span>
                      </div>
                      <div className="text-3xl font-bold text-white">{data.memory?.percent}%</div>
                      <div className="text-sm text-dark-500 mt-1">{formatBytes(data.memory?.used)} / {formatBytes(data.memory?.total)}</div>
                      <div className="progress-bar mt-2 h-2">
                        <div className="progress-fill bg-gradient-to-r from-purple-500 to-pink-500 h-2" style={{ width: `${data.memory?.percent}%` }} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="glass-card p-4 text-center">
                      <Server size={24} className="text-blue-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-white">{data.vms?.running || 0}/{data.vms?.total || 0}</div>
                      <div className="text-dark-500 text-sm">Virtual Machines</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                      <Container size={24} className="text-cyan-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-white">{data.containers?.running || 0}/{data.containers?.total || 0}</div>
                      <div className="text-dark-500 text-sm">LXC Containers</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                      <ClockIcon size={24} className="text-green-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-white">{formatUptime(data.uptime)}</div>
                      <div className="text-dark-500 text-sm">Uptime</div>
                    </div>
                  </div>

                  {data.storage?.length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium mb-3">Storage</h3>
                      <div className="space-y-2">
                        {data.storage.map((s, i) => (
                          <div key={i} className="glass-card p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-dark-300">{s.name}</span>
                              <span className="text-dark-500 text-sm">{s.type}</span>
                            </div>
                            <div className="progress-bar h-2">
                              <div className="progress-fill bg-gradient-to-r from-orange-500 to-yellow-500 h-2" style={{ width: `${s.percent}%` }} />
                            </div>
                            <div className="flex justify-between mt-1 text-xs text-dark-500">
                              <span>{formatBytes(s.used)}</span>
                              <span>{s.percent}%</span>
                              <span>{formatBytes(s.total)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* MikroTik Details */}
              {card.integration?.type === 'mikrotik' && (
                <>
                  <div className="glass-card p-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-semibold text-white">{data.boardName}</div>
                        <div className="text-sm text-dark-400">RouterOS {data.version}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-dark-400">Uptime</div>
                        <div className="text-lg font-medium text-green-400">{data.uptime?.formatted || 'N/A'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Cpu size={16} className="text-blue-400" />
                        <span className="text-dark-400">CPU ({data.cpuCount} cores)</span>
                      </div>
                      <div className="text-3xl font-bold text-white">{data.cpu}%</div>
                      <div className="progress-bar mt-2 h-2">
                        <div className="progress-fill bg-gradient-to-r from-blue-500 to-cyan-500 h-2" style={{ width: `${data.cpu}%` }} />
                      </div>
                    </div>
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <HardDrive size={16} className="text-purple-400" />
                        <span className="text-dark-400">RAM</span>
                      </div>
                      <div className="text-3xl font-bold text-white">{data.memory?.percent}%</div>
                      <div className="text-sm text-dark-500 mt-1">{formatBytes(data.memory?.used)} / {formatBytes(data.memory?.total)}</div>
                      <div className="progress-bar mt-2 h-2">
                        <div className="progress-fill bg-gradient-to-r from-purple-500 to-pink-500 h-2" style={{ width: `${data.memory?.percent}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    {data.hdd && (
                      <div className="glass-card p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <HardDrive size={16} className="text-orange-400" />
                          <span className="text-dark-400">Storage</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{data.hdd.percent}%</div>
                        <div className="text-sm text-dark-500 mt-1">{formatBytes(data.hdd.used)} / {formatBytes(data.hdd.total)}</div>
                        <div className="progress-bar mt-2 h-2">
                          <div className="progress-fill bg-gradient-to-r from-orange-500 to-yellow-500 h-2" style={{ width: `${data.hdd.percent}%` }} />
                        </div>
                      </div>
                    )}
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Network size={16} className="text-green-400" />
                        <span className="text-dark-400">Interfaces</span>
                      </div>
                      <div className="text-2xl font-bold text-white">
                        <span className="text-green-400">{data.interfaces?.up}</span>
                        <span className="text-dark-500"> / {data.interfaces?.total}</span>
                      </div>
                      <div className="text-sm text-dark-500 mt-1">active</div>
                    </div>
                  </div>

                  {data.architecture && (
                    <div className="mt-4 text-center text-sm text-dark-500">
                      Architecture: {data.architecture}
                    </div>
                  )}
                </>
              )}

              {/* AdGuard Details */}
              {card.integration?.type === 'adguard' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-card p-4 text-center">
                    <Globe size={24} className="text-blue-400 mx-auto mb-2" />
                    <div className="text-3xl font-bold text-white">{data.totalQueries?.toLocaleString()}</div>
                    <div className="text-dark-500 text-sm">Total Queries</div>
                  </div>
                  <div className="glass-card p-4 text-center">
                    <Shield size={24} className="text-green-400 mx-auto mb-2" />
                    <div className="text-3xl font-bold text-green-400">{data.blockedQueries?.toLocaleString()}</div>
                    <div className="text-dark-500 text-sm">Blocked ({data.blockPercent}%)</div>
                  </div>
                </div>
              )}

              {/* CrowdSec Details */}
              {card.integration?.type === 'crowdsec' && (
                <>
                  <div className="glass-card p-4 text-center mb-4">
                    <Shield size={24} className="text-red-400 mx-auto mb-2" />
                    <div className="text-3xl font-bold text-red-400">{data.blockedIPs?.toLocaleString() || 0}</div>
                    <div className="text-dark-500 text-sm">Blocked IPs</div>
                  </div>

                  {data.decisionTypes && Object.keys(data.decisionTypes).length > 0 && (
                    <div className="glass-card p-4 mb-4">
                      <h3 className="text-sm font-medium text-dark-400 mb-3">Decision Types</h3>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(data.decisionTypes).map(([type, count]) => (
                          <div key={type} className="px-3 py-1.5 bg-dark-700 rounded-lg text-sm">
                            <span className="text-dark-400">{type}:</span>
                            <span className="ml-1 font-medium text-white">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {data.topScenarios && data.topScenarios.length > 0 && (
                    <div className="glass-card p-4">
                      <h3 className="text-sm font-medium text-dark-400 mb-3">Top Scenarios</h3>
                      <div className="space-y-2">
                        {data.topScenarios.map((scenario, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-sm text-dark-300 truncate flex-1">{scenario.name}</span>
                            <span className="text-sm font-medium text-white ml-2">{scenario.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* OpenWRT Details */}
              {card.integration?.type === 'openwrt' && (
                <>
                  <div className="glass-card p-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-semibold text-white">{data.boardName || 'OpenWRT'}</div>
                        <div className="text-sm text-dark-400">{data.version}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-dark-400">Uptime</div>
                        <div className="text-lg font-medium text-green-400">{data.uptime?.formatted || 'N/A'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Cpu size={16} className="text-blue-400" />
                        <span className="text-dark-400">CPU</span>
                      </div>
                      <div className="text-3xl font-bold text-white">{data.cpu}%</div>
                      <div className="progress-bar mt-2 h-2">
                        <div className="progress-fill bg-gradient-to-r from-blue-500 to-cyan-500 h-2" style={{ width: `${data.cpu}%` }} />
                      </div>
                    </div>
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <HardDrive size={16} className="text-purple-400" />
                        <span className="text-dark-400">RAM</span>
                      </div>
                      <div className="text-3xl font-bold text-white">{data.memory?.percent}%</div>
                      <div className="text-sm text-dark-500 mt-1">{formatBytes(data.memory?.used)} / {formatBytes(data.memory?.total)}</div>
                      <div className="progress-bar mt-2 h-2">
                        <div className="progress-fill bg-gradient-to-r from-purple-500 to-pink-500 h-2" style={{ width: `${data.memory?.percent}%` }} />
                      </div>
                    </div>
                  </div>

                  {(data.hostname || data.kernel) && (
                    <div className="mt-4 glass-card p-4">
                      {data.hostname && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-dark-400">Hostname</span>
                          <span className="text-white">{data.hostname}</span>
                        </div>
                      )}
                      {data.kernel && (
                        <div className="flex items-center justify-between text-sm mt-2">
                          <span className="text-dark-400">Kernel</span>
                          <span className="text-white">{data.kernel}</span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Weather Details */}
              {card.integration?.type === 'weather' && (
                <div className="text-center py-4">
                  <div className="text-6xl mb-4">{data.icon}</div>
                  <div className="text-5xl font-bold text-white mb-2">{data.temp}°C</div>
                  <div className="text-xl text-dark-400 capitalize mb-4">{data.description}</div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="glass-card p-3 text-center">
                      <ThermometerSun size={20} className="text-orange-400 mx-auto mb-1" />
                      <div className="text-lg font-medium">{data.feelsLike}°C</div>
                      <div className="text-xs text-dark-500">Feels like</div>
                    </div>
                    <div className="glass-card p-3 text-center">
                      <Droplets size={20} className="text-blue-400 mx-auto mb-1" />
                      <div className="text-lg font-medium">{data.humidity}%</div>
                      <div className="text-xs text-dark-500">Humidity</div>
                    </div>
                    <div className="glass-card p-3 text-center">
                      <Wind size={20} className="text-gray-400 mx-auto mb-1" />
                      <div className="text-lg font-medium">{data.wind} м/с</div>
                      <div className="text-xs text-dark-500">Wind</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Home Assistant Details */}
              {card.integration?.type === 'homeassistant' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="glass-card p-4 text-center">
                      <Lightbulb size={24} className="text-yellow-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-yellow-400">{data.entityCounts?.lightsOn || 0}</div>
                      <div className="text-sm text-dark-500">из {data.entityCounts?.lights || 0} вкл.</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                      <ToggleRight size={24} className="text-blue-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-blue-400">{data.entityCounts?.switchesOn || 0}</div>
                      <div className="text-sm text-dark-500">из {data.entityCounts?.switches || 0} вкл.</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                      <Gauge size={24} className="text-purple-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-white">{data.entityCounts?.sensors || 0}</div>
                      <div className="text-dark-500 text-sm">Датчики</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                      <Zap size={24} className="text-orange-400 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-white">{data.entityCounts?.automations || 0}</div>
                      <div className="text-dark-500 text-sm">Автоматизации</div>
                    </div>
                  </div>
                  
                  {/* Custom Entities */}
                  {data.customEntities && data.customEntities.length > 0 && (
                    <div className="glass-card p-4">
                      <h4 className="text-sm font-medium text-dark-400 mb-3">Отслеживаемые сущности</h4>
                      <div className="space-y-2">
                        {data.customEntities.map((entity, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-dark-800/50 rounded-lg">
                            <span className="text-dark-300">{entity.name}</span>
                            <span className={`font-medium px-2 py-0.5 rounded ${
                              entity.state === 'on' ? 'bg-yellow-500/20 text-yellow-400' : 
                              entity.state === 'off' ? 'bg-dark-700 text-dark-500' : 
                              entity.domain === 'sensor' ? 'bg-cyan-500/20 text-cyan-400' : 'text-white'
                            }`}>
                              {entity.state}{entity.unit ? ` ${entity.unit}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Wiki.js Details */}
              {card.integration?.type === 'wikijs' && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="glass-card p-4 text-center">
                    <FileJson size={24} className="text-blue-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white">{data.totalPages}</div>
                    <div className="text-dark-500 text-sm">Pages</div>
                  </div>
                  <div className="glass-card p-4 text-center">
                    <RefreshCw size={24} className="text-green-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-green-400">{data.recentPages}</div>
                    <div className="text-dark-500 text-sm">Updated (7d)</div>
                  </div>
                  <div className="glass-card p-4 text-center">
                    <Users size={24} className="text-purple-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white">{data.activeUsers}/{data.totalUsers}</div>
                    <div className="text-dark-500 text-sm">Active Users</div>
                  </div>
                </div>
              )}

              {/* NPM Plus Details */}
              {card.integration?.type === 'npm' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-card p-4 text-center">
                    <Globe size={24} className="text-green-400 mx-auto mb-2" />
                    <div className="text-3xl font-bold text-green-400">{data.enabledHosts}</div>
                    <div className="text-dark-500 text-sm">Active Hosts</div>
                  </div>
                  <div className="glass-card p-4 text-center">
                    <Server size={24} className="text-dark-500 mx-auto mb-2" />
                    <div className="text-3xl font-bold text-white">{data.totalHosts}</div>
                    <div className="text-dark-500 text-sm">Total Hosts</div>
                  </div>
                </div>
              )}
                </>
              )}

              {/* Monitoring Details */}
              {data?.monitoringStatus && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-dark-400 uppercase tracking-wide">Мониторинг</h3>
                  {/* Current Status */}
                  <div className="glass-card p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-dark-400">Текущий статус</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        data.monitoringStatus.status === 'up' ? 'bg-green-500/20 text-green-400' :
                        data.monitoringStatus.status === 'down' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {data.monitoringStatus.status === 'up' ? 'Online' : 
                         data.monitoringStatus.status === 'down' ? 'Offline' : 'Degraded'}
                      </span>
                    </div>
                    {data.monitoringStatus.checks?.length > 0 && (
                      <div className="text-sm text-dark-400">
                        Последняя проверка: {new Date(data.monitoringStatus.checks[data.monitoringStatus.checks.length - 1]?.timestamp).toLocaleString('ru-RU')}
                      </div>
                    )}
                  </div>

                  {/* Stats Grid */}
                  {data.monitoringStatus.stats && (
                    <div className="grid grid-cols-2 gap-4">
                      {['1h', '24h', '7d', '30d'].map(period => {
                        const stats = data.monitoringStatus.stats[period];
                        if (!stats) return null;
                        return (
                          <div key={period} className="glass-card p-4 text-center">
                            <div className="text-dark-500 text-sm mb-1">Uptime {period}</div>
                            <div className={`text-2xl font-bold ${
                              parseFloat(stats.uptime) >= 99 ? 'text-green-400' :
                              parseFloat(stats.uptime) >= 95 ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {stats.uptime}%
                            </div>
                            {stats.avgResponseTime && (
                              <div className="text-xs text-dark-500 mt-1">~{stats.avgResponseTime}ms</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Recent Checks */}
                  {data.monitoringStatus.checks?.length > 0 && (
                    <div className="glass-card p-4">
                      <h4 className="text-sm text-dark-400 mb-3">Последние проверки</h4>
                      <div className="flex gap-1">
                        {data.monitoringStatus.checks.slice(-50).map((check, i) => (
                          <div 
                            key={i}
                            className={`w-2 h-6 rounded-sm ${
                              check.status === 'up' ? 'bg-green-500' :
                              check.status === 'down' ? 'bg-red-500' :
                              'bg-yellow-500'
                            }`}
                            title={`${new Date(check.timestamp).toLocaleTimeString('ru-RU')} - ${check.status} ${check.responseTime ? `(${check.responseTime}ms)` : ''}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Billing Details */}
              {data?.billing && data.billing.nextPayment && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-dark-400 uppercase tracking-wide">Платеж</h3>
                  {/* Payment Info */}
                  <div className="glass-card p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-dark-400">Следующий платеж</span>
                      <span className="text-xl font-bold text-white">
                        {data.billing.amount} {data.billing.currency}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-dark-400">Дата</span>
                      <span className="text-white">{data.billing.nextPayment}</span>
                    </div>
                    {data.billing.period && (
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-dark-400">Период</span>
                        <span className="text-white">
                          {data.billing.period === 'monthly' ? 'Ежемесячно' :
                           data.billing.period === 'quarterly' ? 'Ежеквартально' :
                           data.billing.period === 'yearly' ? 'Ежегодно' : 'Разово'}
                        </span>
                      </div>
                    )}
                    {data.billing.note && (
                      <div className="mt-4 pt-4 border-t border-dark-700">
                        <span className="text-dark-500 text-sm">{data.billing.note}</span>
                      </div>
                    )}
                  </div>

                  {/* Days until payment */}
                  {(() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const paymentDate = new Date(data.billing.nextPayment);
                    paymentDate.setHours(0, 0, 0, 0);
                    const daysUntil = Math.ceil((paymentDate - today) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <div className={`glass-card p-4 text-center ${
                        daysUntil <= 0 ? 'bg-red-500/10' :
                        daysUntil <= 3 ? 'bg-yellow-500/10' :
                        daysUntil <= 7 ? 'bg-blue-500/10' : ''
                      }`}>
                        <div className={`text-4xl font-bold ${
                          daysUntil <= 0 ? 'text-red-400' :
                          daysUntil <= 3 ? 'text-yellow-400' :
                          daysUntil <= 7 ? 'text-blue-400' : 'text-white'
                        }`}>
                          {daysUntil < 0 ? `+${Math.abs(daysUntil)}` : daysUntil}
                        </div>
                        <div className="text-dark-400 text-sm mt-1">
                          {daysUntil < 0 ? 'дней просрочено' :
                           daysUntil === 0 ? 'платеж сегодня' :
                           daysUntil === 1 ? 'день до платежа' :
                           'дней до платежа'}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* SSH Host Details */}
              {card.integration?.type === 'ssh' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity size={16} className="text-orange-400" />
                        <span className="text-dark-400">Load Average</span>
                      </div>
                      <div className="text-3xl font-bold text-white">{data.load?.load1}</div>
                      <div className="text-sm text-dark-500 mt-1">
                        5m: {data.load?.load5} | 15m: {data.load?.load15}
                      </div>
                      <div className="text-xs text-dark-600 mt-1">{data.load?.cores} cores</div>
                      <div className="progress-bar mt-2 h-2">
                        <div className="progress-fill bg-gradient-to-r from-orange-500 to-yellow-500 h-2" 
                          style={{ width: `${Math.min(parseFloat(data.load?.percent || 0), 100)}%` }} />
                      </div>
                    </div>
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <HardDrive size={16} className="text-blue-400" />
                        <span className="text-dark-400">Memory</span>
                      </div>
                      <div className="text-3xl font-bold text-white">{data.memory?.percent}%</div>
                      <div className="text-sm text-dark-500 mt-1">
                        {formatBytes(data.memory?.used)} / {formatBytes(data.memory?.total)}
                      </div>
                      <div className="progress-bar mt-2 h-2">
                        <div className="progress-fill bg-gradient-to-r from-blue-500 to-cyan-500 h-2" 
                          style={{ width: `${data.memory?.percent || 0}%` }} />
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Database size={16} className="text-purple-400" />
                        <span className="text-dark-400">Disk Usage</span>
                      </div>
                      <div className="text-3xl font-bold text-white">{data.disk?.percent}%</div>
                      <div className="text-sm text-dark-500 mt-1">
                        {formatBytes(data.disk?.used)} / {formatBytes(data.disk?.total)}
                      </div>
                      <div className="progress-bar mt-2 h-2">
                        <div className="progress-fill bg-gradient-to-r from-purple-500 to-pink-500 h-2" 
                          style={{ width: `${data.disk?.percent || 0}%` }} />
                      </div>
                    </div>
                    <div className="glass-card p-4 text-center flex flex-col items-center justify-center">
                      <ClockIcon size={24} className="text-green-400 mb-2" />
                      <div className="text-2xl font-bold text-white">{data.uptime?.formatted}</div>
                      <div className="text-dark-500 text-sm">Uptime</div>
                    </div>
                  </div>
                </>
              )}

              {/* Docker Details */}
              {card.integration?.type === 'docker' && (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="glass-card p-4 text-center">
                      <PlayCircle size={24} className="text-green-400 mx-auto mb-2" />
                      <div className="text-3xl font-bold text-green-400">{data.running}</div>
                      <div className="text-dark-500 text-sm">Running</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                      <PauseCircle size={24} className="text-gray-500 mx-auto mb-2" />
                      <div className="text-3xl font-bold text-gray-400">{data.stopped}</div>
                      <div className="text-dark-500 text-sm">Stopped</div>
                    </div>
                    <div className="glass-card p-4 text-center">
                      <Container size={24} className="text-blue-400 mx-auto mb-2" />
                      <div className="text-3xl font-bold text-white">{data.total}</div>
                      <div className="text-dark-500 text-sm">Total</div>
                    </div>
                  </div>

                  {data.containers && data.containers.length > 0 && (
                    <div className="glass-card p-4">
                      <h3 className="text-sm font-medium text-dark-400 mb-3">Containers</h3>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {data.containers.map((c, i) => (
                          <div key={i} className="flex items-center gap-3 p-2 bg-dark-700/50 rounded-lg">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.state === 'running' ? 'bg-green-400' : 'bg-gray-500'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-white truncate">{c.name}</div>
                              <div className="text-xs text-dark-500 truncate">{c.image}</div>
                            </div>
                            <div className="text-xs text-dark-500 flex-shrink-0">{c.status}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Error state */}
          {data?.error && (
            <div className="text-center py-8">
              <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
              <p className="text-red-400">{data.error}</p>
            </div>
          )}

          {/* Not configured - показываем только если интеграция есть но не настроена, и нет мониторинга/биллинга */}
          {card.integration?.type && data && !data.configured && !data.monitoringStatus && !data.billing && (
            <div className="text-center py-8">
              <Settings size={48} className="text-dark-500 mx-auto mb-4" />
              <p className="text-dark-400">Интеграция не настроена</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-dark-700">
            {card.url && (
              <a href={card.url} target="_blank" rel="noopener noreferrer"
                className="btn btn-primary flex items-center gap-2">
                <ExternalLink size={16} /> Открыть
              </a>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============ Service Card Component ============
// ============ Service Card Component ============
function ServiceCard({ card, onEdit, onDelete, integrationData, onShowDetail, monitoringStatus, dragHandleProps, isDragging }) {
  const [isHovered, setIsHovered] = useState(false);
  const IconComponent = serviceIcons[card.icon] || serviceIcons.default;

  // Статус мониторинга
  const monStatus = monitoringStatus?.currentStatus || monitoringStatus?.status;
  const isMonitoringEnabled = card.monitoring?.enabled;
  const isBillable = card.category === 'hosting' || card.category === 'providers';

  const handleClick = (e) => {
    // Собираем все данные для модалки
    const hasIntegration = card.integration?.type && integrationData;
    const hasMonitoring = isMonitoringEnabled && monitoringStatus;
    const hasBilling = isBillable && card.billing?.enabled;
    
    // Если есть что показать - открываем модалку
    if (hasIntegration || hasMonitoring || hasBilling) {
      onShowDetail(card, {
        ...(integrationData || {}),
        monitoringStatus: hasMonitoring ? monitoringStatus : null,
        billing: hasBilling ? card.billing : null
      });
    } else if (card.url) {
      window.open(card.url, '_blank');
    }
  };

  const handleOpenUrl = (e) => {
    e.stopPropagation();
    if (card.url) window.open(card.url, '_blank');
  };

  return (
    <div
      className={`relative pt-8 transition-all duration-200 ease-out ${isDragging ? 'opacity-50 scale-105' : 'hover:scale-[1.02]'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
        {/* Панель управления - над карточкой */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-8 flex items-center justify-center z-10">
          <AnimatePresence>
            {isHovered && (
              <motion.div 
                className="flex items-center gap-1 py-1.5 px-2 rounded-lg bg-dark-800/95 backdrop-blur-sm border border-dark-600/50 shadow-lg"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
              >
                {dragHandleProps && (
                  <>
                    <div 
                      {...dragHandleProps}
                      className="p-1 rounded hover:bg-dark-600 cursor-grab active:cursor-grabbing transition-colors touch-none"
                      onClick={(e) => e.stopPropagation()}
                      title="Перетащить"
                    >
                      <GripVertical size={14} className="text-dark-400" />
                    </div>
                    <div className="w-px h-4 bg-dark-600 mx-0.5" />
                  </>
                )}
                {card.url && (
                  <button
                    onClick={handleOpenUrl}
                    className="p-1 rounded hover:bg-blue-500/20 text-blue-400 transition-colors"
                    title="Открыть"
                  >
                    <ExternalLink size={14} />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(card); }}
                  className="p-1 rounded hover:bg-dark-600 text-dark-300 transition-colors"
                  title="Редактировать"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
                  className="p-1 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                  title="Удалить"
                >
                  <Trash2 size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Карточка */}
        <div
          className="glass-card glow-on-hover cursor-pointer relative"
          onClick={handleClick}
        >
          {/* Индикатор статуса мониторинга */}
          {isMonitoringEnabled && (
            <div 
              className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${
                monStatus === 'up' ? 'bg-green-500 shadow-lg shadow-green-500/50' :
                monStatus === 'down' ? 'bg-red-500 shadow-lg shadow-red-500/50 animate-pulse' :
                'bg-gray-500'
              }`}
              title={
                monStatus === 'up' ? `Online • ${monitoringStatus?.lastCheck?.responseTime || 0}ms` :
                monStatus === 'down' ? `Offline • ${monitoringStatus?.lastCheck?.error || 'No response'}` :
                'Checking...'
              }
            />
          )}

          {/* Контент карточки */}
          <div className="p-4">
            {/* Header: Icon + Name/Description */}
            <div className="flex items-start gap-3">
              <div 
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${card.color}20`, color: card.color }}
              >
                {card.customIcon ? (
                  <img src={card.customIcon} alt="" className="w-7 h-7 object-contain" />
                ) : (
                  <div className="w-6 h-6"><IconComponent /></div>
                )}
              </div>

              <div className="flex-1 min-w-0 overflow-hidden">
                <h3 className="font-semibold text-white truncate text-sm">{card.name}</h3>
                <p className="text-xs text-dark-400 truncate">{card.description}</p>
              </div>
            </div>
            
            {/* Monitoring Stats (если включён мониторинг и нет интеграции) */}
            {isMonitoringEnabled && !integrationData && monitoringStatus?.stats?.['24h'] && (
              <div className="mt-3 pt-2 border-t border-dark-700/50">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      monStatus === 'up' ? 'bg-green-500' : 
                      monStatus === 'down' ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />
                    <span className="text-dark-400">Uptime 24h:</span>
                    <span className={`font-medium ${
                      parseFloat(monitoringStatus.stats['24h'].uptime) >= 99 ? 'text-green-400' :
                      parseFloat(monitoringStatus.stats['24h'].uptime) >= 95 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {monitoringStatus.stats['24h'].uptime}%
                    </span>
                  </div>
                  {monitoringStatus.stats['24h'].avgResponseTime && (
                    <span className="text-dark-500">
                      ~{monitoringStatus.stats['24h'].avgResponseTime}ms
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Billing info - для хостинга и провайдеров */}
            {isBillable && card.billing?.enabled && card.billing?.nextPayment && (
              <div className="mt-3 pt-2 border-t border-dark-700/50">
                <div className="flex items-center justify-between text-xs">
                  {(() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const paymentDate = new Date(card.billing.nextPayment);
                    paymentDate.setHours(0, 0, 0, 0);
                    const daysUntil = Math.ceil((paymentDate - today) / (1000 * 60 * 60 * 24));
                    
                    let statusColor = 'text-dark-400';
                    let statusText = '';
                    
                    if (daysUntil < 0) {
                      statusColor = 'text-red-400';
                      statusText = `Просрочено ${Math.abs(daysUntil)} дн.`;
                    } else if (daysUntil === 0) {
                      statusColor = 'text-red-400';
                      statusText = 'Сегодня!';
                    } else if (daysUntil <= 3) {
                      statusColor = 'text-yellow-400';
                      statusText = `${daysUntil} ${daysUntil === 1 ? 'день' : 'дня'}`;
                    } else if (daysUntil <= 7) {
                      statusColor = 'text-blue-400';
                      statusText = `${daysUntil} дней`;
                    } else {
                      statusText = `${daysUntil} дн.`;
                    }
                    
                    return (
                      <>
                        <div className="flex items-center gap-2">
                          <ClockIcon size={12} className={statusColor} />
                          <span className="text-dark-400">Оплата:</span>
                          <span className={statusColor}>{statusText}</span>
                        </div>
                        {card.billing.amount && (
                          <span className="text-dark-500">
                            {card.billing.amount} {card.billing.currency || ''}
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Integration Stats */}
            {integrationData && (
              <motion.div 
                className="mt-3 pt-2 border-t border-dark-700/50 overflow-hidden" 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }}
              >
                <IntegrationStats card={card} data={integrationData} />
              </motion.div>
            )}
          </div>
        </div>
      </div>
  );
}

// ============ Sortable Service Card Wrapper ============
function SortableServiceCard({ card, onEdit, onDelete, integrationData, onShowDetail, monitoringStatus }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <ServiceCard
        card={card}
        onEdit={onEdit}
        onDelete={onDelete}
        integrationData={integrationData}
        onShowDetail={onShowDetail}
        monitoringStatus={monitoringStatus}
        dragHandleProps={listeners}
        isDragging={isDragging}
      />
    </div>
  );
}

// ============ Card Editor Modal with Auto-Discovery ============
function CardEditor({ card, categories, integrationTemplates, onSave, onClose, saveStatus, lang }) {
  // Local translation function
  const t = (key) => translations[lang]?.[key] || translations['ru']?.[key] || key;
  const [formData, setFormData] = useState(() => {
    // Инициализируем formData из card или дефолтные значения
    if (card) {
      return { 
        ...card, 
        monitoring: card.monitoring || { enabled: false },
        billing: card.billing || { enabled: false }
      };
    }
    return {
      name: '', description: '', url: '', icon: 'server',
      category: categories[0]?.id || 'services', color: '#3b82f6', 
      integration: null, monitoring: { enabled: false },
      billing: { enabled: false }
    };
  });
  const [activeTab, setActiveTab] = useState(() => window.innerWidth < 768 ? null : 'general');
  const [showPassword, setShowPassword] = useState({});
  const [loadingIntegration, setLoadingIntegration] = useState(false);
  const [sshKeys, setSshKeys] = useState([]);
  const [hostKeys, setHostKeys] = useState({ found: false, keys: [] });
  const [deletingKeys, setDeletingKeys] = useState(false);
  
  // Discovery state
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryResults, setDiscoveryResults] = useState(null);
  const [discoveryError, setDiscoveryError] = useState(null);
  const [sshSetupLoading, setSshSetupLoading] = useState(false);
  const [sshSetupResult, setSshSetupResult] = useState(null);
  const [fetchingFavicon, setFetchingFavicon] = useState(false);
  const [faviconError, setFaviconError] = useState(null);

  // Fetch favicon from URL
  const handleFetchFavicon = async () => {
    if (!formData.url) return;
    setFetchingFavicon(true);
    setFaviconError(null);
    try {
      const res = await api.post('/api/icons/fetch-favicon', { url: formData.url });
      if (res.success) {
        setFormData(prev => ({ ...prev, customIcon: res.path }));
      } else {
        setFaviconError(res.error || 'Не удалось получить иконку');
      }
    } catch (err) {
      console.error('Failed to fetch favicon:', err);
      setFaviconError('Не удалось получить иконку с сайта');
    } finally {
      setFetchingFavicon(false);
    }
  };

  // Ref для отслеживания где начался клик
  const overlayRef = useRef(null);
  const mouseDownTarget = useRef(null);

  // Load SSH keys when SSH integration is selected
  useEffect(() => {
    if (formData.integration?.type === 'ssh') {
      fetch('/api/ssh/keys')
        .then(res => res.json())
        .then(keys => setSshKeys(keys || []))
        .catch(err => console.error('Failed to load SSH keys:', err));
    }
  }, [formData.integration?.type]);

  // Check for existing keys when host changes
  useEffect(() => {
    const host = formData.integration?.host;
    if (formData.integration?.type === 'ssh' && host) {
      fetch(`/api/ssh/keys/host/${encodeURIComponent(host)}`)
        .then(res => res.json())
        .then(data => setHostKeys(data))
        .catch(() => setHostKeys({ found: false, keys: [] }));
    } else {
      setHostKeys({ found: false, keys: [] });
    }
  }, [formData.integration?.type, formData.integration?.host]);

  // Delete all keys for host
  const handleDeleteHostKeys = async () => {
    const host = formData.integration?.host;
    if (!host) return;
    
    setDeletingKeys(true);
    try {
      await fetch(`/api/ssh/keys/host/${encodeURIComponent(host)}`, { method: 'DELETE' });
      setHostKeys({ found: false, keys: [] });
      // Clear privateKey in form if it was one of deleted keys
      setFormData(prev => ({
        ...prev,
        integration: { ...prev.integration, privateKey: '' }
      }));
      // Reload SSH keys list
      const keysRes = await fetch('/api/ssh/keys');
      setSshKeys(await keysRes.json() || []);
      setSshSetupResult({ success: true, message: 'Ключи удалены. Теперь можно создать новый.' });
    } catch (err) {
      setSshSetupResult({ success: false, error: 'Ошибка удаления ключей' });
    } finally {
      setDeletingKeys(false);
    }
  };

  // SSH Auto-setup function
  const handleSSHSetup = async () => {
    const { host, port, username, password } = formData.integration || {};
    
    if (!host || !username || !password) {
      setSshSetupResult({ success: false, error: 'Заполните host, username и password' });
      return;
    }

    setSshSetupLoading(true);
    setSshSetupResult(null);

    try {
      const res = await fetch('/api/ssh/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, port: port || 22, username, password })
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Update form with new key and clear password
        setFormData(prev => ({
          ...prev,
          integration: {
            ...prev.integration,
            privateKey: data.keyName,
            password: '' // Clear password - now using key
          }
        }));
        // Reload SSH keys list
        fetch('/api/ssh/keys')
          .then(res => res.json())
          .then(keys => setSshKeys(keys || []));
        
        setSshSetupResult({ success: true, message: data.message });
      } else {
        setSshSetupResult({ success: false, error: data.error });
      }
    } catch (err) {
      setSshSetupResult({ success: false, error: err.message });
    } finally {
      setSshSetupLoading(false);
    }
  };

  // Load full integration data when editing existing card
  useEffect(() => {
    if (card?.id && card?.integration?.type) {
      console.log('[CardEditor] Loading integration for card:', card.id);
      setLoadingIntegration(true);
      fetch(`/api/cards/${card.id}/integration`)
        .then(res => res.json())
        .then(data => {
          console.log('[CardEditor] Loaded integration data:', data);
          if (data && data.type) {
            setFormData(prev => ({ ...prev, integration: data }));
          }
        })
        .catch(err => console.error('[CardEditor] Failed to load integration data:', err))
        .finally(() => setLoadingIntegration(false));
    }
  }, [card?.id]);

  const colors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f97316', '#ec4899', '#ef4444', '#f59e0b', '#84cc16', '#6366f1'];
  const icons = Object.keys(serviceIcons).filter(i => i !== 'default');
  const selectedTemplate = integrationTemplates.find(t => t.type === formData.integration?.type);

  // Правильное закрытие модала - только если клик начался И закончился на overlay
  const handleOverlayMouseDown = (e) => {
    mouseDownTarget.current = e.target;
  };

  const handleOverlayMouseUp = (e) => {
    // Закрываем только если mousedown и mouseup были на самом overlay (не на модале)
    if (mouseDownTarget.current === overlayRef.current && e.target === overlayRef.current) {
      onClose();
    }
    mouseDownTarget.current = null;
  };

  // URL Availability Check
  const handleCheckAvailability = async () => {
    if (!formData.url) return;
    
    setIsDiscovering(true);
    setDiscoveryResults(null);
    setDiscoveryError(null);

    try {
      const res = await fetch('/api/check-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: formData.url })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setDiscoveryResults({ 
          available: true, 
          statusCode: data.statusCode,
          responseTime: data.responseTime
        });
      } else {
        setDiscoveryError(data.error || 'Сервис недоступен');
      }
    } catch (err) {
      setDiscoveryError('Ошибка проверки: ' + err.message);
    } finally {
      setIsDiscovering(false);
    }
  };

  // Сохранение
  const handleSave = (closeAfter = false) => {
    console.log('[CardEditor] Saving formData:', formData);
    onSave(formData, closeAfter);
  };

  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isBillable = formData.category === 'hosting' || formData.category === 'providers';
  const tabs = [
    { id: 'general', label: t('general'), icon: FileText },
    { id: 'integration', label: t('integration'), icon: Zap },
    { id: 'style', label: t('appearance'), icon: Palette },
    ...(isBillable ? [{ id: 'billing', label: t('billing'), icon: ClockIcon }] : []),
    { id: 'monitoring', label: t('monitoring'), icon: Activity }
  ];

  const currentTab = tabs.find(t => t.id === activeTab);

  // Мобильная версия - как в настройках
  if (isMobile) {
    return (
      <motion.div 
        key="card-editor-mobile"
        className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-dark-900"
        initial={{ opacity: 0, x: '100%' }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: '100%' }} transition={{ duration: 0.2, ease: 'easeOut' }}>
        {/* Header with safe area */}
        <header className="flex-shrink-0 bg-dark-900 border-b border-dark-800 pt-safe">
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={() => activeTab ? setActiveTab(null) : onClose()} className="p-2.5 hover:bg-dark-700 rounded-xl -ml-2 active:scale-95 transition-transform">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-lg font-semibold flex-1">
              {activeTab ? currentTab?.label : (card ? t('editCard') : t('newCard'))}
            </h1>
            {activeTab && (
              <div className="flex items-center gap-2">
                {saveStatus?.show && (
                  <span className={`text-sm ${saveStatus.success ? 'text-green-400' : 'text-red-400'}`}>
                    {saveStatus.success ? <CheckCircle2 size={16} /> : saveStatus.message}
                  </span>
                )}
                <button onClick={() => handleSave(false)} className="px-3 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-sm font-medium">
                  {t('save')}
                </button>
                <button onClick={() => handleSave(true)} className="px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium">
                  {t('done')}
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Content - scrollable */}
        <main className="flex-1 overflow-y-auto min-h-0 p-4 pb-24">
          {!activeTab ? (
            // Список секций
            <div className="space-y-2">
              {tabs.map(tab => {
                const TabIcon = tab.icon;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className="w-full flex items-center gap-4 p-4 bg-dark-800/50 hover:bg-dark-700/50 rounded-xl transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <TabIcon size={20} className="text-blue-400" />
                    </div>
                    <span className="font-medium">{tab.label}</span>
                    <ChevronDown size={20} className="ml-auto -rotate-90 text-dark-400" />
                  </button>
                );
              })}
            </div>
          ) : (
            // Содержимое секции
            <div className="space-y-4">
              {activeTab === 'general' && (
                <>
                  <div><label className="block text-sm text-dark-400 mb-2">Название</label>
                    <input type="text" className="input-field" value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Proxmox" /></div>
                  <div><label className="block text-sm text-dark-400 mb-2">Описание</label>
                    <input type="text" className="input-field" value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Виртуализация" /></div>
                  <div><label className="block text-sm text-dark-400 mb-2">URL</label>
                    <input type="url" className="input-field" value={formData.url}
                      onChange={e => setFormData({...formData, url: e.target.value})} placeholder="https://..." /></div>
                  <div><label className="block text-sm text-dark-400 mb-2">Категория</label>
                    <select className="input-field" value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value})}>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select></div>
                </>
              )}

              {activeTab === 'style' && (
                <>
                  <ColorPicker label="Цвет" value={formData.color} onChange={color => setFormData({...formData, color})} />
                  <div>
                    <label className="block text-sm text-dark-400 mb-2">Иконка</label>
                    {/* Кнопка получения favicon */}
                    {formData.url && (
                      <div className="mb-3">
                        <button
                          onClick={handleFetchFavicon}
                          disabled={fetchingFavicon}
                          className="btn btn-secondary flex items-center gap-2 text-sm"
                        >
                          {fetchingFavicon ? (
                            <motion.div className="w-4 h-4 border-2 border-dark-400/30 border-t-dark-400 rounded-full"
                              animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                          ) : (
                            <Globe size={16} />
                          )}
                          Получить favicon из URL
                        </button>
                        {faviconError && (
                          <p className="text-red-400 text-xs mt-2">{faviconError}</p>
                        )}
                      </div>
                    )}
                    {/* Custom icon если есть */}
                    {formData.customIcon && (
                      <div className="flex items-center gap-3 mb-3 p-3 bg-dark-800 rounded-xl">
                        <img src={formData.customIcon} alt="Custom icon" className="w-10 h-10 rounded-lg object-contain bg-dark-700" />
                        <div className="flex-1">
                          <div className="text-sm text-dark-300">Загруженная иконка</div>
                        </div>
                        <button
                          onClick={() => setFormData({ ...formData, icon: 'server', customIcon: null })}
                          className="p-2 hover:bg-dark-700 rounded-lg text-dark-400"
                          title="Удалить"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {icons.map(icon => {
                        const IconComp = serviceIcons[icon];
                        return (
                          <button key={icon} onClick={() => setFormData({...formData, icon, customIcon: null})}
                            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${formData.icon === icon && !formData.customIcon ? 'bg-blue-500/30 ring-2 ring-blue-500' : 'bg-dark-700 hover:bg-dark-600'}`}>
                            <div className="w-5 h-5" style={{ color: formData.color }}><IconComp /></div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'integration' && (
                <>
                  <div>
                    <label className="block text-sm text-dark-400 mb-2">Тип интеграции</label>
                    <select className="input-field" value={formData.integration?.type || ''}
                      onChange={e => {
                        const t = integrationTemplates.find(t => t.type === e.target.value);
                        setFormData({...formData, integration: t ? { type: t.type } : null });
                      }}>
                      <option value="">Без интеграции</option>
                      {integrationTemplates.map(t => <option key={t.type} value={t.type}>{t.name}</option>)}
                    </select>
                  </div>
                  {selectedTemplate && selectedTemplate.fields.map(field => (
                    <div key={field.key}>
                      <label className="block text-sm text-dark-400 mb-2">{field.label}</label>
                      {field.type === 'password' ? (
                        <div className="relative">
                          <input type={showPassword[field.key] ? 'text' : 'password'} className="input-field pr-10"
                            value={formData.integration?.[field.key] || ''}
                            onChange={e => setFormData({...formData, integration: {...formData.integration, [field.key]: e.target.value}})}
                            placeholder={field.placeholder || ''} />
                          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400"
                            onClick={() => setShowPassword({...showPassword, [field.key]: !showPassword[field.key]})}>
                            {showPassword[field.key] ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      ) : field.type === 'select' && field.key === 'privateKey' ? (
                        <select className="input-field" value={formData.integration?.[field.key] || ''}
                          onChange={e => setFormData({...formData, integration: {...formData.integration, [field.key]: e.target.value}})}>
                          <option value="">Пароль</option>
                          {sshKeys.map(key => <option key={key} value={key}>{key}</option>)}
                        </select>
                      ) : (
                        <input type={field.type || 'text'} className="input-field"
                          value={formData.integration?.[field.key] || ''}
                          onChange={e => setFormData({...formData, integration: {...formData.integration, [field.key]: e.target.value}})}
                          placeholder={field.placeholder || ''} />
                      )}
                    </div>
                  ))}
                </>
              )}

              {activeTab === 'billing' && isBillable && (
                <>
                  <div className="flex items-center justify-between py-2">
                    <span>Включить напоминания</span>
                    <Toggle 
                      checked={formData.billing?.enabled || false}
                      onChange={(v) => setFormData({...formData, billing: {...formData.billing, enabled: v}})}
                    />
                  </div>
                  {formData.billing?.enabled && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-sm text-dark-400 mb-2">Сумма</label>
                          <input type="number" className="input-field" value={formData.billing?.amount || ''}
                            onChange={e => setFormData({...formData, billing: {...formData.billing, amount: e.target.value}})} /></div>
                        <div><label className="block text-sm text-dark-400 mb-2">Валюта</label>
                          <select className="input-field" value={formData.billing?.currency || 'RUB'}
                            onChange={e => setFormData({...formData, billing: {...formData.billing, currency: e.target.value}})}>
                            <option value="RUB">RUB</option><option value="USD">USD</option><option value="EUR">EUR</option>
                          </select></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-sm text-dark-400 mb-2">Дата</label>
                          <input type="date" className="input-field" value={formData.billing?.nextPayment || ''}
                            onChange={e => setFormData({...formData, billing: {...formData.billing, nextPayment: e.target.value}})} /></div>
                        <div><label className="block text-sm text-dark-400 mb-2">Период</label>
                          <select className="input-field" value={formData.billing?.period || 'monthly'}
                            onChange={e => setFormData({...formData, billing: {...formData.billing, period: e.target.value}})}>
                            <option value="monthly">Ежемесячно</option><option value="quarterly">Ежеквартально</option>
                            <option value="yearly">Ежегодно</option><option value="once">Разово</option>
                          </select></div>
                      </div>
                      <div><label className="block text-sm text-dark-400 mb-2">Ссылка для оплаты</label>
                        <input type="url" className="input-field" value={formData.billing?.paymentUrl || ''}
                          onChange={e => setFormData({...formData, billing: {...formData.billing, paymentUrl: e.target.value}})}
                          placeholder="https://..." /></div>
                    </>
                  )}
                </>
              )}

              {activeTab === 'monitoring' && (
                <>
                  <div className="flex items-center justify-between py-2">
                    <span>Мониторинг статуса</span>
                    <Toggle 
                      checked={formData.monitoring?.enabled || false}
                      onChange={(v) => setFormData({...formData, monitoring: {...formData.monitoring, enabled: v}})}
                    />
                  </div>
                  {formData.monitoring?.enabled && (
                    <p className="text-sm text-dark-400">Сервис будет проверяться на доступность каждые N секунд (настройки в разделе Мониторинг)</p>
                  )}
                </>
              )}
            </div>
          )}
        </main>
      </motion.div>
    );
  }

  // Desktop version
  return (
    <motion.div 
      ref={overlayRef}
      className="fixed inset-0 modal-overlay flex items-start justify-center z-50 p-4 py-8 overflow-y-auto"
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      onMouseDown={handleOverlayMouseDown}
      onMouseUp={handleOverlayMouseUp}
    >
      <motion.div 
        className="glass-card w-full max-w-4xl my-auto"
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        exit={{ scale: 0.9, opacity: 0 }}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">{card ? 'Редактировать карточку' : 'Новая карточка'}</h2>
            <button onClick={onClose} className="p-2 hover:bg-dark-700 rounded-lg transition-colors"><X size={20} /></button>
          </div>

          <div className="flex gap-6">
            {/* Вертикальные табы слева */}
            <div className="flex flex-col gap-1 min-w-[140px] border-r border-dark-700 pr-4">
              {tabs.map(tab => {
                const TabIcon = tab.icon;
                return (
                  <button key={tab.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                      activeTab === tab.id 
                        ? 'bg-blue-500/20 text-blue-400' 
                        : 'hover:bg-dark-700 text-dark-300'
                    }`}
                    onClick={() => setActiveTab(tab.id)}>
                    <TabIcon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Контент справа */}
            <div className="flex-1 min-w-0 min-h-[350px] max-h-[60vh] overflow-y-auto overflow-x-hidden pr-4">
              <AnimatePresence mode="wait">
              {activeTab === 'general' && (
                <motion.div
                  key="general"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                >
                <div className="space-y-4">
                  <div><label className="block text-sm text-dark-400 mb-2">Название</label>
                    <input type="text" className="input-field" value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Proxmox" /></div>
                  <div><label className="block text-sm text-dark-400 mb-2">Описание</label>
                    <input type="text" className="input-field" value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Виртуализация" /></div>
                  
                  {/* URL with Availability Check button */}
                  <div>
                    <label className="block text-sm text-dark-400 mb-2">URL</label>
                    <div className="flex gap-2">
                      <input type="url" className="input-field flex-1" value={formData.url}
                        onChange={e => { setFormData({...formData, url: e.target.value}); setDiscoveryResults(null); setDiscoveryError(null); }}
                        placeholder="https://proxmox.local:8006" />
                      <button
                        onClick={handleCheckAvailability}
                        disabled={!formData.url || isDiscovering}
                        className="btn btn-secondary flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                        title="Проверить доступность"
                      >
                        {isDiscovering ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                            <RefreshCw size={16} />
                          </motion.div>
                        ) : (
                          <Wifi size={16} />
                        )}
                        <span className="hidden sm:inline">{isDiscovering ? 'Проверка...' : 'Проверить'}</span>
                      </button>
                    </div>
              </div>

              {/* Availability Results */}
              <AnimatePresence>
                {discoveryResults?.available && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl"
                  >
                    <div className="flex items-center gap-2 text-green-400">
                      <Check size={16} />
                      <span className="text-sm">Сервис доступен (HTTP {discoveryResults.statusCode}, {discoveryResults.responseTime}ms)</span>
                    </div>
                  </motion.div>
                )}

                {discoveryError && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle size={16} />
                      <span>{discoveryError}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div><label className="block text-sm text-dark-400 mb-2">Категория</label>
                <select className="input-field" value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}>
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select></div>
            </div>
                </motion.div>
          )}

          {activeTab === 'style' && (
            <motion.div
              key="style"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
            <div className="space-y-4 pl-1">
              <div><label className="block text-sm text-dark-400 mb-2">Цвет</label>
                <div className="flex flex-wrap gap-2 pr-2">
                  {colors.map(color => (
                    <button key={color}
                      className={`w-9 h-9 rounded-xl transition-transform hover:scale-110 flex-shrink-0 ${formData.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-800' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({...formData, color})} />
                  ))}
                </div></div>
              <div><label className="block text-sm text-dark-400 mb-2">Иконка</label>
                {/* Кнопка получения favicon */}
                {formData.url && (
                  <div className="mb-3">
                    <button
                      onClick={handleFetchFavicon}
                      disabled={fetchingFavicon}
                      className="btn btn-secondary flex items-center gap-2 text-sm"
                    >
                      {fetchingFavicon ? (
                        <motion.div className="w-4 h-4 border-2 border-dark-400/30 border-t-dark-400 rounded-full"
                          animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                      ) : (
                        <Globe size={16} />
                      )}
                      Получить favicon из URL
                    </button>
                    {faviconError && (
                      <p className="text-red-400 text-xs mt-2">{faviconError}</p>
                    )}
                  </div>
                )}
                
                {/* Custom icon если есть */}
                {formData.customIcon && (
                  <div className="flex items-center gap-3 mb-3 p-3 bg-dark-800 rounded-xl">
                    <img src={formData.customIcon} alt="Custom icon" className="w-10 h-10 rounded-lg object-contain bg-dark-700" />
                    <div className="flex-1">
                      <div className="text-sm text-dark-300">Загруженная иконка</div>
                      <div className="text-xs text-dark-500">{formData.customIcon}</div>
                    </div>
                    <button
                      onClick={() => setFormData({ ...formData, icon: 'server', customIcon: null })}
                      className="p-2 hover:bg-dark-700 rounded-lg text-dark-400"
                      title="Удалить"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2">
                  {icons.map(icon => {
                    const IconComp = serviceIcons[icon];
                    return (
                      <button key={icon}
                        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all hover:bg-dark-700 flex-shrink-0 ${formData.icon === icon && !formData.customIcon ? 'bg-blue-500/20 ring-1 ring-blue-500' : 'bg-dark-800'}`}
                        onClick={() => setFormData({...formData, icon, customIcon: null})} style={{ color: formData.color }} title={icon}>
                        <div className="w-5 h-5"><IconComp /></div>
                      </button>
                    );
                  })}
                </div></div>
            </div>
            </motion.div>
          )}

          {activeTab === 'integration' && (
            <motion.div
              key="integration"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
            <div className="space-y-4">
              {loadingIntegration && (
                <div className="flex items-center justify-center py-4">
                  <motion.div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full"
                    animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                  <span className="ml-2 text-dark-400 text-sm">Загрузка данных...</span>
                </div>
              )}
              
              <div><label className="block text-sm text-dark-400 mb-2">Тип интеграции</label>
                <select className="input-field" value={formData.integration?.type || ''} disabled={loadingIntegration}
                  onChange={e => {
                    const template = integrationTemplates.find(t => t.type === e.target.value);
                    setFormData({...formData, integration: e.target.value ? { type: e.target.value, ...template?.defaultConfig } : null});
                  }}>
                  <option value="">Без интеграции</option>
                  {integrationTemplates.map(t => <option key={t.type} value={t.type}>{t.name}</option>)}
                </select></div>

              {selectedTemplate?.fields.map(field => (
                <div key={field.key}>
                  <label className="block text-sm text-dark-400 mb-2">{field.label}</label>
                  {field.options === 'ssh_keys' ? (
                    // SSH Key selector
                    <div className="space-y-2">
                      <select 
                        className="input-field"
                        value={formData.integration?.[field.key] || ''}
                        onChange={e => setFormData({...formData, integration: { ...formData.integration, [field.key]: e.target.value }})}
                        disabled={loadingIntegration}>
                        <option value="">Выберите ключ или введите вручную</option>
                        {sshKeys.map(key => (
                          <option key={key.name} value={key.name}>{key.name}</option>
                        ))}
                      </select>
                      <div className="text-xs text-dark-500">или вставьте ключ напрямую:</div>
                      <textarea
                        className="input-field text-xs font-mono h-24 resize-none"
                        value={formData.integration?.[field.key]?.startsWith('-----') ? formData.integration[field.key] : ''}
                        onChange={e => setFormData({...formData, integration: { ...formData.integration, [field.key]: e.target.value }})}
                        placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                        disabled={loadingIntegration}
                      />
                    </div>
                  ) : field.type === 'textarea' ? (
                    // Textarea field
                    <textarea
                      className="input-field h-24 resize-none"
                      value={formData.integration?.[field.key] || ''}
                      onChange={e => setFormData({...formData, integration: { ...formData.integration, [field.key]: e.target.value }})}
                      placeholder={field.placeholder}
                      disabled={loadingIntegration}
                    />
                  ) : (
                    <div className="relative">
                      <input type={field.type === 'password' && !showPassword[field.key] ? 'password' : 'text'}
                        className="input-field pr-10" value={formData.integration?.[field.key] || ''}
                        onChange={e => setFormData({...formData, integration: { ...formData.integration, [field.key]: e.target.value }})}
                        placeholder={field.placeholder} disabled={loadingIntegration} />
                      {field.type === 'password' && (
                        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200"
                          onClick={() => setShowPassword(prev => ({ ...prev, [field.key]: !prev[field.key] }))}>
                          {showPassword[field.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      )}
                    </div>
                  )}
                  {field.hint && <p className="text-xs text-dark-500 mt-1">{field.hint}</p>}
                </div>
              ))}

              {/* SSH Auto-setup button */}
              {formData.integration?.type === 'ssh' && (
                <div className="space-y-3">
                  {/* Existing keys for this host */}
                  {hostKeys.found && hostKeys.keys.length > 0 && (
                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-blue-400 flex items-center gap-2">
                            <Key size={16} />
                            Найден существующий ключ
                          </h4>
                          <p className="text-xs text-dark-400 mt-1">
                            {hostKeys.keys[0]}
                          </p>
                        </div>
                        <button
                          onClick={handleDeleteHostKeys}
                          disabled={deletingKeys}
                          className="btn btn-danger flex items-center gap-2 text-sm"
                        >
                          {deletingKeys ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                              <RefreshCw size={14} />
                            </motion.div>
                          ) : (
                            <Trash2 size={14} />
                          )}
                          Удалить
                        </button>
                      </div>
                      <p className="text-xs text-dark-500 mt-2">
                        Если подключение не работает — удалите ключ и создайте новый
                      </p>
                    </div>
                  )}
                  
                  {/* Auto-setup block */}
                  <div className="p-4 bg-dark-800/50 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium flex items-center gap-2">
                          <Zap size={16} className="text-yellow-400" />
                          Автонастройка
                        </h4>
                        <p className="text-xs text-dark-500 mt-1">
                          {hostKeys.found 
                            ? 'Удалите существующий ключ или используйте его' 
                            : 'Введите пароль и нажмите — ключ создастся автоматически'}
                        </p>
                      </div>
                      <button
                        onClick={handleSSHSetup}
                        disabled={sshSetupLoading || !formData.integration?.host || !formData.integration?.username || !formData.integration?.password}
                        className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
                      >
                        {sshSetupLoading ? (
                          <>
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                              <RefreshCw size={16} />
                            </motion.div>
                            Настройка...
                          </>
                        ) : (
                          <>
                            <Key size={16} />
                            {hostKeys.found ? 'Пересоздать' : 'Настроить'}
                          </>
                        )}
                      </button>
                    </div>
                    
                    {sshSetupResult && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-3 rounded-lg text-sm ${sshSetupResult.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                      >
                        {sshSetupResult.success ? (
                          <div className="flex items-center gap-2">
                            <Check size={16} />
                            {sshSetupResult.message}
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-2">
                              <AlertCircle size={16} />
                              {sshSetupResult.error}
                            </div>
                            {sshSetupResult.error?.includes('authentication') && hostKeys.found && (
                              <p className="text-xs text-dark-400 mt-2">
                                Попробуйте удалить существующий ключ и создать новый
                              </p>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                </div>
              )}

              {!formData.integration?.type && (
                <div className="text-dark-500 text-sm p-4 bg-dark-800/50 rounded-xl">
                  <p className="mb-2">Интеграции позволяют отображать метрики сервиса прямо на карточке.</p>
                  <p>Выберите готовый шаблон или создайте свой в настройках.</p>
                </div>
              )}
            </div>
            </motion.div>
          )}

          {activeTab === 'billing' && (
            <motion.div
              key="billing"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-dark-800/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    formData.billing?.enabled ? 'bg-purple-500/20 text-purple-400' : 'bg-dark-700 text-dark-400'
                  }`}>
                    <ClockIcon size={20} />
                  </div>
                  <div>
                    <div className="font-medium">Напоминание об оплате</div>
                    <div className="text-sm text-dark-400">
                      {formData.billing?.enabled ? 'Активно' : 'Отключено'}
                    </div>
                  </div>
                </div>
                <Toggle 
                  checked={formData.billing?.enabled || false}
                  onChange={(v) => setFormData({...formData, billing: {...formData.billing, enabled: v}})}
                />
              </div>

              {formData.billing?.enabled && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-dark-400 mb-2">Дата платежа</label>
                      <input
                        type="date"
                        className="input-field"
                        value={formData.billing?.nextPayment || ''}
                        onChange={e => setFormData({
                          ...formData,
                          billing: { ...formData.billing, nextPayment: e.target.value }
                        })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-dark-400 mb-2">Повтор</label>
                      <select
                        className="input-field"
                        value={formData.billing?.period || 'monthly'}
                        onChange={e => setFormData({
                          ...formData,
                          billing: { ...formData.billing, period: e.target.value }
                        })}
                      >
                        <option value="monthly">Ежемесячно</option>
                        <option value="quarterly">Ежеквартально</option>
                        <option value="yearly">Ежегодно</option>
                        <option value="once">Разовый</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-dark-400 mb-2">Сумма</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input-field"
                        value={formData.billing?.amount || ''}
                        onChange={e => setFormData({
                          ...formData,
                          billing: { ...formData.billing, amount: e.target.value }
                        })}
                        placeholder="10.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-dark-400 mb-2">Валюта</label>
                      <input
                        type="text"
                        className="input-field"
                        value={formData.billing?.currency || ''}
                        onChange={e => setFormData({
                          ...formData,
                          billing: { ...formData.billing, currency: e.target.value }
                        })}
                        placeholder="EUR, USD, RUB..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-dark-400 mb-2">Напомнить за (дней)</label>
                    <div className="flex flex-wrap gap-2">
                      {[1, 3, 7, 14, 30].map(days => (
                        <button
                          key={days}
                          onClick={() => {
                            const current = formData.billing?.remindDays || [];
                            const newDays = current.includes(days) 
                              ? current.filter(d => d !== days)
                              : [...current, days].sort((a,b) => a-b);
                            setFormData({
                              ...formData,
                              billing: { ...formData.billing, remindDays: newDays }
                            });
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            (formData.billing?.remindDays || []).includes(days)
                              ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500'
                              : 'bg-dark-800 hover:bg-dark-700'
                          }`}
                        >
                          {days} {days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-dark-500 mt-2">Уведомления отправляются в Telegram (настройки в Мониторинге)</p>
                  </div>

                  <div>
                    <label className="block text-sm text-dark-400 mb-2">Заметка</label>
                    <input
                      type="text"
                      className="input-field"
                      value={formData.billing?.note || ''}
                      onChange={e => setFormData({
                        ...formData,
                        billing: { ...formData.billing, note: e.target.value }
                      })}
                      placeholder="Аккаунт, тариф, комментарий..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-dark-400 mb-2">Ссылка для оплаты</label>
                    <input
                      type="url"
                      className="input-field"
                      value={formData.billing?.paymentUrl || ''}
                      onChange={e => setFormData({
                        ...formData,
                        billing: { ...formData.billing, paymentUrl: e.target.value }
                      })}
                      placeholder="https://billing.example.com/pay"
                    />
                    <p className="text-xs text-dark-500 mt-1">Ссылка для перехода к оплате из раздела платежей</p>
                  </div>
                </div>
              )}
            </div>
            </motion.div>
          )}

          {activeTab === 'monitoring' && (
            <motion.div
              key="monitoring"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-dark-800/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    formData.monitoring?.enabled ? 'bg-green-500/20 text-green-400' : 'bg-dark-700 text-dark-400'
                  }`}>
                    {formData.monitoring?.enabled ? <Radio size={20} /> : <Signal size={20} />}
                  </div>
                  <div>
                    <div className="font-medium">Мониторинг доступности</div>
                    <div className="text-sm text-dark-400">
                      {formData.monitoring?.enabled ? 'Проверка каждые 60 сек' : 'Отключён'}
                    </div>
                  </div>
                </div>
                <Toggle 
                  checked={formData.monitoring?.enabled || false}
                  onChange={(v) => setFormData({...formData, monitoring: {...formData.monitoring, enabled: v}})}
                />
              </div>

              {/* Проверяем наличие цели для мониторинга (URL или SSH) */}
              {(() => {
                const hasUrl = Boolean(formData.url);
                const hasSSH = formData.integration?.type === 'ssh' && formData.integration?.host;
                const hasTarget = hasUrl || hasSSH;
                const isSSH = formData.integration?.type === 'ssh';

                return (
                  <>
                    {!hasTarget && (
                      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                        <div className="flex items-center gap-2 text-yellow-400">
                          <AlertCircle size={16} />
                          <span className="text-sm">
                            {isSSH 
                              ? 'Для мониторинга необходимо указать хост SSH' 
                              : 'Для мониторинга необходимо указать URL сервиса'}
                          </span>
                        </div>
                      </div>
                    )}

                    {formData.monitoring?.enabled && hasTarget && (
                      <div className="space-y-3">
                        <div className="p-4 bg-dark-800/50 rounded-xl">
                          <div className="flex items-center gap-2 text-dark-400 text-sm mb-3">
                            <Bell size={14} />
                            <span>Уведомления настраиваются глобально в Настройках → Мониторинг</span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <Check size={14} className="text-green-400" />
                              <span>{isSSH ? 'SSH подключение' : 'HTTP/HTTPS проверка'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Check size={14} className="text-green-400" />
                              <span>История 7 дней</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Check size={14} className="text-green-400" />
                              <span>Статистика uptime</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Check size={14} className="text-green-400" />
                              <span>Telegram алерты</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            </motion.div>
          )}
              </AnimatePresence>
            </div> {/* Конец контента справа */}
          </div> {/* Конец flex gap-6 */}

          <div className="flex items-center justify-between mt-6 pt-6 border-t border-dark-700">
            <div className="flex items-center gap-2">
              {saveStatus?.show && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                    saveStatus.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {saveStatus.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {saveStatus.message}
                </motion.div>
              )}
            </div>
            <div className="flex gap-3">
              <button className="btn btn-secondary" onClick={onClose}>{t('cancel')}</button>
              <button className="btn btn-secondary flex items-center gap-2" onClick={() => handleSave(false)}>
                <Save size={16} />{t('save')}</button>
              <button className="btn btn-primary flex items-center gap-2" onClick={() => handleSave(true)}>
                <Check size={16} />{t('saveAndClose')}</button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============ Category Editor Modal ============
function CategoryEditor({ category, onSave, onDelete, onClose }) {
  const [formData, setFormData] = useState(category || { name: '', icon: 'folder' });
  const icons = Object.keys(categoryIcons);
  
  // Ref для отслеживания где начался клик
  const overlayRef = useRef(null);
  const mouseDownTarget = useRef(null);

  const handleOverlayMouseDown = (e) => {
    mouseDownTarget.current = e.target;
  };

  const handleOverlayMouseUp = (e) => {
    if (mouseDownTarget.current === overlayRef.current && e.target === overlayRef.current) {
      onClose();
    }
    mouseDownTarget.current = null;
  };

  return (
    <motion.div 
      ref={overlayRef}
      className="fixed inset-0 modal-overlay flex items-start justify-center z-50 p-4 py-8 overflow-y-auto"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
      onMouseDown={handleOverlayMouseDown}
      onMouseUp={handleOverlayMouseUp}
    >
      <motion.div className="glass-card w-full max-w-md my-auto"
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">{category ? 'Редактировать категорию' : 'Новая категория'}</h2>
            <button onClick={onClose} className="p-2 hover:bg-dark-700 rounded-lg transition-colors"><X size={20} /></button>
          </div>

          <div className="space-y-4">
            <div><label className="block text-sm text-dark-400 mb-2">Название</label>
              <input type="text" className="input-field" value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Мои сервисы" /></div>
            <div><label className="block text-sm text-dark-400 mb-2">Иконка</label>
              <div className="flex flex-wrap gap-2">
                {icons.map(icon => {
                  const IconComp = categoryIcons[icon];
                  return (
                    <button key={icon}
                      className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all hover:bg-dark-700 ${formData.icon === icon ? 'bg-blue-500/20 ring-1 ring-blue-500' : 'bg-dark-800'}`}
                      onClick={() => setFormData({...formData, icon})} title={icon}>
                      <IconComp size={20} />
                    </button>
                  );
                })}
              </div></div>
          </div>

          <div className="flex justify-between gap-3 mt-6 pt-6 border-t border-dark-700">
            <div>{category && (
              <button className="btn btn-danger flex items-center gap-2" onClick={() => onDelete(category.id)}>
                <Trash2 size={16} />Удалить</button>
            )}</div>
            <div className="flex gap-3">
              <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
              <button className="btn btn-primary flex items-center gap-2" onClick={() => onSave(formData)}>
                <Save size={16} />Сохранить</button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============ Integration Template Editor ============
function IntegrationTemplateEditor({ template, onSave, onDelete, onClose }) {
  const [formData, setFormData] = useState(template || {
    type: '', name: '', endpoint: '', method: 'GET', authType: 'none', fields: [], responseMapping: ''
  });
  const [newField, setNewField] = useState({ key: '', label: '', type: 'text', placeholder: '' });

  // Ref для отслеживания где начался клик
  const overlayRef = useRef(null);
  const mouseDownTarget = useRef(null);

  const handleOverlayMouseDown = (e) => {
    mouseDownTarget.current = e.target;
  };

  const handleOverlayMouseUp = (e) => {
    if (mouseDownTarget.current === overlayRef.current && e.target === overlayRef.current) {
      onClose();
    }
    mouseDownTarget.current = null;
  };

  const addField = () => {
    if (newField.key && newField.label) {
      setFormData({...formData, fields: [...formData.fields, { ...newField }]});
      setNewField({ key: '', label: '', type: 'text', placeholder: '' });
    }
  };

  return (
    <motion.div 
      ref={overlayRef}
      className="fixed inset-0 modal-overlay flex items-start justify-center z-[400] p-4 py-8 overflow-y-auto"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
      onMouseDown={handleOverlayMouseDown}
      onMouseUp={handleOverlayMouseUp}
    >
      <motion.div className="glass-card w-full max-w-2xl my-auto mb-24"
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">{template ? 'Редактировать интеграцию' : 'Новый шаблон интеграции'}</h2>
            <button onClick={onClose} className="p-2 hover:bg-dark-700 rounded-lg transition-colors"><X size={20} /></button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm text-dark-400 mb-2">ID (латиница)</label>
                <input type="text" className="input-field" value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})}
                  placeholder="my-service" disabled={!!template} /></div>
              <div><label className="block text-sm text-dark-400 mb-2">Название</label>
                <input type="text" className="input-field" value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Мой сервис" /></div>
            </div>

            <div><label className="block text-sm text-dark-400 mb-2">API Endpoint</label>
              <input type="text" className="input-field" value={formData.endpoint}
                onChange={e => setFormData({...formData, endpoint: e.target.value})}
                placeholder="/api/status или полный URL" />
              <p className="text-xs text-dark-500 mt-1">Используйте {'{{host}}'} для подстановки хоста из настроек карточки</p></div>

            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm text-dark-400 mb-2">Метод</label>
                <select className="input-field" value={formData.method}
                  onChange={e => setFormData({...formData, method: e.target.value})}>
                  <option value="GET">GET</option><option value="POST">POST</option>
                </select></div>
              <div><label className="block text-sm text-dark-400 mb-2">Авторизация</label>
                <select className="input-field" value={formData.authType}
                  onChange={e => setFormData({...formData, authType: e.target.value})}>
                  <option value="none">Без авторизации</option>
                  <option value="basic">Basic Auth</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="apikey">API Key (header)</option>
                </select></div>
            </div>

            <div><label className="block text-sm text-dark-400 mb-2">Поля конфигурации</label>
              <div className="space-y-2 mb-3">
                {formData.fields.map((field, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-dark-800 p-2 rounded-lg">
                    <span className="text-dark-300 flex-1">{field.label}</span>
                    <span className="text-dark-500 text-sm">{field.key}</span>
                    <span className="text-dark-500 text-sm">{field.type}</span>
                    <button className="p-1 hover:bg-dark-700 rounded"
                      onClick={() => setFormData({...formData, fields: formData.fields.filter((_, i) => i !== idx)})}>
                      <X size={14} className="text-red-400" /></button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                <input type="text" className="input-field" value={newField.key}
                  onChange={e => setNewField({...newField, key: e.target.value})} placeholder="key" />
                <input type="text" className="input-field" value={newField.label}
                  onChange={e => setNewField({...newField, label: e.target.value})} placeholder="Label" />
                <select className="input-field" value={newField.type}
                  onChange={e => setNewField({...newField, type: e.target.value})}>
                  <option value="text">Text</option><option value="password">Password</option><option value="url">URL</option>
                </select>
                <button className="btn btn-secondary" onClick={addField}><Plus size={16} /></button>
              </div></div>

            <div><label className="block text-sm text-dark-400 mb-2">Маппинг ответа (JS)</label>
              <textarea className="input-field font-mono text-sm h-24" value={formData.responseMapping}
                onChange={e => setFormData({...formData, responseMapping: e.target.value})}
                placeholder={`// data - ответ API\nreturn {\n  configured: true,\n  display: data.status\n}`} /></div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-3 mt-6 pt-6 border-t border-dark-700">
            {template ? (
              <button className="btn btn-danger flex items-center justify-center gap-2 order-2 sm:order-1" onClick={() => onDelete(template.type)}>
                <Trash2 size={16} />Удалить</button>
            ) : <div className="hidden sm:block" />}
            <div className="flex gap-2 order-1 sm:order-2">
              <button className="btn btn-secondary flex-1 sm:flex-none" onClick={onClose}>Отмена</button>
              <button className="btn btn-primary flex-1 sm:flex-none flex items-center justify-center gap-2" onClick={() => onSave(formData)}>
                <Save size={16} />Сохранить</button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============ System Info Component ============
function SystemInfoSection() {
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInfo = async () => {
      try {
        const [version, docker, monitoring] = await Promise.all([
          api.get('/api/system/version').catch(() => null),
          api.get('/api/system/docker').catch(() => ({ available: false })),
          api.get('/api/monitoring/status').catch(() => ({}))
        ]);
        
        const monitoredCount = Object.keys(monitoring).length;
        const upCount = Object.values(monitoring).filter(m => m.status === 'up').length;
        
        setSystemInfo({
          version: version?.version || 'N/A',
          isProduction: version?.isProduction || false,
          docker,
          monitoring: { total: monitoredCount, up: upCount }
        });
      } catch (err) {
        console.error('Failed to load system info:', err);
      } finally {
        setLoading(false);
      }
    };
    loadInfo();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <motion.div 
          className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Version Info */}
      <div className="p-4 bg-dark-800 rounded-xl">
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <Server size={18} className="text-blue-400" />
          HomeDash
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-dark-700/50 rounded-lg">
            <div className="text-xs text-dark-400 mb-1">Версия</div>
            <div className="text-lg font-semibold text-blue-400">v{systemInfo?.version}</div>
          </div>
          <div className="p-3 bg-dark-700/50 rounded-lg">
            <div className="text-xs text-dark-400 mb-1">Режим</div>
            <div className="text-lg font-semibold">
              {systemInfo?.isProduction ? (
                <span className="text-green-400">Production</span>
              ) : (
                <span className="text-yellow-400">Development</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Docker Info */}
      <div className="p-4 bg-dark-800 rounded-xl">
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <Container size={18} className="text-purple-400" />
          Docker
        </h3>
        {systemInfo?.docker?.available ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-dark-400">Статус</span>
              <span className="text-green-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                {systemInfo.docker.containerState}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-dark-400">Контейнер</span>
              <span className="text-dark-300">{systemInfo.docker.containerName?.replace('/', '')}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-dark-400">ID</span>
              <span className="text-dark-500 font-mono text-xs">{systemInfo.docker.containerId}</span>
            </div>
          </div>
        ) : (
          <div className="text-dark-400 text-sm">
            Docker socket не подключен
          </div>
        )}
      </div>

      {/* Monitoring Stats */}
      <div className="p-4 bg-dark-800 rounded-xl">
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <Activity size={18} className="text-green-400" />
          Мониторинг
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-dark-700/50 rounded-lg">
            <div className="text-xs text-dark-400 mb-1">Сервисов</div>
            <div className="text-lg font-semibold">{systemInfo?.monitoring?.total || 0}</div>
          </div>
          <div className="p-3 bg-dark-700/50 rounded-lg">
            <div className="text-xs text-dark-400 mb-1">Online</div>
            <div className="text-lg font-semibold text-green-400">{systemInfo?.monitoring?.up || 0}</div>
          </div>
        </div>
      </div>

      {/* Update Instructions */}
      <div className="p-4 bg-dark-800 rounded-xl">
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <RefreshCw size={18} className="text-yellow-400" />
          Обновление
        </h3>
        <div className="text-sm text-dark-400 space-y-2">
          <p>Для обновления выполните команды:</p>
          <div className="p-3 bg-dark-900 rounded-lg font-mono text-xs text-dark-300 space-y-1">
            <div>cd /opt</div>
            <div>rm -rf homedash</div>
            <div>unzip homedash-vXX.zip</div>
            <div>cd homedash</div>
            <div>docker compose up -d --build</div>
          </div>
          <p className="text-dark-500 text-xs mt-2">
            Данные (карточки, настройки) сохраняются в data/ и не удаляются при обновлении.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============ PWA Notifications Manager ============
function useNotifications(enabled) {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const lastCheckRef = useRef(null);
  const shownNotificationsRef = useRef(new Set());

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') {
      return 'denied';
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch {
      return 'denied';
    }
  };

  const showNotification = (title, options = {}) => {
    if (permission !== 'granted') return;
    
    // Prevent duplicate notifications
    const notifId = `${title}-${options.tag || Date.now()}`;
    if (shownNotificationsRef.current.has(notifId)) return;
    shownNotificationsRef.current.add(notifId);
    
    // Clean old IDs after 1 hour
    setTimeout(() => shownNotificationsRef.current.delete(notifId), 3600000);

    try {
      const notification = new Notification(title, {
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        ...options
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        if (options.url) {
          window.location.href = options.url;
        }
      };

      // Auto-close after 10 seconds
      setTimeout(() => notification.close(), 10000);
    } catch (err) {
      console.error('[Notifications] Error:', err);
    }
  };

  // Check for upcoming payments
  useEffect(() => {
    if (!enabled || permission !== 'granted') return;

    const checkPayments = async () => {
      try {
        const data = await api.get('/api/notifications/pending');
        if (data?.notifications?.length > 0) {
          data.notifications.forEach(notif => {
            showNotification(notif.title, {
              body: notif.body,
              tag: notif.id,
              data: notif
            });
          });
        }
      } catch (err) {
        console.error('[Notifications] Check failed:', err);
      }
    };

    // Check immediately and then every 30 minutes
    checkPayments();
    const interval = setInterval(checkPayments, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [enabled, permission]);

  return { permission, requestPermission, showNotification };
}

// Notifications Settings Component
function NotificationsSettings({ formData, setFormData }) {
  const { permission, requestPermission } = useNotifications(false);
  const [requesting, setRequesting] = useState(false);
  const [testingTopic, setTestingTopic] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [showBotToken, setShowBotToken] = useState(false);
  const [showSummaryExample, setShowSummaryExample] = useState(false);

  // Инициализация telegram настроек
  useEffect(() => {
    if (!formData.telegram) {
      setFormData(prev => ({
        ...prev,
        telegram: {
          enabled: false,
          botToken: '',
          chatId: '',
          notifyDown: true,
          notifyDownTopicId: '',
          notifyUp: true,
          notifyUpTopicId: '',
          notifyPayments: true,
          notifyPaymentsTopicId: '',
          notifyPaymentsDays: [1, 3, 7],
          notifyTasks: true,
          notifyTasksTopicId: '',
          notifyTasksDays: [1],
          dailySummary: false,
          dailySummaryTopicId: '',
          dailySummaryTime: '09:00'
        }
      }));
    }
  }, []);

  const handleBrowserToggle = async (enabled) => {
    if (enabled && permission !== 'granted') {
      setRequesting(true);
      const result = await requestPermission();
      setRequesting(false);
      if (result !== 'granted') return;
    }
    setFormData({ ...formData, notifications: { ...formData.notifications, enabled } });
  };

  const handleTestTopic = async (topicType, topicId) => {
    if (!formData.telegram?.botToken || !formData.telegram?.chatId) {
      setTestResult({ type: topicType, success: false, error: 'Заполните Bot Token и Chat ID' });
      return;
    }

    setTestingTopic(topicType);
    setTestResult(null);

    const messages = {
      down: '🔴 <b>Тест: Сервис недоступен</b>\n\nПример уведомления о недоступности сервиса.',
      up: '✅ <b>Тест: Сервис восстановлен</b>\n\nПример уведомления о восстановлении сервиса.',
      payments: '💳 <b>Тест: Напоминание о платеже</b>\n\n<b>Пример сервиса</b>\nСумма: 500 RUB\nСрок: через 3 дня',
      tasks: '📋 <b>Тест: Напоминание о задаче</b>\n\n<b>Пример задачи</b>\nПриоритет: 🔴 Высокий\nСрок: завтра',
      summary: `📊 <b>Ежедневная сводка</b>\n${new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}\n\n🔴 <b>Недоступные сервисы:</b>\n• Proxmox VE\n\n💳 <b>Платежи (7 дней):</b>\n⚠️• Hetzner: 1500 RUB (через 2д)\n• VDS: 500 RUB (через 5д)\n\n📋 <b>Задачи (7 дней):</b>\n⚠️• Обновить сервер (через 1д)\n• Бэкап БД (через 4д)`
    };

    try {
      const res = await api.post('/api/telegram/test', {
        botToken: formData.telegram.botToken,
        chatId: formData.telegram.chatId,
        topicId: topicId || null,
        message: messages[topicType]
      });
      setTestResult({ type: topicType, ...res });
    } catch (err) {
      setTestResult({ type: topicType, success: false, error: err.message });
    } finally {
      setTestingTopic(null);
    }
  };

  const updateTelegram = (key, value) => {
    setFormData({
      ...formData,
      telegram: { ...formData.telegram, [key]: value }
    });
  };

  const isSupported = typeof Notification !== 'undefined';
  const isBrowserEnabled = formData.notifications?.enabled && permission === 'granted';

  // Кнопка теста топика
  const TestTopicButton = ({ topicType, topicId, disabled }) => (
    <button
      onClick={() => handleTestTopic(topicType, topicId)}
      disabled={disabled || testingTopic === topicType}
      className="px-2 py-1 text-xs bg-dark-600 hover:bg-dark-500 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1"
      title="Отправить тестовое сообщение"
    >
      {testingTopic === topicType ? (
        <motion.div className="w-3 h-3 border border-dark-400/30 border-t-dark-400 rounded-full"
          animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
      ) : (
        <Send size={12} />
      )}
      Тест
    </button>
  );

  const canTest = formData.telegram?.botToken && formData.telegram?.chatId;

  return (
    <div className="space-y-6">
      {/* Браузерные уведомления */}
      <div className="p-4 bg-dark-800/50 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isBrowserEnabled ? 'bg-purple-500/20 text-purple-400' : 'bg-dark-700 text-dark-400'
            }`}>
              <Bell size={20} />
            </div>
            <div>
              <div className="font-medium">Браузерные уведомления</div>
              <div className="text-sm text-dark-400">
                {!isSupported ? 'Не поддерживается' : 
                 permission === 'denied' ? 'Заблокировано' :
                 isBrowserEnabled ? 'Включены' : 'Отключены'}
              </div>
            </div>
          </div>
          <Toggle 
            checked={isBrowserEnabled}
            onChange={handleBrowserToggle}
            disabled={!isSupported || permission === 'denied' || requesting}
          />
        </div>

        {isBrowserEnabled && (
          <div className="pt-4 border-t border-dark-700 space-y-3">
            <label className="block text-sm text-dark-400 mb-2">Напоминать о платежах за:</label>
            <div className="flex flex-wrap gap-2">
              {[1, 3, 7, 14].map(days => (
                <button key={days} type="button"
                  onClick={() => {
                    const current = formData.notifications?.remindDays || [1, 3];
                    const newDays = current.includes(days) 
                      ? current.filter(d => d !== days)
                      : [...current, days].sort((a,b) => a-b);
                    setFormData({ ...formData, notifications: { ...formData.notifications, remindDays: newDays }});
                  }}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    (formData.notifications?.remindDays || [1, 3]).includes(days)
                      ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500'
                      : 'bg-dark-800 hover:bg-dark-700'
                  }`}>
                  {days} {days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}
                </button>
              ))}
            </div>
            <p className="text-xs text-dark-500 mt-2">
              Работают когда приложение открыто или в фоне
            </p>
          </div>
        )}

        {permission === 'denied' && (
          <div className="mt-4 p-3 bg-red-500/10 rounded-lg">
            <p className="text-red-400 text-sm">
              Заблокировано в браузере. Разрешите в настройках сайта.
            </p>
          </div>
        )}
      </div>

      {/* Telegram уведомления */}
      <div className="p-4 bg-dark-800/50 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              formData.telegram?.enabled ? 'bg-blue-500/20 text-blue-400' : 'bg-dark-700 text-dark-400'
            }`}>
              <Send size={20} />
            </div>
            <div>
              <div className="font-medium">Telegram уведомления</div>
              <div className="text-sm text-dark-400">
                {formData.telegram?.enabled ? 'Включены' : 'Отключены'}
              </div>
            </div>
          </div>
          <Toggle 
            checked={formData.telegram?.enabled || false}
            onChange={(v) => updateTelegram('enabled', v)}
          />
        </div>

        {formData.telegram?.enabled && (
          <div className="space-y-4 pt-4 border-t border-dark-700">
            {/* Основные настройки бота */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-dark-400 mb-2">Bot Token</label>
                <div className="relative">
                  <input
                    type={showBotToken ? 'text' : 'password'}
                    className="input-field pr-10"
                    value={formData.telegram?.botToken || ''}
                    onChange={e => updateTelegram('botToken', e.target.value)}
                    placeholder="123456789:ABC..."
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200"
                    onClick={() => setShowBotToken(!showBotToken)}
                  >
                    {showBotToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-xs text-dark-500 mt-1">Создайте бота через @BotFather</p>
              </div>

              <div>
                <label className="block text-sm text-dark-400 mb-2">Chat ID</label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.telegram?.chatId || ''}
                  onChange={e => updateTelegram('chatId', e.target.value)}
                  placeholder="-1001234567890"
                />
                <p className="text-xs text-dark-500 mt-1">Для групп с темами используйте ID супергруппы</p>
              </div>
            </div>

            {/* Типы уведомлений */}
            <div className="space-y-3 pt-4 border-t border-dark-700">
              <h4 className="text-sm font-medium text-dark-300 mb-3">Типы уведомлений</h4>
              
              {/* Мониторинг */}
              <div className="space-y-2">
                <div className="text-xs text-dark-500 uppercase tracking-wide">Мониторинг сервисов</div>
                
                {/* Сервис offline */}
                <div className="p-3 bg-dark-700/50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🔴</span>
                      <div className="font-medium text-sm">Сервис недоступен</div>
                    </div>
                    <Toggle checked={formData.telegram?.notifyDown ?? true} onChange={v => updateTelegram('notifyDown', v)} />
                  </div>
                  {formData.telegram?.notifyDown && (
                    <div className="mt-3 pt-3 border-t border-dark-600 flex items-center gap-2">
                      <input type="text" className="input-field text-sm py-2 flex-1"
                        value={formData.telegram?.notifyDownTopicId || ''}
                        onChange={e => updateTelegram('notifyDownTopicId', e.target.value)}
                        placeholder="Topic ID (опционально)" />
                      <TestTopicButton topicType="down" topicId={formData.telegram?.notifyDownTopicId} disabled={!canTest} />
                    </div>
                  )}
                </div>

                {/* Сервис online */}
                <div className="p-3 bg-dark-700/50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">✅</span>
                      <div className="font-medium text-sm">Сервис восстановлен</div>
                    </div>
                    <Toggle checked={formData.telegram?.notifyUp ?? true} onChange={v => updateTelegram('notifyUp', v)} />
                  </div>
                  {formData.telegram?.notifyUp && (
                    <div className="mt-3 pt-3 border-t border-dark-600 flex items-center gap-2">
                      <input type="text" className="input-field text-sm py-2 flex-1"
                        value={formData.telegram?.notifyUpTopicId || ''}
                        onChange={e => updateTelegram('notifyUpTopicId', e.target.value)}
                        placeholder="Topic ID (опционально)" />
                      <TestTopicButton topicType="up" topicId={formData.telegram?.notifyUpTopicId} disabled={!canTest} />
                    </div>
                  )}
                </div>
              </div>

              {/* Платежи */}
              <div className="space-y-2 pt-3">
                <div className="text-xs text-dark-500 uppercase tracking-wide">Платежи</div>
                <div className="p-3 bg-dark-700/50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">💳</span>
                      <div className="font-medium text-sm">Напоминания о платежах</div>
                    </div>
                    <Toggle checked={formData.telegram?.notifyPayments ?? true} onChange={v => updateTelegram('notifyPayments', v)} />
                  </div>
                  {formData.telegram?.notifyPayments && (
                    <div className="mt-3 pt-3 border-t border-dark-600 space-y-3">
                      <div>
                        <label className="block text-xs text-dark-400 mb-2">Напоминать за:</label>
                        <div className="flex flex-wrap gap-2">
                          {[1, 3, 7, 14].map(days => (
                            <button key={days} type="button"
                              onClick={() => {
                                const current = formData.telegram?.notifyPaymentsDays || [1, 3, 7];
                                const newDays = current.includes(days) ? current.filter(d => d !== days) : [...current, days].sort((a,b) => a-b);
                                updateTelegram('notifyPaymentsDays', newDays);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                                (formData.telegram?.notifyPaymentsDays || [1, 3, 7]).includes(days) ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500' : 'bg-dark-600 hover:bg-dark-500'
                              }`}>
                              {days} {days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="text" className="input-field text-sm py-2 flex-1"
                          value={formData.telegram?.notifyPaymentsTopicId || ''}
                          onChange={e => updateTelegram('notifyPaymentsTopicId', e.target.value)}
                          placeholder="Topic ID (опционально)" />
                        <TestTopicButton topicType="payments" topicId={formData.telegram?.notifyPaymentsTopicId} disabled={!canTest} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Задачи */}
              <div className="space-y-2 pt-3">
                <div className="text-xs text-dark-500 uppercase tracking-wide">Задачи</div>
                <div className="p-3 bg-dark-700/50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📋</span>
                      <div>
                        <div className="font-medium text-sm">Напоминания о задачах</div>
                        <div className="text-xs text-dark-500">С установленным дедлайном</div>
                      </div>
                    </div>
                    <Toggle checked={formData.telegram?.notifyTasks ?? true} onChange={v => updateTelegram('notifyTasks', v)} />
                  </div>
                  {formData.telegram?.notifyTasks && (
                    <div className="mt-3 pt-3 border-t border-dark-600 space-y-3">
                      <div>
                        <label className="block text-xs text-dark-400 mb-2">Напоминать за:</label>
                        <div className="flex flex-wrap gap-2">
                          {[0, 1, 3, 7].map(days => (
                            <button key={days} type="button"
                              onClick={() => {
                                const current = formData.telegram?.notifyTasksDays || [1];
                                const newDays = current.includes(days) ? current.filter(d => d !== days) : [...current, days].sort((a,b) => a-b);
                                updateTelegram('notifyTasksDays', newDays);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                                (formData.telegram?.notifyTasksDays || [1]).includes(days) ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500' : 'bg-dark-600 hover:bg-dark-500'
                              }`}>
                              {days === 0 ? 'В день' : `${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}`}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="text" className="input-field text-sm py-2 flex-1"
                          value={formData.telegram?.notifyTasksTopicId || ''}
                          onChange={e => updateTelegram('notifyTasksTopicId', e.target.value)}
                          placeholder="Topic ID (опционально)" />
                        <TestTopicButton topicType="tasks" topicId={formData.telegram?.notifyTasksTopicId} disabled={!canTest} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Ежедневная сводка */}
              <div className="space-y-2 pt-3">
                <div className="text-xs text-dark-500 uppercase tracking-wide">Сводка</div>
                <div className="p-3 bg-dark-700/50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📊</span>
                      <div>
                        <div className="font-medium text-sm">Ежедневная сводка</div>
                        <div className="text-xs text-dark-500">Платежи, задачи, статус сервисов</div>
                      </div>
                    </div>
                    <Toggle checked={formData.telegram?.dailySummary ?? false} onChange={v => updateTelegram('dailySummary', v)} />
                  </div>
                  {formData.telegram?.dailySummary && (
                    <div className="mt-3 pt-3 border-t border-dark-600 space-y-3">
                      <div>
                        <label className="block text-xs text-dark-400 mb-1">Время отправки</label>
                        <input type="time" className="input-field text-sm py-2"
                          value={formData.telegram?.dailySummaryTime || '09:00'}
                          onChange={e => updateTelegram('dailySummaryTime', e.target.value)} />
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="text" className="input-field text-sm py-2 flex-1"
                          value={formData.telegram?.dailySummaryTopicId || ''}
                          onChange={e => updateTelegram('dailySummaryTopicId', e.target.value)}
                          placeholder="Topic ID (опционально)" />
                        <TestTopicButton topicType="summary" topicId={formData.telegram?.dailySummaryTopicId} disabled={!canTest} />
                      </div>
                      {/* Пример сводки */}
                      <button type="button" onClick={() => setShowSummaryExample(!showSummaryExample)}
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                        {showSummaryExample ? 'Скрыть' : 'Показать'} пример сводки
                      </button>
                      {showSummaryExample && (
                        <div className="p-3 bg-dark-800 rounded-lg text-xs font-mono whitespace-pre-line text-dark-300">
{`📊 Ежедневная сводка
понедельник, 12 января

🔴 Недоступные сервисы:
• Proxmox VE

💳 Платежи (7 дней):
⚠️• Hetzner: 1500 RUB (через 2д)
• VDS: 500 RUB (через 5д)

📋 Задачи (7 дней):
⚠️• Обновить сервер (через 1д)
• Бэкап БД (через 4д)`}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Результат теста */}
            {testResult && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {testResult.success ? (
                  <div className="flex items-center gap-2"><Check size={16} />Тестовое сообщение отправлено!</div>
                ) : (
                  <div className="flex items-center gap-2"><AlertCircle size={16} />{testResult.error}</div>
                )}
              </motion.div>
            )}

            {/* Информация */}
            <div className="p-3 bg-dark-700/30 rounded-lg text-xs text-dark-500">
              <p className="mb-2"><strong className="text-dark-400">Темы (Topics):</strong></p>
              <p>Для отправки в определённую тему группы укажите Topic ID. Откройте тему в Telegram Web - ID будет в URL после последнего слеша.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Monitoring Settings Component ============
function MonitoringSettings({ formData, setFormData }) {
  // Инициализируем monitoring если его нет
  useEffect(() => {
    if (!formData.monitoring) {
      setFormData(prev => ({
        ...prev,
        monitoring: { enabled: false, interval: 60, timeout: 10, retries: 2, historyDays: 7 }
      }));
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Глобальный переключатель мониторинга */}
      <div className="p-4 bg-dark-800/50 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              formData.monitoring?.enabled ? 'bg-green-500/20 text-green-400' : 'bg-dark-700 text-dark-400'
            }`}>
              <Activity size={20} />
            </div>
            <div>
              <div className="font-medium">Система мониторинга</div>
              <div className="text-sm text-dark-400">
                {formData.monitoring?.enabled ? 'Активна' : 'Отключена'}
              </div>
            </div>
          </div>
          <Toggle 
            checked={formData.monitoring?.enabled || false}
            onChange={(v) => setFormData({...formData, monitoring: {...formData.monitoring, enabled: v}})}
          />
        </div>

        {formData.monitoring?.enabled && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dark-700">
            <div>
              <label className="block text-sm text-dark-400 mb-2">Интервал проверки (сек)</label>
              <input
                type="number"
                className="input-field"
                value={formData.monitoring?.interval || 60}
                onChange={e => setFormData({
                  ...formData,
                  monitoring: { ...formData.monitoring, interval: parseInt(e.target.value) || 60 }
                })}
                min={30}
                max={3600}
              />
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-2">Таймаут (сек)</label>
              <input
                type="number"
                className="input-field"
                value={formData.monitoring?.timeout || 10}
                onChange={e => setFormData({
                  ...formData,
                  monitoring: { ...formData.monitoring, timeout: parseInt(e.target.value) || 10 }
                })}
                min={5}
                max={60}
              />
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-2">Попыток перед OFFLINE</label>
              <input
                type="number"
                className="input-field"
                value={formData.monitoring?.retries || 2}
                onChange={e => setFormData({
                  ...formData,
                  monitoring: { ...formData.monitoring, retries: parseInt(e.target.value) || 2 }
                })}
                min={0}
                max={5}
              />
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-2">Хранить историю (дней)</label>
              <input
                type="number"
                className="input-field"
                value={formData.monitoring?.historyDays || 7}
                onChange={e => setFormData({
                  ...formData,
                  monitoring: { ...formData.monitoring, historyDays: parseInt(e.target.value) || 7 }
                })}
                min={1}
                max={90}
              />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-dark-800/30 rounded-xl text-sm text-dark-500">
        <p className="mb-2"><strong>Как это работает:</strong></p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Включите мониторинг на нужных карточках (Редактирование - Мониторинг)</li>
          <li>Сервер будет проверять URL каждые N секунд</li>
          <li>При изменении статуса отправит уведомление в Telegram (настройки в разделе Уведомления)</li>
          <li>История и статистика сохраняются локально</li>
        </ul>
      </div>
    </div>
  );
}

// ============ Settings Modal ============
function SettingsModal({ settings, categories, integrationTemplates, onSave, onClose, onExport, onImport, onCategoryChange, saveStatus, lang }) {
  // Local translation function
  const t = (key) => translations[lang]?.[key] || translations['ru']?.[key] || key;
  
  const [formData, setFormData] = useState(settings);
  const [activeTab, setActiveTab] = useState(null); // null = show tabs list on mobile
  const [editingCategory, setEditingCategory] = useState(null);
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [sshKeys, setSshKeys] = useState([]);
  const [sshTestResult, setSshTestResult] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const fileInputRef = useRef(null);
  const sshKeyInputRef = useRef(null);
  
  const overlayRef = useRef(null);
  const mouseDownTarget = useRef(null);

  // Check mobile on resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    // On desktop, default to general tab
    if (!isMobile && !activeTab) setActiveTab('general');
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile, activeTab]);

  // Load SSH keys when tab opens
  useEffect(() => {
    if (activeTab === 'ssh') {
      loadSshKeys();
    }
  }, [activeTab]);

  const loadSshKeys = async () => {
    try {
      const keys = await api.get('/api/ssh/keys');
      setSshKeys(keys);
    } catch (err) {
      console.error('Failed to load SSH keys:', err);
    }
  };

  const handleSshKeyUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('key', file);
    
    try {
      const result = await fetch('/api/ssh/keys', { method: 'POST', body: formData }).then(r => r.json());
      if (result.success) {
        loadSshKeys();
      }
    } catch (err) {
      console.error('Failed to upload SSH key:', err);
    }
    e.target.value = '';
  };

  const handleSshKeyDelete = async (name) => {
    if (!confirm(`Удалить SSH ключ "${name}"?`)) return;
    try {
      await api.delete(`/api/ssh/keys/${name}`);
      loadSshKeys();
    } catch (err) {
      console.error('Failed to delete SSH key:', err);
    }
  };

  const handleOverlayMouseDown = (e) => {
    mouseDownTarget.current = e.target;
  };

  const handleOverlayMouseUp = (e) => {
    if (mouseDownTarget.current === overlayRef.current && e.target === overlayRef.current) {
      onClose();
    }
    mouseDownTarget.current = null;
  };

  const handleCategorySave = async (catData) => {
    await onCategoryChange(editingCategory ? 'update' : 'create', catData, editingCategory?.id);
    setShowCategoryEditor(false);
    setEditingCategory(null);
  };

  const handleCategoryDelete = async (catId) => {
    if (!confirm('Удалить категорию? Все карточки в ней будут удалены.')) return;
    await onCategoryChange('delete', null, catId);
    setShowCategoryEditor(false);
    setEditingCategory(null);
  };

  const handleTemplateSave = async (templateData) => {
    await api.post('/api/integrations/templates', templateData);
    setShowTemplateEditor(false);
    setEditingTemplate(null);
    onSave(formData);
  };

  const handleTemplateDelete = async (type) => {
    if (!confirm('Удалить шаблон интеграции?')) return;
    await api.delete(`/api/integrations/templates/${type}`);
    setShowTemplateEditor(false);
    setEditingTemplate(null);
    onSave(formData);
  };

  const handleFileImport = (e) => {
    const file = e.target.files[0];
    if (file) {
      onImport(file);
    }
    e.target.value = ''; // Reset input
  };

  const tabs = [
    {id:'general', label: t('general'), icon: Settings},
    {id:'notifications', label: t('notifications'), icon: Bell},
    {id:'monitoring', label: t('monitoring'), icon: Activity},
    {id:'categories', label: t('categories'), icon: Folder},
    {id:'integrations', label: t('integrations'), icon: Zap},
    {id:'ssh', label: t('sshKeys'), icon: Key},
    {id:'backup', label: t('backup'), icon: Download},
    {id:'system', label: t('system'), icon: Server}
  ];

  const currentTab = tabs.find(tab => tab.id === activeTab);

  // Mobile: fullscreen page
  if (isMobile) {
    return (
      <>
        <motion.div 
          key="settings-mobile"
          className="fixed inset-0 z-50 flex flex-col bg-dark-900"
          initial={{ opacity: 0, x: '100%' }} 
          animate={{ opacity: 1, x: 0 }} 
          exit={{ opacity: 0, x: '100%' }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {/* Header with safe area */}
          <header className="flex-shrink-0 bg-dark-900 border-b border-dark-800 pt-safe">
            <div className="px-4 py-3 flex items-center gap-3">
              <button 
                onClick={() => activeTab ? setActiveTab(null) : onClose()}
                className="p-2.5 hover:bg-dark-700 rounded-xl -ml-2 active:scale-95 transition-transform"
              >
                <ArrowLeft size={24} />
              </button>
              <h1 className="text-lg font-semibold flex-1">
                {activeTab ? currentTab?.label : t('settings')}
              </h1>
              {activeTab && (
                <div className="flex items-center gap-2">
                  {saveStatus?.show && (
                    <span className={`text-sm ${saveStatus.success ? 'text-green-400' : 'text-red-400'}`}>
                      {saveStatus.success ? <CheckCircle2 size={16} /> : saveStatus.message}
                    </span>
                  )}
                  <button 
                    onClick={() => onSave(formData, false)}
                    className="px-3 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-sm font-medium"
                  >
                    {t('save')}
                  </button>
                  <button 
                    onClick={() => onSave(formData, true)}
                    className="px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium"
                  >
                    {t('done')}
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* Content - scrollable */}
          <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="p-4 pb-24">
            {!activeTab ? (
              // Tab list
              <div className="space-y-2">
                {tabs.map(tab => {
                  const TabIcon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className="w-full flex items-center gap-4 p-4 bg-dark-800/50 hover:bg-dark-700/50 rounded-xl transition-colors"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                        <TabIcon size={20} className="text-blue-400" />
                      </div>
                      <span className="font-medium">{tab.label}</span>
                      <ChevronDown size={20} className="ml-auto -rotate-90 text-dark-400" />
                    </button>
                  );
                })}
              </div>
            ) : (
              // Tab content
              <div className="space-y-4">
                {activeTab === 'general' && (
                  <>
                    <div>
                      <label className="block text-sm text-dark-400 mb-2">Заголовок</label>
                      <input type="text" className="input-field" value={formData.title}
                        onChange={e => setFormData({...formData, title: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-sm text-dark-400 mb-2">Ваше имя</label>
                      <input type="text" className="input-field" value={formData.userName}
                        onChange={e => setFormData({...formData, userName: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-sm text-dark-400 mb-2">Колонок</label>
                      <select className="input-field" value={formData.columns}
                        onChange={e => setFormData({...formData, columns: parseInt(e.target.value)})}>
                        {[2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-dark-400 mb-2">Город для погоды</label>
                      <input type="text" className="input-field" value={formData.weatherCity || ''}
                        onChange={e => setFormData({...formData, weatherCity: e.target.value})}
                        placeholder="Riga, Moscow, Saint Petersburg..." />
                    </div>
                    <div>
                      <label className="block text-sm text-dark-400 mb-2">Часовой пояс</label>
                      <select className="input-field" value={formData.timezone || 'Europe/Moscow'}
                        onChange={e => setFormData({...formData, timezone: e.target.value})}>
                        <option value="Europe/Moscow">Москва (UTC+3)</option>
                        <option value="Europe/Riga">Рига (UTC+2/+3)</option>
                        <option value="Europe/Kiev">Киев (UTC+2/+3)</option>
                        <option value="Europe/Minsk">Минск (UTC+3)</option>
                        <option value="Asia/Yekaterinburg">Екатеринбург (UTC+5)</option>
                        <option value="Asia/Novosibirsk">Новосибирск (UTC+7)</option>
                        <option value="Asia/Vladivostok">Владивосток (UTC+10)</option>
                        <option value="Europe/London">Лондон (UTC+0/+1)</option>
                        <option value="America/New_York">Нью-Йорк (UTC-5/-4)</option>
                        <option value="America/Los_Angeles">Лос-Анджелес (UTC-8/-7)</option>
                        <option value="Asia/Dubai">Дубай (UTC+4)</option>
                        <option value="UTC">UTC</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span>Показывать часы</span>
                      <Toggle 
                        checked={formData.showClock || false}
                        onChange={(v) => setFormData({...formData, showClock: v})}
                      />
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span>Показывать приветствие</span>
                      <Toggle 
                        checked={formData.showGreeting || false}
                        onChange={(v) => setFormData({...formData, showGreeting: v})}
                      />
                    </div>
                    <div className="p-3 bg-dark-800/50 rounded-xl">
                      <div className="text-sm text-dark-400 mb-2">SSL сертификат для HTTPS</div>
                      <a href="/api/ssl/certificate" download="homedash-certificate.crt"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm">
                        <Download size={16} /> Скачать сертификат
                      </a>
                      <p className="text-xs text-dark-500 mt-2">Установите на устройство чтобы не видеть предупреждения о безопасности</p>
                    </div>
                  </>
                )}

                {activeTab === 'notifications' && (
                  <NotificationsSettings formData={formData} setFormData={setFormData} />
                )}

                {activeTab === 'monitoring' && (
                  <MonitoringSettings formData={formData} setFormData={setFormData} />
                )}

                {activeTab === 'categories' && (
                  <div className="space-y-3">
                    {categories.map(cat => {
                      const CatIcon = categoryIcons[cat.icon] || Folder;
                      return (
                        <div key={cat.id} className="flex items-center gap-3 p-3 bg-dark-800/50 rounded-xl">
                          <CatIcon size={20} className="text-blue-400" />
                          <span className="flex-1">{cat.name}</span>
                          <button onClick={() => { setEditingCategory(cat); setShowCategoryEditor(true); }}
                            className="p-2 hover:bg-dark-700 rounded-lg"><Edit3 size={16} /></button>
                        </div>
                      );
                    })}
                    <button onClick={() => { setEditingCategory(null); setShowCategoryEditor(true); }}
                      className="w-full p-4 border-2 border-dashed border-dark-600 rounded-xl text-dark-400 flex items-center justify-center gap-2">
                      <Plus size={20} /> Добавить категорию
                    </button>
                  </div>
                )}

                {activeTab === 'integrations' && (
                  <div className="space-y-3">
                    {integrationTemplates.map(tmpl => (
                      <div key={tmpl.type} className="flex items-center gap-3 p-3 bg-dark-800/50 rounded-xl">
                        <Zap size={20} className="text-purple-400" />
                        <div className="flex-1">
                          <div className="font-medium">{tmpl.name}</div>
                          <div className="text-xs text-dark-400">{tmpl.type}</div>
                        </div>
                        <button onClick={() => { setEditingTemplate(tmpl); setShowTemplateEditor(true); }}
                          className="p-2 hover:bg-dark-700 rounded-lg"><Edit3 size={16} /></button>
                      </div>
                    ))}
                    <button onClick={() => { setEditingTemplate(null); setShowTemplateEditor(true); }}
                      className="w-full p-4 border-2 border-dashed border-dark-600 rounded-xl text-dark-400 flex items-center justify-center gap-2">
                      <Plus size={20} /> Добавить шаблон
                    </button>
                  </div>
                )}

                {activeTab === 'ssh' && (
                  <div className="space-y-4">
                    <input type="file" ref={sshKeyInputRef} onChange={handleSshKeyUpload} className="hidden" />
                    <button onClick={() => sshKeyInputRef.current?.click()}
                      className="w-full p-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-xl flex items-center justify-center gap-2">
                      <Upload size={20} /> Загрузить SSH ключ
                    </button>
                    <div className="space-y-2">
                      {sshKeys.map(key => (
                        <div key={key.name} className="flex items-center gap-3 p-3 bg-dark-800/50 rounded-xl">
                          <Key size={18} className="text-green-400" />
                          <span className="flex-1 text-sm truncate">{key.name}</span>
                          <button onClick={() => handleSshKeyDelete(key.name)}
                            className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg"><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'backup' && (
                  <div className="space-y-4">
                    <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".zip,.json" className="hidden" />
                    <button onClick={onExport}
                      className="w-full p-4 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-xl flex items-center justify-center gap-2">
                      <Download size={20} /> Скачать бэкап
                    </button>
                    <button onClick={() => fileInputRef.current?.click()}
                      className="w-full p-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-xl flex items-center justify-center gap-2">
                      <Upload size={20} /> Загрузить бэкап
                    </button>
                    <p className="text-xs text-dark-500 text-center">
                      Бэкап включает конфигурацию, SSH ключи, иконки и историю платежей
                    </p>
                  </div>
                )}

                {activeTab === 'system' && (
                  <SystemInfoSection />
                )}
              </div>
            )}
            </div>
          </div>
        </motion.div>

        <AnimatePresence>
          {showCategoryEditor && (
            <CategoryEditor category={editingCategory} onSave={handleCategorySave} onDelete={handleCategoryDelete}
              onClose={() => { setShowCategoryEditor(false); setEditingCategory(null); }} />
          )}
          {showTemplateEditor && (
            <IntegrationTemplateEditor template={editingTemplate} onSave={handleTemplateSave} onDelete={handleTemplateDelete}
              onClose={() => { setShowTemplateEditor(false); setEditingTemplate(null); }} />
          )}
        </AnimatePresence>
      </>
    );
  }

  // Desktop: modal with sidebar
  return (
    <>
      <motion.div 
        ref={overlayRef}
        className="fixed inset-0 modal-overlay flex items-start justify-center z-50 p-4 py-8 overflow-y-auto"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
        onMouseDown={handleOverlayMouseDown}
        onMouseUp={handleOverlayMouseUp}
      >
        <motion.div className="glass-card w-full max-w-4xl my-auto"
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Настройки</h2>
              <button onClick={onClose} className="p-2 hover:bg-dark-700 rounded-lg transition-colors"><X size={20} /></button>
            </div>

            <div className="flex gap-6">
              {/* Вертикальные табы слева */}
              <div className="flex flex-col gap-1 min-w-[160px] border-r border-dark-700 pr-4">
                {tabs.map(tab => {
                  const TabIcon = tab.icon;
                  return (
                    <button key={tab.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                        activeTab === tab.id 
                          ? 'bg-blue-500/20 text-blue-400' 
                          : 'hover:bg-dark-700 text-dark-300'
                      }`}
                      onClick={() => setActiveTab(tab.id)}>
                      <TabIcon size={18} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Контент справа */}
              <div className="flex-1 h-[500px] overflow-y-auto pr-2">
                <AnimatePresence mode="wait">
                  {activeTab === 'general' && (
                    <motion.div
                      key="general"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                    >
              <div className="space-y-4">
                <div><label className="block text-sm text-dark-400 mb-2">Заголовок</label>
                  <input type="text" className="input-field" value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})} /></div>
                <div><label className="block text-sm text-dark-400 mb-2">Ваше имя</label>
                  <input type="text" className="input-field" value={formData.userName}
                    onChange={e => setFormData({...formData, userName: e.target.value})} /></div>
                <div><label className="block text-sm text-dark-400 mb-2">Колонок</label>
                  <select className="input-field" value={formData.columns}
                    onChange={e => setFormData({...formData, columns: parseInt(e.target.value)})}>
                    {[2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                  </select></div>
                <div>
                  <label className="block text-sm text-dark-400 mb-2">Город для погоды</label>
                  <input type="text" className="input-field" value={formData.weatherCity || ''}
                    onChange={e => setFormData({...formData, weatherCity: e.target.value})}
                    placeholder="Riga, Moscow, Saint Petersburg..." />
                  <p className="text-xs text-dark-500 mt-1">Оставьте пустым чтобы скрыть погоду</p>
                </div>
                <div>
                  <label className="block text-sm text-dark-400 mb-2">Часовой пояс</label>
                  <select className="input-field" value={formData.timezone || 'Europe/Moscow'}
                    onChange={e => setFormData({...formData, timezone: e.target.value})}>
                    <option value="Europe/Moscow">Москва (UTC+3)</option>
                    <option value="Europe/Riga">Рига (UTC+2/+3)</option>
                    <option value="Europe/Kiev">Киев (UTC+2/+3)</option>
                    <option value="Europe/Minsk">Минск (UTC+3)</option>
                    <option value="Asia/Yekaterinburg">Екатеринбург (UTC+5)</option>
                    <option value="Asia/Novosibirsk">Новосибирск (UTC+7)</option>
                    <option value="Asia/Vladivostok">Владивосток (UTC+10)</option>
                    <option value="Europe/London">Лондон (UTC+0/+1)</option>
                    <option value="America/New_York">Нью-Йорк (UTC-5/-4)</option>
                    <option value="America/Los_Angeles">Лос-Анджелес (UTC-8/-7)</option>
                    <option value="Asia/Dubai">Дубай (UTC+4)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-dark-300">Показывать часы</span>
                  <Toggle 
                    checked={formData.showClock || false}
                    onChange={(v) => setFormData({...formData, showClock: v})}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-dark-300">Показывать приветствие</span>
                  <Toggle 
                    checked={formData.showGreeting || false}
                    onChange={(v) => setFormData({...formData, showGreeting: v})}
                  />
                </div>
                <div className="p-3 bg-dark-800/50 rounded-xl">
                  <div className="text-sm text-dark-400 mb-2">SSL сертификат для HTTPS</div>
                  <a href="/api/ssl/certificate" download="homedash-certificate.crt"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm">
                    <Download size={16} /> Скачать сертификат
                  </a>
                  <p className="text-xs text-dark-500 mt-2">Установите на устройство чтобы не видеть предупреждения</p>
                </div>
              </div>
                    </motion.div>
            )}

            {activeTab === 'notifications' && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
              <NotificationsSettings formData={formData} setFormData={setFormData} />
              </motion.div>
            )}

            {activeTab === 'monitoring' && (
              <motion.div
                key="monitoring"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
              <MonitoringSettings formData={formData} setFormData={setFormData} />
              </motion.div>
            )}

            {activeTab === 'categories' && (
              <motion.div
                key="categories"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-dark-400 text-sm">Управление категориями карточек</p>
                  <button className="btn btn-primary flex items-center gap-2"
                    onClick={() => { setEditingCategory(null); setShowCategoryEditor(true); }}>
                    <FolderPlus size={16} />Добавить</button>
                </div>
                <div className="space-y-2">
                  {categories.map(cat => {
                    const Icon = categoryIcons[cat.icon] || Folder;
                    return (
                      <div key={cat.id} className="flex items-center justify-between p-3 bg-dark-800 rounded-xl group">
                        <div className="flex items-center gap-3"><Icon size={20} className="text-dark-400" /><span>{cat.name}</span></div>
                        <button className="p-2 opacity-0 group-hover:opacity-100 hover:bg-dark-700 rounded-lg transition-all"
                          onClick={() => { setEditingCategory(cat); setShowCategoryEditor(true); }}><Edit3 size={16} /></button>
                      </div>
                    );
                  })}
                </div>
              </div>
              </motion.div>
            )}

            {activeTab === 'integrations' && (
              <motion.div
                key="integrations"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-dark-400 text-sm">Шаблоны интеграций для сбора метрик</p>
                  <button className="btn btn-primary flex items-center gap-2"
                    onClick={() => { setEditingTemplate(null); setShowTemplateEditor(true); }}>
                    <Plus size={16} />Добавить</button>
                </div>
                <div className="space-y-2">
                  {integrationTemplates.map(tmpl => (
                    <div key={tmpl.type} className="flex items-center justify-between p-3 bg-dark-800 rounded-xl group">
                      <div>
                        <span className="font-medium">{tmpl.name}</span>
                        <span className="text-dark-500 text-sm ml-2">({tmpl.type})</span>
                        {tmpl.builtin && <span className="ml-2 px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">встроенный</span>}
                      </div>
                      {!tmpl.builtin && (
                        <button className="p-2 opacity-0 group-hover:opacity-100 hover:bg-dark-700 rounded-lg transition-all"
                          onClick={() => { setEditingTemplate(tmpl); setShowTemplateEditor(true); }}><Edit3 size={16} /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              </motion.div>
            )}

            {activeTab === 'ssh' && (
              <motion.div
                key="ssh"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
              <div className="space-y-4">
                <div className="p-4 bg-dark-800 rounded-xl">
                  <h3 className="font-medium mb-2 flex items-center gap-2"><Key size={18} />SSH Ключи</h3>
                  <p className="text-dark-400 text-sm mb-4">
                    Загрузите приватные SSH ключи для подключения к серверам. Ключи хранятся локально в контейнере.
                  </p>
                  
                  {/* Upload button */}
                  <input ref={sshKeyInputRef} type="file" className="hidden" onChange={handleSshKeyUpload} />
                  <button 
                    className="btn btn-primary flex items-center gap-2 mb-4"
                    onClick={() => sshKeyInputRef.current?.click()}>
                    <Upload size={16} /> Загрузить ключ
                  </button>

                  {/* Keys list */}
                  {sshKeys.length > 0 ? (
                    <div className="space-y-2">
                      {sshKeys.map(key => (
                        <div key={key.name} className="flex items-center justify-between p-3 bg-dark-700 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Key size={16} className="text-blue-400" />
                            <div>
                              <div className="font-medium">{key.name}</div>
                              <div className="text-xs text-dark-500">
                                {key.size} bytes • {new Date(key.modified).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleSshKeyDelete(key.name)}
                            className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-dark-500">
                      <Key size={32} className="mx-auto mb-2 opacity-50" />
                      <p>Нет загруженных ключей</p>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-dark-800 rounded-xl">
                  <h3 className="font-medium mb-2 flex items-center gap-2"><Terminal size={18} />Использование</h3>
                  <div className="text-dark-400 text-sm space-y-2">
                    <p>1. Загрузите приватный SSH ключ (id_rsa, id_ed25519 и т.д.)</p>
                    <p>2. Создайте карточку с интеграцией "SSH Host"</p>
                    <p>3. В поле "SSH Key" выберите загруженный ключ или вставьте ключ напрямую</p>
                    <p>4. Убедитесь, что публичный ключ добавлен в ~/.ssh/authorized_keys на сервере</p>
                  </div>
                </div>
              </div>
              </motion.div>
            )}

            {activeTab === 'backup' && (
              <motion.div
                key="backup"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
              <div className="space-y-4">
                <div className="p-4 bg-dark-800 rounded-xl">
                  <h3 className="font-medium mb-2 flex items-center gap-2"><Download size={18} />Экспорт бэкапа</h3>
                  <p className="text-dark-400 text-sm mb-3">Скачать полный бэкап: конфигурация, SSH ключи, иконки, платежи.</p>
                  <button className="btn btn-secondary flex items-center gap-2" onClick={onExport}>
                    <FileJson size={16} />Скачать бэкап (.zip)</button>
                </div>
                <div className="p-4 bg-dark-800 rounded-xl">
                  <h3 className="font-medium mb-2 flex items-center gap-2"><Upload size={18} />Импорт бэкапа</h3>
                  <p className="text-dark-400 text-sm mb-3">Загрузить бэкап из архива. Текущие настройки будут перезаписаны.</p>
                  <input ref={fileInputRef} type="file" accept=".zip,.json" className="hidden" onChange={handleFileImport} />
                  <button className="btn btn-secondary flex items-center gap-2" onClick={() => fileInputRef.current?.click()}>
                    <Upload size={16} />Загрузить бэкап</button>
                </div>
              </div>
              </motion.div>
            )}

            {activeTab === 'system' && (
              <motion.div
                key="system"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
              <SystemInfoSection />
              </motion.div>
            )}
                </AnimatePresence>
              </div> {/* Конец контента справа */}
            </div> {/* Конец flex gap-6 */}

            {/* Кнопки внизу - показываем для general, monitoring и notifications */}
            {(activeTab === 'general' || activeTab === 'monitoring' || activeTab === 'notifications') && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-dark-700">
                <div className="flex items-center gap-2">
                  {saveStatus?.show && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                        saveStatus.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {saveStatus.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                      {saveStatus.message}
                    </motion.div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button className="btn btn-secondary" onClick={onClose}>{t('cancel')}</button>
                  <button className="btn btn-secondary flex items-center gap-2" onClick={() => onSave(formData, false)}>
                    <Save size={16} />{t('save')}</button>
                  <button className="btn btn-primary flex items-center gap-2" onClick={() => onSave(formData, true)}>
                    <Check size={16} />{t('saveAndClose')}</button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {showCategoryEditor && (
          <CategoryEditor category={editingCategory} onSave={handleCategorySave} onDelete={handleCategoryDelete}
            onClose={() => { setShowCategoryEditor(false); setEditingCategory(null); }} />
        )}
        {showTemplateEditor && (
          <IntegrationTemplateEditor template={editingTemplate} onSave={handleTemplateSave} onDelete={handleTemplateDelete}
            onClose={() => { setShowTemplateEditor(false); setEditingTemplate(null); }} />
        )}
      </AnimatePresence>
    </>
  );
}

// ============ Translation Widget ============
function TranslateWidget({ show, onClose }) {
  const [selectedLang, setSelectedLang] = useState(() => {
    // Check if already translated
    const match = document.cookie.match(/googtrans=\/ru\/([a-z-]+)/i);
    return match ? match[1] : '';
  });
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const languages = [
    { code: '', name: 'Русский (оригинал)' },
    { code: 'en', name: 'English' },
    { code: 'de', name: 'Deutsch' },
    { code: 'fr', name: 'Francais' },
    { code: 'es', name: 'Espanol' },
    { code: 'it', name: 'Italiano' },
    { code: 'pt', name: 'Portugues' },
    { code: 'zh-CN', name: '中文' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
    { code: 'tr', name: 'Turkce' },
    { code: 'pl', name: 'Polski' },
    { code: 'uk', name: 'Українська' },
  ];

  useEffect(() => {
    if (!show) return;
    
    // Load Google Translate script if not loaded
    if (!window.google?.translate?.TranslateElement && !scriptLoaded) {
      const script = document.createElement('script');
      script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      
      // Create hidden container for Google widget
      let container = document.getElementById('google_translate_element');
      if (!container) {
        container = document.createElement('div');
        container.id = 'google_translate_element';
        container.style.display = 'none';
        document.body.appendChild(container);
      }
      
      window.googleTranslateElementInit = () => {
        new window.google.translate.TranslateElement({
          pageLanguage: 'ru',
          includedLanguages: 'en,de,fr,es,it,pt,zh-CN,ja,ko,tr,pl,uk',
          autoDisplay: false
        }, 'google_translate_element');
        setScriptLoaded(true);
      };
      
      document.body.appendChild(script);
    } else {
      setScriptLoaded(true);
    }
  }, [show]);

  const handleLanguageChange = (langCode) => {
    setSelectedLang(langCode);
    
    if (langCode === '') {
      // Reset to original
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname;
      window.location.reload();
      return;
    }
    
    // Set translation cookie and trigger
    document.cookie = `googtrans=/ru/${langCode}; path=/;`;
    document.cookie = `googtrans=/ru/${langCode}; path=/; domain=${window.location.hostname}`;
    
    // Try to trigger Google Translate
    const select = document.querySelector('.goog-te-combo');
    if (select) {
      select.value = langCode;
      select.dispatchEvent(new Event('change'));
    } else {
      window.location.reload();
    }
    
    onClose();
  };

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute right-0 top-full mt-2 bg-dark-800 rounded-xl border border-dark-700 shadow-2xl z-50 overflow-hidden w-48 sm:w-56"
      style={{ maxHeight: 'calc(100vh - 120px)' }}
    >
      <div className="p-3 border-b border-dark-700 flex items-center justify-between">
        <span className="text-sm font-medium">Перевод</span>
        <button onClick={onClose} className="p-1 hover:bg-dark-700 rounded-lg transition-colors">
          <X size={16} />
        </button>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: '280px' }}>
        {languages.map(lang => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`w-full px-3 py-2.5 text-left text-sm flex items-center justify-between hover:bg-dark-700 transition-colors ${
              selectedLang === lang.code ? 'bg-blue-500/20 text-blue-400' : 'text-dark-200'
            }`}
          >
            <span>{lang.name}</span>
            {selectedLang === lang.code && <Check size={16} />}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ============ Main App ============
export default function App() {
  const [config, setConfig] = useState(null);
  const [integrationData, setIntegrationData] = useState({});
  const [integrationTemplates, setIntegrationTemplates] = useState([]);
  const [monitoringStatuses, setMonitoringStatuses] = useState({});
  const [editingCard, setEditingCard] = useState(null);
  const [showCardEditor, setShowCardEditor] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTranslate, setShowTranslate] = useState(false);
  const [currentPage, setCurrentPage] = useState(() => localStorage.getItem('homedash-page') || 'dashboard');
  const [mobileTab, setMobileTab] = useState(() => localStorage.getItem('homedash-tab') || 'home');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailCard, setDetailCard] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [lang, setLang] = useState(() => localStorage.getItem('homedash-lang') || 'ru');
  const [activeDragId, setActiveDragId] = useState(null);
  
  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Translation function - simple, no memoization
  const t = (key) => translations[lang]?.[key] || translations['ru']?.[key] || key;
  
  // Save language to localStorage
  useEffect(() => {
    localStorage.setItem('homedash-lang', lang);
  }, [lang]);

  // Save current page and tab to localStorage
  useEffect(() => {
    localStorage.setItem('homedash-page', currentPage);
  }, [currentPage]);
  
  useEffect(() => {
    localStorage.setItem('homedash-tab', mobileTab);
  }, [mobileTab]);
  
  // Check for mobile on resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [detailData, setDetailData] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [tabBarHidden, setTabBarHidden] = useState(false);
  const lastScrollY = useRef(0);
  
  // Hide/show tab bar on scroll
  useEffect(() => {
    if (!isMobile) return;
    
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const scrollDelta = currentScrollY - lastScrollY.current;
          
          // Скрываем при прокрутке вниз более чем на 10px
          if (scrollDelta > 10 && currentScrollY > 50) {
            setTabBarHidden(true);
          }
          // Показываем при прокрутке вверх более чем на 10px или в самом верху
          else if (scrollDelta < -10 || currentScrollY < 50) {
            setTabBarHidden(false);
          }
          
          lastScrollY.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobile]);
  
  // Update notification state
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const sessionBuildId = useRef(null); // buildId при загрузке страницы

  // PWA Notifications
  const notificationsEnabled = config?.notifications?.enabled || false;
  useNotifications(notificationsEnabled);

  // Service Worker registration and update handling
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Регистрируем SW
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('[App] SW registered');
          
          // Проверяем обновления SW каждые 5 минут
          setInterval(() => {
            registration.update().catch(err => console.log('[App] SW update check failed:', err));
          }, 5 * 60 * 1000);
        })
        .catch(err => console.error('[App] SW registration failed:', err));
    }

    // Проверяем версию сервера при загрузке
    checkServerVersion(true);
    
    // Периодическая проверка версии сервера (каждые 2 минуты)
    const versionCheckInterval = setInterval(() => checkServerVersion(false), 2 * 60 * 1000);
    
    return () => clearInterval(versionCheckInterval);
  }, []);

  // Check server version
  const checkServerVersion = async (isInitial) => {
    try {
      const data = await api.get('/api/system/version');
      if (data.buildId) {
        if (isInitial) {
          // Первая проверка при загрузке - запоминаем текущий buildId
          sessionBuildId.current = data.buildId;
          console.log('[App] Initial buildId:', data.buildId);
        } else if (sessionBuildId.current && data.buildId !== sessionBuildId.current) {
          // buildId изменился ПОСЛЕ загрузки страницы - сервер обновился
          console.log('[App] Server updated! Old:', sessionBuildId.current, 'New:', data.buildId);
          setUpdateAvailable(true);
        }
      }
    } catch (err) {
      console.log('[App] Version check failed:', err);
    }
  };

  // Handle update click - просто перезагружаем страницу
  const handleUpdate = () => {
    // Очищаем кэши и перезагружаем
    if ('caches' in window) {
      caches.keys().then(names => {
        Promise.all(names.map(name => caches.delete(name))).then(() => {
          window.location.reload();
        });
      });
    } else {
      window.location.reload();
    }
  };

  const toggleCategory = (categoryId) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const handleShowDetail = (card, data) => {
    setDetailCard(card);
    setDetailData(data);
  };

  // Load weather data
  const loadWeather = async () => {
    try {
      const data = await api.get('/api/weather');
      setWeatherData(data);
    } catch (err) { console.error('Failed to load weather:', err); }
  };

  // Load monitoring statuses
  const loadMonitoringStatuses = async () => {
    try {
      const data = await api.get('/api/monitoring/status');
      setMonitoringStatuses(data);
    } catch (err) { console.error('Failed to load monitoring:', err); }
  };

  useEffect(() => { loadConfig(); loadIntegrationTemplates(); loadWeather(); loadMonitoringStatuses(); }, []);

  const [configError, setConfigError] = useState(null);

  const loadConfig = async (retryCount = 0) => {
    try {
      setConfigError(null);
      const res = await fetch('/api/config', { 
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      if (!data || !data.cards) {
        throw new Error('Invalid config format');
      }
      setConfig(data);
      setLoading(false);
      data.cards.forEach(card => { if (card.integration?.type) loadIntegrationData(card); });
    } catch (err) { 
      console.error('Failed to load config:', err);
      // Retry up to 3 times with exponential backoff
      if (retryCount < 3) {
        console.log(`Retrying loadConfig (attempt ${retryCount + 1})...`);
        setTimeout(() => loadConfig(retryCount + 1), Math.pow(2, retryCount) * 1000);
        return;
      }
      setConfigError(err.message || 'Unknown error');
      setLoading(false); 
    }
  };

  const loadIntegrationTemplates = async () => {
    try {
      const data = await api.get('/api/integrations/templates');
      setIntegrationTemplates(data);
    } catch (err) { console.error('Failed to load templates:', err); }
  };

  const loadIntegrationData = async (card) => {
    if (!card.integration?.type) return;
    try {
      const data = await api.get(`/api/integrations/${card.integration.type}/${card.id}`);
      setIntegrationData(prev => ({ ...prev, [card.id]: data }));
    } catch (err) { console.error('Failed to load integration data:', err); }
  };

  // Функция обновления всех данных
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadConfig();
      await loadWeather();
      await loadMonitoringStatuses();
      // Принудительно обновляем все интеграции
      if (config?.cards) {
        await Promise.all(
          config.cards
            .filter(card => card.integration?.type)
            .map(card => loadIntegrationData(card))
        );
      }
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!config) return;
    const interval = setInterval(() => {
      config.cards.forEach(card => { if (card.integration?.type) loadIntegrationData(card); });
      loadMonitoringStatuses();
    }, 30000);
    return () => clearInterval(interval);
  }, [config]);

  const [cardSaveStatus, setCardSaveStatus] = useState({ show: false, success: false, message: '' });

  const handleSaveCard = async (cardData, closeAfter = false) => {
    try {
      if (editingCard) {
        await api.put(`/api/cards/${editingCard.id}`, cardData);
        if (cardData.integration) await api.put(`/api/cards/${editingCard.id}/integration`, cardData.integration);
      } else {
        const newCard = await api.post('/api/cards', cardData);
        if (cardData.integration) await api.put(`/api/cards/${newCard.id}/integration`, cardData.integration);
        // После создания новой карточки переключаемся на её редактирование
        setEditingCard({ ...cardData, id: newCard.id });
      }
      await loadConfig();
      setCardSaveStatus({ show: true, success: true, message: 'Сохранено' });
      setTimeout(() => setCardSaveStatus({ show: false, success: false, message: '' }), 2000);
      if (closeAfter) {
        setShowCardEditor(false);
        setEditingCard(null);
      }
    } catch (err) { 
      console.error('Failed to save card:', err);
      setCardSaveStatus({ show: true, success: false, message: 'Ошибка сохранения' });
      setTimeout(() => setCardSaveStatus({ show: false, success: false, message: '' }), 3000);
    }
  };

  const handleDeleteCard = async (cardId) => {
    if (!confirm('Удалить карточку?')) return;
    try { await api.delete(`/api/cards/${cardId}`); await loadConfig(); }
    catch (err) { console.error('Failed to delete card:', err); }
  };

  // Drag and Drop handlers
  const handleDragStart = (event) => {
    setActiveDragId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveDragId(null);
    
    if (!over || active.id === over.id) return;

    // Найдем категорию карточки
    const activeCard = cards.find(c => c.id === active.id);
    const overCard = cards.find(c => c.id === over.id);
    
    if (!activeCard || !overCard) return;
    
    // Получаем карточки этой категории
    const categoryCards = cards
      .filter(c => c.category === activeCard.category)
      .sort((a, b) => a.order - b.order);
    
    const oldIndex = categoryCards.findIndex(c => c.id === active.id);
    const newIndex = categoryCards.findIndex(c => c.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    // Переупорядочиваем карточки
    const reorderedCards = arrayMove(categoryCards, oldIndex, newIndex);
    const newCardIds = reorderedCards.map(c => c.id);
    
    // Обновляем локальное состояние
    setConfig(prev => {
      const updatedCards = prev.cards.map(card => {
        const newIdx = newCardIds.indexOf(card.id);
        if (newIdx !== -1) {
          return { ...card, order: newIdx };
        }
        return card;
      });
      return { ...prev, cards: updatedCards };
    });
    
    // Сохраняем на сервере
    try {
      await api.put('/api/cards/reorder', { cardIds: newCardIds });
    } catch (err) {
      console.error('Failed to reorder:', err);
      loadConfig(); // Откат при ошибке
    }
  };

  const [saveStatus, setSaveStatus] = useState({ show: false, success: false, message: '' });

  const handleSaveSettings = async (settings, closeAfter = false) => {
    try {
      await api.put('/api/settings', settings);
      await loadConfig();
      await loadWeather(); // Обновляем погоду если изменился город
      await loadIntegrationTemplates();
      setSaveStatus({ show: true, success: true, message: 'Настройки сохранены' });
      if (closeAfter) {
        // Показываем уведомление, потом закрываем
        setTimeout(() => {
          setShowSettings(false);
          setSaveStatus({ show: false, success: false, message: '' });
        }, 800);
      } else {
        setTimeout(() => setSaveStatus({ show: false, success: false, message: '' }), 2000);
      }
    } catch (err) { 
      console.error('Failed to save settings:', err);
      setSaveStatus({ show: true, success: false, message: 'Ошибка сохранения' });
      setTimeout(() => setSaveStatus({ show: false, success: false, message: '' }), 3000);
    }
  };

  const handleCategoryChange = async (action, catData, catId) => {
    try {
      if (action === 'create') await api.post('/api/categories', catData);
      else if (action === 'update') await api.put(`/api/categories/${catId}`, catData);
      else if (action === 'delete') await api.delete(`/api/categories/${catId}`);
      await loadConfig();
    } catch (err) { console.error('Failed to change category:', err); }
  };

  const handleExport = async () => {
    try {
      // Download ZIP file directly
      const response = await fetch('/api/config/export');
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `homedash-backup-${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { 
      console.error('Failed to export:', err);
      alert('Ошибка экспорта');
    }
  };

  const handleImport = async (file) => {
    if (!confirm('Импортировать бэкап? Текущие настройки будут перезаписаны.')) return;
    try {
      const formData = new FormData();
      formData.append('backup', file);
      
      const response = await fetch('/api/config/import', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Import failed');
      
      await loadConfig();
      await loadIntegrationTemplates();
      setShowSettings(false);
      alert('Бэкап успешно восстановлен');
    } catch (err) { 
      console.error('Failed to import:', err);
      alert('Ошибка импорта: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-animated flex items-center justify-center">
        <motion.div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full"
          animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-animated flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
          <p className="text-dark-300 mb-2">Не удалось загрузить конфигурацию</p>
          {configError && (
            <p className="text-sm text-red-400 mb-4 p-2 bg-red-500/10 rounded-lg break-all">{configError}</p>
          )}
          <button className="btn btn-primary" onClick={loadConfig}>Попробовать снова</button>
          <p className="text-xs text-dark-500 mt-4">
            URL: {window.location.href}
          </p>
        </div>
      </div>
    );
  }

  const { settings, categories, cards } = config;
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
    6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'
  };

  // Страница платежей (только для десктопа)
  if (currentPage === 'payments' && !isMobile) {
    return (
      <PaymentsPage 
        cards={cards} 
        onBack={() => setCurrentPage('dashboard')}
        onEditCard={(card) => { setEditingCard(card); setShowCardEditor(true); setCurrentPage('dashboard'); }}
        onRefreshCards={loadConfig}
      />
    );
  }

  // Страница задач (только для десктопа)
  if (currentPage === 'tasks' && !isMobile) {
    return (
      <TasksPage 
        onBack={() => setCurrentPage('dashboard')}
      />
    );
  }

  // Мобильная версия (Liquid Glass Style)
  if (isMobile) {
    // Считаем предстоящие платежи для индикатора
    const upcomingPaymentsCount = (() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return cards.filter(card => {
        if (!card.billing?.enabled || !card.billing?.nextPayment) return false;
        const paymentDate = new Date(card.billing.nextPayment);
        paymentDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((paymentDate - today) / (1000 * 60 * 60 * 24));
        return daysUntil <= 7; // Платежи в ближайшие 7 дней
      }).length;
    })();

    return (
      <>
        {/* MobileDashboard скрывается когда открыты модальные окна */}
        {!showSettings && !showCardEditor && currentPage === 'dashboard' && (
          <MobileDashboard
            config={config}
            settings={settings}
            categories={categories}
            cards={cards}
            integrationData={integrationData}
            monitoringStatuses={monitoringStatuses}
            weatherData={weatherData}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            onEditCard={(card) => { setEditingCard(card); setShowCardEditor(true); }}
            onNewCard={() => { setEditingCard(null); setShowCardEditor(true); }}
            onOpenSettings={() => setShowSettings(true)}
            onDeleteCard={handleDeleteCard}
            loadIntegrationData={loadIntegrationData}
            activeTab={mobileTab}
            lang={lang}
            setLang={setLang}
          />
        )}

        {/* Payments Page */}
        {currentPage === 'payments' && !showSettings && !showCardEditor && (
          <PaymentsPage 
            cards={cards} 
            onBack={() => setCurrentPage('dashboard')}
            onEditCard={(card) => { setEditingCard(card); setShowCardEditor(true); setCurrentPage('dashboard'); }}
            onRefreshCards={loadConfig}
          />
        )}

        {/* Tasks Page */}
        {currentPage === 'tasks' && !showSettings && !showCardEditor && (
          <TasksPage 
            onBack={() => setCurrentPage('dashboard')}
          />
        )}

        {/* Modals */}
        <AnimatePresence>
          {showCardEditor && (
            <CardEditor 
              key="card-editor"
              card={editingCard} 
              categories={categories}
              integrationTemplates={integrationTemplates}
              onSave={handleSaveCard}
              onClose={() => { setShowCardEditor(false); setEditingCard(null); }}
              saveStatus={cardSaveStatus}
              lang={lang}
            />
          )}
          {showSettings && (
            <SettingsModal 
              key="settings-modal"
              settings={settings} 
              categories={categories}
              integrationTemplates={integrationTemplates}
              onSave={handleSaveSettings}
              onClose={() => setShowSettings(false)}
              onExport={handleExport}
              onImport={handleImport}
              onCategoryChange={handleCategoryChange}
              saveStatus={saveStatus}
              lang={lang}
            />
          )}
        </AnimatePresence>

        {/* Detail Modal */}
        <AnimatePresence>
          {detailCard && (
            <CardDetailModal card={detailCard} data={detailData} onClose={() => { setDetailCard(null); setDetailData(null); }} />
          )}
        </AnimatePresence>

        {/* Global Tab Bar - always visible on mobile */}
        <nav className={`tab-bar ${tabBarHidden && !showSettings && !showCardEditor ? 'hidden' : ''}`} style={{ zIndex: 300 }}>
          <div className="flex justify-around items-center">
            <button 
              className={`tab-bar-item ${currentPage === 'dashboard' && mobileTab === 'home' && !showSettings && !showCardEditor ? 'active' : ''}`}
              onClick={() => { setShowSettings(false); setShowCardEditor(false); setEditingCard(null); setCurrentPage('dashboard'); setMobileTab('home'); }}
            >
              <Home size={24} />
              <span>{t('home')}</span>
            </button>
            <button 
              className={`tab-bar-item ${currentPage === 'dashboard' && mobileTab === 'monitoring' && !showSettings && !showCardEditor ? 'active' : ''}`}
              onClick={() => { setShowSettings(false); setShowCardEditor(false); setEditingCard(null); setCurrentPage('dashboard'); setMobileTab('monitoring'); }}
            >
              <Activity size={24} />
              <span>{t('status')}</span>
            </button>
            <button 
              className={`tab-bar-item ${currentPage === 'payments' && !showSettings && !showCardEditor ? 'active' : ''}`}
              onClick={() => { setShowSettings(false); setShowCardEditor(false); setEditingCard(null); setCurrentPage('payments'); }}
            >
              <Receipt size={24} />
              <span>{t('payments')}</span>
              {upcomingPaymentsCount > 0 && (
                <span className="absolute top-0.5 right-2 min-w-[16px] h-[16px] bg-red-500 rounded-full text-[9px] flex items-center justify-center font-bold text-white">
                  {upcomingPaymentsCount}
                </span>
              )}
            </button>
            <button 
              className={`tab-bar-item ${currentPage === 'tasks' && !showSettings && !showCardEditor ? 'active' : ''}`}
              onClick={() => { setShowSettings(false); setShowCardEditor(false); setEditingCard(null); setCurrentPage('tasks'); }}
            >
              <CheckCircle2 size={24} />
              <span>Задачи</span>
            </button>
            <button 
              className={`tab-bar-item ${showSettings ? 'active' : ''}`}
              onClick={() => { 
                if (showSettings) return;
                setShowCardEditor(false); 
                setEditingCard(null); 
                setShowSettings(true); 
              }}
            >
              <Settings size={24} />
              <span>{t('settings')}</span>
            </button>
          </div>
        </nav>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-animated">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-dark-900/50 border-b border-dark-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Grid size={20} /></div>
            <h1 className="text-xl font-semibold">{settings.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Кнопка платежей - всегда доступна */}
            {(() => {
              const upcomingPayments = cards.filter(c => {
                if ((c.category !== 'hosting' && c.category !== 'providers') || !c.billing?.enabled || !c.billing?.nextPayment) return false;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const paymentDate = new Date(c.billing.nextPayment);
                paymentDate.setHours(0, 0, 0, 0);
                const daysUntil = Math.ceil((paymentDate - today) / (1000 * 60 * 60 * 24));
                return daysUntil <= 7;
              }).length;
              
              return (
                <button 
                  className="relative p-3 rounded-xl hover:bg-dark-700 transition-colors" 
                  onClick={() => setCurrentPage('payments')}
                  title="Платежи"
                >
                  <Receipt size={20} />
                  {upcomingPayments > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center font-medium">
                      {upcomingPayments}
                    </span>
                  )}
                </button>
              );
            })()}
            {/* Кнопка задач */}
            <button 
              className="p-3 rounded-xl hover:bg-dark-700 transition-colors" 
              onClick={() => setCurrentPage('tasks')}
              title="Задачи"
            >
              <CheckCircle2 size={20} />
            </button>
            <button 
              className="p-3 rounded-xl hover:bg-dark-700 transition-colors disabled:opacity-50" 
              onClick={handleRefresh} 
              disabled={refreshing}
              title="Обновить"
            >
              <motion.div
                animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
                transition={refreshing ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
              >
                <RefreshCw size={20} />
              </motion.div>
            </button>
            <div className="relative">
              <button 
                className={`p-3 rounded-xl hover:bg-dark-700 transition-colors ${showTranslate ? 'bg-dark-700' : ''}`}
                onClick={() => setShowTranslate(!showTranslate)}
                title="Перевести страницу"
              >
                <Globe size={20} />
              </button>
              <AnimatePresence>
                {showTranslate && (
                  <TranslateWidget show={showTranslate} onClose={() => setShowTranslate(false)} />
                )}
              </AnimatePresence>
            </div>
            <button className="p-3 rounded-xl hover:bg-dark-700 transition-colors" onClick={() => setShowSettings(true)}>
              <Settings size={20} /></button>
          </div>
        </div>
      </header>

      {/* Update notification banner */}
      <AnimatePresence>
        {updateAvailable && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-gradient-to-r from-blue-600 to-purple-600 overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-white">
                <RefreshCw size={18} />
                <span className="text-sm font-medium">Доступно обновление приложения</span>
              </div>
              <button
                onClick={handleUpdate}
                className="px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Download size={14} />
                Обновить
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {(settings.showClock || settings.showGreeting) && (
          <div className="mb-12">
            {settings.showClock && <Clock weatherData={weatherData} />}
            {settings.showGreeting && (
              <div className="flex items-center justify-center">
                <Greeting name={settings.userName} />
              </div>
            )}
          </div>
        )}

        {categories.sort((a, b) => a.order - b.order).map(category => {
          const categoryCards = cards.filter(c => c.category === category.id).sort((a, b) => a.order - b.order);
          if (categoryCards.length === 0) return null;
          const CategoryIcon = categoryIcons[category.icon] || Server;
          const isCollapsed = collapsedCategories[category.id];

          return (
            <motion.section key={category.id} className="mb-10" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <button 
                className="category-header mb-6 w-full cursor-pointer group"
                onClick={() => toggleCategory(category.id)}
              >
                <CategoryIcon size={20} className="text-dark-400" />
                <h2 className="text-lg font-medium text-dark-200 flex-1 text-left">{category.name}</h2>
                <span className="text-dark-500 text-sm mr-2">{categoryCards.length}</span>
                <motion.div
                  animate={{ rotate: isCollapsed ? -90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown size={18} className="text-dark-500 group-hover:text-dark-400 transition-colors" />
                </motion.div>
              </button>
              
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext items={categoryCards.map(c => c.id)} strategy={rectSortingStrategy}>
                        <div className={`grid ${gridCols[settings.columns]} gap-4`}>
                          {categoryCards.map(card => (
                            <SortableServiceCard key={card.id} card={card}
                              onEdit={(c) => { setEditingCard(c); setShowCardEditor(true); }}
                              onDelete={handleDeleteCard}
                              integrationData={integrationData[card.id]}
                              monitoringStatus={monitoringStatuses[card.id]}
                              onShowDetail={handleShowDetail} />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          );
        })}

        <motion.button
          className="fixed bottom-8 right-8 w-14 h-14 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center shadow-lg hover:shadow-xl hover:shadow-blue-500/25 transition-all"
          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
          onClick={() => { setEditingCard(null); setShowCardEditor(true); }}>
          <Plus size={24} />
        </motion.button>
      </main>

      <AnimatePresence>
        {showCardEditor && (
          <CardEditor card={editingCard} categories={categories} integrationTemplates={integrationTemplates}
            onSave={handleSaveCard} onClose={() => { setShowCardEditor(false); setEditingCard(null); }}
            saveStatus={cardSaveStatus} lang={lang} />
        )}
        {showSettings && (
          <SettingsModal settings={settings} categories={categories} integrationTemplates={integrationTemplates}
            onSave={handleSaveSettings} onClose={() => setShowSettings(false)}
            onExport={handleExport} onImport={handleImport} onCategoryChange={handleCategoryChange}
            saveStatus={saveStatus} lang={lang} />
        )}
        {detailCard && (
          <CardDetailModal card={detailCard} data={detailData} onClose={() => { setDetailCard(null); setDetailData(null); }} lang={lang} />
        )}
      </AnimatePresence>
    </div>
  );
}
