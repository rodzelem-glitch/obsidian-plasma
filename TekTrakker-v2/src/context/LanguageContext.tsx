import { cleanUndefinedFields } from '../lib/utils';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, TranslationKeys } from '../constants/translations';
import { useAppContext } from './AppContext';
import { db } from 'lib/firebase';

type Language = 'en' | 'es';

interface LanguageContextProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state, dispatch } = useAppContext();
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app-language');
    if (saved === 'es' || saved === 'en') return saved;
    return 'en';
  });

  // Keep in sync with state.currentUser.preferences?.language if present
  useEffect(() => {
    const userPref = state.currentUser?.preferences?.language;
    if (userPref === 'es' || userPref === 'en') {
      if (userPref !== language) {
        setLanguageState(userPref);
        localStorage.setItem('app-language', userPref);
      }
    }
  }, [state.currentUser?.preferences?.language]);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app-language', lang);

    // Save to user preferences in DB if user is logged in
    if (state.currentUser?.id && !state.isDemoMode) {
      try {
        const updatedPrefs = {
          ...state.currentUser.preferences,
          language: lang,
        };
        await db.collection('users').doc(state.currentUser.id).set(cleanUndefinedFields({
          preferences: updatedPrefs,
        }), { merge: true });

        dispatch({
          type: 'UPDATE_EMPLOYEE',
          payload: {
            ...state.currentUser,
            preferences: updatedPrefs,
          },
        });
      } catch (err) {
        console.error('Failed to sync language preference to Firestore:', err);
      }
    }
  };

  const t = (key: string, params?: Record<string, string>): string => {
    // 1. Check exact key match in active language
    const activeDict = translations[language];
    let translation = activeDict && activeDict[key] ? activeDict[key] : (translations['en'][key] || key);

    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        translation = translation.replace(new RegExp(`{${paramKey}}`, 'g'), value);
      });
    }

    return translation;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
