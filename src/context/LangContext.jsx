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

  /**
   * Cách gọi:
   *   t(section, key)             → 'Lưu'
   *   t(section, key, params)     → nội suy {n}, {name}...
   *   t('section.key')            → dot notation
   *   t('section.key', params)    → dot notation + nội suy
   *
   * TƯƠNG THÍCH NGƯỢC 100% với cách gọi cũ.
   */
  const t = useCallback((section, key, params) => {
    const dict = lang === 'vi' ? vi : en;

    let raw;
    if (key === undefined || typeof key === 'object') {
      // dot notation: t('common.save') hoặc t('common.save', { n: 3 })
      if (typeof key === 'object') params = key;
      raw = section.split('.').reduce((obj, k) => obj?.[k], dict);
      if (raw == null && import.meta.env.DEV) console.warn('[i18n] missing key:', section);
      raw = raw ?? section;
    } else {
      raw = dict[section]?.[key];
      if (raw == null && import.meta.env.DEV) console.warn(`[i18n] missing key: ${section}.${key}`);
      raw = raw ?? key;
    }

    // Nội suy: "Đã xác nhận {n} nguyên liệu" + { n: 5 }
    if (params && typeof raw === 'string') {
      raw = raw.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? `{${k}}`));
    }
    return raw;
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, toggle, switchLang, t, vi, en }}>
      {children}
    </LangContext.Provider>
  );
};

export const useLang = () => useContext(LangContext);
