import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { APP_HINDI } from './appHindi';
import { EXACT, PATTERNS } from './generated/hi';
import { compile, translate, type Dictionary } from './translate';

const KEY = 'cb-lang'; // same name as the website
export type Lang = 'en' | 'hi';

let dictionary: Dictionary | null = null;
const hindi = () => (dictionary ||= compile({ ...APP_HINDI, ...EXACT }, PATTERNS));

/** Texts shown in Hindi mode that have no Hindi entry (development only; reported at the end of each stage). */
export const missingHindi = new Set<string>();
const noteMissing = (core: string) => {
  if (__DEV__ && !missingHindi.has(core)) {
    missingHindi.add(core);
    console.log('[i18n] no Hindi for:', core);
  }
};

type Value = { lang: Lang; setLang: (next: Lang) => void; t: (text: string) => string };
const Context = createContext<Value>({ lang: 'en', setLang: () => {}, t: (text) => text });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setState] = useState<Lang>('en');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((saved) => saved === 'hi' && setState('hi'))
      .catch(() => {});
  }, []);

  const setLang = useCallback((next: Lang) => {
    setState(next);
    AsyncStorage.setItem(KEY, next).catch(() => {});
  }, []);

  const value = useMemo<Value>(
    () => ({ lang, setLang, t: (text) => (lang === 'hi' ? translate(hindi(), text, noteMissing) : text) }),
    [lang, setLang],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useLanguage = () => useContext(Context);
