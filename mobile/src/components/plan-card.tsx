import { Pressable, View } from 'react-native';
import { Text } from '@/components/text';

import { ProviderLogo } from '@/components/brand';
import type { Plan } from '@/lib/api';
import { inr } from '@/lib/format';
import { useTheme } from '@/lib/theme';

export const CAT_LABEL: Record<string, string> = { fiber: 'Fiber', airfiber: 'Air Fiber', tv: 'TV', ott: 'OTT' };
export const otts = (p: Plan) => (p.ott_apps || []).map(o => (typeof o === 'string' ? o : o.name));
const cta = (type?: string) => (type === 'ott' ? 'Get this pack' : type === 'airfiber' ? 'Book Air Fiber' : 'Request connection');

/* The website's plan card (globals.css .plan): provider, plan name, big speed, price, facts, OTT apps, Compare + Request */
export function PlanCard({ plan: p, selected, onCompare, onRequest }: { plan: Plan; selected: boolean; onCompare: () => void; onRequest: () => void }) {
  const t = useTheme();
  const type = p.category?.type || 'fiber';
  const speedy = type === 'fiber' || type === 'airfiber';
  const big = speedy ? [p.speed_mbps ?? '—', 'Mbps'] : type === 'tv' ? [p.tv_channels ?? '—', 'channels'] : [otts(p).length, 'apps'];
  const apps = otts(p);
  const facts: [string, string][] = speedy
    ? [['Data', p.data_limit || 'Unlimited'], ['Installation', Number(p.install_charge) ? inr(p.install_charge) : 'Free'], ['TV channels', p.tv_channels ? p.tv_channels + '+' : '—']]
    : [['Validity', (p.validity_days || 30) + ' days'], ...(type === 'tv' ? ([['Installation', Number(p.install_charge) ? inr(p.install_charge) : 'Free']] as [string, string][]) : [])];
  return (
    <View style={{ backgroundColor: t.surface, borderColor: selected ? t.blue : t.line, borderWidth: 1.5, borderRadius: 14, padding: 18, gap: 12,
      ...(selected ? { shadowColor: t.blue, shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 0 }, elevation: 2 } : {}) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <ProviderLogo name={p.category?.name || ''} url={p.category?.logo_url} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.ink, fontWeight: '800', fontSize: 14 }}>{p.category?.name}</Text>
          <Text style={{ color: t.muted, fontWeight: '600', fontSize: 12.5 }}>{CAT_LABEL[type] || ''}</Text>
        </View>
      </View>
      <Text style={{ color: t.ink, fontFamily: 'display', fontWeight: '700', fontSize: 18 }}>{p.name}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text style={{ color: t.blue, fontFamily: 'display', fontWeight: '800', fontSize: 38, lineHeight: 42 }}>{big[0]}</Text>
          <Text style={{ color: t.muted, fontWeight: '700' }}>{big[1]}</Text>
        </View>
        <Text style={{ color: t.ink, fontFamily: 'display', fontWeight: '800', fontSize: 22 }}>{inr(p.price)}<Text style={{ color: t.muted, fontSize: 13, fontWeight: '600' }}>/month</Text></Text>
      </View>
      <View style={{ gap: 6 }}>
        {facts.map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, borderTopWidth: 1, borderTopColor: t.line, borderStyle: 'dashed', paddingTop: 6 }}>
            <Text style={{ color: t.muted, fontSize: 14 }}>{k}</Text>
            <Text style={{ color: t.ink, fontSize: 14, fontWeight: '700' }}>{v}</Text>
          </View>
        ))}
      </View>
      {apps.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {apps.map(a => <View key={a} style={{ backgroundColor: t.blueSoft, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ color: t.blue, fontSize: 12, fontWeight: '700' }}>{a}</Text></View>)}
        </View>
      ) : <Text style={{ color: t.muted, fontSize: 13 }}>No OTT apps included</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
        <Pressable onPress={onCompare} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 }}>
          <View style={{ width: 17, height: 17, borderRadius: 4, borderWidth: 1.5, borderColor: selected ? t.blue : t.lineStrong, backgroundColor: selected ? t.blue : t.surface, alignItems: 'center', justifyContent: 'center' }}>
            {selected ? <Text style={{ color: t.blueInk, fontSize: 11, fontWeight: '800', lineHeight: 13 }}>✓</Text> : null}
          </View>
          <Text style={{ color: t.ink, fontSize: 13.5, fontWeight: '600' }}>Compare</Text>
        </Pressable>
        <Pressable onPress={onRequest} accessibilityRole="button" accessibilityLabel={cta(type)} style={{ backgroundColor: t.blue, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text style={{ color: t.blueInk, fontWeight: '700', fontSize: 13.5 }}>{cta(type)}</Text>
        </Pressable>
      </View>
    </View>
  );
}
