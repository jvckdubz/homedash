import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy
} from '@dnd-kit/sortable';
import {
  Settings, Plus, Grid, RefreshCw, ChevronDown, Download, Receipt,
  Globe, CheckCircle2, Server, Home, Activity, AlertCircle
} from 'lucide-react';

// API
import api from './api';

// Constants
import { translations } from './constants/translations';
import { serviceIcons, categoryIcons } from './constants/icons';

// Hooks
import { I18nContext } from './hooks/useI18n';
import useNotifications from './hooks/useNotifications';

// Components
import { Clock, Greeting } from './components/common';
import TranslateWidget from './components/common/TranslateWidget';
import MobileDashboard from './components/dashboard/MobileDashboard';
import PaymentsPage from './components/payments/PaymentsPage';
import TasksPage from './components/tasks/TasksPage';
import { ServiceCard, SortableServiceCard } from './components/cards/ServiceCard';
import CardEditor from './components/cards/CardEditor';
import CardDetailModal from './components/cards/CardDetailModal';
import SettingsModal from './components/settings/SettingsModal';

// Grid columns mapping
const gridCols = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6'
};

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
      // Skip SW on HTTPS with self-signed cert (will fail anyway)
      const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      const isHttp = location.protocol === 'http:';
      
      if (!isLocalhost && !isHttp) {
        // HTTPS with IP/domain - likely self-signed, skip SW
        return;
      }
      
      // Регистрируем SW
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('[App] SW registered');
          
          // Проверяем обновления SW каждые 5 минут
          setInterval(() => {
            registration.update().catch(() => {});
          }, 5 * 60 * 1000);
        })
        .catch(() => {
          // Silently ignore - app works without SW
        });
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
      
      // Reload everything after import
      await loadConfig();
      await loadIntegrationTemplates();
      await loadMonitoringStatuses();
      await loadWeather();
      
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
      <>
        <PaymentsPage 
          cards={cards} 
          onBack={() => setCurrentPage('dashboard')}
          onEditCard={(card) => { setEditingCard(card); setShowCardEditor(true); setCurrentPage('dashboard'); }}
          onViewCard={(card) => { 
            // Открываем карточку со всеми данными (как при обычном клике)
            const cardIntegrationData = integrationData[card.id] || {};
            const cardMonitoringStatus = monitoringStatuses[card.id];
            setDetailCard(card);
            setDetailData({ 
              ...cardIntegrationData, 
              configured: !!card.integration?.type,
              monitoringStatus: card.monitoring?.enabled ? cardMonitoringStatus : null,
              billing: card.billing?.enabled ? card.billing : null
            });
          }}
          onRefreshCards={loadConfig}
        />
        {/* Detail Modal для просмотра карточки */}
        <AnimatePresence>
          {detailCard && (
            <CardDetailModal card={detailCard} data={detailData} onClose={() => { setDetailCard(null); setDetailData(null); }} />
          )}
        </AnimatePresence>
      </>
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
            onViewCard={(card) => { 
              // Открываем карточку со всеми данными (как при обычном клике)
              const cardIntegrationData = integrationData[card.id] || {};
              const cardMonitoringStatus = monitoringStatuses[card.id];
              setDetailCard(card);
              setDetailData({ 
                ...cardIntegrationData, 
                configured: !!card.integration?.type,
                monitoringStatus: card.monitoring?.enabled ? cardMonitoringStatus : null,
                billing: card.billing?.enabled ? card.billing : null
              });
            }}
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
              <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
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
            onTemplateChange={loadIntegrationTemplates}
            saveStatus={saveStatus} lang={lang} />
        )}
        {detailCard && (
          <CardDetailModal card={detailCard} data={detailData} onClose={() => { setDetailCard(null); setDetailData(null); }} lang={lang} />
        )}
      </AnimatePresence>
    </div>
  );
}
