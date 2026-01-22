import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Save, Trash2, Plus, AlertCircle } from 'lucide-react';

function IntegrationTemplateEditor({ template, onSave, onDelete, onClose }) {
  const [formData, setFormData] = useState({
    type: template?.type || '', 
    name: template?.name || '', 
    endpoint: template?.endpoint || '', 
    method: template?.method || 'GET', 
    authType: template?.authType || 'none', 
    fields: template?.fields || [], 
    responseMapping: template?.responseMapping || ''
  });
  const [newField, setNewField] = useState({ key: '', label: '', type: 'text', placeholder: '' });

  // Ref для отслеживания где начался клик
  const overlayRef = useRef(null);
  const mouseDownTarget = useRef(null);

  const handleOverlayMouseDown = (e) => {
    mouseDownTarget.current = e.target;
  };

  const handleOverlayMouseUp = (e) => {
    if (mouseDownTarget.current === overlayRef.current && e.target === overlayRef.current) {
      onClose();
    }
    mouseDownTarget.current = null;
  };

  const addField = () => {
    if (newField.key && newField.label) {
      setFormData({...formData, fields: [...formData.fields, { ...newField }]});
      setNewField({ key: '', label: '', type: 'text', placeholder: '' });
    }
  };

  return (
    <motion.div 
      ref={overlayRef}
      className="fixed inset-0 modal-overlay flex items-start justify-center z-[400] p-4 py-8 overflow-y-auto"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
      onMouseDown={handleOverlayMouseDown}
      onMouseUp={handleOverlayMouseUp}
    >
      <motion.div className="glass-card w-full max-w-2xl my-auto mb-24"
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">{template ? 'Редактировать интеграцию' : 'Новый шаблон интеграции'}</h2>
            <button onClick={onClose} className="p-2 hover:bg-dark-700 rounded-lg transition-colors"><X size={20} /></button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm text-dark-400 mb-2">ID (латиница)</label>
                <input type="text" className="input-field" value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})}
                  placeholder="my-service" disabled={!!template} /></div>
              <div><label className="block text-sm text-dark-400 mb-2">Название</label>
                <input type="text" className="input-field" value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Мой сервис" /></div>
            </div>

            <div><label className="block text-sm text-dark-400 mb-2">API Endpoint</label>
              <input type="text" className="input-field" value={formData.endpoint}
                onChange={e => setFormData({...formData, endpoint: e.target.value})}
                placeholder="/api/status или полный URL" />
              <p className="text-xs text-dark-500 mt-1">Используйте {'{{host}}'} для подстановки хоста из настроек карточки</p></div>

            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm text-dark-400 mb-2">Метод</label>
                <select className="input-field" value={formData.method}
                  onChange={e => setFormData({...formData, method: e.target.value})}>
                  <option value="GET">GET</option><option value="POST">POST</option>
                </select></div>
              <div><label className="block text-sm text-dark-400 mb-2">Авторизация</label>
                <select className="input-field" value={formData.authType}
                  onChange={e => setFormData({...formData, authType: e.target.value})}>
                  <option value="none">Без авторизации</option>
                  <option value="basic">Basic Auth</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="apikey">API Key (header)</option>
                </select></div>
            </div>

            <div><label className="block text-sm text-dark-400 mb-2">Поля конфигурации</label>
              <div className="space-y-2 mb-3">
                {formData.fields.map((field, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-dark-800 p-2 rounded-lg">
                    <span className="text-dark-300 flex-1">{field.label}</span>
                    <span className="text-dark-500 text-sm">{field.key}</span>
                    <span className="text-dark-500 text-sm">{field.type}</span>
                    <button className="p-1 hover:bg-dark-700 rounded"
                      onClick={() => setFormData({...formData, fields: formData.fields.filter((_, i) => i !== idx)})}>
                      <X size={14} className="text-red-400" /></button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                <input type="text" className="input-field" value={newField.key}
                  onChange={e => setNewField({...newField, key: e.target.value})} placeholder="key" />
                <input type="text" className="input-field" value={newField.label}
                  onChange={e => setNewField({...newField, label: e.target.value})} placeholder="Label" />
                <select className="input-field" value={newField.type}
                  onChange={e => setNewField({...newField, type: e.target.value})}>
                  <option value="text">Text</option><option value="password">Password</option><option value="url">URL</option>
                </select>
                <button className="btn btn-secondary" onClick={addField}><Plus size={16} /></button>
              </div></div>

            <div><label className="block text-sm text-dark-400 mb-2">Маппинг ответа (JS)</label>
              <textarea className="input-field font-mono text-sm h-24" value={formData.responseMapping}
                onChange={e => setFormData({...formData, responseMapping: e.target.value})}
                placeholder={`// data - ответ API\nreturn {\n  configured: true,\n  display: data.status\n}`} /></div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-3 mt-6 pt-6 border-t border-dark-700">
            {template ? (
              <button className="btn btn-danger flex items-center justify-center gap-2 order-2 sm:order-1" onClick={() => onDelete(template.type)}>
                <Trash2 size={16} />Удалить</button>
            ) : <div className="hidden sm:block" />}
            <div className="flex gap-2 order-1 sm:order-2">
              <button className="btn btn-secondary flex-1 sm:flex-none" onClick={onClose}>Отмена</button>
              <button className="btn btn-primary flex-1 sm:flex-none flex items-center justify-center gap-2" onClick={() => onSave(formData)}>
                <Save size={16} />Сохранить</button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============ System Info Component ============
export default IntegrationTemplateEditor;
