import type { ReactNode } from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';

import { useLanguage } from '../i18n/LanguageProvider';
import { colors, fontFamily, type Family, type Weight } from './theme';

export type TProps = TextProps & {
  children?: ReactNode;
  /** size, weight, colour, family, line height, centred, uppercase with letter spacing */
  s?: number;
  w?: Weight;
  c?: string;
  f?: Family;
  lh?: number;
  center?: boolean;
  caps?: number;
  /** do not translate (names, numbers, codes) */
  raw?: boolean;
};

/** Text that follows the EN / Hindi switch. Each string child is translated on its own, like a text node on the web. */
export function T({ children, style, s = 16, w = 400, c = colors.ink, f = 'body', lh, center, caps, raw, ...rest }: TProps) {
  const { t, lang } = useLanguage();
  const list = Array.isArray(children) ? children : [children];
  const ratio = f === 'display' ? 1.18 : 1.55;
  let lineHeight = lh ?? Math.round(s * ratio);
  if (lang === 'hi') lineHeight = Math.max(lineHeight, Math.round(s * 1.42)); // Devanagari marks need the room
  const base: TextStyle = {
    fontFamily: fontFamily(f, w), fontSize: s, lineHeight, color: c,
    ...(center ? { textAlign: 'center' } : null),
    ...(caps !== undefined ? { textTransform: 'uppercase', letterSpacing: caps } : null),
  };
  return (
    <Text style={[base, style]} maxFontSizeMultiplier={1.3} {...rest}>
      {list.map((child) => (typeof child === 'string' && !raw ? t(child) : child))}
    </Text>
  );
}
