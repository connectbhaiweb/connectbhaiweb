import { router } from 'expo-router';
import { Gauge, Heart, KeyRound, Pencil, RotateCw, Wifi } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui';
import { tr, useLang } from '@/lib/i18n';
import { colors, font } from '@/lib/theme';

/* The website's "Featured" Care plan card on Home. */
export function CareCard() {
  const { lang } = useLang();
  const chip = (Icon: typeof Wifi, l: string) => <View key={l} style={s.chip}><Icon size={14} color={colors.blue} /><Text style={s.chipText}>{tr(l, lang)}</Text></View>;
  return (
    <View style={s.card}>
      <Text style={s.tag}>★ {tr('Featured', lang)}</Text>
      <View style={s.top}>
        <View style={s.ico}><Heart size={24} color="#fff" strokeWidth={2.4} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{tr('Connect Bhai Care plan', lang)}</Text>
          <Text style={s.sub}>{tr('Live modem status, restart and Wi-Fi control, right from your phone.', lang)}</Text>
        </View>
      </View>
      <View style={s.panel}>
        {[['Modem', 'Online'], ['Fiber signal', 'Strong'], ['Speed', '98 Mbps']].map(([k, v]) => (
          <View key={k} style={s.prow}><Text style={s.pk}>{tr(k, lang)}</Text><Text style={[s.pv, k === 'Modem' && { color: colors.green }]}>{tr(v, lang)}</Text></View>
        ))}
      </View>
      <View style={s.chips}>{chip(RotateCw, 'Restart')}{chip(Pencil, 'Wi-Fi name')}{chip(KeyRound, 'Password')}{chip(Gauge, 'Speed test')}</View>
      <Button label="Explore Care plan →" onPress={() => router.navigate('/care')} />
    </View>
  );
}
const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.line },
  tag: { alignSelf: 'flex-end', backgroundColor: '#FBBF24', color: '#3B2A00', fontFamily: font.bodyXBold, fontSize: 12, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  top: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  ico: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.displayXBold, fontSize: 19, color: colors.ink },
  sub: { fontFamily: font.body, fontSize: 13.5, lineHeight: 19, color: colors.muted },
  panel: { borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12, gap: 8 },
  prow: { flexDirection: 'row', justifyContent: 'space-between' },
  pk: { fontFamily: font.body, fontSize: 14.5, color: colors.muted },
  pv: { fontFamily: font.bodyXBold, fontSize: 14.5, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.blueSoft, borderRadius: 999, paddingHorizontal: 12, height: 32 },
  chipText: { fontFamily: font.bodyBold, fontSize: 13, color: colors.blue },
});
