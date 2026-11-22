import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Hero } from '@/components/Hero';
import { Button, Field, Pill, Segmented, T } from '@/components/ui';
import { CATEGORIES, popularPins, type Category } from '@/lib/catalog';
import { compare } from '@/lib/plan-state';
import { colors, font, shadow } from '@/lib/theme';

export default function Home() {
  const [pin, setPin] = useState('');
  const [type, setType] = useState<Category>('fiber');
  const [pins, setPins] = useState<{ pin: string; area: string }[]>([]);

  useEffect(() => { popularPins().then(setPins); }, []);

  const go = (p: string, t: Category = type) => {
    if (p.length !== 6) return;
    compare.clear();
    router.push({ pathname: '/plans', params: { pin: p, type: t } });
  };

  return (
    <View style={s.screen}>
      <AppHeader />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
        <Hero>
          <Text style={s.h1}>Compare. Choose.{'\n'}Connect. <Text style={{ color: colors.sky }}>Care.</Text></Text>
        </Hero>
        <View style={s.searchWrap}>
          <View style={s.search}>
            <View style={s.cityRow}><T v="label">Your city</T><View style={s.city}><Text style={s.cityText}>Indore</Text></View></View>
            <Segmented items={CATEGORIES.map((c) => ({ key: c.key, label: c.label }))} value={type} onChange={setType} />
            <Text style={s.cardTitle}>Check {CATEGORIES.find((c) => c.key === type)?.label} Plans{'\n'}At Your Pincode</Text>
            <T v="small" style={{ fontSize: 15 }}>Enter your 6-digit PIN code</T>
            <View style={s.pinRow}>
              <Field mono placeholder="Enter PIN code" keyboardType="number-pad" maxLength={6} value={pin} containerStyle={{ flex: 1 }}
                onChangeText={(t) => setPin(t.replace(/\D/g, ''))} returnKeyType="search"
                onSubmitEditing={(e) => go(e.nativeEvent.text)} />
              <Button label="Search" disabled={pin.length !== 6} onPress={() => go(pin)} style={{ height: 58 }} />
            </View>
            <View style={s.chips}>{pins.map((p) => <Pill key={p.pin} label={`${p.pin} · ${p.area}`} onPress={() => go(p.pin)} />)}</View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  h1: { fontFamily: font.displayXBold, fontSize: 31.5, lineHeight: 36, color: '#fff', letterSpacing: -0.4 },
  searchWrap: { paddingHorizontal: 16, marginTop: -4 },
  search: { backgroundColor: '#fff', borderRadius: 22, padding: 16, gap: 14, marginTop: -2, ...shadow.card },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  city: { flex: 1, borderWidth: 1.5, borderColor: colors.lineStrong, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  cityText: { fontFamily: font.bodyMd, fontSize: 17, color: colors.ink },
  cardTitle: { fontFamily: font.display, fontSize: 21, lineHeight: 27, color: colors.ink },
  pinRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  resetRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  reset: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.blueSoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  resetText: { fontFamily: font.bodyBold, fontSize: 14, color: colors.blue },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  results: { padding: 16, gap: 14 },
  eyebrow: { fontFamily: font.bodyXBold, fontSize: 12, lineHeight: 20, letterSpacing: 1.4, color: colors.blue, textTransform: 'uppercase' },
  count: { fontFamily: font.displayXBold, fontSize: 24, color: colors.ink, marginTop: -6 },
  fHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fTitle: { fontFamily: font.display, fontSize: 17, color: colors.ink, flex: 1 },
  error: { color: colors.bad, fontFamily: font.bodyMd, padding: 16 },
  bar: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: colors.ink, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...shadow.card },
  barText: { color: '#fff', fontFamily: font.bodyBold, fontSize: 15, marginLeft: 6 },
});
