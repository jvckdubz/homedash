import React, { useState, useEffect, useRef } from 'react';
import { Globe, Plus, Trash2, GripVertical, ExternalLink, Image, Upload, X, ChevronDown, ChevronUp, Info, Shield, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Toggle } from '../common';
import api from '../../api';

function StatusPageSettings() {
  const [config, setConfig] = useState({
    enabled: false,
    title: 'Статус сервисов',
    pageTitle: '',
    description: '',
    logo: '',
    footerText: '',
    lang: 'ru',
    monitors: []
  });
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedMonitor, setExpandedMonitor] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingMonitorLogo, setUploadingMonitorLogo] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const mainLogoRef = useRef(null);
  const monitorLogoRefs = useRef({});

  useEffect(() => {
    loadData();
  }, []);

  // Автоскрытие статуса сохранения
  useEffect(() => {
    if (saveStatus === 'saved' || saveStatus === 'error') {
      const timer = setTimeout(() => setSaveStatus(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const loadData = async () => {
    try {
      const [configData, cardsData] = await Promise.all([
        api.get('/api/status-page/config').catch(() => null),
        api.get('/api/config').then(c => c.cards || []).catch(() => [])
      ]);
      if (configData) {
        setConfig({ ...config, ...configData });
      }
      setCards(cardsData);
    } catch (err) {
      console.error('Ошибка загрузки:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setSaveStatus('saving');
    try {
      await api.post('/api/status-page/config', config);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  // Загрузка логотипа страницы
  const handleMainLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      formData.append('type', 'main');
      
      const result = await fetch('/api/status-page/upload-logo', {
        method: 'POST',
        body: formData
      }).then(r => r.json());
      
      if (result.url) {
        updateConfig('logo', result.url);
      }
    } catch (err) {
      console.error('Ошибка загрузки логотипа:', err);
    } finally {
      setUploadingLogo(false);
    }
  };

  // Загрузка логотипа монитора
  const handleMonitorLogoUpload = async (cardId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingMonitorLogo(cardId);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      formData.append('type', 'monitor');
      formData.append('cardId', cardId);
      
      const result = await fetch('/api/status-page/upload-logo', {
        method: 'POST',
        body: formData
      }).then(r => r.json());
      
      if (result.url) {
        updateMonitor(cardId, 'customLogo', result.url);
      }
    } catch (err) {
      console.error('Ошибка загрузки логотипа:', err);
    } finally {
      setUploadingMonitorLogo(null);
    }
  };

  const addMonitor = (cardId) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    
    if (config.monitors.some(m => m.cardId === cardId)) return;

    setConfig(prev => ({
      ...prev,
      monitors: [
        ...prev.monitors,
        {
          cardId: card.id,
          // Данные из карточки (для справки)
          originalName: card.name,
          originalUrl: card.url || '',
          // Кастомные данные для страницы статуса
          customName: card.name,
          customDescription: '',
          customUrl: card.url || '',
          customLogo: '',
          showLink: false
        }
      ]
    }));
    
    // Раскрываем новый монитор для редактирования
    setExpandedMonitor(cardId);
  };

  const removeMonitor = (cardId) => {
    setConfig(prev => ({
      ...prev,
      monitors: prev.monitors.filter(m => m.cardId !== cardId)
    }));
    if (expandedMonitor === cardId) {
      setExpandedMonitor(null);
    }
  };

  const updateMonitor = (cardId, key, value) => {
    setConfig(prev => ({
      ...prev,
      monitors: prev.monitors.map(m => 
        m.cardId === cardId ? { ...m, [key]: value } : m
      )
    }));
  };

  // Карточки с включенным мониторингом, которые ещё не добавлены
  const availableCards = cards.filter(
    c => c.monitoring?.enabled && !config.monitors.some(m => m.cardId === c.id)
  );

  if (loading) {
    return <div className="text-center py-8 text-dark-400">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Включение страницы статуса */}
      <div className="p-4 bg-dark-800/50 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              config.enabled ? 'bg-green-500/20 text-green-400' : 'bg-dark-700 text-dark-400'
            }`}>
              <Globe size={20} />
            </div>
            <div>
              <div className="font-medium">Публичная страница статуса</div>
              <div className="text-sm text-dark-400">
                {config.enabled ? 'Доступна по адресу /status' : 'Отключена'}
              </div>
            </div>
          </div>
          <Toggle 
            checked={config.enabled}
            onChange={(v) => updateConfig('enabled', v)}
          />
        </div>

        {config.enabled && (
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <a 
              href="/status" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
            >
              <ExternalLink size={14} />
              Открыть страницу статуса
            </a>
          </div>
        )}
      </div>

      {config.enabled && (
        <>
          {/* Настройки страницы */}
          <div className="p-4 bg-dark-800/50 rounded-xl space-y-4">
            <h3 className="font-medium text-dark-300">Настройки страницы</h3>
            
            <div>
              <label className="block text-sm text-dark-400 mb-2">Заголовок</label>
              <input
                type="text"
                className="input-field"
                value={config.title}
                onChange={(e) => updateConfig('title', e.target.value)}
                placeholder="Статус сервисов"
              />
            </div>

            <div>
              <label className="block text-sm text-dark-400 mb-2">Описание</label>
              <input
                type="text"
                className="input-field"
                value={config.description}
                onChange={(e) => updateConfig('description', e.target.value)}
                placeholder="Мониторинг состояния наших сервисов"
              />
            </div>

            {/* Логотип страницы */}
            <div>
              <label className="block text-sm text-dark-400 mb-2">Логотип страницы</label>
              <div className="flex items-center gap-4">
                {config.logo ? (
                  <div className="relative">
                    <img 
                      src={config.logo} 
                      alt="Логотип" 
                      className="w-16 h-16 rounded-xl object-contain bg-dark-700"
                    />
                    <button
                      onClick={() => updateConfig('logo', '')}
                      className="btn-xs absolute bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600"
                      style={{ top: -4, right: -4, width: 16, height: 16 }}
                    >
                      <X style={{ width: 10, height: 10 }} />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-dark-700 flex items-center justify-center text-dark-500">
                    <Image size={24} />
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <input
                    ref={mainLogoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleMainLogoUpload}
                  />
                  <button
                    onClick={() => mainLogoRef.current?.click()}
                    disabled={uploadingLogo}
                    className="px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    <Upload size={14} />
                    {uploadingLogo ? 'Загрузка...' : 'Загрузить файл'}
                  </button>
                  <input
                    type="text"
                    className="input-field text-sm"
                    value={config.logo}
                    onChange={(e) => updateConfig('logo', e.target.value)}
                    placeholder="Или вставьте URL изображения"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm text-dark-400 mb-2">Текст в подвале</label>
              <input
                type="text"
                className="input-field"
                value={config.footerText}
                onChange={(e) => updateConfig('footerText', e.target.value)}
                placeholder="Powered by HomeDash"
              />
            </div>

            <div>
              <label className="block text-sm text-dark-400 mb-2">Название вкладки браузера</label>
              <input
                type="text"
                className="input-field"
                value={config.pageTitle || ''}
                onChange={(e) => updateConfig('pageTitle', e.target.value)}
                placeholder={config.title || 'Статус сервисов'}
              />
              <div className="text-xs text-dark-500 mt-1">
                Если не указано, будет использоваться заголовок
              </div>
            </div>

            <div>
              <label className="block text-sm text-dark-400 mb-2">Язык страницы</label>
              <select
                className="input-field"
                value={config.lang || 'ru'}
                onChange={(e) => updateConfig('lang', e.target.value)}
              >
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
              <div className="text-xs text-dark-500 mt-1">
                Язык интерфейса публичной страницы статуса
              </div>
            </div>
          </div>

          {/* Безопасность и публичный доступ */}
          <div className="p-4 bg-dark-800/50 rounded-xl space-y-4">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-blue-400" />
              <h3 className="font-medium text-dark-300">Публичный доступ</h3>
            </div>
            
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-start gap-2 text-sm text-blue-300">
                <Info size={16} className="mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <p>Для безопасного публичного доступа рекомендуется использовать обратный прокси (nginx/traefik).</p>
                  <p><b>Пример для Nginx Proxy Manager (вкладка Advanced):</b></p>
                  <pre className="mt-2 p-2 bg-dark-900 rounded text-xs overflow-x-auto">
{`location = /status {
    proxy_pass http://IP:PORT;
}
location /assets {
    proxy_pass http://IP:PORT;
}
location /api/status-page/public {
    proxy_pass http://IP:PORT;
}
location /api/status-page/logos {
    proxy_pass http://IP:PORT;
}
location = /favicon.svg {
    proxy_pass http://IP:PORT;
}
location = /manifest.json {
    proxy_pass http://IP:PORT;
}
location / {
    return 403;
}`}
                  </pre>
                  <p className="text-dark-400 text-xs mt-2">
                    Замените IP:PORT на адрес HomeDash (например 192.168.1.100:3000). Это откроет только /status, остальное - 403 Forbidden.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Мониторы на странице */}
          <div className="p-4 bg-dark-800/50 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-dark-300">Сервисы на странице</h3>
              <span className="text-sm text-dark-500">{config.monitors.length} сервисов</span>
            </div>

            {/* Список добавленных мониторов */}
            {config.monitors.length > 0 ? (
              <div className="space-y-3">
                {config.monitors.map((monitor) => {
                  const isExpanded = expandedMonitor === monitor.cardId;
                  
                  return (
                    <div 
                      key={monitor.cardId}
                      className={`bg-dark-700/50 rounded-xl border overflow-hidden ${
                        monitor.maintenance ? 'border-blue-500/50' : 'border-dark-600'
                      }`}
                    >
                      {/* Заголовок монитора */}
                      <div 
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-dark-700/30"
                        onClick={() => setExpandedMonitor(isExpanded ? null : monitor.cardId)}
                      >
                        <div className="flex items-center gap-3">
                          <GripVertical size={16} className="text-dark-500" />
                          {monitor.customLogo ? (
                            <img src={monitor.customLogo} alt="" className="w-8 h-8 rounded-lg object-contain" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-dark-600 flex items-center justify-center text-dark-400">
                              <Globe size={16} />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">{monitor.customName}</span>
                              {monitor.maintenance && (
                                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full flex items-center gap-1">
                                  <Wrench size={10} />
                                  Обслуживание
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-dark-500">
                              Карточка: {monitor.originalName}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); removeMonitor(monitor.cardId); }}
                            className="p-2 hover:bg-red-500/20 rounded-lg text-red-400"
                          >
                            <Trash2 size={16} />
                          </button>
                          {isExpanded ? <ChevronUp size={16} className="text-dark-400" /> : <ChevronDown size={16} className="text-dark-400" />}
                        </div>
                      </div>

                      {/* Развернутые настройки */}
                      {isExpanded && (
                        <div className="p-4 pt-0 space-y-4 border-t border-dark-600">
                          {/* Режим обслуживания */}
                          <div className="flex items-center justify-between py-2">
                            <span className="text-sm text-dark-400">Режим обслуживания</span>
                            <Toggle
                              checked={monitor.maintenance || false}
                              onChange={(v) => {
                                updateMonitor(monitor.cardId, 'maintenance', v);
                                fetch(`/api/status-page/maintenance/${monitor.cardId}`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ enabled: v })
                                });
                              }}
                            />
                          </div>

                          {/* Логотип монитора */}
                          <div>
                            <label className="block text-sm text-dark-400 mb-2">Логотип сервиса</label>
                            <div className="flex items-center gap-4">
                              {monitor.customLogo ? (
                                <div className="relative">
                                  <img 
                                    src={monitor.customLogo} 
                                    alt="" 
                                    className="w-12 h-12 rounded-lg object-contain bg-dark-600"
                                  />
                                  <button
                                    onClick={() => updateMonitor(monitor.cardId, 'customLogo', '')}
                                    className="btn-xs absolute bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600"
                                    style={{ top: -4, right: -4, width: 16, height: 16 }}
                                  >
                                    <X style={{ width: 10, height: 10 }} />
                                  </button>
                                </div>
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-dark-600 flex items-center justify-center text-dark-500">
                                  <Image size={20} />
                                </div>
                              )}
                              <div className="flex-1 space-y-2">
                                <input
                                  ref={el => monitorLogoRefs.current[monitor.cardId] = el}
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => handleMonitorLogoUpload(monitor.cardId, e)}
                                />
                                <button
                                  onClick={() => monitorLogoRefs.current[monitor.cardId]?.click()}
                                  disabled={uploadingMonitorLogo === monitor.cardId}
                                  className="px-3 py-1.5 bg-dark-600 hover:bg-dark-500 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
                                >
                                  <Upload size={14} />
                                  {uploadingMonitorLogo === monitor.cardId ? 'Загрузка...' : 'Загрузить'}
                                </button>
                                <input
                                  type="text"
                                  className="input-field text-sm"
                                  value={monitor.customLogo}
                                  onChange={(e) => updateMonitor(monitor.cardId, 'customLogo', e.target.value)}
                                  placeholder="Или URL изображения"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Название */}
                          <div>
                            <label className="block text-sm text-dark-400 mb-2">
                              Название на странице статуса
                            </label>
                            <input
                              type="text"
                              className="input-field"
                              value={monitor.customName}
                              onChange={(e) => updateMonitor(monitor.cardId, 'customName', e.target.value)}
                              placeholder="Название сервиса"
                            />
                          </div>

                          {/* Описание */}
                          <div>
                            <label className="block text-sm text-dark-400 mb-2">
                              Описание
                            </label>
                            <textarea
                              className="input-field resize-none"
                              rows={2}
                              value={monitor.customDescription}
                              onChange={(e) => updateMonitor(monitor.cardId, 'customDescription', e.target.value)}
                              placeholder="Краткое описание сервиса для посетителей"
                            />
                          </div>

                          {/* Ссылка */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-dark-400">Показывать ссылку на сервис</span>
                              <Toggle
                                checked={monitor.showLink || false}
                                onChange={(v) => updateMonitor(monitor.cardId, 'showLink', v)}
                              />
                            </div>
                            {monitor.showLink && (
                              <input
                                type="text"
                                className="input-field"
                                value={monitor.customUrl}
                                onChange={(e) => updateMonitor(monitor.cardId, 'customUrl', e.target.value)}
                                placeholder="https://example.com"
                              />
                            )}
                          </div>

                          <div className="pt-2 text-xs text-dark-500">
                            Мониторинг берётся из карточки "{monitor.originalName}", но отображение на странице статуса настраивается здесь независимо.
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-dark-500">
                Добавьте сервисы для отображения на странице статуса
              </div>
            )}

            {/* Добавление мониторов */}
            {availableCards.length > 0 && (
              <div className="pt-4 border-t border-dark-700">
                <label className="block text-sm text-dark-400 mb-2">Добавить сервис</label>
                <div className="flex gap-2 flex-wrap">
                  {availableCards.map(card => (
                    <button
                      key={card.id}
                      onClick={() => addMonitor(card.id)}
                      className="px-3 py-1.5 bg-dark-700 hover:bg-dark-600 rounded-lg text-sm flex items-center gap-2 transition-colors"
                    >
                      <Plus size={14} />
                      {card.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {availableCards.length === 0 && config.monitors.length === 0 && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm text-yellow-400">
                  Нет карточек с включенным мониторингом. Включите мониторинг на нужных карточках в их редакторе.
                </p>
              </div>
            )}
          </div>

          {/* Кнопка сохранения */}
          <div className="flex items-center gap-3">
            <button
              onClick={saveConfig}
              disabled={saving}
              className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-xl font-medium transition-colors"
            >
              {saving ? 'Сохранение...' : 'Сохранить настройки'}
            </button>
            {saveStatus === 'saving' && (
              <Loader2 size={20} className="text-blue-400 animate-spin" />
            )}
            {saveStatus === 'saved' && (
              <CheckCircle size={20} className="text-green-400" />
            )}
            {saveStatus === 'error' && (
              <AlertCircle size={20} className="text-red-400" />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default StatusPageSettings;
