import { StyleSheet, Text as RNText, type TextProps } from 'react-native';

/* The website's fonts: Manrope for body text, Sora for headings (fontFamily: 'display'), IBM Plex Mono for codes (fontFamily: 'mono').
   Set fontWeight as usual; this picks the matching font file. */
const MANROPE: Record<string, string> = { '400': 'Manrope_400Regular', '500': 'Manrope_500Medium', '600': 'Manrope_600SemiBold', '700': 'Manrope_700Bold', '800': 'Manrope_800ExtraBold' };
const SORA: Record<string, string> = { '400': 'Sora_400Regular', '600': 'Sora_600SemiBold', '700': 'Sora_700Bold', '800': 'Sora_800ExtraBold' };
const MONO: Record<string, string> = { '400': 'IBMPlexMono_400Regular', '500': 'IBMPlexMono_500Medium', '600': 'IBMPlexMono_600SemiBold', '700': 'IBMPlexMono_700Bold' };

export function fontFor(family: string | undefined, weight: string | number | undefined) {
  const w = String(weight ?? '400');
  const near = (m: Record<string, string>) => m[w] || (Number(w) >= 800 ? Object.values(m).slice(-1)[0] : Number(w) >= 600 ? m['700'] || m['600'] : m['400']);
  if (family === 'display') return near(SORA);
  if (family === 'mono') return near(MONO);
  return near(MANROPE);
}

export function Text({ style, ...p }: TextProps) {
  const f = StyleSheet.flatten(style) || {};
  const { fontWeight, fontFamily, ...rest } = f as { fontWeight?: string | number; fontFamily?: string };
  return <RNText {...p} style={[rest, { fontFamily: fontFor(fontFamily, fontWeight) }]} />;
}
