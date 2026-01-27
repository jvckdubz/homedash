import React, { useEffect } from 'react';
import { Activity, Clock as ClockIcon, RefreshCw, Bell, AlertTriangle, Repeat } from 'lucide-react';
import { Toggle } from '../common';

function MonitoringSettings({ formData, setFormData, t }) {
  useEffect(() => {
    if (!formData.monitoring) {
      setFormData(prev => ({
        ...prev,
        monitoring: {
          enabled: false,
          interval: 60,
          retryInterval: 60,
          timeout: 10,
          retries: 3,
          resendInterval: 0,
          historyDays: 7
        }
      }));
    }
  }, []);

  const updateMonitoring = (key, value) => {
    setFormData({
      ...formData,
      monitoring: { ...formData.monitoring, [key]: value }
    });
  };

  return (
    <div className="space-y-6">
      {/* Глобальный переключатель */}
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
            onChange={(v) => updateMonitoring('enabled', v)}
          />
        </div>

        {formData.monitoring?.enabled && (
          <div className="space-y-4 pt-4 border-t border-dark-700">
            <p className="text-sm text-dark-400 mb-4">
              Глобальные настройки по умолчанию. Каждую карточку можно настроить индивидуально в её редакторе.
            </p>
            
            {/* Интервалы */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-dark-400 mb-2 flex items-center gap-2">
                  <ClockIcon size={14} />
                  Интервал проверки (сек)
                </label>
                <input
                  type="number"
                  className="input-field"
                  value={formData.monitoring?.interval || 60}
                  onChange={e => updateMonitoring('interval', parseInt(e.target.value) || 60)}
                  min={20}
                  max={86400}
                />
                <div className="text-xs text-dark-500 mt-1">
                  Обычный интервал между проверками
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-dark-400 mb-2 flex items-center gap-2">
                  <RefreshCw size={14} />
                  Интервал повтора (сек)
                </label>
                <input
                  type="number"
                  className="input-field"
                  value={formData.monitoring?.retryInterval || formData.monitoring?.interval || 60}
                  onChange={e => updateMonitoring('retryInterval', parseInt(e.target.value) || 60)}
                  min={20}
                  max={86400}
                />
                <div className="text-xs text-dark-500 mt-1">
                  Интервал при проблемах (PENDING/DOWN)
                </div>
              </div>
            </div>

            {/* Timeout и Retries */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-dark-400 mb-2 flex items-center gap-2">
                  <AlertTriangle size={14} />
                  Таймаут (сек)
                </label>
                <input
                  type="number"
                  className="input-field"
                  value={formData.monitoring?.timeout || 10}
                  onChange={e => updateMonitoring('timeout', parseInt(e.target.value) || 10)}
                  min={5}
                  max={120}
                />
              </div>
              
              <div>
                <label className="block text-sm text-dark-400 mb-2 flex items-center gap-2">
                  <Repeat size={14} />
                  Попыток до DOWN
                </label>
                <input
                  type="number"
                  className="input-field"
                  value={formData.monitoring?.retries ?? 3}
                  onChange={e => updateMonitoring('retries', parseInt(e.target.value) || 0)}
                  min={0}
                  max={10}
                />
                <div className="text-xs text-dark-500 mt-1">
                  0 = сразу DOWN, 3 = после 3 неудач
                </div>
              </div>
            </div>

            {/* Resend и History */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-dark-400 mb-2 flex items-center gap-2">
                  <Bell size={14} />
                  Повтор уведомлений
                </label>
                <input
                  type="number"
                  className="input-field"
                  value={formData.monitoring?.resendInterval || 0}
                  onChange={e => updateMonitoring('resendInterval', parseInt(e.target.value) || 0)}
                  min={0}
                  max={100}
                />
                <div className="text-xs text-dark-500 mt-1">
                  Каждые N проверок (0 = отключено)
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-dark-400 mb-2">
                  Хранить историю (дней)
                </label>
                <input
                  type="number"
                  className="input-field"
                  value={formData.monitoring?.historyDays || 7}
                  onChange={e => updateMonitoring('historyDays', parseInt(e.target.value) || 7)}
                  min={1}
                  max={90}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Как это работает */}
      <div className="p-4 bg-dark-800/30 rounded-xl text-sm text-dark-500">
        <p className="mb-3 font-medium text-dark-400">Как это работает:</p>
        <ul className="space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">1.</span>
            <span>Включите мониторинг на нужных карточках (Редактировать -{'>'} Мониторинг)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-400 mt-0.5">2.</span>
            <span>При сбое статус становится PENDING (желтый), начинается счетчик попыток</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-red-400 mt-0.5">3.</span>
            <span>После N неудачных попыток - статус DOWN (красный), отправляется уведомление</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">4.</span>
            <span>При проблемах используется более частый интервал повтора</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">5.</span>
            <span>При восстановлении - уведомление UP с указанием времени простоя</span>
          </li>
        </ul>
      </div>

      {/* Статусы */}
      <div className="p-4 bg-dark-800/30 rounded-xl">
        <p className="text-sm font-medium text-dark-400 mb-3">Статусы:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0"></div>
            <span className="text-dark-300 flex-shrink-0">UP</span>
            <span className="text-dark-500 truncate">- работает</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500 flex-shrink-0"></div>
            <span className="text-dark-300 flex-shrink-0">PENDING</span>
            <span className="text-dark-500 truncate">- проверка</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0"></div>
            <span className="text-dark-300 flex-shrink-0">DOWN</span>
            <span className="text-dark-500 truncate">- недоступен</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0"></div>
            <span className="text-dark-300 flex-shrink-0">MAINT</span>
            <span className="text-dark-500 truncate">- обслуживание</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MonitoringSettings;
