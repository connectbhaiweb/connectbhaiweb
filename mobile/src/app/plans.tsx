import { router, useLocalSearchParams } from 'expo-router';
import { ChevronDown, ChevronLeft, ChevronUp, MapPin, SlidersHorizontal } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { PlanCard } from '@/components/PlanCard';
import { Button, Card, Pill, Segmented, T } from '@/components/ui';
import { CATEGORIES, areaNames, lookupPin, searchPlans, type Category, type PinInfo, type Plan } from '@/lib/catalog';
import { compare, useCompare } from '@/lib/plan-state';
import { colors, font, shadow } from '@/lib/theme';

type Sort = 'price' | 'speed' | 'value';
const SPEEDS = [0, 50, 100, 200, 300];

export default function PlansScreen() {
  const params = useLocalSearchParams<{ pin?: string; type?: string }>();
  const pin = String(params.pin ?? '');
  const [type, setType] = useState<Category>(CATEGORIES.some((c) => c.key === params.type) ? (params.type as Category) : 'fiber');
  const [info, setInfo] = useState<PinInfo | null>(null);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<Sort>('price');
  const [minSpeed, setMinSpeed] = useState(0);
  const [providers, setProviders] = useState<string[]>([]);
  const [needOtt, setNeedOtt] = useState(false);
  const [needTv, setNeedTv] = useState(false);
  const [showF, setShowF] = useState(false);
  const picked = useCompare();

  useEffect(() => {
    let live = true;
    compare.clear(); compare.setPin(pin);
    Promise.all([lookupPin(pin), searchPlans(pin, type)])
      .then(([i, list]) => {
        if (!live) return;
        setError(''); setInfo(i); setPlans(list); setMinSpeed(0); setProviders([]); setNeedOtt(false); setNeedTv(false); setBusy(false);
      })
      .catch((e) => {
        if (!live) return;
        setError(e instanceof Error ? e.message : 'Something went wrong.'); setPlans(null); setInfo(null); setBusy(false);
      });
    return () => { live = false; };
  }, [pin, type]);

  const ask = (plan?: Plan) =>
    router.push({ pathname: '/request', params: { pincode: pin, area: info ? areaNames(info) : '', plan_id: plan ? String(plan.id) : '', plan_name: plan ? `${plan.provider} ${plan.name}` : '' } });

  const speedy = type === 'fiber' || type === 'air_fiber';
  const providerNames = useMemo(() => [...new Set((plans ?? []).map((p) => p.provider))], [plans]);
  const shown = useMemo(() => {
    const l = (plans ?? []).filter((p) => (!minSpeed || (p.speed ?? 0) >= minSpeed) && (!providers.length || providers.includes(p.provider)) && (!needOtt || p.ott.length) && (!needTv || p.tv));
    const by: Record<Sort, (a: Plan, b: Plan) => number> = {
      price: (a, b) => a.price - b.price, speed: (a, b) => (b.speed ?? 0) - (a.speed ?? 0),
      value: (a, b) => (a.speed ? a.price / a.speed : 1e9) - (b.speed ? b.price / b.speed : 1e9),
    };
    return [...l].sort(by[sort]);
  }, [plans, minSpeed, providers, needOtt, needTv, sort]);

  const head = (
    <View>
      <View style={s.top}>
        <Pressable onPress={() => router.back()} style={s.back} hitSlop={8}><ChevronLeft size={20} color={colors.blue} strokeWidth={2.6} /><Text style={s.backText}>Change PIN</Text></Pressable>
        <Text style={s.eyebrow}>PIN {pin}{info && areaNames(info) ? ` · ${areaNames(info)}` : ''}</Text>
        <Segmented items={CATEGORIES.map((c) => ({ key: c.key, label: c.label }))} value={type} onChange={(t) => { setBusy(true); setType(t); }} />
      </View>
      {busy && <ActivityIndicator style={{ marginTop: 28 }} size="large" color={colors.blue} />}
      {!!error && <Text style={s.error}>{error}</Text>}
      {info && !busy && (
        <View style={s.results}>
          {info.serviceable ? (
            <>
              <Text style={s.count}>{shown.length} of {plans?.length ?? 0} plans match</Text>
              <Segmented<Sort> items={[{ key: 'price', label: 'Price' }, ...(speedy ? [{ key: 'speed' as Sort, label: 'Speed' }, { key: 'value' as Sort, label: 'Best value' }] : [])]} value={sort} onChange={setSort} />
              {(plans?.length ?? 0) > 1 && (
                <Card style={{ gap: 12 }}>
                  <Pressable style={s.fHead} onPress={() => setShowF(!showF)}>
                    <SlidersHorizontal size={17} color={colors.ink} /><Text style={s.fTitle}>Filters{minSpeed || providers.length || needOtt || needTv ? ' (on)' : ''}</Text>
                    {showF ? <ChevronUp size={18} color={colors.ink} /> : <ChevronDown size={18} color={colors.ink} />}
                  </Pressable>
                  {showF && <>
                  {speedy && (
                    <>
                      <T v="label">Minimum speed</T>
                      <View style={s.chips}>{SPEEDS.map((v) => <Pill key={v} label={v ? `${v}+ Mbps` : 'Any'} on={minSpeed === v} onPress={() => setMinSpeed(v)} />)}</View>
                    </>
                  )}
                  <T v="label">Benefits</T>
                  <View style={s.chips}><Pill label="Includes OTT apps" on={needOtt} onPress={() => setNeedOtt(!needOtt)} /><Pill label="Includes TV channels" on={needTv} onPress={() => setNeedTv(!needTv)} /></View>
                  {providerNames.length > 1 && (
                    <>
                      <T v="label">Provider</T>
                      <View style={s.chips}>{providerNames.map((n) => <Pill key={n} label={n} on={providers.includes(n)} onPress={() => setProviders((c) => (c.includes(n) ? c.filter((x) => x !== n) : [...c, n]))} />)}</View>
                    </>
                  )}
                  </>}
                </Card>
              )}
              {shown.length === 0 && <T v="small" style={{ fontSize: 15 }}>No plans match these filters. Loosen a filter, or request a callback.</T>}
            </>
          ) : (
            <Card style={{ gap: 8 }}>
              <View style={s.fHead}><MapPin size={18} color={colors.warn} /><Text style={s.fTitle}>We do not serve {pin} yet</Text></View>
              <T v="small" style={{ fontSize: 14.5 }}>Request a callback and we will tell you when we reach your area.</T>
            </Card>
          )}
          <Button kind="soft" label="Request a callback instead" onPress={() => ask()} />
        </View>
      )}
    </View>
  );

  return (
    <View style={s.screen}>
      <AppHeader />
      <FlatList
        data={info?.serviceable && !busy ? shown : []}
        keyExtractor={(p) => String(p.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: picked.length ? 96 : 24 }}
        ListHeaderComponent={head}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <PlanCard plan={item} picked={picked.some((p) => p.id === item.id)} onCompare={() => compare.toggle(item)} onRequest={() => ask(item)} />
          </View>
        )}
      />
      {picked.length > 0 && (
        <View style={s.bar}>
          <Text style={s.barText}>{picked.length} selected</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button small kind="outline" label="Clear" onPress={() => compare.clear()} />
            <Button small label="Compare" disabled={picked.length < 2} onPress={() => router.push('/compare')} />
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: { padding: 16, gap: 12 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 2 },
  backText: { fontFamily: font.bodyBold, fontSize: 15, color: colors.blue },
  results: { paddingHorizontal: 16, paddingBottom: 16, gap: 14 },
  eyebrow: { fontFamily: font.bodyXBold, fontSize: 12, lineHeight: 20, letterSpacing: 1.4, color: colors.blue, textTransform: 'uppercase' },
  count: { fontFamily: font.displayXBold, fontSize: 24, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fTitle: { fontFamily: font.display, fontSize: 17, color: colors.ink, flex: 1 },
  error: { color: colors.bad, fontFamily: font.bodyMd, padding: 16 },
  bar: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: colors.ink, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...shadow.card },
  barText: { color: '#fff', fontFamily: font.bodyBold, fontSize: 15, marginLeft: 6 },
});
