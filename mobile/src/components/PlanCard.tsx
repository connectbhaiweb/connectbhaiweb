import { Check } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, T } from '@/components/ui';
import { CATEGORIES, inr, type Plan } from '@/lib/catalog';
import { colors, font } from '@/lib/theme';

const CTA = { fiber: 'Request connection', air_fiber: 'Book Air Fiber', tv: 'Request connection', ott: 'Get this pack' } as const;
const Row = ({ k, v }: { k: string; v: string }) => (
  <View style={s.row}><Text style={s.rowK}>{k}</Text><Text style={s.rowV}>{v}</Text></View>
);

/* One plan, laid out like the website's plan card. */
export function PlanCard({ plan, picked, onCompare, onRequest }: { plan: Plan; picked: boolean; onCompare: () => void; onRequest: () => void }) {
  const speedy = plan.type === 'fiber' || plan.type === 'air_fiber';
  return (
    <Card style={[s.card, picked && { borderColor: colors.blue, borderWidth: 2 }]}>
      <View style={s.prov}>
        <View style={s.logoBox}>{plan.logo ? <Image source={plan.logo} style={s.logo} resizeMode="contain" /> : <Text style={s.logoFallback}>{plan.provider.slice(0, 1)}</Text>}</View>
        <View style={{ flex: 1 }}>
          <Text style={s.provName}>{plan.provider}</Text>
          <Text style={s.provKind}>{CATEGORIES.find((c) => c.key === plan.type)?.long}</Text>
        </View>
      </View>
      <Text style={s.name}>{plan.name}</Text>
      <View style={s.big}>
        {speedy ? (
          <Text style={s.speed}>{plan.speed ?? '—'}<Text style={s.mbps}> Mbps</Text></Text>
        ) : plan.type === 'tv' && plan.tv ? (
          <Text style={s.speed}>{plan.tv}<Text style={s.mbps}> channels</Text></Text>
        ) : <View />}
        <Text style={s.price}>{inr(plan.price)}<Text style={s.per}>/{plan.type === 'ott' || plan.type === 'tv' ? 'month' : 'month'}</Text></Text>
      </View>
      <View style={s.facts}>
        {speedy && <Row k="Data" v="Unlimited" />}
        {(speedy || plan.type === 'tv') && <Row k="Installation" v={plan.install ? inr(plan.install) : 'Free'} />}
        {speedy && <Row k="TV channels" v={plan.tv ? `${plan.tv}+` : '—'} />}
        {!speedy && <Row k="Validity" v={`${plan.validity ?? 30} days`} />}
      </View>
      <View style={s.ott}>
        {plan.ott.length ? plan.ott.map((o) => <View key={o} style={s.ottTag}><Text style={s.ottText}>{o}</Text></View>) : <T v="small">No OTT apps included</T>}
      </View>
      <View style={s.acts}>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: picked }} onPress={onCompare} style={s.check}>
          <View style={[s.box, picked && { backgroundColor: colors.blue, borderColor: colors.blue }]}>{picked && <Check size={15} color="#fff" strokeWidth={3.2} />}</View>
          <Text style={s.checkText}>Compare</Text>
        </Pressable>
        <Button small label={CTA[plan.type]} onPress={onRequest} style={{ flex: 1, maxWidth: 190 }} />
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  card: { padding: 16, gap: 12, borderRadius: 18 },
  prov: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoBox: { width: 46, height: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 34, height: 34 },
  logoFallback: { fontFamily: font.display, fontSize: 18, color: colors.blue },
  provName: { fontFamily: font.bodyXBold, fontSize: 16, color: colors.ink },
  provKind: { fontFamily: font.bodyMd, fontSize: 13.5, color: colors.muted },
  name: { fontFamily: font.display, fontSize: 21, lineHeight: 26, color: colors.ink, letterSpacing: -0.2 },
  big: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  speed: { fontFamily: font.displayXBold, fontSize: 40, lineHeight: 44, color: colors.blue, letterSpacing: -0.8 },
  mbps: { fontFamily: font.bodyBold, fontSize: 16, color: colors.muted, letterSpacing: 0 },
  price: { fontFamily: font.displayXBold, fontSize: 26, color: colors.ink, paddingBottom: 4 },
  per: { fontFamily: font.bodyMd, fontSize: 13.5, color: colors.muted },
  facts: { borderTopWidth: 1, borderColor: colors.line, borderStyle: 'dashed' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderColor: colors.line, borderStyle: 'dashed' },
  rowK: { fontFamily: font.body, fontSize: 14.5, color: colors.muted },
  rowV: { fontFamily: font.bodyXBold, fontSize: 14.5, color: colors.ink },
  ott: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ottTag: { backgroundColor: colors.blueSoft, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  ottText: { fontFamily: font.bodyBold, fontSize: 12.5, color: colors.blue },
  acts: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  checkText: { fontFamily: font.bodyMd, fontSize: 15, color: colors.ink },
});
