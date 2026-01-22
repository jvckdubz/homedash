import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Edit3, Trash2, X, CheckCircle2, Circle, Clock as ClockIcon,
  AlertCircle, Calendar, FileText, ChevronDown, ChevronUp, Globe, Check
} from 'lucide-react';
import api from '../../api';

function TasksPage({ onBack }) {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('homedash-tasks-tab') || 'tasks');
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [filter, setFilter] = useState('active'); // active | completed
  const [showTranslate, setShowTranslate] = useState(false);

  // Save activeTab to localStorage
  useEffect(() => {
    localStorage.setItem('homedash-tasks-tab', activeTab);
  }, [activeTab]);
  
  // New task form
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: ''
  });
  
  // New note form
  const [newNote, setNewNote] = useState({
    title: '',
    content: '',
    color: '#3b82f6'
  });

  const noteColors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', 
    '#f97316', '#eab308', '#22c55e', '#06b6d4'
  ];

  const priorityColors = {
    low: 'bg-green-500/20 text-green-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    high: 'bg-red-500/20 text-red-400'
  };

  const priorityLabels = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий'
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tasksData, notesData] = await Promise.all([
        api.get('/api/tasks').catch(() => []),
        api.get('/api/notes').catch(() => [])
      ]);
      setTasks(tasksData || []);
      setNotes(notesData || []);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  // Tasks handlers
  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;
    try {
      const task = await api.post('/api/tasks', newTask);
      setTasks(prev => [...prev, task]);
      setNewTask({ title: '', description: '', priority: 'medium', dueDate: '' });
      setShowAddTask(false);
    } catch (err) {
      console.error('Failed to add task:', err);
    }
  };

  const handleUpdateTask = async (id, updates) => {
    try {
      const updated = await api.put(`/api/tasks/${id}`, updates);
      setTasks(prev => prev.map(t => t.id === id ? updated : t));
      setEditingTask(null);
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const handleToggleTask = async (task) => {
    await handleUpdateTask(task.id, { completed: !task.completed });
  };

  const handleDeleteTask = async (id) => {
    if (!confirm('Удалить задачу?')) return;
    try {
      await api.delete(`/api/tasks/${id}`);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  // Notes handlers
  const handleAddNote = async () => {
    if (!newNote.title.trim() && !newNote.content.trim()) return;
    try {
      const note = await api.post('/api/notes', newNote);
      setNotes(prev => [...prev, note]);
      setNewNote({ title: '', content: '', color: '#3b82f6' });
      setShowAddNote(false);
    } catch (err) {
      console.error('Failed to add note:', err);
    }
  };

  const handleUpdateNote = async (id, updates) => {
    try {
      const updated = await api.put(`/api/notes/${id}`, updates);
      setNotes(prev => prev.map(n => n.id === id ? updated : n));
      setEditingNote(null);
    } catch (err) {
      console.error('Failed to update note:', err);
    }
  };

  const handleDeleteNote = async (id) => {
    if (!confirm('Удалить заметку?')) return;
    try {
      await api.delete(`/api/notes/${id}`);
      setNotes(prev => prev.filter(n => n.id !== id));
      setEditingNote(null);
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (filter === 'active') return !task.completed;
    if (filter === 'completed') return task.completed;
    return !task.completed; // default to active
  }).sort((a, b) => {
    // Sort: incomplete first, then by priority, then by due date
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  const completedCount = tasks.filter(t => t.completed).length;
  const activeCount = tasks.filter(t => !t.completed).length;

  // Format due date
  const formatDueDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date < today) return { text: 'Просрочено', class: 'text-red-400' };
    if (date.toDateString() === today.toDateString()) return { text: 'Сегодня', class: 'text-yellow-400' };
    if (date.toDateString() === tomorrow.toDateString()) return { text: 'Завтра', class: 'text-blue-400' };
    return { text: date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }), class: 'text-dark-400' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-animated flex items-center justify-center">
        <motion.div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full"
          animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-animated pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-dark-900/80 border-b border-dark-800">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-dark-700 transition-colors">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-xl font-semibold">Задачи</h1>
          </div>
          <div className="relative">
            <button 
              onClick={() => setShowTranslate(!showTranslate)}
              className={`p-2.5 rounded-xl hover:bg-dark-700 transition-colors ${showTranslate ? 'bg-dark-700' : ''}`}
            >
              <Globe size={20} />
            </button>
            <AnimatePresence>
              {showTranslate && (
                <TranslateWidget show={showTranslate} onClose={() => setShowTranslate(false)} />
              )}
            </AnimatePresence>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="px-4 pb-3 flex gap-2">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 py-2.5 px-4 rounded-xl font-medium transition-all ${
              activeTab === 'tasks' 
                ? 'bg-blue-500 text-white' 
                : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 size={18} />
              <span>Задачи</span>
              {activeCount > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === 'tasks' ? 'bg-white/20' : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {activeCount}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex-1 py-2.5 px-4 rounded-xl font-medium transition-all ${
              activeTab === 'notes' 
                ? 'bg-purple-500 text-white' 
                : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <FileText size={18} />
              <span>Заметки</span>
              {notes.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === 'notes' ? 'bg-white/20' : 'bg-purple-500/20 text-purple-400'
                }`}>
                  {notes.length}
                </span>
              )}
            </div>
          </button>
        </div>
      </header>

      {/* Tasks Tab */}
      {activeTab === 'tasks' && (
        <div className="p-4">
          {/* Filter */}
          {tasks.length > 0 && (
            <div className="flex gap-2 mb-4">
              {[
                { id: 'active', label: 'Активные', count: activeCount },
                { id: 'completed', label: 'Выполненные', count: completedCount }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    filter === f.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
                  }`}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
          )}

          {/* Tasks List */}
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filteredTasks.map(task => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`bg-dark-800/50 backdrop-blur rounded-xl p-4 border border-dark-700 cursor-pointer hover:border-dark-600 transition-colors ${
                    task.completed ? 'opacity-60' : ''
                  }`}
                  onClick={() => setEditingTask(task)}
                >
                  <div className="flex gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleTask(task); }}
                      className={`w-6 h-6 rounded-lg border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        task.completed
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-dark-500 hover:border-blue-500'
                      }`}
                    >
                      {task.completed && <Check size={14} />}
                    </button>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className={`font-medium ${task.completed ? 'line-through text-dark-400' : ''}`}>
                          {task.title}
                        </h3>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-dark-400 hover:text-red-400 transition-colors flex-shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      
                      {task.description && (
                        <p className="text-sm text-dark-400 mt-1 line-clamp-2">{task.description}</p>
                      )}
                      
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[task.priority]}`}>
                          {priorityLabels[task.priority]}
                        </span>
                        {task.dueDate && (() => {
                          const due = formatDueDate(task.dueDate);
                          return due && (
                            <span className={`flex items-center gap-1 text-xs ${due.class}`}>
                              <Calendar size={12} />
                              {due.text}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Empty State */}
          {filteredTasks.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle2 size={48} className="mx-auto text-dark-600 mb-4" />
              <p className="text-dark-400 mb-4">
                {filter === 'completed' ? 'Нет выполненных задач' : 'Все задачи выполнены!'}
              </p>
              {filter === 'active' && (
                <button
                  onClick={() => setShowAddTask(true)}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-xl text-sm font-medium transition-colors"
                >
                  Добавить задачу
                </button>
              )}
            </div>
          )}

          {/* Add Button */}
          {(tasks.length > 0 || filter === 'active') && filteredTasks.length > 0 && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAddTask(true)}
              className="fixed bottom-24 right-4 w-14 h-14 bg-blue-500 hover:bg-blue-600 rounded-full shadow-lg flex items-center justify-center transition-colors z-50"
            >
              <Plus size={24} />
            </motion.button>
          )}
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <div className="p-4">
          {/* Notes Grid */}
          <div className="grid grid-cols-2 gap-3">
            <AnimatePresence mode="popLayout">
              {notes.map(note => (
                <motion.div
                  key={note.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => setEditingNote(note)}
                  className="bg-dark-800/50 backdrop-blur rounded-xl p-4 border border-dark-700 cursor-pointer hover:border-dark-600 transition-colors"
                  style={{ borderLeftWidth: '3px', borderLeftColor: note.color }}
                >
                  {note.title && (
                    <h3 className="font-medium mb-1 line-clamp-1">{note.title}</h3>
                  )}
                  <p className="text-sm text-dark-400 line-clamp-4 whitespace-pre-wrap">
                    {note.content || 'Пустая заметка'}
                  </p>
                  <p className="text-xs text-dark-500 mt-2">
                    {new Date(note.updatedAt).toLocaleDateString('ru-RU')}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Empty State */}
          {notes.length === 0 && (
            <div className="text-center py-12">
              <FileText size={48} className="mx-auto text-dark-600 mb-4" />
              <p className="text-dark-400">Нет заметок</p>
              <button
                onClick={() => setShowAddNote(true)}
                className="mt-4 px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-xl text-sm font-medium transition-colors"
              >
                Создать заметку
              </button>
            </div>
          )}

          {/* Add Button */}
          {notes.length > 0 && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAddNote(true)}
              className="fixed bottom-24 right-4 w-14 h-14 bg-purple-500 hover:bg-purple-600 rounded-full shadow-lg flex items-center justify-center transition-colors z-50"
            >
              <Plus size={24} />
            </motion.button>
          )}
        </div>
      )}

      {/* Add Task Modal */}
      <AnimatePresence>
        {showAddTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 pb-24 sm:pb-4"
            onClick={() => setShowAddTask(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-dark-800 rounded-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-dark-700 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Новая задача</h2>
                <button onClick={() => setShowAddTask(false)} className="p-2 hover:bg-dark-700 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm text-dark-400 mb-1.5">Название</label>
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                    placeholder="Что нужно сделать?"
                    className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl focus:border-blue-500 focus:outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm text-dark-400 mb-1.5">Описание</label>
                  <textarea
                    value={newTask.description}
                    onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                    placeholder="Подробности (необязательно)"
                    rows={3}
                    className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-dark-400 mb-1.5">Приоритет</label>
                    <select
                      value={newTask.priority}
                      onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl focus:border-blue-500 focus:outline-none"
                    >
                      <option value="low">Низкий</option>
                      <option value="medium">Средний</option>
                      <option value="high">Высокий</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-dark-400 mb-1.5">Срок</label>
                    <input
                      type="date"
                      value={newTask.dueDate}
                      onChange={e => setNewTask(p => ({ ...p, dueDate: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  onClick={handleAddTask}
                  disabled={!newTask.title.trim()}
                  className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
                >
                  Добавить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Task Modal */}
      <AnimatePresence>
        {editingTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 pb-24 sm:pb-4"
            onClick={() => setEditingTask(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-dark-800 rounded-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-dark-700 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Редактировать</h2>
                <button onClick={() => setEditingTask(null)} className="p-2 hover:bg-dark-700 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm text-dark-400 mb-1.5">Название</label>
                  <input
                    type="text"
                    value={editingTask.title}
                    onChange={e => setEditingTask(p => ({ ...p, title: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-dark-400 mb-1.5">Описание</label>
                  <textarea
                    value={editingTask.description}
                    onChange={e => setEditingTask(p => ({ ...p, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-dark-400 mb-1.5">Приоритет</label>
                    <select
                      value={editingTask.priority}
                      onChange={e => setEditingTask(p => ({ ...p, priority: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl focus:border-blue-500 focus:outline-none"
                    >
                      <option value="low">Низкий</option>
                      <option value="medium">Средний</option>
                      <option value="high">Высокий</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-dark-400 mb-1.5">Срок</label>
                    <input
                      type="date"
                      value={editingTask.dueDate || ''}
                      onChange={e => setEditingTask(p => ({ ...p, dueDate: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDeleteTask(editingTask.id)}
                    className="flex-1 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl font-medium transition-colors"
                  >
                    Удалить
                  </button>
                  <button
                    onClick={() => handleUpdateTask(editingTask.id, editingTask)}
                    className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 rounded-xl font-medium transition-colors"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Note Modal */}
      <AnimatePresence>
        {showAddNote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 pb-24 sm:pb-4 overflow-hidden"
            onClick={() => setShowAddNote(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-dark-800 rounded-2xl overflow-hidden max-h-[60vh] sm:max-h-[80vh] flex flex-col"
            >
              <div className="p-4 border-b border-dark-700 flex items-center justify-between flex-shrink-0">
                <h2 className="text-lg font-semibold">Новая заметка</h2>
                <button onClick={() => setShowAddNote(false)} className="p-2 hover:bg-dark-700 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 space-y-4 flex-1 overflow-y-auto overflow-x-hidden">
                <div>
                  <label className="block text-sm text-dark-400 mb-1.5">Заголовок</label>
                  <input
                    type="text"
                    value={newNote.title}
                    onChange={e => setNewNote(p => ({ ...p, title: e.target.value }))}
                    placeholder="Заголовок (необязательно)"
                    className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-dark-400 mb-1.5">Содержание</label>
                  <textarea
                    value={newNote.content}
                    onChange={e => setNewNote(p => ({ ...p, content: e.target.value }))}
                    placeholder="Текст заметки..."
                    rows={6}
                    className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl focus:border-purple-500 focus:outline-none resize-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm text-dark-400 mb-1.5">Цвет</label>
                  <div className="flex flex-wrap gap-2">
                    {noteColors.map(color => (
                      <button
                        key={color}
                        onClick={() => setNewNote(p => ({ ...p, color }))}
                        className={`w-8 h-8 rounded-lg transition-transform ${
                          newNote.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-800 scale-110' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.title.trim() && !newNote.content.trim()}
                  className="w-full py-3 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
                >
                  Создать
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Note Modal */}
      <AnimatePresence>
        {editingNote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 pb-24 sm:pb-4 overflow-hidden"
            onClick={() => setEditingNote(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-dark-800 rounded-2xl overflow-hidden max-h-[60vh] sm:max-h-[80vh] flex flex-col"
            >
              <div className="p-4 border-b border-dark-700 flex items-center justify-between flex-shrink-0">
                <h2 className="text-lg font-semibold">Редактировать</h2>
                <button onClick={() => setEditingNote(null)} className="p-2 hover:bg-dark-700 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 space-y-4 flex-1 overflow-y-auto overflow-x-hidden">
                <div>
                  <label className="block text-sm text-dark-400 mb-1.5">Заголовок</label>
                  <input
                    type="text"
                    value={editingNote.title}
                    onChange={e => setEditingNote(p => ({ ...p, title: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-dark-400 mb-1.5">Содержание</label>
                  <textarea
                    value={editingNote.content}
                    onChange={e => setEditingNote(p => ({ ...p, content: e.target.value }))}
                    rows={8}
                    className="w-full px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl focus:border-purple-500 focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-dark-400 mb-1.5">Цвет</label>
                  <div className="flex flex-wrap gap-2">
                    {noteColors.map(color => (
                      <button
                        key={color}
                        onClick={() => setEditingNote(p => ({ ...p, color }))}
                        className={`w-8 h-8 rounded-lg transition-transform ${
                          editingNote.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-800 scale-110' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDeleteNote(editingNote.id)}
                    className="flex-1 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl font-medium transition-colors"
                  >
                    Удалить
                  </button>
                  <button
                    onClick={() => handleUpdateNote(editingNote.id, editingNote)}
                    className="flex-1 py-3 bg-purple-500 hover:bg-purple-600 rounded-xl font-medium transition-colors"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TasksPage;
