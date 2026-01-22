import React, { useContext, createContext } from 'react';
import { translations } from '../constants/translations';

// i18n Context
export const I18nContext = React.createContext({ 
  t: (k) => k, 
  lang: 'ru', 
  setLang: () => {} 
});

export const useI18n = () => React.useContext(I18nContext);

// i18n Provider
export function I18nProvider({ children, lang, setLang }) {
  const t = (key) => translations[lang]?.[key] || translations['ru']?.[key] || key;
  
  return (
    <I18nContext.Provider value={{ t, lang, setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export default useI18n;
