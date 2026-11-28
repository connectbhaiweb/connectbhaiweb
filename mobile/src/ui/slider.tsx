/* A range input (the "Max price" filter). Core React Native only. */
import { useRef, useState } from 'react';
import { View, type GestureResponderEvent, type ViewInstance } from 'react-native';

import { useLanguage } from '../i18n/LanguageProvider';
import { colors } from './theme';

export function Slider({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  const { t } = useLanguage();
  const [width, setWidth] = useState(0);
  const left = useRef(0);
  const box = useRef<ViewInstance>(null);
  const span = Math.max(step, max - min);
  const at = Math.min(1, Math.max(0, (value - min) / span));
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const move = (e: GestureResponderEvent) => {
    if (!width) return;
    const ratio = Math.min(1, Math.max(0, (e.nativeEvent.pageX - left.current) / width));
    onChange(clamp(ratio >= 1 ? max : Math.round((min + ratio * span - min) / step) * step + min));
  };
  return (
    <View
      ref={box}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={t(label)}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(clamp(value + (e.nativeEvent.actionName === 'increment' ? step : -step)))}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        const pageX = e.nativeEvent.pageX;
        box.current?.measure((_x, _y, _w, _h, px) => {
          left.current = px;
          if (width) onChange(clamp(Math.round((Math.min(1, Math.max(0, (pageX - px) / width)) * span) / step) * step + min));
        });
      }}
      onResponderMove={move}
      style={{ height: 36, justifyContent: 'center' }}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.line }}>
        <View style={{ width: `${at * 100}%`, height: 6, borderRadius: 3, backgroundColor: colors.blue }} />
      </View>
      <View style={{ position: 'absolute', left: Math.max(0, at * width - 10), width: 20, height: 20, borderRadius: 10, backgroundColor: colors.blue, borderWidth: 2, borderColor: colors.white }} />
    </View>
  );
}
