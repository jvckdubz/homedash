import React, { useState, useEffect } from 'react';
import { Activity, ExternalLink, Clock, CheckCircle, XCircle, AlertCircle, Wrench, ArrowLeft } from 'lucide-react';

// Переводы
const translations = {
  ru: {
    allOperational: 'Все системы работают нормально',
    someDown: 'Некоторые сервисы недоступны',
    checking: 'Проверка сервисов...',
    maintenance: 'Ведутся плановые работы',
    waiting: 'Ожидание первых проверок...',
    partial: 'Часть сервисов проверяется',
    unknown: 'Статус неизвестен',
    statusUp: 'Работает',
    statusDown: 'Недоступен',
    statusPending: 'Проверяется',
    statusMaintenance: 'Обслуживание',
    statusWaiting: 'Ожидание',
    statusUnknown: 'Ожидание данных',
    for24h: 'за 24ч',
    updated: 'Обновлено',
    loading: 'Загрузка...',
    notConfigured: 'Страница статуса не настроена',
    accessDenied: 'Доступ запрещён',
    loadError: 'Ошибка загрузки',
    connectionError: 'Не удалось загрузить данные',
    noMonitors: 'Нет настроенных мониторов',
    back: 'Назад',
    plannedMaintenance: 'Плановое обслуживание'
  },
  en: {
    allOperational: 'All systems operational',
    someDown: 'Some services are down',
    checking: 'Checking services...',
    maintenance: 'Scheduled maintenance in progress',
    waiting: 'Waiting for first checks...',
    partial: 'Some services are being checked',
    unknown: 'Status unknown',
    statusUp: 'Operational',
    statusDown: 'Down',
    statusPending: 'Checking',
    statusMaintenance: 'Maintenance',
    statusWaiting: 'Waiting',
    statusUnknown: 'Pending',
    for24h: '24h',
    updated: 'Updated',
    loading: 'Loading...',
    notConfigured: 'Status page not configured',
    accessDenied: 'Access denied',
    loadError: 'Load error',
    connectionError: 'Failed to load data',
    noMonitors: 'No monitors configured',
    back: 'Back',
    plannedMaintenance: 'Scheduled maintenance'
  }
};

function StatusPage() {
  const [config, setConfig] = useState(null);
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [lang, setLang] = useState('ru');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  const t = (key) => translations[lang]?.[key] || translations['ru'][key] || key;

  // Отслеживание размера экрана
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadStatusPage();
    const interval = setInterval(loadStatusPage, 30000);
    return () => clearInterval(interval);
  }, []);

  // Устанавливаем title и язык из конфига
  useEffect(() => {
    if (config?.pageTitle) {
      document.title = config.pageTitle;
    }
    if (config?.lang) {
      setLang(config.lang);
    }
    return () => {
      document.title = 'HomeDash';
    };
  }, [config?.pageTitle, config?.lang]);

  const loadStatusPage = async () => {
    try {
      const response = await fetch('/api/status-page/public');
      if (!response.ok) {
        if (response.status === 404) {
          setError('notConfigured');
        } else if (response.status === 403) {
          setError('accessDenied');
        } else {
          setError('loadError');
        }
        return;
      }
      const data = await response.json();
      setConfig(data.config);
      setMonitors(data.monitors || []);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError('connectionError');
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status) => {
    switch (status) {
      case 'up':
        return { 
          icon: CheckCircle, 
          color: 'text-green-400', 
          bg: 'bg-green-500/20',
          label: t('statusUp'),
          dot: 'bg-green-500'
        };
      case 'down':
        return { 
          icon: XCircle, 
          color: 'text-red-400', 
          bg: 'bg-red-500/20',
          label: t('statusDown'),
          dot: 'bg-red-500 animate-pulse'
        };
      case 'pending':
        return { 
          icon: AlertCircle, 
          color: 'text-yellow-400', 
          bg: 'bg-yellow-500/20',
          label: t('statusPending'),
          dot: 'bg-yellow-500 animate-pulse'
        };
      case 'maintenance':
        return { 
          icon: Wrench, 
          color: 'text-blue-400', 
          bg: 'bg-blue-500/20',
          label: t('statusMaintenance'),
          dot: 'bg-blue-500'
        };
      case 'waiting':
        return { 
          icon: Clock, 
          color: 'text-gray-400', 
          bg: 'bg-gray-500/20',
          label: t('statusWaiting'),
          dot: 'bg-gray-500 animate-pulse'
        };
      default:
        return { 
          icon: AlertCircle, 
          color: 'text-gray-400', 
          bg: 'bg-gray-500/20',
          label: t('statusUnknown'),
          dot: 'bg-gray-500 animate-pulse'
        };
    }
  };

  const getOverallStatus = () => {
    if (monitors.length === 0) return 'unknown';
    if (monitors.some(m => m.status === 'down')) return 'down';
    if (monitors.some(m => m.status === 'pending')) return 'pending';
    if (monitors.some(m => m.status === 'maintenance')) return 'maintenance';
    if (monitors.every(m => m.status === 'up')) return 'up';
    if (monitors.every(m => m.status === 'unknown' || !m.status)) return 'waiting';
    return 'partial';
  };

  const getOverallMessage = () => {
    const overall = getOverallStatus();
    switch (overall) {
      case 'up': return t('allOperational');
      case 'down': return t('someDown');
      case 'pending': return t('checking');
      case 'maintenance': return t('maintenance');
      case 'waiting': return t('waiting');
      case 'partial': return t('partial');
      default: return t('unknown');
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusName = (s) => {
    switch(s) {
      case 1: return t('statusUp');
      case 0: return t('statusDown');
      case 2: return t('statusPending');
      case 3: return t('statusMaintenance');
      default: return t('statusUnknown');
    }
  };

  const handleBack = () => {
    // В PWA standalone mode history.back() может не работать
    if (window.history.length > 1 && document.referrer) {
      window.history.back();
    } else {
      // Пробуем закрыть окно, если не получится - ничего страшного
      try {
        window.close();
      } catch (e) {
        // Если закрыть не удалось, просто игнорируем
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-10 h-10 md:w-12 md:h-12 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-dark-400">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 md:w-12 md:h-12 text-red-400 mx-auto mb-4" />
          <p className="text-dark-400">{t(error)}</p>
        </div>
      </div>
    );
  }

  const overallStatus = getOverallStatus();
  const overallInfo = getStatusInfo(overallStatus);

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Header */}
      <header className="bg-dark-800 border-b border-dark-700">
        <div className="max-w-4xl mx-auto px-4 py-4 md:py-6">
          <div className="flex items-center gap-3 md:gap-4">
            {/* Кнопка назад - только на мобильных */}
            <button 
              type="button"
              onClick={handleBack}
              className="btn-xs md:hidden p-2 -ml-2 rounded-lg hover:bg-dark-700 text-dark-400 active:bg-dark-600"
              style={{ minWidth: 40, minHeight: 40 }}
            >
              <ArrowLeft size={20} />
            </button>
            
            {config?.logo ? (
              <img src={config.logo} alt="" className="w-10 h-10 md:w-12 md:h-12 rounded-xl object-contain" />
            ) : (
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Activity className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-2xl font-bold text-white truncate">
                {config?.title || 'Status'}
              </h1>
              {config?.description && (
                <p className="text-dark-400 text-xs md:text-sm truncate">{config.description}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Overall Status Banner */}
      <div className={`${overallInfo.bg} border-b border-dark-700`}>
        <div className="max-w-4xl mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center gap-2 md:gap-3">
            <overallInfo.icon className={`w-5 h-5 md:w-6 md:h-6 ${overallInfo.color}`} />
            <span className={`font-medium text-sm md:text-base ${overallInfo.color}`}>
              {getOverallMessage()}
            </span>
          </div>
        </div>
      </div>

      {/* Services List */}
      <main className="max-w-4xl mx-auto px-4 py-4 md:py-8">
        <div className="space-y-3 md:space-y-4">
          {monitors.map((monitor, index) => {
            const statusInfo = getStatusInfo(monitor.status);

            return (
              <div 
                key={index}
                className="bg-dark-800 rounded-xl border border-dark-700 p-3 md:p-4 transition-all duration-300 hover:border-dark-600 hover:shadow-lg hover:shadow-black/20 group"
              >
                {/* Header row */}
                <div className="flex items-center gap-3">
                  {/* Logo + status indicator */}
                  {monitor.logo ? (
                    <div className="relative flex-shrink-0">
                      <img 
                        src={monitor.logo} 
                        alt="" 
                        className="w-10 h-10 md:w-12 md:h-12 rounded-lg object-contain bg-dark-700 transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className={`absolute -bottom-1 -right-1 w-3 h-3 md:w-3.5 md:h-3.5 rounded-full border-2 border-dark-800 ${statusInfo.dot}`} />
                    </div>
                  ) : (
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${statusInfo.dot}`} />
                  )}
                  
                  {/* Name + description */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white text-sm md:text-base truncate">{monitor.name}</h3>
                    {monitor.description && (
                      <p className="text-xs md:text-sm text-dark-400 truncate">{monitor.description}</p>
                    )}
                  </div>
                  
                  {/* Stats + badge */}
                  <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                    {monitor.uptime && (
                      <div className="text-right hidden sm:block">
                        <div className={`text-xs md:text-sm font-medium ${
                          parseFloat(monitor.uptime) >= 99 ? 'text-green-400' :
                          parseFloat(monitor.uptime) >= 95 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {monitor.uptime}%
                        </div>
                        <div className="text-xs text-dark-500">{t('for24h')}</div>
                      </div>
                    )}
                    <span className={`px-2 md:px-3 py-1 rounded-full text-xs md:text-sm whitespace-nowrap ${statusInfo.bg} ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                </div>

                {/* Uptime on mobile - below header */}
                {monitor.uptime && (
                  <div className="flex items-center justify-between mt-2 sm:hidden text-xs">
                    <span className="text-dark-500">Uptime {t('for24h')}:</span>
                    <span className={`font-medium ${
                      parseFloat(monitor.uptime) >= 99 ? 'text-green-400' :
                      parseFloat(monitor.uptime) >= 95 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {monitor.uptime}%
                    </span>
                  </div>
                )}

                {/* Heartbeat Bar */}
                {monitor.heartbeat?.length > 0 && (() => {
                  // На мобильном показываем меньше палок для лучшей читаемости
                  const beats = isMobile 
                    ? monitor.heartbeat.slice(-45) 
                    : monitor.heartbeat;
                  
                  return (
                    <div className="flex gap-0.5 mt-3">
                      {beats.map((beat, i) => {
                        const status = typeof beat === 'object' ? beat.s : beat;
                        const time = typeof beat === 'object' ? beat.t : null;
                        
                        return (
                          <div 
                            key={i}
                            className={`flex-1 min-w-[2px] h-6 rounded-sm transition-all duration-150 hover:brightness-125 cursor-default ${
                              status === 1 ? 'bg-green-500' :
                              status === 0 ? 'bg-red-500' :
                              status === 2 ? 'bg-yellow-500' :
                              status === 3 ? 'bg-blue-500' :
                              'bg-gray-600'
                            }`}
                            title={time ? `${formatTime(time)} - ${getStatusName(status)}` : getStatusName(status)}
                          />
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Link */}
                {monitor.link && (
                  <a 
                    href={monitor.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-3 text-xs md:text-sm text-blue-400 hover:text-blue-300 truncate max-w-full"
                  >
                    <ExternalLink size={14} className="flex-shrink-0" />
                    <span className="truncate">{monitor.link}</span>
                  </a>
                )}
              </div>
            );
          })}

          {monitors.length === 0 && (
            <div className="text-center py-8 md:py-12 text-dark-400">
              {t('noMonitors')}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t border-dark-700 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs md:text-sm text-dark-500">
          <div className="flex items-center gap-2">
            <Clock size={14} />
            {lastUpdate && (
              <span>
                {t('updated')}: {lastUpdate.toLocaleString(lang === 'en' ? 'en-US' : 'ru-RU')}
              </span>
            )}
          </div>
          {config?.footerText && (
            <span className="text-center">{config.footerText}</span>
          )}
        </div>
      </main>
    </div>
  );
}

export default StatusPage;
