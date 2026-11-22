import { router } from 'expo-router';
import { MapPin, RotateCcw, SlidersHorizontal } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Hero } from '@/components/Hero';
import { PlanCard } from '@/components/PlanCard';
import { Button, Card, Field, Pill, Segmented, T } from '@/components/ui';
import { CATEGORIES, areaNames, lookupPin, popularPins, searchPlans, type Category, type PinInfo, type Plan } from '@/lib/catalog';
import { compare, useCompare } from '@/lib/plan-state';
import { colors, font, shadow } from '@/lib/theme';

type Sort = 'price' | 'speed' | 'value';
const SPEEDS = [0, 50, 100, 200, 300];

export default function Plans() {
  const [pin, setPin] = useState('');
  const [type, setType] = useState<Category>('fiber');
  const [info, setInfo] = useState<PinInfo | null>(null);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [pins, setPins] = useState<{ pin: string; area: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<Sort>('price');
  const [minSpeed, setMinSpeed] = useState(0);
  const [providers, setProviders] = useState<string[]>([]);
  const [needOtt, setNeedOtt] = useState(false);
  const [needTv, setNeedTv] = useState(false);
  const picked = useCompare();

  useEffect(() => { popularPins().then(setPins); }, []);

  const load = useCallback(async (p: string, t: Category) => {
    setBusy(true); setError(''); compare.clear(); compare.setPin(p);
    try {
      const [i, list] = await Promise.all([lookupPin(p), searchPlans(p, t)]);
      setInfo(i); setPlans(list); setMinSpeed(0); setProviders([]); setNeedOtt(false); setNeedTv(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); setPlans(null); setInfo(null); }
    setBusy(false);
  }, []);
  const reset = () => { setPin(''); setInfo(null); setPlans(null); setError(''); compare.clear(); };
  const pick = (t: Category) => { setType(t); if (info) load(pin, t); };
  const ask = (plan?: Plan) =>
    router.push({ pathname: '/request', params: { pincode: pin, plan_id: plan ? String(plan.id) : '', plan_name: plan ? `${plan.provider} ${plan.name}` : '' } });

  const speedy = type === 'fiber' || type === 'air_fiber';
  const providerNames = useMemo(() => [...new Set((plans ?? []).map((p) => p.provider))], [plans]);
  const shown = useMemo(() => {
    let l = (plans ?? []).filter((p) => (!minSpeed || (p.speed ?? 0) >= minSpeed) && (!providers.length || providers.includes(p.provider)) && (!needOtt || p.ott.length) && (!needTv || p.tv));
    const by: Record<Sort, (a: Plan, b: Plan) => number> = {
      price: (a, b) => a.price - b.price, speed: (a, b) => (b.speed ?? 0) - (a.speed ?? 0),
      value: (a, b) => (a.speed ? a.price / a.speed : 1e9) - (b.speed ? b.price / b.speed : 1e9),
    };
    l = [...l].sort(by[sort]); return l;
  }, [plans, minSpeed, providers, needOtt, needTv, sort]);

  const searchCard = (
    <View style={s.search}>
      <View style={s.cityRow}><T v="label">Your city</T><View style={s.city}><Text style={s.cityText}>Indore</Text></View></View>
      <Segmented items={CATEGORIES.map((c) => ({ key: c.key, label: c.label }))} value={type} onChange={pick} />
      <Text style={s.cardTitle}>Check {CATEGORIES.find((c) => c.key === type)?.label} Plans{'\n'}At Your Pincode</Text>
      <T v="small" style={{ fontSize: 15 }}>Enter your 6-digit PIN code</T>
      <View style={s.pinRow}>
        <Field mono placeholder="Enter PIN code" keyboardType="number-pad" maxLength={6} value={pin} containerStyle={{ flex: 1 }}
          onChangeText={(t) => setPin(t.replace(/\D/g, ''))} returnKeyType="search"
          onSubmitEditing={(e) => { const p = e.nativeEvent.text; if (p.length === 6) load(p, type); }} />
        <Button label="Search" disabled={pin.length !== 6 || busy} onPress={() => load(pin, type)} style={{ height: 58 }} />
      </View>
      <View style={s.resetRow}>
        <Pressable onPress={reset} style={s.reset}><RotateCcw size={15} color={colors.blue} strokeWidth={2.4} /><Text style={s.resetText}>Reset</Text></Pressable>
      </View>
      {!info && (
        <View style={s.chips}>{pins.map((p) => <Pill key={p.pin} label={`${p.pin} · ${p.area}`} onPress={() => { setPin(p.pin); load(p.pin, type); }} />)}</View>
      )}
    </View>
  );

  const results = info && !busy && (
    <View style={s.results}>
      <Text style={s.eyebrow}>PIN {info.pincode}{areaNames(info) ? ` · ${areaNames(info)}` : ''} · {CATEGORIES.find((c) => c.key === type)?.long}</Text>
      {info.serviceable ? (
        <>
          <Text style={s.count}>{shown.length} of {plans?.length ?? 0} plans match</Text>
          <Segmented<Sort> items={[{ key: 'price', label: 'Price' }, ...(speedy ? [{ key: 'speed' as Sort, label: 'Speed' }, { key: 'value' as Sort, label: 'Best value' }] : [])]} value={sort} onChange={setSort} />
          {(plans?.length ?? 0) > 1 && (
            <Card style={{ gap: 12 }}>
              <View style={s.fHead}><SlidersHorizontal size={17} color={colors.ink} /><Text style={s.fTitle}>Filters</Text></View>
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
            </Card>
          )}
          {shown.length === 0 && <T v="small" style={{ fontSize: 15 }}>No plans match these filters. Loosen a filter, or request a callback.</T>}
        </>
      ) : (
        <Card style={{ gap: 8 }}>
          <View style={s.fHead}><MapPin size={18} color={colors.warn} /><Text style={s.fTitle}>We do not serve {info.pincode} yet</Text></View>
          <T v="small" style={{ fontSize: 14.5 }}>Request a callback and we will tell you when we reach your area.</T>
        </Card>
      )}
      <Button kind="soft" label="Request a callback instead" onPress={() => ask()} />
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
        ListHeaderComponent={
          <View>
            <Hero>
              <Text style={s.h1}>Compare. Choose.{'\n'}Connect. <Text style={{ color: colors.sky }}>Care.</Text></Text>
            </Hero>
            <View style={s.searchWrap}>{searchCard}</View>
            {busy && <ActivityIndicator style={{ marginTop: 28 }} size="large" color={colors.blue} />}
            {!!error && <Text style={s.error}>{error}</Text>}
            {results}
          </View>
        }
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
