import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Globe, X, ExternalLink, Check } from 'lucide-react';

function TranslateWidget({ show, onClose }) {
  const [selectedLang, setSelectedLang] = useState(() => {
    // Check if already translated
    const match = document.cookie.match(/googtrans=\/ru\/([a-z-]+)/i);
    return match ? match[1] : '';
  });
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const languages = [
    { code: '', name: 'Русский (оригинал)' },
    { code: 'en', name: 'English' },
    { code: 'de', name: 'Deutsch' },
    { code: 'fr', name: 'Francais' },
    { code: 'es', name: 'Espanol' },
    { code: 'it', name: 'Italiano' },
    { code: 'pt', name: 'Portugues' },
    { code: 'zh-CN', name: '中文' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
    { code: 'tr', name: 'Turkce' },
    { code: 'pl', name: 'Polski' },
    { code: 'uk', name: 'Українська' },
  ];

  useEffect(() => {
    if (!show) return;
    
    // Load Google Translate script if not loaded
    if (!window.google?.translate?.TranslateElement && !scriptLoaded) {
      const script = document.createElement('script');
      script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      
      // Create hidden container for Google widget
      let container = document.getElementById('google_translate_element');
      if (!container) {
        container = document.createElement('div');
        container.id = 'google_translate_element';
        container.style.display = 'none';
        document.body.appendChild(container);
      }
      
      window.googleTranslateElementInit = () => {
        new window.google.translate.TranslateElement({
          pageLanguage: 'ru',
          includedLanguages: 'en,de,fr,es,it,pt,zh-CN,ja,ko,tr,pl,uk',
          autoDisplay: false
        }, 'google_translate_element');
        setScriptLoaded(true);
      };
      
      document.body.appendChild(script);
    } else {
      setScriptLoaded(true);
    }
  }, [show]);

  const handleLanguageChange = (langCode) => {
    setSelectedLang(langCode);
    
    if (langCode === '') {
      // Reset to original
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + window.location.hostname;
      window.location.reload();
      return;
    }
    
    // Set translation cookie and trigger
    document.cookie = `googtrans=/ru/${langCode}; path=/;`;
    document.cookie = `googtrans=/ru/${langCode}; path=/; domain=${window.location.hostname}`;
    
    // Try to trigger Google Translate
    const select = document.querySelector('.goog-te-combo');
    if (select) {
      select.value = langCode;
      select.dispatchEvent(new Event('change'));
    } else {
      window.location.reload();
    }
    
    onClose();
  };

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute right-0 top-full mt-2 bg-dark-800 rounded-xl border border-dark-700 shadow-2xl z-50 overflow-hidden w-48 sm:w-56"
      style={{ maxHeight: 'calc(100vh - 120px)' }}
    >
      <div className="p-3 border-b border-dark-700 flex items-center justify-between">
        <span className="text-sm font-medium">Перевод</span>
        <button onClick={onClose} className="p-1 hover:bg-dark-700 rounded-lg transition-colors">
          <X size={16} />
        </button>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: '280px' }}>
        {languages.map(lang => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`w-full px-3 py-2.5 text-left text-sm flex items-center justify-between hover:bg-dark-700 transition-colors ${
              selectedLang === lang.code ? 'bg-blue-500/20 text-blue-400' : 'text-dark-200'
            }`}
          >
            <span>{lang.name}</span>
            {selectedLang === lang.code && <Check size={16} />}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ============ Main App ============
export default TranslateWidget;
