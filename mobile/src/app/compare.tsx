import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, T } from '@/components/ui';
import { inr, type Plan } from '@/lib/catalog';
import { compare, useCompare } from '@/lib/plan-state';
import { colors, font } from '@/lib/theme';

export default function Compare() {
  const list = useCompare();
  const speedy = list.some((p) => p.type === 'fiber' || p.type === 'air_fiber');
  const rows: [string, (p: Plan) => string][] = [
    ['Provider', (p) => p.provider],
    ...(speedy ? ([['Speed', (p) => (p.speed ? `${p.speed} Mbps` : '—')]] as [string, (p: Plan) => string][]) : []),
    ['Price', (p) => `${inr(p.price)}/month`],
    ...(speedy ? ([['₹ per Mbps', (p) => (p.speed ? '₹' + (p.price / p.speed).toFixed(1) : '—')]] as [string, (p: Plan) => string][]) : []),
    ['Data', () => 'Unlimited'], ['Installation', (p) => (p.install ? inr(p.install) : 'Free')],
    ['OTT apps', (p) => (p.ott.length ? p.ott.join(', ') : '—')], ['TV channels', (p) => (p.tv ? `${p.tv}+` : '—')],
  ];
  const choose = (p: Plan) => router.replace({ pathname: '/request', params: { pincode: compare.pin, plan_id: String(p.id), plan_name: `${p.provider} ${p.name}` } });
  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.wrap}>
        <T v="h1">Compare plans</T>
        <T v="small">{compare.pin ? `PIN ${compare.pin}` : ''}</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={s.line}><View style={s.k} />{list.map((p) => <Text key={p.id} style={[s.cell, s.head]}>{p.name}</Text>)}</View>
            {rows.map(([k, f]) => (
              <View key={k} style={s.line}><Text style={[s.k, s.kText]}>{k}</Text>{list.map((p) => <Text key={p.id} style={s.cell}>{f(p)}</Text>)}</View>
            ))}
            <View style={s.line}><View style={s.k} />{list.map((p) => <View key={p.id} style={s.cell}><Button small label="Choose" onPress={() => choose(p)} /></View>)}</View>
          </View>
        </ScrollView>
        <Button kind="outline" label="Close" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  wrap: { padding: 20, gap: 12 },
  line: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.line, alignItems: 'center' },
  k: { width: 96, paddingVertical: 12 },
  kText: { fontFamily: font.bodyBold, color: colors.muted, fontSize: 13.5 },
  cell: { width: 150, paddingVertical: 12, paddingHorizontal: 6, fontFamily: font.bodyBold, fontSize: 14, color: colors.ink },
  head: { fontFamily: font.display, fontSize: 15 },
});
