import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Edit3, Trash2, ExternalLink, X, AlertCircle,
  ChevronDown, ChevronUp, History, Receipt, ShoppingCart, TrendingUp,
  Globe, QrCode, Camera, Copy, CheckCircle2, Eye, Download, Link2,
  Clock as ClockIcon, PieChart
} from 'lucide-react';
import api from '../../api';
import { serviceIcons } from '../../constants/icons';
import { ColorPicker, providerIcons } from '../common';
import TranslateWidget from '../common/TranslateWidget';

function PaymentsPage({ cards: initialCards, onBack, onEditCard, onViewCard, onRefreshCards }) {
  const [activeTab, setActiveTab] = useState('payments');
  const [providers, setProviders] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [localCards, setLocalCards] = useState(initialCards || []);
  const [selectedItem, setSelectedItem] = useState(null); // {type: 'card'|'provider', data: ...}
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [showAddPurchase, setShowAddPurchase] = useState(false);
  const [showAddChoice, setShowAddChoice] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false); // Спойлер иконок
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [showQrViewer, setShowQrViewer] = useState(null); // QR data for viewing
  const [qrCodes, setQrCodes] = useState({});
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [showPayModal, setShowPayModal] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null); // {type: 'provider'|'billing', item: ...}
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
    nextPayment: '', note: '', url: '', remindDays: [3, 7],
    linkedCardId: '' // Связь с карточкой
  });

  // Форма новой покупки
  const [newPurchase, setNewPurchase] = useState({
    name: '', amount: '', currency: 'RUB', date: new Date().toISOString().split('T')[0], note: '', category: 'other'
  });

  const purchaseCategories = [
    { id: 'food', name: 'Еда', icon: 'utensils' },
    { id: 'transport', name: 'Транспорт', icon: 'car' },
    { id: 'health', name: 'Здоровье', icon: 'stethoscope' },
    { id: 'entertainment', name: 'Развлечения', icon: 'gamepad' },
    { id: 'shopping', name: 'Покупки', icon: 'bag' },
    { id: 'home', name: 'Дом', icon: 'sofa' },
    { id: 'education', name: 'Образование', icon: 'education' },
    { id: 'sport', name: 'Спорт', icon: 'dumbbell' },
    { id: 'travel', name: 'Путешествия', icon: 'plane' },
    { id: 'other', name: 'Другое', icon: 'tag' }
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
      linkedCardId: p.linkedCardId,
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
    
    // Связь хранится только в провайдере (linkedCardId)
    // Карточка не модифицируется - это безопаснее
    
    setNewProvider({
      name: '', icon: 'receipt', color: '#8b5cf6',
      amount: '', currency: 'RUB', period: 'monthly',
      nextPayment: '', note: '', url: '', remindDays: [3, 7],
      linkedCardId: ''
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
    // Reload stats after deletion
    const newStats = await api.get('/api/payments/stats').catch(() => null);
    if (newStats) setStats(newStats);
  };

  const deleteProvider = async (id) => {
    setShowDeleteConfirm({ type: 'provider', item: { id } });
  };

  // Отключить биллинг у карточки (удалить из платежей)
  const disableBilling = async (card) => {
    setShowDeleteConfirm({ type: 'billing', item: card });
  };

  // Подтверждение удаления
  const confirmDelete = async () => {
    if (!showDeleteConfirm) return;
    
    try {
      if (showDeleteConfirm.type === 'provider') {
        await api.delete(`/api/providers/${showDeleteConfirm.item.id}`);
        setProviders(prev => prev.filter(p => p.id !== showDeleteConfirm.item.id));
        setSelectedItem(null);
        loadData();
      } else if (showDeleteConfirm.type === 'billing') {
        const card = showDeleteConfirm.item;
        // Отправляем ТОЛЬКО billing, чтобы не перезаписать integration урезанными данными
        await api.put(`/api/cards/${card.id}`, { 
          billing: { ...card.billing, enabled: false } 
        });
        if (onRefreshCards) await onRefreshCards();
        await loadData();
        setSelectedItem(null);
      }
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Ошибка при удалении');
    }
    setShowDeleteConfirm(null);
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

  // Группировка по календарным месяцам
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
  const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
  
  const overdue = allPayments.filter(c => c.daysUntil < 0);
  const todayPayments = allPayments.filter(c => c.daysUntil === 0);
  const thisWeek = allPayments.filter(c => c.daysUntil > 0 && c.daysUntil <= 7);
  
  // В этом месяце - после 7 дней, но до конца текущего месяца
  const thisMonth = allPayments.filter(c => {
    if (c.daysUntil <= 7) return false;
    const payDate = new Date(c.nextPayment);
    return payDate.getMonth() === currentMonth && payDate.getFullYear() === currentYear;
  });
  
  // В следующем месяце
  const nextMonthPayments = allPayments.filter(c => {
    const payDate = new Date(c.nextPayment);
    return payDate.getMonth() === nextMonth && payDate.getFullYear() === nextMonthYear;
  });
  
  // Позже - всё что после следующего месяца
  const later = allPayments.filter(c => {
    const payDate = new Date(c.nextPayment);
    const payMonth = payDate.getMonth();
    const payYear = payDate.getFullYear();
    // Не в текущем и не в следующем месяце
    if (payYear > nextMonthYear) return true;
    if (payYear === nextMonthYear && payMonth > nextMonth) return true;
    return false;
  });

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
              {item.linkedCardId && (
                <Link2 size={12} className="text-blue-400 flex-shrink-0" title={`Связан с: ${localCards.find(c => c.id === item.linkedCardId)?.name || 'карточка'}`} />
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
                <div className="flex-1 flex flex-col gap-2">
                  {selectedItem.data.linkedCardId && (
                    <button 
                      onClick={() => {
                        const linkedCard = localCards.find(c => c.id === selectedItem.data.linkedCardId);
                        if (linkedCard && onViewCard) {
                          setSelectedItem(null);
                          onViewCard(linkedCard);
                        }
                      }} 
                      className="w-full px-4 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-xl flex items-center justify-center gap-2"
                    >
                      <ExternalLink size={18} /> Открыть карточку
                    </button>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setEditingBilling({...selectedItem.data, isProvider: true})} className="flex-1 px-4 py-2.5 bg-dark-700 hover:bg-dark-600 rounded-xl flex items-center justify-center gap-2">
                      <Edit3 size={18} /> <span className="hidden sm:inline">Редактировать</span><span className="sm:hidden">Изменить</span>
                    </button>
                    <button onClick={() => deleteProvider(item.id)} className="flex-1 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl flex items-center justify-center gap-2">
                      <Trash2 size={18} /> <span className="hidden sm:inline">Удалить платеж</span><span className="sm:hidden">Удалить</span>
                    </button>
                  </div>
                </div>
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
            <motion.div className="fixed inset-0 z-[400] modal-overlay flex items-center justify-center p-4"
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

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <motion.div className="fixed inset-0 z-[400] modal-overlay flex items-center justify-center p-4"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteConfirm(null)}>
              <motion.div className="glass-card w-full max-w-sm p-6"
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-semibold mb-3">Удалить платеж?</h3>
                <p className="text-dark-400 mb-4">
                  {showDeleteConfirm.type === 'billing' 
                    ? 'Карточка останется, но напоминание об оплате будет отключено.'
                    : 'Платеж будет удален из списка.'}
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowDeleteConfirm(null)} 
                    className="flex-1 px-4 py-2.5 bg-dark-700 hover:bg-dark-600 rounded-xl transition-colors"
                  >
                    Отмена
                  </button>
                  <button 
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl font-medium transition-colors"
                  >
                    Удалить
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* QR Viewer Modal */}
          {showQrViewer && (
            <motion.div className="fixed inset-0 z-[400] modal-overlay flex items-center justify-center p-4"
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
            <motion.div className="fixed inset-0 z-[400] modal-overlay flex items-center justify-center p-4"
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
                    <div>
                      <label className="block text-sm text-dark-400 mb-1">Привязать к карточке</label>
                      <select 
                        className="input-field"
                        value={editingBilling.linkedCardId || ''} 
                        onChange={e => setEditingBilling({...editingBilling, linkedCardId: e.target.value || null})}
                      >
                        <option value="">Без привязки</option>
                        {localCards.map(card => (
                          <option key={card.id} value={card.id}>{card.name}</option>
                        ))}
                      </select>
                      <p className="text-xs text-dark-500 mt-1">Связь для быстрого перехода к карточке</p>
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
            <motion.div className="fixed inset-0 z-[400] modal-overlay flex items-center justify-center p-4"
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
              <button 
                type="button"
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="w-full flex items-center justify-between p-3 bg-dark-800 hover:bg-dark-700 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-dark-700 flex items-center justify-center" style={{ color: newProvider.color }}>
                    {React.createElement(serviceIcons[newProvider.icon] || serviceIcons.default)}
                  </div>
                  <span className="text-sm text-dark-400">Иконка</span>
                </div>
                {showIconPicker ? <ChevronUp size={18} className="text-dark-400" /> : <ChevronDown size={18} className="text-dark-400" />}
              </button>
              
              <AnimatePresence>
                {showIconPicker && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-8 gap-2 pt-3">
                      {providerIcons.map(icon => {
                        const IconComp = serviceIcons[icon.id] || serviceIcons.default;
                        return (
                          <button key={icon.id} onClick={() => { setNewProvider({...newProvider, icon: icon.id}); setShowIconPicker(false); }}
                            className={`aspect-square flex items-center justify-center rounded-lg transition-colors ${newProvider.icon === icon.id ? 'bg-purple-500/30 ring-2 ring-purple-500' : 'bg-dark-700 hover:bg-dark-600'}`}
                            title={icon.name}>
                            <div className="w-5 h-5" style={{ color: newProvider.color }}><IconComp /></div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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

            <div>
              <label className="block text-sm text-dark-400 mb-1">Привязать к карточке</label>
              <select 
                value={newProvider.linkedCardId} 
                onChange={e => setNewProvider({...newProvider, linkedCardId: e.target.value})}
                className="input-field w-full">
                <option value="">Без привязки</option>
                {localCards.map(card => (
                  <option key={card.id} value={card.id}>{card.name}</option>
                ))}
              </select>
              <p className="text-xs text-dark-500 mt-1">Связь для быстрого перехода к карточке</p>
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
              {renderSection('В следующем месяце', nextMonthPayments, <ClockIcon size={14} className="text-purple-400" />)}
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
            {/* RUB Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-card p-4">
                <div className="text-sm text-dark-400 mb-1">Этот месяц (RUB)</div>
                <div className="text-2xl font-bold">{stats.thisMonth.total.toFixed(0)}</div>
                <div className="text-xs text-dark-500">{stats.thisMonth.count} платежей</div>
              </div>
              <div className="glass-card p-4">
                <div className="text-sm text-dark-400 mb-1">Прошлый месяц (RUB)</div>
                <div className="text-2xl font-bold">{stats.lastMonth.total.toFixed(0)}</div>
                <div className="text-xs text-dark-500">{stats.lastMonth.count} платежей</div>
              </div>
            </div>

            <div className="glass-card p-4">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-400" /> Прогноз на {stats.forecast.monthName || 'след. месяц'} (RUB)
              </h3>
              <div className="text-3xl font-bold mb-3">{stats.forecast.total.toFixed(0)} RUB</div>
              {stats.forecast.items?.length > 0 && (
                <div className="space-y-1">
                  {stats.forecast.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-dark-400">{item.name}</span>
                      <span>{item.amount} RUB</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-card p-4">
              <div className="text-sm text-dark-400 mb-1">За год (RUB)</div>
              <div className="text-2xl font-bold">{stats.yearTotal?.toFixed(0) || 0}</div>
              <div className="text-xs text-dark-500">{stats.yearCount || 0} платежей</div>
            </div>

            {/* Other currencies */}
            {stats.otherCurrencies?.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-dark-700">
                <div className="text-sm text-dark-400 font-medium">Другие валюты</div>
                {stats.otherCurrencies.map(curr => (
                  <div key={curr.currency} className="glass-card p-4">
                    <div className="text-sm font-medium text-blue-400 mb-2">{curr.currency}</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-dark-500">Этот месяц</div>
                        <div className="font-medium">{curr.thisMonth.total.toFixed(2)} ({curr.thisMonth.count})</div>
                      </div>
                      <div>
                        <div className="text-dark-500">Прошлый месяц</div>
                        <div className="font-medium">{curr.lastMonth.total.toFixed(2)} ({curr.lastMonth.count})</div>
                      </div>
                      <div>
                        <div className="text-dark-500">Прогноз</div>
                        <div className="font-medium">{curr.forecast.total.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-dark-500">За год</div>
                        <div className="font-medium">{curr.year.total.toFixed(2)} ({curr.year.count})</div>
                      </div>
                    </div>
                    {curr.forecast.items?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-dark-700 space-y-1">
                        {curr.forecast.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="text-dark-400">{item.name}</span>
                            <span>{item.amount} {curr.currency}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add Choice Modal */}
      <AnimatePresence>
        {showAddChoice && (
          <motion.div className="fixed inset-0 z-[400] modal-overlay flex items-center justify-center p-4"
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

export default PaymentsPage;
