import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Save, Settings, Globe, Palette, Bell, Key, Download, Upload,
  Server, Folder, Database, Check, AlertCircle, Eye, EyeOff, RefreshCw,
  Activity, Plus, Edit3, Trash2, ChevronDown, ChevronUp, Cpu, HardDrive, Clock as ClockIcon, Zap,
  FolderPlus, Terminal, FileJson, Container, ArrowLeft, CheckCircle2
} from 'lucide-react';
import api from '../../api';
import { translations } from '../../constants/translations';
import { categoryIcons } from '../../constants/icons';
import { Toggle, ColorPicker } from '../common';
import CategoryEditor from './CategoryEditor';
import IntegrationTemplateEditor from './IntegrationTemplateEditor';
import SystemInfoSection from './SystemInfoSection';
import NotificationsSettings from './NotificationsSettings';
import MonitoringSettings from './MonitoringSettings';
import StatusPageSettings from './StatusPageSettings';

function SettingsModal({ settings, categories, integrationTemplates, onSave, onClose, onExport, onImport, onCategoryChange, onTemplateChange, saveStatus, lang }) {
  // Local translation function
  const t = (key) => translations[lang]?.[key] || translations['ru']?.[key] || key;
  
  const [formData, setFormData] = useState(settings);
  const [activeTab, setActiveTab] = useState(null); // null = show tabs list on mobile
  const [editingCategory, setEditingCategory] = useState(null);
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [localTemplates, setLocalTemplates] = useState(integrationTemplates);
  const [sshKeys, setSshKeys] = useState([]);
  const [sshTestResult, setSshTestResult] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [hasUpdate, setHasUpdate] = useState(false);
  const fileInputRef = useRef(null);
  const sshKeyInputRef = useRef(null);
  
  const overlayRef = useRef(null);
  const mouseDownTarget = useRef(null);

  // Check for updates on mount
  useEffect(() => {
    api.get('/api/system/check-update')
      .then(data => setHasUpdate(data?.hasUpdate || false))
      .catch(() => {});
  }, []);

  // Sync local templates with props
  useEffect(() => {
    setLocalTemplates(integrationTemplates);
  }, [integrationTemplates]);

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
    try {
      await api.post('/api/integrations/templates', templateData);
      // Update local state immediately
      setLocalTemplates(prev => {
        const existing = prev.findIndex(t => t.type === templateData.type);
        if (existing !== -1) {
          const updated = [...prev];
          updated[existing] = { ...templateData, builtin: false };
          return updated;
        }
        return [...prev, { ...templateData, builtin: false }];
      });
      setShowTemplateEditor(false);
      setEditingTemplate(null);
      if (onTemplateChange) onTemplateChange();
    } catch (err) {
      console.error('Failed to save template:', err);
      alert('Ошибка сохранения: ' + err.message);
    }
  };

  const handleTemplateDelete = async (type) => {
    if (!confirm('Удалить шаблон интеграции?')) return;
    await api.delete(`/api/integrations/templates/${type}`);
    // Update local state immediately
    setLocalTemplates(prev => prev.filter(t => t.type !== type));
    setShowTemplateEditor(false);
    setEditingTemplate(null);
    if (onTemplateChange) onTemplateChange();
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
    {id:'statusPage', label: 'Страница статуса', icon: Globe},
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
          className="fixed inset-0 z-[400] flex flex-col bg-dark-900"
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
                  const showUpdateBadge = tab.id === 'system' && hasUpdate;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className="w-full flex items-center gap-4 p-4 bg-dark-800/50 hover:bg-dark-700/50 rounded-xl transition-colors"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center relative">
                        <TabIcon size={20} className="text-blue-400" />
                        {showUpdateBadge && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full border-2 border-dark-800" />
                        )}
                      </div>
                      <span className="font-medium">{tab.label}</span>
                      {showUpdateBadge && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">NEW</span>
                      )}
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
                    {localTemplates.map(tmpl => (
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

                {activeTab === 'statusPage' && (
                  <StatusPageSettings />
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
                  const showUpdateBadge = tab.id === 'system' && hasUpdate;
                  return (
                    <button key={tab.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left relative ${
                        activeTab === tab.id 
                          ? 'bg-blue-500/20 text-blue-400' 
                          : 'hover:bg-dark-700 text-dark-300'
                      }`}
                      onClick={() => setActiveTab(tab.id)}>
                      <div className="relative">
                        <TabIcon size={18} />
                        {showUpdateBadge && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-500 rounded-full" />
                        )}
                      </div>
                      {tab.label}
                      {showUpdateBadge && (
                        <span className="ml-auto px-1.5 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded">NEW</span>
                      )}
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

            {activeTab === 'statusPage' && (
              <motion.div
                key="statusPage"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
              <StatusPageSettings />
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
                  {localTemplates.map(tmpl => (
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
export default SettingsModal;
