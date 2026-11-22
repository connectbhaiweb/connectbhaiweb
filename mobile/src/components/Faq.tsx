import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Pill, T } from '@/components/ui';
import faq from '@/lib/faq.json';
import { tr, useLang } from '@/lib/i18n';
import { PHONE_E164, WA_URL } from '@/lib/site';
import { colors, font } from '@/lib/theme';

/** FAQ from the website (same questions and answers), with the "Still need help?" call/WhatsApp card. */
export function Faq() {
  const { lang } = useLang();
  const [cat, setCat] = useState('All');
  const [open, setOpen] = useState(0);
  const items = (faq.items as string[][]).filter(([c]) => cat === 'All' || c === cat);
  return (
    <View style={{ paddingHorizontal: 16, gap: 12, marginTop: 28 }}>
      <T v="eyebrow">FAQ</T>
      <T v="h1">Got questions? We have answers, Bhai.</T>
      <View style={s.chips}>{(faq.cats as string[]).map((c) => <Pill key={c} label={c} on={cat === c} onPress={() => { setCat(c); setOpen(0); }} />)}</View>
      {items.map(([, q, a], i) => (
        <Card key={q} style={{ padding: 14, gap: 8 }}>
          <Pressable onPress={() => setOpen(open === i ? -1 : i)} style={s.q}>
            <Text style={s.qText}>{tr(q, lang)}</Text>{open === i ? <ChevronUp size={18} color={colors.ink} /> : <ChevronDown size={18} color={colors.ink} />}
          </Pressable>
          {open === i && <Text style={s.a}>{tr(a, lang)}</Text>}
        </Card>
      ))}
      <Card style={{ gap: 10 }}>
        <T v="h3">Still need help?</T>
        <T v="small">Our experts reply in minutes, in Hindi and English.</T>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Call us" onPress={() => Linking.openURL(`tel:${PHONE_E164}`)} style={{ flex: 1 }} />
          <Button kind="outline" label="WhatsApp" onPress={() => Linking.openURL(WA_URL)} style={{ flex: 1 }} />
        </View>
      </Card>
    </View>
  );
}
const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  q: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  qText: { flex: 1, fontFamily: font.bodyBold, fontSize: 15.5, color: colors.ink },
  a: { fontFamily: font.body, fontSize: 14.5, lineHeight: 21, color: colors.muted ?? '#52607F' },
});
