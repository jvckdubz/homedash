import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Bell, BellOff, Send, AlertCircle, Check, Eye, EyeOff, RefreshCw, Camera, X, QrCode } from 'lucide-react';
import api from '../../api';
import { Toggle } from '../common';
import useNotifications from '../../hooks/useNotifications';

function NotificationsSettings({ formData, setFormData }) {
  const { permission, requestPermission } = useNotifications(false);
  const [requesting, setRequesting] = useState(false);
  const [testingTopic, setTestingTopic] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [showBotToken, setShowBotToken] = useState(false);
  const [showSummaryExample, setShowSummaryExample] = useState(false);

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

  const handleBrowserToggle = async (enabled) => {
    if (enabled && permission !== 'granted') {
      setRequesting(true);
      const result = await requestPermission();
      setRequesting(false);
      if (result !== 'granted') return;
    }
    setFormData({ ...formData, notifications: { ...formData.notifications, enabled } });
  };

  const handleTestTopic = async (topicType, topicId) => {
    if (!formData.telegram?.botToken || !formData.telegram?.chatId) {
      setTestResult({ type: topicType, success: false, error: 'Заполните Bot Token и Chat ID' });
      return;
    }

    setTestingTopic(topicType);
    setTestResult(null);

    const messages = {
      down: '🔴 <b>Тест: Сервис недоступен</b>\n\nПример уведомления о недоступности сервиса.',
      up: '✅ <b>Тест: Сервис восстановлен</b>\n\nПример уведомления о восстановлении сервиса.',
      payments: '💳 <b>Тест: Напоминание о платеже</b>\n\n<b>Пример сервиса</b>\nСумма: 500 RUB\nСрок: через 3 дня',
      tasks: '📋 <b>Тест: Напоминание о задаче</b>\n\n<b>Пример задачи</b>\nПриоритет: 🔴 Высокий\nСрок: завтра',
      summary: `📊 <b>Ежедневная сводка</b>\n${new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}\n\n🔴 <b>Недоступные сервисы:</b>\n• Proxmox VE\n\n💳 <b>Платежи (7 дней):</b>\n⚠️• Hetzner: 1500 RUB (через 2д)\n• VDS: 500 RUB (через 5д)\n\n📋 <b>Задачи (7 дней):</b>\n⚠️• Обновить сервер (через 1д)\n• Бэкап БД (через 4д)`
    };

    try {
      const res = await api.post('/api/telegram/test', {
        botToken: formData.telegram.botToken,
        chatId: formData.telegram.chatId,
        topicId: topicId || null,
        message: messages[topicType]
      });
      setTestResult({ type: topicType, ...res });
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

  const isSupported = typeof Notification !== 'undefined';
  const isBrowserEnabled = formData.notifications?.enabled && permission === 'granted';

  // Кнопка теста топика
  const TestTopicButton = ({ topicType, topicId, disabled }) => (
    <button
      onClick={() => handleTestTopic(topicType, topicId)}
      disabled={disabled || testingTopic === topicType}
      className="px-2 py-1 text-xs bg-dark-600 hover:bg-dark-500 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1"
      title="Отправить тестовое сообщение"
    >
      {testingTopic === topicType ? (
        <motion.div className="w-3 h-3 border border-dark-400/30 border-t-dark-400 rounded-full"
          animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
      ) : (
        <Send size={12} />
      )}
      Тест
    </button>
  );

  const canTest = formData.telegram?.botToken && formData.telegram?.chatId;

  return (
    <div className="space-y-6">
      {/* Браузерные уведомления */}
      <div className="p-4 bg-dark-800/50 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isBrowserEnabled ? 'bg-purple-500/20 text-purple-400' : 'bg-dark-700 text-dark-400'
            }`}>
              <Bell size={20} />
            </div>
            <div>
              <div className="font-medium">Браузерные уведомления</div>
              <div className="text-sm text-dark-400">
                {!isSupported ? 'Не поддерживается' : 
                 permission === 'denied' ? 'Заблокировано' :
                 isBrowserEnabled ? 'Включены' : 'Отключены'}
              </div>
            </div>
          </div>
          <Toggle 
            checked={isBrowserEnabled}
            onChange={handleBrowserToggle}
            disabled={!isSupported || permission === 'denied' || requesting}
          />
        </div>

        {isBrowserEnabled && (
          <div className="pt-4 border-t border-dark-700 space-y-3">
            <label className="block text-sm text-dark-400 mb-2">Напоминать о платежах за:</label>
            <div className="flex flex-wrap gap-2">
              {[1, 3, 7, 14].map(days => (
                <button key={days} type="button"
                  onClick={() => {
                    const current = formData.notifications?.remindDays || [1, 3];
                    const newDays = current.includes(days) 
                      ? current.filter(d => d !== days)
                      : [...current, days].sort((a,b) => a-b);
                    setFormData({ ...formData, notifications: { ...formData.notifications, remindDays: newDays }});
                  }}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    (formData.notifications?.remindDays || [1, 3]).includes(days)
                      ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500'
                      : 'bg-dark-800 hover:bg-dark-700'
                  }`}>
                  {days} {days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}
                </button>
              ))}
            </div>
            <p className="text-xs text-dark-500 mt-2">
              Работают когда приложение открыто или в фоне
            </p>
          </div>
        )}

        {permission === 'denied' && (
          <div className="mt-4 p-3 bg-red-500/10 rounded-lg">
            <p className="text-red-400 text-sm">
              Заблокировано в браузере. Разрешите в настройках сайта.
            </p>
          </div>
        )}
      </div>

      {/* Telegram уведомления */}
      <div className="p-4 bg-dark-800/50 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              formData.telegram?.enabled ? 'bg-blue-500/20 text-blue-400' : 'bg-dark-700 text-dark-400'
            }`}>
              <Send size={20} />
            </div>
            <div>
              <div className="font-medium">Telegram уведомления</div>
              <div className="text-sm text-dark-400">
                {formData.telegram?.enabled ? 'Включены' : 'Отключены'}
              </div>
            </div>
          </div>
          <Toggle 
            checked={formData.telegram?.enabled || false}
            onChange={(v) => updateTelegram('enabled', v)}
          />
        </div>

        {formData.telegram?.enabled && (
          <div className="space-y-4 pt-4 border-t border-dark-700">
            {/* Основные настройки бота */}
            <div className="space-y-3">
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
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200"
                    onClick={() => setShowBotToken(!showBotToken)}
                  >
                    {showBotToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-xs text-dark-500 mt-1">Создайте бота через @BotFather</p>
              </div>

              <div>
                <label className="block text-sm text-dark-400 mb-2">Chat ID</label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.telegram?.chatId || ''}
                  onChange={e => updateTelegram('chatId', e.target.value)}
                  placeholder="-1001234567890"
                />
                <p className="text-xs text-dark-500 mt-1">Для групп с темами используйте ID супергруппы</p>
              </div>
            </div>

            {/* Типы уведомлений */}
            <div className="space-y-3 pt-4 border-t border-dark-700">
              <h4 className="text-sm font-medium text-dark-300 mb-3">Типы уведомлений</h4>
              
              {/* Мониторинг */}
              <div className="space-y-2">
                <div className="text-xs text-dark-500 uppercase tracking-wide">Мониторинг сервисов</div>
                
                {/* Сервис offline */}
                <div className="p-3 bg-dark-700/50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🔴</span>
                      <div className="font-medium text-sm">Сервис недоступен</div>
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

                {/* Сервис online */}
                <div className="p-3 bg-dark-700/50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">✅</span>
                      <div className="font-medium text-sm">Сервис восстановлен</div>
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
                        <input type="time" className="input-field text-sm py-2"
                          value={formData.telegram?.dailySummaryTime || '09:00'}
                          onChange={e => updateTelegram('dailySummaryTime', e.target.value)} />
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="text" className="input-field text-sm py-2 flex-1"
                          value={formData.telegram?.dailySummaryTopicId || ''}
                          onChange={e => updateTelegram('dailySummaryTopicId', e.target.value)}
                          placeholder="Topic ID (опционально)" />
                        <TestTopicButton topicType="summary" topicId={formData.telegram?.dailySummaryTopicId} disabled={!canTest} />
                      </div>
                      {/* Пример сводки */}
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
⚠️• Hetzner: 1500 RUB (через 2д)
• VDS: 500 RUB (через 5д)

📋 Задачи (7 дней):
⚠️• Обновить сервер (через 1д)
• Бэкап БД (через 4д)`}
                        </div>
                      )}
                    </div>
                  )}
                </div>
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

// ============ Monitoring Settings Component ============
export default NotificationsSettings;
