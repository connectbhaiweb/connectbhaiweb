import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import hi from '@/lib/hi.json';
import { HI_EXTRA } from '@/lib/hi-extra';

export type Lang = 'en' | 'hi';
const KEY = 'cb-lang';
const DICT: Record<string, string> = { ...(hi as Record<string, string>), ...HI_EXTRA };

let current: Lang = 'en';
/** Translates plain English text. Anything without a Hindi entry stays English. */
export const tr = (text: string, lang: Lang = current): string => (lang === 'hi' ? DICT[text] ?? text : text);

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'en', setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, set] = useState<Lang>('en');
  useEffect(() => {
    SecureStore.getItemAsync(KEY).then((v) => { if (v === 'hi') { current = 'hi'; set('hi'); } }).catch(() => {});
  }, []);
  const setLang = useCallback((l: Lang) => {
    current = l; set(l);
    SecureStore.setItemAsync(KEY, l).catch(() => {});
  }, []);
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
