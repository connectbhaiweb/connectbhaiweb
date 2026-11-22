import { Check, Pause, Play, RotateCcw, Wifi } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tr, useLang } from '@/lib/i18n';
import { colors, font } from '@/lib/theme';

/* The website's hero story: Compare, Choose, Connect, Care (auto-plays, with pause and replay). */
const STEPS = ['Compare', 'Choose', 'Connect', 'Care'] as const;

function Slide({ i }: { i: number }) {
  const { lang } = useLang();
  if (i === 0) return (
    <View style={s.body}>
      <Text style={s.mini}>452010 · Vijay Nagar · <Text style={{ color: colors.blue }}>9 {tr('plans', lang)}</Text></Text>
      {[['₹399', '50 Mbps'], ['₹599', '100 Mbps', 'Best'], ['₹799', '200 Mbps']].map(([p, sp, tag]) => (
        <View key={p} style={s.plan}><Text style={s.price}>{p}<Text style={s.sub}> /month</Text></Text><Text style={s.sub}>{sp}</Text>{!!tag && <Text style={s.tag}>{tr(tag, lang)}</Text>}</View>
      ))}
    </View>
  );
  if (i === 1) return (
    <View style={s.body}>
      <Text style={s.price}>₹599<Text style={s.sub}> /month + GST</Text></Text>
      <Text style={s.sub}>100 Mbps · Unlimited</Text>
      <View style={s.cta}><Text style={s.ctaText}>{tr('Book Now', lang)}</Text></View>
      <Text style={s.mini}>{tr('Request received', lang)} · CB-104B2</Text>
    </View>
  );
  if (i === 2) return (
    <View style={s.body}>
      {[['Lead received', 'Today, 10:12 am'], ['TIP assigned', 'Sharma Networks'], ['Installation done', 'Router is live']].map(([a, b]) => (
        <View key={a} style={s.row}><View style={s.tick}><Check size={12} color="#fff" strokeWidth={3} /></View><View><Text style={s.rowA}>{tr(a, lang)}</Text><Text style={s.sub}>{b}</Text></View></View>
      ))}
    </View>
  );
  return (
    <View style={s.body}>
      <View style={s.row}><Wifi size={22} color={colors.blue} /><View><Text style={s.rowA}>{tr('Modem online', lang)}</Text><Text style={s.sub}>{tr('Signal: Strong', lang)} · 98 Mbps</Text></View></View>
      <Text style={s.mini}>{tr('Restart · Wi-Fi · Password', lang)}</Text>
    </View>
  );
}

export function Story() {
  const { lang } = useLang();
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setI((x) => (x + 1) % STEPS.length), 3200);
    return () => clearInterval(t);
  }, [playing]);
  return (
    <View style={s.card}>
      <Text style={s.title}><Text style={{ color: colors.blue }}>{tr(STEPS[i], lang)}</Text> · {tr(['with plans at your PIN code', 'the plan that fits you', 'with installation tracked live', 'and stay online'][i], lang)}</Text>
      <Slide i={i} />
      <View style={s.foot}>
        <View style={{ flexDirection: 'row', gap: 6 }}>{STEPS.map((x, k) => <View key={x} style={[s.dot, k === i && s.dotOn]} />)}</View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable accessibilityLabel={playing ? 'Pause' : 'Play'} onPress={() => setPlaying(!playing)} style={s.ctl}>{playing ? <Pause size={16} color="#fff" /> : <Play size={16} color="#fff" />}</Pressable>
          <Pressable accessibilityLabel="Replay" onPress={() => { setI(0); setPlaying(true); }} style={s.ctl}><RotateCcw size={16} color="#fff" /></Pressable>
        </View>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  card: { backgroundColor: '#E9F0FF', borderRadius: 20, padding: 16, gap: 12 },
  title: { fontFamily: font.display, fontSize: 17, color: colors.ink },
  body: { backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 8, minHeight: 150, justifyContent: 'center' },
  mini: { fontFamily: font.bodyMd, fontSize: 13, color: colors.muted },
  plan: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  price: { fontFamily: font.displayXBold, fontSize: 20, color: colors.ink },
  sub: { fontFamily: font.bodyMd, fontSize: 13, color: colors.muted },
  tag: { fontFamily: font.bodyXBold, fontSize: 11, color: '#fff', backgroundColor: colors.green, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  cta: { alignSelf: 'flex-start', backgroundColor: colors.blue, borderRadius: 9, paddingHorizontal: 16, paddingVertical: 8 },
  ctaText: { color: '#fff', fontFamily: font.bodyBold, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowA: { fontFamily: font.bodyBold, fontSize: 14.5, color: colors.ink },
  tick: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#B7C6EA' },
  dotOn: { width: 22, backgroundColor: colors.blue },
  ctl: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2B3B63', alignItems: 'center', justifyContent: 'center' },
});
