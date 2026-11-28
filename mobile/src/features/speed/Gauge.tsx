/* The website's speed gauge: 270° sweep, 0 at bottom-left, 100 Mbps at the top, 300+ at bottom-right. */
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import { useLanguage } from '../../i18n/LanguageProvider';
import { T } from '../../ui/text';
import { fontFamily } from '../../ui/theme';

const SCALE = [25, 50, 100, 150, 200, 300];
export const pctOf = (m: number) => Math.min(100, m <= 100 ? m / 2 : 50 + (Math.min(m, 300) - 100) / 4);
const angle = (pct: number) => -135 + pct * 2.7;
const xy = (r: number, a: number): [number, number] => {
  const t = ((a - 90) * Math.PI) / 180;
  return [150 + r * Math.cos(t), 150 + r * Math.sin(t)];
};
const arc = (r: number) => {
  const [x0, y0] = xy(r, angle(0));
  const [x1, y1] = xy(r, angle(100));
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 1 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
};
const ARC_LENGTH = (270 / 360) * 2 * Math.PI * 128;

/** Moves smoothly to each new reading. */
function useEased(target: number) {
  const calm = useReducedMotion();
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (calm) return;
    const start = Date.now();
    const begin = from.current;
    let frame = 0;
    const step = () => {
      const k = Math.min(1, (Date.now() - start) / 700);
      from.current = begin + (target - begin) * (1 - Math.pow(1 - k, 3));
      setValue(from.current);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, calm]);
  return calm ? target : value;
}

export function Gauge({ value }: { value: number }) {
  const { t } = useLanguage();
  const shown = useEased(value);
  const pct = pctOf(shown);
  return (
    <View accessible accessibilityLabel={`${Math.round(value)} ${t('Mbps')}`} style={{ width: '100%', aspectRatio: 300 / 262 }}>
      <Svg viewBox="0 0 300 262" width="100%" height="100%">
        <Defs>
          <LinearGradient id="spArc" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor="#1D6BFF" />
            <Stop offset="0.55" stopColor="#22B8FF" />
            <Stop offset="1" stopColor="#2EF0C2" />
          </LinearGradient>
        </Defs>
        <Path d={arc(128)} fill="none" stroke="#7FA2FF" strokeOpacity={0.16} strokeWidth={15} strokeLinecap="round" />
        {pct > 0.05 ? <Path d={arc(128)} fill="none" stroke="url(#spArc)" strokeWidth={15} strokeLinecap="round" strokeDasharray={[(pct / 100) * ARC_LENGTH, ARC_LENGTH]} /> : null}
        {Array.from({ length: 41 }, (_, i) => {
          const major = i % 5 === 0;
          const a = angle(i * 2.5);
          const [x0, y0] = xy(major ? 98 : 103, a);
          const [x1, y1] = xy(112, a);
          return <Line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#9FB8F2" strokeOpacity={major ? 0.85 : 0.4} strokeWidth={major ? 2.2 : 1.2} strokeLinecap="round" />;
        })}
        {SCALE.map((v) => {
          const [x, y] = xy(82, angle(pctOf(v)));
          return (
            <SvgText key={v} x={x} y={y + 4.5} textAnchor="middle" fontSize="13" fontFamily={fontFamily('body', 700)} fill="#DCE7FF">
              {String(v)}
            </SvgText>
          );
        })}
        <G transform={`rotate(${angle(pct).toFixed(1)} 150 150)`}>
          <Path d="M150 150 L150 56" stroke="#fff" strokeWidth={3.6} strokeLinecap="round" />
        </G>
        <Circle cx={150} cy={150} r={14} fill="#22D3EE" fillOpacity={0.25} />
        <Circle cx={150} cy={150} r={9} fill="#22D3EE" />
        <Circle cx={150} cy={150} r={3.6} fill="#06142F" />
      </Svg>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: '60%', alignItems: 'center' }}>
        <T f="display" s={46} w={800} lh={50} c="#fff" raw>{Math.round(shown)}</T>
        <T f="display" s={17} w={700} lh={20} c="#4FA8FF" raw>Mbps</T>
      </View>
    </View>
  );
}
