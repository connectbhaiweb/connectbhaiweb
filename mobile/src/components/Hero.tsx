import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import { colors } from '@/lib/theme';

/* Navy hero with the website's faint grid. */
export function Hero({ children }: { children: ReactNode }) {
  return (
    <View style={s.hero}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <Pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse">
            <Path d="M36 0H0V36" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#grid)" />
      </Svg>
      {children}
    </View>
  );
}
const s = StyleSheet.create({ hero: { backgroundColor: colors.blueDeep, paddingHorizontal: 16, paddingTop: 22, paddingBottom: 22, overflow: 'hidden' } });
