import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Sun, Moon, CloudSun, CloudRain, CloudSnow, CloudLightning, CloudFog, Cloudy, Cloud,
  ThermometerSun, Droplets, Wind, Cpu, HardDrive, Server, Container, Shield, Globe,
  Lightbulb, ToggleRight, Gauge, PlayCircle, PauseCircle, Layers, Clock as ClockIcon, Activity,
  Wifi, Database, FileJson, RefreshCw
} from 'lucide-react';
import { presetColors } from '../../constants/icons';

// Weather Icon Component
export const WeatherIcon = ({ code, className }) => {
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

// Color Picker Component
export function ColorPicker({ value, onChange, label }) {
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

// iOS-style Toggle Component
export function Toggle({ checked, onChange, disabled = false }) {
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

// Clock Component
export function Clock({ weatherData }) {
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

// Greeting Component
export function Greeting({ name }) {
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

// Integration Stats Display
export function IntegrationStats({ card, data }) {
  if (!data || data.error || !data.configured) return null;

  const integrationType = card.integration?.type;

  if (integrationType === 'proxmox') {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div className="flex items-center gap-2">
          <Cpu size={12} className="text-blue-400 flex-shrink-0" />
          <div className="progress-bar flex-1 h-1.5">
            <div className="progress-fill bg-blue-500 h-1.5" style={{ width: `${data.cpu}%` }} />
          </div>
          <span className="text-dark-300 text-[11px] w-9 text-right">{data.cpu}%</span>
        </div>
        <div className="flex items-center gap-2">
          <HardDrive size={12} className="text-purple-400 flex-shrink-0" />
          <div className="progress-bar flex-1 h-1.5">
            <div className="progress-fill bg-purple-500 h-1.5" style={{ width: `${data.memory?.percent}%` }} />
          </div>
          <span className="text-dark-300 text-[11px] w-9 text-right">{data.memory?.percent}%</span>
        </div>
        <div className="flex items-center gap-1.5" title="Virtual Machines">
          <Server size={12} className="text-blue-400 flex-shrink-0" />
          <span className="text-green-400">{data.vms?.running || 0}</span>
          <span className="text-dark-600">/</span>
          <span className="text-dark-500">{data.vms?.total || 0}</span>
        </div>
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
        <div className="flex items-center gap-2">
          <Shield size={12} className="text-green-400 flex-shrink-0" />
          <div className="progress-bar flex-1 h-1.5">
            <div className="progress-fill bg-green-500 h-1.5" style={{ width: `${data.blockPercent}%` }} />
          </div>
          <span className="text-green-400 text-[11px] w-9 text-right">{data.blockPercent}%</span>
        </div>
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

  if (integrationType === 'portainer') {
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
        <div className="flex items-center gap-1.5" title="Стеки">
          <Layers size={12} className="text-blue-400 flex-shrink-0" />
          <span className="text-blue-400">{data.stacks || 0}</span>
          <span className="text-dark-600">stacks</span>
        </div>
        <div className="flex items-center gap-1.5" title="Окружения">
          <Server size={12} className="text-dark-400 flex-shrink-0" />
          <span className="text-dark-400">{data.totalEndpoints || 0}</span>
          <span className="text-dark-600">envs</span>
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
        <div className="flex items-center gap-2">
          <Cpu size={12} className="text-orange-400 flex-shrink-0" />
          <div className="progress-bar flex-1 h-1.5">
            <div className="progress-fill bg-orange-500 h-1.5" style={{ width: `${data.cpu || 0}%` }} />
          </div>
          <span className="text-dark-300 text-[11px] w-9 text-right">{data.cpu || 0}%</span>
        </div>
        <div className="flex items-center gap-2">
          <HardDrive size={12} className="text-blue-400 flex-shrink-0" />
          <div className="progress-bar flex-1 h-1.5">
            <div className="progress-fill bg-blue-500 h-1.5" style={{ width: `${data.memory?.percent || 0}%` }} />
          </div>
          <span className="text-dark-300 text-[11px] w-9 text-right">{parseFloat(data.memory?.percent || 0).toFixed(0)}%</span>
        </div>
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
        <div className="flex items-center gap-2">
          <Activity size={12} className="text-orange-400 flex-shrink-0" />
          <div className="progress-bar flex-1 h-1.5">
            <div className="progress-fill bg-orange-500 h-1.5" 
              style={{ width: `${Math.min(parseFloat(data.load?.percent || 0), 100)}%` }} />
          </div>
          <span className="text-dark-300 text-[11px] w-8 text-right">{data.load?.load1}</span>
        </div>
        <div className="flex items-center gap-2">
          <HardDrive size={12} className="text-blue-400 flex-shrink-0" />
          <div className="progress-bar flex-1 h-1.5">
            <div className="progress-fill bg-blue-500 h-1.5" 
              style={{ width: `${data.memory?.percent || 0}%` }} />
          </div>
          <span className="text-dark-300 text-[11px] w-9 text-right">{data.memory?.percent}%</span>
        </div>
        <div className="flex items-center gap-1.5" title="Uptime">
          <ClockIcon size={12} className="text-green-400 flex-shrink-0" />
          <span className="text-dark-300">{data.uptime?.formatted}</span>
        </div>
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
        <div className="flex items-center gap-2">
          <Cpu size={12} className="text-orange-400 flex-shrink-0" />
          <div className="progress-bar flex-1 h-1.5">
            <div className="progress-fill bg-orange-500 h-1.5" style={{ width: `${data.cpu}%` }} />
          </div>
          <span className="text-dark-300 text-[11px] w-9 text-right">{data.cpu}%</span>
        </div>
        <div className="flex items-center gap-2">
          <HardDrive size={12} className="text-blue-400 flex-shrink-0" />
          <div className="progress-bar flex-1 h-1.5">
            <div className="progress-fill bg-blue-500 h-1.5" style={{ width: `${data.memory?.percent}%` }} />
          </div>
          <span className="text-dark-300 text-[11px] w-9 text-right">{data.memory?.percent}%</span>
        </div>
        <div className="flex items-center gap-1.5" title="Uptime">
          <ClockIcon size={12} className="text-green-400 flex-shrink-0" />
          <span className="text-dark-300">{data.uptime?.formatted}</span>
        </div>
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

// Provider Icons for PaymentsPage
export const providerIcons = [
  { id: 'wifi', name: 'Интернет' },
  { id: 'phone', name: 'Телефон' },
  { id: 'mobile', name: 'Мобильный' },
  { id: 'tv', name: 'ТВ' },
  { id: 'electric', name: 'Электричество' },
  { id: 'gas', name: 'Газ' },
  { id: 'water', name: 'Вода' },
  { id: 'utilities', name: 'Коммуналка' },
  { id: 'home', name: 'Дом' },
  { id: 'car', name: 'Авто' },
  { id: 'fuel', name: 'Топливо' },
  { id: 'bike', name: 'Велосипед' },
  { id: 'bus', name: 'Автобус' },
  { id: 'train', name: 'Поезд' },
  { id: 'plane', name: 'Самолёт' },
  { id: 'stethoscope', name: 'Медицина' },
  { id: 'health', name: 'Здоровье' },
  { id: 'medicine', name: 'Лекарства' },
  { id: 'dumbbell', name: 'Спорт' },
  { id: 'gamepad', name: 'Игры' },
  { id: 'music', name: 'Музыка' },
  { id: 'film', name: 'Кино' },
  { id: 'play', name: 'Стриминг' },
  { id: 'headphones', name: 'Аудио' },
  { id: 'cat', name: 'Питомцы' },
  { id: 'baby', name: 'Дети' },
  { id: 'food', name: 'Еда' },
  { id: 'coffee', name: 'Кофе' },
  { id: 'wine', name: 'Напитки' },
  { id: 'shopping', name: 'Покупки' },
  { id: 'bag', name: 'Магазин' },
  { id: 'gift', name: 'Подарки' },
  { id: 'subscription', name: 'Подписка' },
  { id: 'education', name: 'Учёба' },
  { id: 'book', name: 'Книги' },
  { id: 'briefcase', name: 'Работа' },
  { id: 'cloud', name: 'Облако' },
  { id: 'server', name: 'Сервер' },
  { id: 'shield', name: 'Защита' },
  { id: 'credit-card', name: 'Карта' },
  { id: 'banknote', name: 'Деньги' },
  { id: 'receipt', name: 'Чек' },
  { id: 'tag', name: 'Другое' }
];

export default {
  WeatherIcon,
  ColorPicker,
  Toggle,
  Clock,
  Greeting,
  IntegrationStats,
  providerIcons
};
