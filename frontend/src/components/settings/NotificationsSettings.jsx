import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, AlertCircle, Check, Eye, EyeOff, Smartphone, Shield, Loader2, RefreshCw } from 'lucide-react';
import api from '../../api';
import { Toggle } from '../common';
import pushService from '../../services/pushService';

function NotificationsSettings({ formData, setFormData }) {
  const [testingTopic, setTestingTopic] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [showBotToken, setShowBotToken] = useState(false);
  const [showSummaryExample, setShowSummaryExample] = useState(false);
  
  // Push state
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSecure, setPushSecure] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(true);
  const [pushSubscribing, setPushSubscribing] = useState(false);
  const [pushTesting, setPushTesting] = useState(null);
  const [pushTestResult, setPushTestResult] = useState(null);
  const [deviceName, setDeviceName] = useState(() => {
    const ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua)) return 'iPad';
    if (/Android/.test(ua)) return 'Android';
    if (/Mac/.test(ua)) return 'Mac';
    if (/Windows/.test(ua)) return 'Windows';
    return 'Browser';
  });

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

  // Инициализация Push
  useEffect(() => {
    initPush();
  }, []);

  const initPush = async () => {
    setPushLoading(true);
    try {
      const supported = pushService.isSupported();
      const secure = pushService.isSecureContext();
      
      setPushSupported(supported);
      setPushSecure(secure);
      
      if (supported && secure) {
        await pushService.init();
        setPushSubscribed(pushService.isSubscribed());
      }
    } catch (err) {
      console.error('[Push] Init error:', err);
    } finally {
      setPushLoading(false);
    }
  };

  const handlePushSubscribe = async () => {
    setPushSubscribing(true);
    const result = await pushService.subscribe(deviceName);
    if (result.success) {
      setPushSubscribed(true);
    } else {
      setPushTestResult({ type: 'subscribe', sent: 0, error: result.error });
    }
    setPushSubscribing(false);
  };

  const handlePushUnsubscribe = async () => {
    setPushSubscribing(true);
    await pushService.unsubscribe();
    setPushSubscribed(false);
    setPushSubscribing(false);
  };

  // Переподписка (удалить старую + создать новую)
  const handlePushResubscribe = async () => {
    setPushSubscribing(true);
    setPushTestResult(null);
    
    try {
      // Сначала отписываемся
      await pushService.unsubscribe();
      
      // Затем подписываемся заново
      const result = await pushService.subscribe(deviceName);
      if (result.success) {
        setPushSubscribed(true);
        setPushTestResult({ type: 'resubscribe', sent: 1, error: null });
      } else {
        setPushSubscribed(false);
        setPushTestResult({ type: 'resubscribe', sent: 0, error: result.error });
      }
    } catch (err) {
      setPushTestResult({ type: 'resubscribe', sent: 0, error: err.message });
    }
    
    setPushSubscribing(false);
  };

  const handlePushTest = async (type, delay = 0) => {
    setPushTesting(type);
    setPushTestResult(null);
    
    try {
      const response = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, delay })
      });
      const result = await response.json();
      
      // Отложенное уведомление
      if (result.scheduled) {
        setPushTestResult({ 
          type, 
          sent: 1, 
          scheduled: true,
          error: null,
          message: result.message 
        });
        setPushTesting(null);
        setTimeout(() => setPushTestResult(null), (delay + 2) * 1000);
        return;
      }
      
      // Добавляем детали если есть ошибка
      if (result.error) {
        setPushTestResult({ type, sent: 0, error: result.error, details: result.details || null });
      } else if (result.sent === 0 && result.failed > 0) {
        setPushTestResult({ type, sent: 0, error: `Не доставлено: ${result.failed}` });
      } else {
        setPushTestResult({ type, ...result });
      }
    } catch (err) {
      setPushTestResult({ type, sent: 0, error: `Сеть: ${err.message}` });
    }
    
    setPushTesting(null);
    setTimeout(() => setPushTestResult(null), 10000);
  };
  
  // Диагностика Push
  const handlePushDiagnose = async () => {
    setPushTesting('diagnose');
    try {
      const response = await fetch('/api/push/status');
      const data = await response.json();
      setPushTestResult({
        type: 'diagnose',
        sent: data.ok ? 1 : 0,
        error: data.ok ? null : data.error,
        details: JSON.stringify(data, null, 2)
      });
    } catch (err) {
      setPushTestResult({ type: 'diagnose', sent: 0, error: err.message });
    }
    setPushTesting(null);
    setTimeout(() => setPushTestResult(null), 30000); // 30 сек для диагностики
  };

  const handleTestTopic = async (topicType, topicId) => {
    if (!formData.telegram?.botToken || !formData.telegram?.chatId) {
      setTestResult({ type: topicType, success: false, error: 'Заполните Bot Token и Chat ID' });
      return;
    }

    setTestingTopic(topicType);
    setTestResult(null);

    try {
      if (topicType === 'summary') {
        const res = await api.post('/api/monitoring/telegram/test-daily-report');
        setTestResult({ type: topicType, ...res });
      } else {
        const messages = {
          down: '🔴 <b>Тест: Сервис недоступен</b>\n\nПример уведомления о недоступности сервиса.',
          up: '✅ <b>Тест: Сервис восстановлен</b>\n\nПример уведомления о восстановлении сервиса.',
          payments: '💳 <b>Тест: Напоминание о платеже</b>\n\n<b>Пример сервиса</b>\nСумма: 500 RUB\nСрок: через 3 дня',
          tasks: '📋 <b>Тест: Напоминание о задаче</b>\n\n<b>Пример задачи</b>\nПриоритет: Высокий\nСрок: завтра'
        };

        const res = await api.post('/api/monitoring/telegram/test', {
          botToken: formData.telegram.botToken,
          chatId: formData.telegram.chatId,
          topicId: topicId || null,
          message: messages[topicType]
        });
        setTestResult({ type: topicType, ...res });
      }
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

  // Кнопка теста Telegram
  const TestTopicButton = ({ topicType, topicId, disabled }) => (
    <button
      onClick={() => handleTestTopic(topicType, topicId)}
      disabled={disabled || testingTopic === topicType}
      className="btn-xs px-2 py-1 text-xs bg-dark-600 hover:bg-dark-500 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1"
      title="Отправить тестовое сообщение"
    >
      {testingTopic === topicType ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <Send size={12} />
      )}
      Тест
    </button>
  );

  // Кнопка теста Push
  const PushTestButton = ({ type, label }) => (
    <button
      onClick={() => handlePushTest(type)}
      disabled={!pushSubscribed || pushTesting === type}
      className="btn-xs px-2 py-1 text-xs bg-dark-600 hover:bg-dark-500 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1"
    >
      {pushTesting === type ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <Send size={12} />
      )}
      {label}
    </button>
  );

  const canTest = formData.telegram?.botToken && formData.telegram?.chatId;

  return (
    <div className="space-y-6">
      {/* ==================== PUSH-УВЕДОМЛЕНИЯ ==================== */}
      <div className="p-4 bg-dark-800/50 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              pushSubscribed ? 'bg-green-500/20 text-green-400' : 'bg-dark-700 text-dark-400'
            }`}>
              <Smartphone size={20} />
            </div>
            <div>
              <div className="font-medium">Push-уведомления</div>
              <div className="text-sm text-dark-400">
                {pushLoading ? 'Загрузка...' :
                 !pushSupported ? 'Не поддерживается' :
                 !pushSecure ? 'Требуется HTTPS' :
                 pushSubscribed ? 'Включены' : 'Отключены'}
              </div>
            </div>
          </div>
          {pushSupported && pushSecure && (
            <Toggle
              checked={pushSubscribed}
              onChange={pushSubscribed ? handlePushUnsubscribe : handlePushSubscribe}
              disabled={pushLoading || pushSubscribing}
            />
          )}
        </div>

        {/* HTTPS предупреждение */}
        {pushSupported && !pushSecure && (
          <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <Shield size={16} className="text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm space-y-2">
                <div className="text-orange-300 font-medium">Требуется HTTPS</div>
                <div className="text-orange-400/70 text-xs leading-relaxed">
                  Для работы Push-уведомлений:
                  <ol className="list-decimal list-inside mt-1 space-y-1">
                    <li>Скачайте сертификат (кнопка ниже или в разделе "Основное")</li>
                    <li>Установите и сделайте его доверенным на устройстве</li>
                    <li>Откройте HomeDash по HTTPS</li>
                  </ol>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a href="/api/ssl/certificate" className="text-blue-400 hover:text-blue-300 text-xs underline">
                    Скачать сертификат
                  </a>
                  <span className="text-dark-600">|</span>
                  <a href={`https://${window.location.hostname}:3443`} className="text-blue-400 hover:text-blue-300 text-xs underline">
                    Открыть HTTPS
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Настройки Push */}
        {pushSubscribed && (
          <div className="pt-4 border-t border-dark-700 space-y-4">
            <div className="text-xs text-dark-500 uppercase tracking-wide">Тестирование Push</div>
            
            <div className="grid grid-cols-2 gap-2">
              <PushTestButton type="monitoring" label="Мониторинг" />
              <PushTestButton type="payment" label="Платёж" />
              <PushTestButton type="task" label="Задача" />
              <PushTestButton type="test" label="Общий тест" />
            </div>
            
            {/* Отложенный тест */}
            <button
              onClick={() => handlePushTest('test', 10)}
              disabled={pushTesting === 'test'}
              className="btn-xs w-full px-2 py-2 text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {pushTesting === 'test' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              Тест через 10 сек (закрой приложение)
            </button>
            
            {/* Кнопки диагностики и переподписки */}
            <div className="flex gap-2">
              <button
                onClick={handlePushDiagnose}
                disabled={pushTesting === 'diagnose'}
                className="btn-xs flex-1 px-2 py-2 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {pushTesting === 'diagnose' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <AlertCircle size={14} />
                )}
                Диагностика
              </button>
              
              <button
                onClick={handlePushResubscribe}
                disabled={pushSubscribing}
                className="btn-xs flex-1 px-2 py-2 text-xs bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {pushSubscribing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                Переподписаться
              </button>
            </div>

            {pushTestResult && (
              <div className={`p-3 rounded-lg text-sm ${
                pushTestResult.sent > 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
              }`}>
                <div className="flex items-center gap-2">
                  {pushTestResult.sent > 0 ? <Check size={14} /> : <AlertCircle size={14} />}
                  {pushTestResult.scheduled 
                    ? pushTestResult.message
                    : pushTestResult.sent > 0 
                      ? (pushTestResult.type === 'resubscribe' ? 'Переподписка успешна!' : 'Отправлено!') 
                      : pushTestResult.error || 'Неизвестная ошибка'}
                </div>
                {pushTestResult.details && (
                  <pre className="mt-2 p-2 bg-dark-800 rounded text-xs overflow-x-auto whitespace-pre-wrap break-all">
                    {pushTestResult.details}
                  </pre>
                )}
                {pushTestResult.error?.includes('403') && (
                  <div className="mt-2 text-xs text-orange-400">
                    Ошибка 403: попробуйте нажать "Переподписаться"
                  </div>
                )}
              </div>
            )}

            <div className="p-3 bg-dark-700/30 rounded-lg text-xs text-dark-500">
              Push-уведомления приходят даже когда приложение закрыто. 
              Нажмите на уведомление чтобы перейти к нужному элементу.
            </div>
          </div>
        )}

        {/* Имя устройства */}
        {pushSupported && pushSecure && !pushSubscribed && !pushLoading && (
          <div className="pt-4 border-t border-dark-700">
            <label className="block text-sm text-dark-400 mb-2">Имя устройства</label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="input-field"
              placeholder="Мой телефон"
            />
          </div>
        )}
      </div>

      {/* ==================== TELEGRAM ==================== */}
      <div className="p-4 bg-dark-800/50 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              formData.telegram?.enabled ? 'bg-blue-500/20 text-blue-400' : 'bg-dark-700 text-dark-400'
            }`}>
              <Send size={20} />
            </div>
            <div>
              <div className="font-medium">Telegram</div>
              <div className="text-sm text-dark-400">
                {formData.telegram?.enabled ? 'Настроен' : 'Отключён'}
              </div>
            </div>
          </div>
          <Toggle
            checked={formData.telegram?.enabled || false}
            onChange={v => updateTelegram('enabled', v)}
          />
        </div>

        {formData.telegram?.enabled && (
          <div className="pt-4 border-t border-dark-700 space-y-4">
            {/* Bot Token */}
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
                <button type="button"
                  onClick={() => setShowBotToken(!showBotToken)}
                  className="btn-xs absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-dark-600 rounded">
                  {showBotToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Chat ID */}
            <div>
              <label className="block text-sm text-dark-400 mb-2">Chat ID</label>
              <input
                type="text"
                className="input-field"
                value={formData.telegram?.chatId || ''}
                onChange={e => updateTelegram('chatId', e.target.value)}
                placeholder="-1001234567890"
              />
            </div>

            {/* Типы уведомлений */}
            <div className="space-y-3">
              <div className="text-xs text-dark-500 uppercase tracking-wide">Мониторинг</div>
              
              {/* DOWN */}
              <div className="p-3 bg-dark-700/50 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🔴</span>
                    <span className="font-medium text-sm">Сервис недоступен</span>
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

              {/* UP */}
              <div className="p-3 bg-dark-700/50 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">✅</span>
                    <span className="font-medium text-sm">Сервис восстановлен</span>
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
                      <div className="w-32">
                        <input type="time" className="input-field text-sm py-2 w-full"
                          style={{ maxWidth: '128px' }}
                          value={formData.telegram?.dailySummaryTime || '09:00'}
                          onChange={e => updateTelegram('dailySummaryTime', e.target.value)} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="text" className="input-field text-sm py-2 flex-1"
                        value={formData.telegram?.dailySummaryTopicId || ''}
                        onChange={e => updateTelegram('dailySummaryTopicId', e.target.value)}
                        placeholder="Topic ID (опционально)" />
                      <TestTopicButton topicType="summary" topicId={formData.telegram?.dailySummaryTopicId} disabled={!canTest} />
                    </div>
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
• Hetzner: 1500 RUB (через 2д)
• VDS: 500 RUB (через 5д)

📋 Задачи (7 дней):
• Обновить сервер (через 1д)
• Бэкап БД (через 4д)`}
                      </div>
                    )}
                  </div>
                )}
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

export default NotificationsSettings;
