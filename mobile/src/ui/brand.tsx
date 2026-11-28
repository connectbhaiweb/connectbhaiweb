/* The logo (tap plays the reveal, like the website), the language switch and the provider logos. */
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { useLanguage } from '../i18n/LanguageProvider';
import type { Provider } from '../lib/api/types';
import { T } from './text';
import { colors, radius } from './theme';

const STATIC = require('../../assets/logo-full.png');
const REVEAL = require('../../assets/logo-reveal.webp');
const RATIO = 452 / 96;
const PLAY_MS = 3600;

export function Logo({ height = 30, onPress }: { height?: number; onPress?: () => void }) {
  const calm = useReducedMotion();
  const [play, setPlay] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Connect Bhai home"
      hitSlop={8}
      style={{ flexShrink: 1 }} // a narrow header makes the logo smaller instead of running into the buttons
      onPress={() => {
        if (!calm) {
          setPlay((n) => n + 1);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setPlay(0), PLAY_MS);
        }
        onPress?.();
      }}>
      <Image key={play} source={play ? REVEAL : STATIC} style={{ width: Math.round(height * RATIO), maxWidth: '100%', height }} contentFit="contain" recyclingKey={'logo' + play} />
    </Pressable>
  );
}

export function LangToggle({ light }: { light?: boolean }) {
  const { lang, setLang } = useLanguage();
  const toHindi = lang === 'en';
  const side = (label: string, on: boolean) => (
    <View style={{ paddingHorizontal: 7, minWidth: 28, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? (light ? colors.blue : colors.white) : 'transparent' }}>
      <T s={12} w={800} lh={18} raw c={on ? (light ? colors.white : colors.blueDeep) : light ? colors.muted : 'rgba(201,216,255,0.85)'}>{label}</T>
    </View>
  );
  return (
    <Pressable
      testID="lang-toggle"
      accessibilityRole="button"
      accessibilityLabel={toHindi ? 'हिन्दी में देखें (Switch to Hindi)' : 'Switch to English (अंग्रेज़ी में देखें)'}
      onPress={() => setLang(toHindi ? 'hi' : 'en')}
      hitSlop={8}
      style={{ flexDirection: 'row', borderWidth: 1, borderColor: light ? colors.lineStrong : 'rgba(141,180,255,0.4)', borderRadius: radius.pill, padding: 2 }}>
      {side('EN', toHindi)}
      {side('हिं', !toHindi)}
    </Pressable>
  );
}

const LOGOS: Record<string, number> = {
  '/logos/bsnl.png': require('../../assets/logos/bsnl.png'),
  '/logos/jio.svg': require('../../assets/logos/jio.svg'),
  '/logos/airtel.svg': require('../../assets/logos/airtel.svg'),
};

export function ProviderLogo({ provider, size = 30 }: { provider: Provider; size?: number }) {
  const url = provider.logo_url;
  const source = url ? LOGOS[url] || (/^https?:/.test(url) ? { uri: url } : null) : null;
  if (!source)
    return (
      <View style={{ width: size, height: size, borderRadius: radius.sm, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' }}>
        <T f="display" s={13} w={800} c={colors.white} raw>{(provider.brand || provider.name || '?').slice(0, 2).toUpperCase()}</T>
      </View>
    );
  return (
    <View style={{ width: size, height: size, borderRadius: radius.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E4EAF5', padding: 3 }}>
      <Image source={source} style={{ flex: 1 }} contentFit="contain" accessibilityLabel={provider.brand} />
    </View>
  );
}

/** Round social icons, drawn like the website's footer. */
export { FacebookIcon, InstagramIcon } from './social';
