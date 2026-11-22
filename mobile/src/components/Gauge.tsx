import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { font } from '@/lib/theme';

/* Speed dial 0-300 Mbps, like the website's gauge. The scale is not linear: 25, 50, 100, 150, 200, 300 sit where the website puts them. */
const MARKS: [number, number][] = [[0, 0], [25, 0.1], [50, 0.22], [100, 0.5], [150, 0.66], [200, 0.82], [300, 1]];
const frac = (v: number) => {
  const x = Math.max(0, Math.min(300, v));
  for (let i = 1; i < MARKS.length; i++) if (x <= MARKS[i][0]) { const [a, fa] = MARKS[i - 1], [b, fb] = MARKS[i]; return fa + ((x - a) / (b - a)) * (fb - fa); }
  return 1;
};
const A0 = 135, SWEEP = 270, R = 118, C = 150;
const pt = (deg: number, r: number) => { const a = (deg * Math.PI) / 180; return [C + r * Math.cos(a), C + r * Math.sin(a)] as const; };
const arc = (f: number) => { const [x0, y0] = pt(A0, R), [x1, y1] = pt(A0 + SWEEP * f, R); return `M${x0} ${y0} A${R} ${R} 0 ${SWEEP * f > 180 ? 1 : 0} 1 ${x1} ${y1}`; };

export function Gauge({ value, unit = 'Mbps' }: { value: number; unit?: string }) {
  const f = frac(value);
  const [nx, ny] = pt(A0 + SWEEP * f, 84);
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={300} height={270} viewBox="0 0 300 270">
        <Path d={arc(1)} stroke="rgba(255,255,255,0.12)" strokeWidth={14} fill="none" strokeLinecap="round" />
        <Path d={arc(Math.max(f, 0.001))} stroke="#4C7DFF" strokeWidth={14} fill="none" strokeLinecap="round" />
        {MARKS.map(([v, fr]) => {
          const [x1, y1] = pt(A0 + SWEEP * fr, 96), [x2, y2] = pt(A0 + SWEEP * fr, 104), [tx, ty] = pt(A0 + SWEEP * fr, 82);
          return (
            <View key={v}>
              <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.55)" strokeWidth={2} />
              {v > 0 && <SvgText x={tx} y={ty + 4} fill="rgba(255,255,255,0.85)" fontSize={12} textAnchor="middle">{v}</SvgText>}
            </View>
          );
        })}
        <Line x1={C} y1={C} x2={nx} y2={ny} stroke="#fff" strokeWidth={4} strokeLinecap="round" />
        <Circle cx={C} cy={C} r={9} fill="#4C7DFF" stroke="#fff" strokeWidth={3} />
      </Svg>
      <View style={{ position: 'absolute', top: 168, alignItems: 'center' }}>
        <Text style={{ fontFamily: font.displayXBold, fontSize: 48, color: '#fff' }}>{Math.round(value)}</Text>
        <Text style={{ fontFamily: font.bodyBold, fontSize: 18, color: '#7FA2FF' }}>{unit}</Text>
      </View>
    </View>
  );
}
