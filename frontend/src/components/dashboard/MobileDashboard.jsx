import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Plus, Edit3, Trash2, ExternalLink, X, Server, Activity, Cloud,
  Wrench, Home, Shield, Globe, Cpu, HardDrive, Clock as ClockIcon, RefreshCw,
  ChevronDown, ChevronUp, Receipt, CheckCircle2, Search, Link2, AlertCircle, Zap,
  ArrowLeft, Container, Droplets, FileText, Gauge, Grid, Layers, Lightbulb, Lock,
  Network, PauseCircle, PlayCircle, Power, Radio, Router, ThermometerSun, Users, Wind
} from 'lucide-react';
import api from '../../api';
import { translations } from '../../constants/translations';
import { serviceIcons, categoryIcons } from '../../constants/icons';
import { IntegrationStats, WeatherIcon, Clock, Greeting } from '../common';
import TranslateWidget from '../common/TranslateWidget';

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
  const [providers, setProviders] = useState([]); // Для отображения связанных платежей
  
  // Загрузка провайдеров для отображения связей
  useEffect(() => {
    api.get('/api/providers').then(setProviders).catch(() => {});
  }, []);
  
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
              <RefreshCw size={20} className={`text-white/70 ${refreshing ? 'animate-spin opacity-50' : ''}`} />
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
            {/* Billing Section - показывает данные карточки ИЛИ связанного провайдера */}
            {(() => {
              // Ищем провайдер, привязанный к этой карточке
              const linkedProvider = providers.find(p => p.linkedCardId === detailCard.id);
              
              // Берём данные: приоритет у провайдера, затем billing карточки
              const billingSource = linkedProvider || (detailCard.billing?.enabled ? detailCard.billing : null);
              
              if (!billingSource || !billingSource.nextPayment) return null;
              
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const paymentDate = new Date(billingSource.nextPayment);
              paymentDate.setHours(0, 0, 0, 0);
              const daysUntil = Math.ceil((paymentDate - today) / (1000 * 60 * 60 * 24));
              
              return (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-white/50 uppercase tracking-wide flex items-center gap-2">
                    {t('payments')}
                    {linkedProvider && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded normal-case">
                        {linkedProvider.name}
                      </span>
                    )}
                  </h3>
                  <div className="mobile-card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white/60">{t('nextPayment')}</span>
                      <span className="text-xl font-bold">
                        {billingSource.amount} {billingSource.currency}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">{t('date')}</span>
                      <span>{billingSource.nextPayment}</span>
                    </div>
                  </div>
                  
                  {/* Days until payment */}
                  {daysUntil >= 0 && (
                    <div className="mobile-card p-4 text-center">
                      <div className={`text-4xl font-bold ${daysUntil <= 3 ? 'text-red-400' : daysUntil <= 7 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {daysUntil}
                      </div>
                      <div className="text-white/50 text-sm mt-1">
                        {t('daysUntil')}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

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
                    
                    if (intType === 'portainer') {
                      return (
                        <>
                          <MetricItem label={t('running')} value={data.running || 0} color="text-green-400" />
                          <MetricItem label={t('stopped')} value={data.stopped || 0} color="text-red-400" />
                          <MetricItem label={t('total')} value={data.total || 0} />
                          <MetricItem label="Stacks" value={data.stacks || 0} color="text-blue-400" />
                          <MetricItem label="Endpoints" value={data.totalEndpoints || 0} />
                          {data.endpoints && data.endpoints.length > 0 && (
                            <div className="pt-2 mt-2 border-t border-white/5">
                              <div className="text-xs text-white/40 mb-2">Environments</div>
                              <div className="space-y-1.5">
                                {data.endpoints.map((ep, i) => (
                                  <div key={i} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-1.5 h-1.5 rounded-full ${ep.status === 'up' ? 'bg-green-400' : 'bg-red-400'}`} />
                                      <span className="text-white/80">{ep.name}</span>
                                    </div>
                                    <span className="text-white/40">{ep.running}/{ep.containers}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {data.containers && data.containers.length > 0 && (
                            <div className="pt-2 mt-2 border-t border-white/5">
                              <div className="text-xs text-white/40 mb-2">Containers</div>
                              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                {data.containers.map((c, i) => (
                                  <div key={i} className="flex items-center gap-2 text-xs">
                                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.state === 'running' ? 'bg-green-400' : 'bg-gray-500'}`} />
                                    <span className="text-white/80 truncate flex-1">{c.name}</span>
                                    <span className="text-white/40 text-[10px]">{c.endpoint}</span>
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
                        
                        // Portainer
                        if (intType === 'portainer') {
                          return (
                            <div className="grid grid-cols-4 gap-2">
                              <MetricCard icon={<PlayCircle size={18} />} value={data.running || 0} label="Running" color="text-green-400" />
                              <MetricCard icon={<PauseCircle size={18} />} value={data.stopped || 0} label="Stopped" color="text-red-400" />
                              <MetricCard icon={<Layers size={18} />} value={data.stacks || 0} label="Stacks" color="text-blue-400" />
                              <MetricCard icon={<Server size={18} />} value={data.totalEndpoints || 0} label="Envs" />
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
                    onDeleteCard(selectedCard.id);
                    setSelectedCard(null);
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

export default MobileDashboard;
