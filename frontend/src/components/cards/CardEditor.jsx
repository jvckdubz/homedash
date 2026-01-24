import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Save, Server, Activity, Cloud, Wrench, Home, Shield, Globe,
  Check, AlertCircle, Eye, EyeOff, RefreshCw, ChevronDown, ChevronUp,
  Bell, Key, Upload, Clock as ClockIcon, Zap, FileText,
  Palette, ArrowLeft, CheckCircle2, Wifi, Trash2, Radio, Signal
} from 'lucide-react';
import api from '../../api';
import { translations } from '../../constants/translations';
import { serviceIcons, presetColors } from '../../constants/icons';
import { ColorPicker, Toggle } from '../common';

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
  const [showIconPickerEditor, setShowIconPickerEditor] = useState(false);

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
  
  console.log('[CardEditor] formData.integration:', formData.integration);
  console.log('[CardEditor] integrationTemplates:', integrationTemplates);
  console.log('[CardEditor] selectedTemplate:', selectedTemplate);
  
  // Автоматические поля на основе authType
  const getTemplateFields = () => {
    if (!selectedTemplate) return [];
    const fields = [...(selectedTemplate.fields || [])];
    
    console.log('[CardEditor] selectedTemplate.authType:', selectedTemplate.authType);
    console.log('[CardEditor] fields before auto-add:', fields);
    
    // Добавляем стандартные поля авторизации если их нет
    if (selectedTemplate.authType === 'apikey' && !fields.find(f => f.key === 'apiKey')) {
      fields.unshift({ key: 'apiKey', label: 'API Key', type: 'password' });
    }
    if (selectedTemplate.authType === 'bearer' && !fields.find(f => f.key === 'token')) {
      fields.unshift({ key: 'token', label: 'Token', type: 'password' });
    }
    if (selectedTemplate.authType === 'basic') {
      if (!fields.find(f => f.key === 'username')) {
        fields.unshift({ key: 'username', label: 'Username', type: 'text' });
      }
      if (!fields.find(f => f.key === 'password')) {
        fields.push({ key: 'password', label: 'Password', type: 'password' });
      }
    }
    
    console.log('[CardEditor] fields after auto-add:', fields);
    return fields;
  };
  
  const templateFields = getTemplateFields();

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
        className="fixed inset-0 z-[400] flex flex-col overflow-hidden bg-dark-900"
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
                    {/* Внешняя иконка по URL */}
                    <div className="mb-3">
                      <label className="block text-sm text-dark-400 mb-1">Иконка по URL</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formData.customIcon || ''}
                          onChange={e => setFormData({...formData, customIcon: e.target.value || null})}
                          placeholder="https://example.com/icon.png"
                          className="input-field flex-1"
                        />
                        {formData.customIcon && (
                          <button
                            onClick={() => setFormData({ ...formData, customIcon: null })}
                            className="px-3 bg-dark-700 hover:bg-dark-600 rounded-xl text-dark-400 transition-colors"
                            title="Очистить"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-dark-500 mt-2">
                        Источники: <a href="https://simpleicons.org" target="_blank" rel="noopener" className="text-blue-400 hover:underline">SimpleIcons</a>, 
                        {' '}<a href="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/" target="_blank" rel="noopener" className="text-blue-400 hover:underline">Dashboard Icons</a>,
                        {' '}<a href="https://selfh.st/icons/" target="_blank" rel="noopener" className="text-blue-400 hover:underline">Selfh.st</a>
                      </p>
                    </div>
                    
                    {/* Предпросмотр внешней иконки */}
                    {formData.customIcon && (
                      <div className="flex items-center gap-3 mb-3 p-3 bg-dark-800 rounded-xl">
                        <img 
                          src={formData.customIcon} 
                          alt="Custom icon" 
                          className="w-10 h-10 rounded-lg object-contain bg-dark-700"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <div className="flex-1">
                          <div className="text-sm text-dark-300">Внешняя иконка</div>
                          <div className="text-xs text-dark-500 truncate max-w-[200px]">{formData.customIcon}</div>
                        </div>
                      </div>
                    )}

                    {/* Кнопка получения favicon */}
                    {formData.url && !formData.customIcon && (
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
                          Автоматически из URL сервиса
                        </button>
                        {faviconError && (
                          <p className="text-red-400 text-xs mt-2">{faviconError}</p>
                        )}
                      </div>
                    )}
                    
                    {/* Спойлер иконок */}
                    <button 
                      type="button"
                      onClick={() => setShowIconPickerEditor(!showIconPickerEditor)}
                      className="w-full flex items-center justify-between p-3 bg-dark-800 hover:bg-dark-700 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-dark-700 flex items-center justify-center" style={{ color: formData.color }}>
                          {formData.customIcon ? (
                            <img src={formData.customIcon} alt="icon" className="w-6 h-6 object-contain" />
                          ) : (
                            React.createElement(serviceIcons[formData.icon] || serviceIcons.default)
                          )}
                        </div>
                        <span className="text-sm text-dark-400">Иконка</span>
                      </div>
                      {showIconPickerEditor ? <ChevronUp size={18} className="text-dark-400" /> : <ChevronDown size={18} className="text-dark-400" />}
                    </button>
                    
                    <AnimatePresence>
                      {showIconPickerEditor && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-wrap gap-2 pt-3">
                            {icons.map(icon => {
                              const IconComp = serviceIcons[icon];
                              return (
                                <button key={icon} onClick={() => { setFormData({...formData, icon, customIcon: null}); setShowIconPickerEditor(false); }}
                                  className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${formData.icon === icon && !formData.customIcon ? 'bg-blue-500/30 ring-2 ring-blue-500' : 'bg-dark-700 hover:bg-dark-600'}`}>
                                  <div className="w-5 h-5" style={{ color: formData.color }}><IconComp /></div>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
                  {selectedTemplate && templateFields.map(field => (
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
                          {sshKeys.map(key => <option key={key.name} value={key.name}>{key.name}</option>)}
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
                {/* Внешняя иконка по URL */}
                <div className="mb-3">
                  <input
                    type="text"
                    value={formData.customIcon || ''}
                    onChange={e => setFormData({...formData, customIcon: e.target.value || null})}
                    placeholder="URL иконки (https://...)"
                    className="input-field mb-2"
                  />
                  <p className="text-xs text-dark-500">
                    <a href="https://simpleicons.org" target="_blank" rel="noopener" className="text-blue-400">SimpleIcons</a>
                    {' · '}
                    <a href="https://selfh.st/icons/" target="_blank" rel="noopener" className="text-blue-400">Selfh.st</a>
                  </p>
                </div>

                {/* Предпросмотр внешней иконки */}
                {formData.customIcon && (
                  <div className="flex items-center gap-3 mb-3 p-3 bg-dark-800 rounded-xl">
                    <img 
                      src={formData.customIcon} 
                      alt="Custom icon" 
                      className="w-10 h-10 rounded-lg object-contain bg-dark-700"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-dark-300">Внешняя иконка</div>
                      <div className="text-xs text-dark-500 truncate">{formData.customIcon}</div>
                    </div>
                    <button
                      onClick={() => setFormData({ ...formData, customIcon: null })}
                      className="p-2 hover:bg-dark-700 rounded-lg text-dark-400 flex-shrink-0"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                {/* Кнопка получения favicon */}
                {formData.url && !formData.customIcon && (
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
                      Автоматически из URL
                    </button>
                    {faviconError && (
                      <p className="text-red-400 text-xs mt-2">{faviconError}</p>
                    )}
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

              {templateFields.map(field => (
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
export default CardEditor;
