import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Save, Trash2, Server, Activity, Cloud, Wrench, Home, Shield, Globe, Database, Container, Network, Layers, Folder, Gauge, Cog, Receipt } from 'lucide-react';
import { categoryIcons } from '../../constants/icons';

const categoryIconsList = [
  { id: 'server', Icon: Server }, { id: 'activity', Icon: Activity }, { id: 'cloud', Icon: Cloud },
  { id: 'wrench', Icon: Wrench }, { id: 'home', Icon: Home }, { id: 'shield', Icon: Shield },
  { id: 'globe', Icon: Globe }, { id: 'database', Icon: Database }, { id: 'container', Icon: Container },
  { id: 'network', Icon: Network }, { id: 'layers', Icon: Layers }, { id: 'folder', Icon: Folder },
  { id: 'gauge', Icon: Gauge }, { id: 'cog', Icon: Cog }, { id: 'receipt', Icon: Receipt }
];

function CategoryEditor({ category, onSave, onDelete, onClose }) {
  const [formData, setFormData] = useState(category || { name: '', icon: 'folder' });
  const icons = Object.keys(categoryIcons);
  
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

  return (
    <motion.div 
      ref={overlayRef}
      className="fixed inset-0 modal-overlay flex items-start justify-center z-50 p-4 py-8 overflow-y-auto"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
      onMouseDown={handleOverlayMouseDown}
      onMouseUp={handleOverlayMouseUp}
    >
      <motion.div className="glass-card w-full max-w-md my-auto"
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">{category ? 'Редактировать категорию' : 'Новая категория'}</h2>
            <button onClick={onClose} className="p-2 hover:bg-dark-700 rounded-lg transition-colors"><X size={20} /></button>
          </div>

          <div className="space-y-4">
            <div><label className="block text-sm text-dark-400 mb-2">Название</label>
              <input type="text" className="input-field" value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Мои сервисы" /></div>
            <div><label className="block text-sm text-dark-400 mb-2">Иконка</label>
              <div className="flex flex-wrap gap-2">
                {icons.map(icon => {
                  const IconComp = categoryIcons[icon];
                  return (
                    <button key={icon}
                      className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all hover:bg-dark-700 ${formData.icon === icon ? 'bg-blue-500/20 ring-1 ring-blue-500' : 'bg-dark-800'}`}
                      onClick={() => setFormData({...formData, icon})} title={icon}>
                      <IconComp size={20} />
                    </button>
                  );
                })}
              </div></div>
          </div>

          <div className="flex justify-between gap-3 mt-6 pt-6 border-t border-dark-700">
            <div>{category && (
              <button className="btn btn-danger flex items-center gap-2" onClick={() => onDelete(category.id)}>
                <Trash2 size={16} />Удалить</button>
            )}</div>
            <div className="flex gap-3">
              <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
              <button className="btn btn-primary flex items-center gap-2" onClick={() => onSave(formData)}>
                <Save size={16} />Сохранить</button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============ Integration Template Editor ============
export default CategoryEditor;
