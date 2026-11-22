import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { PlanCard } from '@/components/PlanCard';
import { Button, Card, Check, Pill, T } from '@/components/ui';
import { areaNames, inr, lookupPin, searchPlans, type Category, type PinInfo, type Plan } from '@/lib/catalog';
import { compare, useCompare } from '@/lib/plan-state';
import { colors, font } from '@/lib/theme';

/* Plan results shown under the search card on Home, with the website's sort and filters. */
type Sort = 'price' | 'speed' | 'value';
const SPEEDS = [0, 50, 100, 200, 300];
const WHAT: Record<Category, string> = { fiber: 'Fiber broadband', air_fiber: 'Air Fiber', tv: 'TV', ott: 'OTT', sim: 'SIM' };
const exGst = (p: Plan) => p.priceExGst ?? p.price;

export function Results({ pin, type }: { pin: string; type: Category }) {
  const [info, setInfo] = useState<PinInfo | null>(null);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<Sort>('price');
  const [minSpeed, setMinSpeed] = useState(0);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [providers, setProviders] = useState<string[]>([]);
  const [needOtt, setNeedOtt] = useState(false);
  const [needTv, setNeedTv] = useState(false);
  const picked = useCompare();

  useEffect(() => {
    let live = true;
    compare.clear(); compare.setPin(pin);
    Promise.all([type === 'sim' ? Promise.resolve(null) : lookupPin(pin), searchPlans(pin, type)])
      .then(([i, list]) => {
        if (!live) return;
        setError(''); setInfo(i); setPlans(list); setMinSpeed(0); setMaxPrice(null); setProviders([]); setNeedOtt(false); setNeedTv(false); setBusy(false);
      })
      .catch((e) => { if (!live) return; setError(e instanceof Error ? e.message : 'Something went wrong.'); setPlans(null); setInfo(null); setBusy(false); });
    return () => { live = false; };
  }, [pin, type]);

  const ask = (plan?: Plan) => router.push({ pathname: '/request', params: { pincode: pin, area: info ? areaNames(info) : '', plan_id: plan ? String(plan.id) : '', plan_name: plan ? `${plan.provider} ${plan.name}` : '' } });
  const speedy = type === 'fiber' || type === 'air_fiber';
  const ceil = Math.max(100, Math.ceil(Math.max(0, ...(plans ?? []).map(exGst)) / 100) * 100);
  const limit = maxPrice ?? ceil;
  const names = useMemo(() => [...new Set((plans ?? []).map((p) => p.provider))], [plans]);
  const shown = useMemo(() => {
    const l = (plans ?? []).filter((p) => (!minSpeed || (p.speed ?? 0) >= minSpeed) && exGst(p) <= limit && (!providers.length || providers.includes(p.provider)) && (!needOtt || p.ott.length) && (!needTv || p.tv));
    const by: Record<Sort, (a: Plan, b: Plan) => number> = { price: (a, b) => a.price - b.price, speed: (a, b) => (b.speed ?? 0) - (a.speed ?? 0), value: (a, b) => (a.speed ? a.price / a.speed : 1e9) - (b.speed ? b.price / b.speed : 1e9) };
    return [...l].sort(by[sort]);
  }, [plans, minSpeed, limit, providers, needOtt, needTv, sort]);
  const reset = () => { setMinSpeed(0); setMaxPrice(null); setProviders([]); setNeedOtt(false); setNeedTv(false); };
  const where = type === 'sim' ? WHAT[type] : `PIN ${pin}${info && areaNames(info) ? ` · ${areaNames(info)}` : ''} · ${WHAT[type]}`;

  if (busy) return <ActivityIndicator style={{ marginTop: 28 }} size="large" color={colors.blue} />;
  if (error) return <Text style={s.error}>{error}</Text>;
  if ((type !== 'sim' && !info?.serviceable) || !plans?.length) {
    return (
      <View style={s.wrap}>
        <Card style={{ gap: 10, alignItems: 'center' }}>
          <T v="eyebrow">{where}</T>
          <T v="h2" style={{ textAlign: 'center' }}>{type === 'sim' ? 'No SIM plans listed yet' : `No ${WHAT[type]} plans at this PIN code yet`}</T>
          <T v="small" style={{ textAlign: 'center' }}>Leave your details and we will call you as soon as it is available at your address.</T>
          <Button label="Request a callback" onPress={() => ask()} />
        </Card>
      </View>
    );
  }
  return (
    <View style={s.wrap}>
      <T v="eyebrow">{where}</T>
      <Text style={s.count}>{shown.length} of {plans.length} {type === 'ott' ? 'OTT packs' : 'plans'} match</Text>
      <T v="label">Sort by</T>
      <View style={s.chips}>
        <Pill label="Price: low to high" on={sort === 'price'} onPress={() => setSort('price')} />
        {speedy && <Pill label="Speed: high to low" on={sort === 'speed'} onPress={() => setSort('speed')} />}
        {speedy && <Pill label="Best value (₹ per Mbps)" on={sort === 'value'} onPress={() => setSort('value')} />}
      </View>
      <Card style={{ gap: 10 }}>
        <View style={s.fHead}><Text style={s.fTitle}>Filters</Text><Pressable onPress={reset} hitSlop={8}><Text style={s.reset}>Reset</Text></Pressable></View>
        {speedy && (
          <>
            <T v="label">Minimum speed</T>
            <View style={s.chips}>{SPEEDS.map((v) => <Pill key={v} label={v ? `${v}+ Mbps` : 'Any'} on={minSpeed === v} onPress={() => setMinSpeed(v)} />)}</View>
          </>
        )}
        <T v="label">{`Max price (before GST): ${inr(limit)}`}</T>
        <View style={s.chips}>
          {[...new Set([...Array.from({ length: Math.floor(ceil / 500) }, (_, i) => (i + 1) * 500), ceil])].map((v) => <Pill key={v} label={inr(v)} on={limit === v} onPress={() => setMaxPrice(v >= ceil ? null : v)} />)}
        </View>
        {type !== 'ott' && (
          <>
            <T v="label">Benefits</T>
            <Check label="Includes OTT apps" on={needOtt} onPress={() => setNeedOtt(!needOtt)} />
            {speedy && <Check label="Includes TV channels" on={needTv} onPress={() => setNeedTv(!needTv)} />}
          </>
        )}
        <T v="label">Provider</T>
        {names.map((n) => <Check key={n} label={n} on={providers.includes(n)} onPress={() => setProviders((c) => (c.includes(n) ? c.filter((x) => x !== n) : [...c, n]))} />)}
      </Card>
      {shown.length === 0 ? (
        <Card style={{ gap: 10, alignItems: 'center' }}><T v="h3">No plans match these filters.</T><Button small kind="outline" label="Reset filters" onPress={reset} /></Card>
      ) : shown.map((p) => <PlanCard key={p.id} plan={p} picked={picked.some((x) => x.id === p.id)} onCompare={() => compare.toggle(p)} onRequest={() => ask(p)} />)}
      <T v="small" style={{ fontSize: 14 }}>Can&apos;t decide? Request a callback and a TIP will help you choose.</T>
      <Button kind="soft" label="Request a callback" onPress={() => ask()} />
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 24, gap: 12 },
  count: { fontFamily: font.displayXBold, fontSize: 24, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fTitle: { fontFamily: font.display, fontSize: 18, color: colors.ink },
  reset: { fontFamily: font.bodyBold, fontSize: 15, color: colors.blue },
  error: { color: colors.bad, fontFamily: font.bodyMd, padding: 16 },
});
