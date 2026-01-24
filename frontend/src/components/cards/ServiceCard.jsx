import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Edit3, Trash2, ExternalLink, Server, GripVertical, Link2, Receipt, Clock as ClockIcon, Bookmark
} from 'lucide-react';
import { serviceIcons } from '../../constants/icons';
import { IntegrationStats } from '../common';
import api from '../../api';

function ServiceCard({ card, onEdit, onDelete, integrationData, onShowDetail, monitoringStatus, dragHandleProps, isDragging }) {
  const [isHovered, setIsHovered] = useState(false);
  const [linkedProvider, setLinkedProvider] = useState(null);
  const IconComponent = serviceIcons[card.icon] || serviceIcons.default;

  // Загружаем связанный провайдер
  useEffect(() => {
    api.get('/api/providers')
      .then(providers => {
        const linked = providers.find(p => p.linkedCardId === card.id);
        setLinkedProvider(linked || null);
      })
      .catch(() => {});
  }, [card.id]);

  // Статус мониторинга
  const monStatus = monitoringStatus?.currentStatus || monitoringStatus?.status;
  const isMonitoringEnabled = card.monitoring?.enabled;
  const isBillable = card.category === 'hosting' || card.category === 'providers';
  
  // Данные billing: приоритет у связанного провайдера
  const billingSource = linkedProvider || (card.billing?.enabled ? card.billing : null);
  const hasBilling = isBillable && billingSource?.nextPayment;

  const handleClick = (e) => {
    // Собираем все данные для модалки
    const hasIntegration = card.integration?.type && integrationData;
    const hasMonitoring = isMonitoringEnabled && monitoringStatus;
    const hasBookmarks = card.bookmarks?.length > 0;
    
    // Если есть что показать - открываем модалку
    if (hasIntegration || hasMonitoring || hasBilling || hasBookmarks) {
      onShowDetail(card, {
        ...(integrationData || {}),
        monitoringStatus: hasMonitoring ? monitoringStatus : null,
        billing: hasBilling ? billingSource : null,
        linkedProvider: linkedProvider
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
              {card.customIcon ? (
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/10 backdrop-blur-sm shadow-lg ring-1 ring-white/10">
                  <img src={card.customIcon} alt="" className="w-7 h-7 object-contain drop-shadow" />
                </div>
              ) : (
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
                  style={{ backgroundColor: `${card.color}25`, color: card.color }}
                >
                  <div className="w-6 h-6"><IconComponent /></div>
                </div>
              )}

              <div className="flex-1 min-w-0 overflow-hidden">
                <h3 className="font-semibold text-white truncate text-sm">{card.name}</h3>
                <p className="text-xs text-dark-400 truncate">{card.description}</p>
                {/* Количество закладок */}
                {card.bookmarks?.length > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-blue-400">
                    <Bookmark size={12} />
                    <span>{card.bookmarks.length} {card.bookmarks.length === 1 ? 'ссылка' : card.bookmarks.length < 5 ? 'ссылки' : 'ссылок'}</span>
                  </div>
                )}
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
            {/* Billing info - для хостинга и провайдеров (из карточки или связанного провайдера) */}
            {hasBilling && (
              <div className="mt-3 pt-2 border-t border-dark-700/50">
                <div className="flex items-center justify-between text-xs">
                  {(() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const paymentDate = new Date(billingSource.nextPayment);
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
                          <span className="text-dark-400">
                            {linkedProvider ? linkedProvider.name : 'Оплата'}:
                          </span>
                          <span className={statusColor}>{statusText}</span>
                        </div>
                        {billingSource.amount && (
                          <span className="text-dark-500">
                            {billingSource.amount} {billingSource.currency || ''}
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

export { ServiceCard, SortableServiceCard };
export default ServiceCard;
