import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

// Проверяем путь ДО загрузки основного приложения
const isStatusPage = window.location.pathname === '/status';

// Динамический импорт - загружаем только нужный компонент
const AppComponent = isStatusPage 
  ? React.lazy(() => import('./pages/StatusPage'))
  : React.lazy(() => import('./App.jsx'));

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <React.Suspense fallback={
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <AppComponent />
    </React.Suspense>
  </React.StrictMode>,
)
