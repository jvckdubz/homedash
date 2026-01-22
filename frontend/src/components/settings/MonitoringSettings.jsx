import React, { useEffect } from 'react';
import { Activity, Clock as ClockIcon, RefreshCw, Bell } from 'lucide-react';
import { Toggle } from '../common';

function MonitoringSettings({ formData, setFormData }) {
  // Инициализируем monitoring если его нет
  useEffect(() => {
    if (!formData.monitoring) {
      setFormData(prev => ({
        ...prev,
        monitoring: { enabled: false, interval: 60, timeout: 10, retries: 2, historyDays: 7 }
      }));
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Глобальный переключатель мониторинга */}
      <div className="p-4 bg-dark-800/50 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              formData.monitoring?.enabled ? 'bg-green-500/20 text-green-400' : 'bg-dark-700 text-dark-400'
            }`}>
              <Activity size={20} />
            </div>
            <div>
              <div className="font-medium">Система мониторинга</div>
              <div className="text-sm text-dark-400">
                {formData.monitoring?.enabled ? 'Активна' : 'Отключена'}
              </div>
            </div>
          </div>
          <Toggle 
            checked={formData.monitoring?.enabled || false}
            onChange={(v) => setFormData({...formData, monitoring: {...formData.monitoring, enabled: v}})}
          />
        </div>

        {formData.monitoring?.enabled && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dark-700">
            <div>
              <label className="block text-sm text-dark-400 mb-2">Интервал проверки (сек)</label>
              <input
                type="number"
                className="input-field"
                value={formData.monitoring?.interval || 60}
                onChange={e => setFormData({
                  ...formData,
                  monitoring: { ...formData.monitoring, interval: parseInt(e.target.value) || 60 }
                })}
                min={30}
                max={3600}
              />
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-2">Таймаут (сек)</label>
              <input
                type="number"
                className="input-field"
                value={formData.monitoring?.timeout || 10}
                onChange={e => setFormData({
                  ...formData,
                  monitoring: { ...formData.monitoring, timeout: parseInt(e.target.value) || 10 }
                })}
                min={5}
                max={60}
              />
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-2">Попыток перед OFFLINE</label>
              <input
                type="number"
                className="input-field"
                value={formData.monitoring?.retries || 2}
                onChange={e => setFormData({
                  ...formData,
                  monitoring: { ...formData.monitoring, retries: parseInt(e.target.value) || 2 }
                })}
                min={0}
                max={5}
              />
            </div>
            <div>
              <label className="block text-sm text-dark-400 mb-2">Хранить историю (дней)</label>
              <input
                type="number"
                className="input-field"
                value={formData.monitoring?.historyDays || 7}
                onChange={e => setFormData({
                  ...formData,
                  monitoring: { ...formData.monitoring, historyDays: parseInt(e.target.value) || 7 }
                })}
                min={1}
                max={90}
              />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-dark-800/30 rounded-xl text-sm text-dark-500">
        <p className="mb-2"><strong>Как это работает:</strong></p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Включите мониторинг на нужных карточках (Редактирование - Мониторинг)</li>
          <li>Сервер будет проверять URL каждые N секунд</li>
          <li>При изменении статуса отправит уведомление в Telegram (настройки в разделе Уведомления)</li>
          <li>История и статистика сохраняются локально</li>
        </ul>
      </div>
    </div>
  );
}

// ============ Settings Modal ============
export default MonitoringSettings;
