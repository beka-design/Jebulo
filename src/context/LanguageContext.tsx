import React, { createContext, useContext, useState, useEffect } from 'react';
import { en } from '../locales/en';
import { am } from '../locales/am';
import { SupportedLanguage } from '../types';


interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (keyPath: string, fallback?: string) => string;
  isAmharic: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'gizay_preferred_lang';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved === 'am' || saved === 'en') return saved;
    return 'en';
  });

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, language);
    document.documentElement.lang = language;
    if (language === 'am') {
      document.documentElement.classList.add('font-ethiopic');
    } else {
      document.documentElement.classList.remove('font-ethiopic');
    }
  }, [language]);

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
  };

  const t = (keyPath: string, fallback?: string): string => {
    const dict = language === 'am' ? am : en;
    const parts = keyPath.split('.');
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = dict;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        // Fallback to English dictionary if key missing in Amharic
        let enCurrent: any = en;
        for (const enPart of parts) {
          if (enCurrent && typeof enCurrent === 'object' && enPart in enCurrent) {
            enCurrent = enCurrent[enPart];
          } else {
            return fallback || keyPath;
          }
        }
        return typeof enCurrent === 'string' ? enCurrent : fallback || keyPath;
      }
    }
    return typeof current === 'string' ? current : fallback || keyPath;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        isAmharic: language === 'am',
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
