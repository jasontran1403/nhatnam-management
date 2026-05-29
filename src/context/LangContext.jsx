// src/context/LangContext.jsx
import { createContext, useContext, useState, useCallback } from 'react';
import vi from '../lang-vi.json';
import en from '../lang-en.json';

const STORAGE_KEY = 'app_lang';

const LangContext = createContext(null);

export const LangProvider = ({ children }) => {
  const [lang, setLang] = useState(() => localStorage.getItem(STORAGE_KEY) || 'vi');

  const toggle = useCallback(() => {
    setLang(prev => {
      const next = prev === 'vi' ? 'en' : 'vi';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const switchLang = useCallback((l) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLang(l);
  }, []);

  // t(section, key) → string
  // t('common.save') → string (dot notation shorthand)
  const t = useCallback((section, key) => {
    const dict = lang === 'vi' ? vi : en;
    if (key === undefined) {
      // dot notation: t('common.save')
      const parts = section.split('.');
      return parts.reduce((obj, k) => obj?.[k], dict) ?? section;
    }
    return dict[section]?.[key] ?? key;
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, toggle, switchLang, t, vi, en }}>
      {children}
    </LangContext.Provider>
  );
};

export const useLang = () => useContext(LangContext);
