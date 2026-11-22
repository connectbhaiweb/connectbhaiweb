import { router } from 'expo-router';
import { ChevronDown, ListChecks, RotateCcw, Search, ShieldCheck, Wrench } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { CareCard } from '@/components/CareCard';
import { Faq } from '@/components/Faq';
import { Footer } from '@/components/Footer';
import { Hero } from '@/components/Hero';
import { Results } from '@/components/Results';
import { Story } from '@/components/Story';
import { Button, Card, Field, Pill, Segmented, T } from '@/components/ui';
import { CATEGORIES, popularPins, type Category } from '@/lib/catalog';
import { tr, useLang } from '@/lib/i18n';
import { compare, useCompare } from '@/lib/plan-state';
import { joinWaitlist, loadCities, type City } from '@/lib/site';
import { colors, font, shadow } from '@/lib/theme';

const TITLE: Record<Category, [string, string]> = {
  fiber: ['Check Fiber Plans At Your Pincode', 'Enter your 6-digit PIN code'],
  air_fiber: ['Book Air Fiber', 'Wireless home internet, no fiber cable needed. Check availability at your PIN code.'],
  tv: ['TV channel packs', "IPTV over your fiber line. Check what's available at your PIN code."],
  ott: ['OTT packs', "Streaming app bundles you can add to any connection. Check what's available at your PIN code."],
  sim: ['Book a SIM online', 'Get a new number or keep your number and switch (port). Delivered to your door in Indore with e-KYC.'],
};
const HOW: [string, string, string, typeof Search][] = [
  ['01 / Compare', 'Search your PIN code', 'See only the plans that are actually offered in your area, with speed, price, data and OTT/TV benefits.', Search],
  ['02 / Choose', 'Request a connection', 'Pick a plan and share your details. You get a request number immediately.', ListChecks],
  ['03 / Connect', 'Track installation', 'An assigned TIP calls you, books the installation and updates every step in your dashboard.', Wrench],
  ['04 / Care', 'Stay looked after', 'Check your modem status, restart it and change your Wi-Fi from your dashboard, and raise a ticket whenever you need help.', ShieldCheck],
];

export default function Home() {
  const { lang } = useLang();
  const [pin, setPin] = useState('');
  const [type, setType] = useState<Category>('fiber');
  const [searched, setSearched] = useState<{ pin: string; type: Category } | null>(null);
  const [simType, setSimType] = useState<'prepaid' | 'postpaid'>('prepaid');
  const [pins, setPins] = useState<{ pin: string; area: string }[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [city, setCity] = useState<City | null>(null);
  const [allCities, setAllCities] = useState(false);
  const [picker, setPicker] = useState(false);
  const [wl, setWl] = useState({ name: '', phone: '', done: false, busy: false, error: '' });
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const resultsY = useRef(0);
  const picked = useCompare();

  useEffect(() => {
    popularPins().then(setPins);
    loadCities().then((c) => { setCities(c); setCity((cur) => cur ?? c.find((x) => x.status === 'live') ?? null); }).catch(() => {});
  }, []);
  const soon = !!city && city.status !== 'live';
  const join = async () => {
    if (!city) return;
    setWl((w) => ({ ...w, busy: true, error: '' }));
    try { await joinWaitlist({ city_id: city.id, phone: wl.phone, name: wl.name.trim() }); setWl((w) => ({ ...w, done: true, busy: false })); }
    catch (e) { setWl((w) => ({ ...w, busy: false, error: e instanceof Error ? e.message : 'Something went wrong.' })); }
  };
  const go = (p: string, t: Category = type) => {
    if (t !== 'sim' && p.length !== 6) return;
    compare.clear();
    setPin(p); setSearched({ pin: t === 'sim' ? '' : p, type: t });
    setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, resultsY.current - 80), animated: true }), 350);
  };
  const pickType = (t: Category) => { setType(t); if (searched && (t === 'sim' || pin.length === 6)) go(pin, t); else setSearched(null); };
  const reset = () => { setPin(''); setSearched(null); compare.clear(); };
  const choose = (c: City) => { setCity(c); setPicker(false); setWl({ name: '', phone: '', done: false, busy: false, error: '' }); setSearched(null); };
  const live = cities.filter((c) => c.status === 'live');
  const shownCities = allCities ? cities : cities.filter((c) => c.status === 'live' || c.status === 'soon').slice(0, 8);

  return (
    <View style={s.screen}>
      <AppHeader />
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: picked.length ? 96 : 0 }}>
        <Hero>
          <Text style={s.h1}>Compare. Choose.{'\n'}Connect. <Text style={{ color: colors.sky }}>Care.</Text></Text>
        </Hero>
        <View style={s.searchWrap}>
          <View style={s.search}>
            <View style={s.cityRow}>
              <T v="label">Your city</T>
              <Pressable style={s.city} onPress={() => setPicker(true)}><Text style={s.cityText}>{city?.name ?? 'Indore'}</Text><ChevronDown size={18} color={colors.ink} /></Pressable>
            </View>
            <Segmented items={CATEGORIES.map((c) => ({ key: c.key, label: c.label }))} value={type} onChange={pickType} />
            {soon ? (
              wl.done ? (
                <View style={{ gap: 8 }}>
                  <Text style={s.cardTitle}>{tr("You're on the list for", lang)} {city?.name}</Text>
                  <T v="small" style={{ fontSize: 14.5 }}>We will WhatsApp you the day Connect Bhai starts in your city. More people from one city means we launch there sooner.</T>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  <Text style={s.cardTitle}>{tr('Coming soon to', lang)} {city?.name}</Text>
                  <T v="small" style={{ fontSize: 14.5 }}>Join the waiting list and we will WhatsApp you the day we launch there.</T>
                  <Field label="Your name" value={wl.name} onChangeText={(t) => setWl({ ...wl, name: t })} autoComplete="name" />
                  <Field label="Mobile number" mono keyboardType="number-pad" maxLength={10} value={wl.phone} onChangeText={(t) => setWl({ ...wl, phone: t.replace(/\D/g, '') })} />
                  {!!wl.error && <T v="small" style={{ color: colors.bad }}>{wl.error}</T>}
                  <Button label="Join the waiting list" loading={wl.busy} disabled={wl.name.trim().length < 2 || wl.phone.length !== 10} onPress={join} />
                </View>
              )
            ) : type === 'sim' ? (
              <>
                <Text style={s.cardTitle}>{tr(TITLE.sim[0], lang)}</Text>
                <T v="small" style={{ fontSize: 15 }}>{TITLE.sim[1]}</T>
                <View style={s.chips}><Pill label="Prepaid" on={simType === 'prepaid'} onPress={() => setSimType('prepaid')} /><Pill label="Postpaid" on={simType === 'postpaid'} onPress={() => setSimType('postpaid')} /></View>
                <Button block label="Show SIM plans" onPress={() => go('', 'sim')} />
              </>
            ) : (
              <>
                <Text style={s.cardTitle}>{tr(TITLE[type][0], lang)}</Text>
                <T v="small" style={{ fontSize: 15 }}>{TITLE[type][1]}</T>
                <View style={s.pinRow}>
                  <Field mono placeholder="Enter your PIN code" keyboardType="number-pad" maxLength={6} value={pin} containerStyle={{ flex: 1 }}
                    onChangeText={(t) => setPin(t.replace(/\D/g, ''))} returnKeyType="search" onSubmitEditing={(e) => go(e.nativeEvent.text)} />
                  <Button label="Search" disabled={pin.length !== 6} onPress={() => go(pin)} style={{ height: 58 }} />
                </View>
                <View style={s.resetRow}>
                  <Pressable onPress={reset} style={s.reset}><RotateCcw size={14} color={colors.blue} strokeWidth={2.4} /><Text style={s.resetText}>{tr('Reset', lang)}</Text></Pressable>
                </View>
                <View style={s.chips}>{pins.map((p) => <Pill key={p.pin} label={`${p.pin} · ${p.area}`} on={pin === p.pin} onPress={() => go(p.pin)} />)}</View>
              </>
            )}
          </View>
        </View>

        {searched && !soon && (
          <View onLayout={(e) => { resultsY.current = e.nativeEvent.layout.y; }}>
            <Results key={`${searched.pin}-${searched.type}`} pin={searched.pin} type={searched.type} />
          </View>
        )}

        <View style={s.sec}>
          <Story />
          <CareCard />
          <T style={{ fontSize: 14.5, lineHeight: 21 }}>Free for customers · BSNL TIPs, DSAs & local ISPs · Installation tracked end to end</T>
        </View>

        <View style={s.sec}>
          <T v="eyebrow">How it works</T>
          <T v="h1">From search to a working connection</T>
          {HOW.map(([n, h, p, Icon]) => (
            <Card key={n} style={{ gap: 6, padding: 0, overflow: 'hidden' }}>
              <View style={s.art}><Icon size={40} color={colors.blue} strokeWidth={1.8} /></View>
              <View style={{ padding: 16, gap: 6 }}><T v="eyebrow">{n}</T><T v="h2">{h}</T><T v="small" style={{ fontSize: 14.5, lineHeight: 21 }}>{p}</T></View>
            </Card>
          ))}
        </View>

        <View style={s.sec}>
          <T v="eyebrow">Madhya Pradesh</T>
          <T v="h1">{`Live in ${live.map((c) => c.name).join(', ') || 'Indore'}. Coming to every district of MP.`}</T>
          <T v="small" style={{ fontSize: 14.5, lineHeight: 21 }}>Pick your city. Where we are live you can compare and book right away. Everywhere else, join the waiting list and we will WhatsApp you the day we launch there.</T>
          <View style={s.chips}>{shownCities.map((c) => <Pill key={c.id} label={`${c.name} · ${c.status === 'live' ? tr('Live', lang) : tr('Soon', lang)}`} on={city?.id === c.id} onPress={() => { choose(c); scroll.current?.scrollTo({ y: 0, animated: true }); }} />)}</View>
          {!allCities && cities.length > shownCities.length && <Button small kind="outline" label={`Show all ${cities.length} districts`} onPress={() => setAllCities(true)} />}
        </View>

        <View style={s.sec}>
          <Card style={{ gap: 10 }}>
            <T v="eyebrow">For DSAs & TIPs</T>
            <T v="h2">Grow with Connect Bhai</T>
            <T v="small" style={{ fontSize: 14.5, lineHeight: 21 }}>Join as a Direct Selling Agent (DSA) or a Telecom Infrastructure Partner (TIP). Admin verifies every DSA and TIP before leads are assigned.</T>
            {['Verified leads from your service PIN codes', 'Follow-ups, installation status and commissions in one portal', 'Transparent commission approval and payment records'].map((x) => <T key={x} style={{ fontSize: 14.5 }}>{`✓  ${x}`}</T>)}
            <Button kind="soft" label="Become a DSA or TIP" onPress={() => router.push('/apply')} />
          </Card>
        </View>
        <Faq />
        <Footer />
      </ScrollView>

      {picked.length > 0 && (
        <View style={s.bar}>
          <Text style={s.barText}>{picked.length} {tr('selected', lang)}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button small kind="outline" label="Clear" onPress={() => compare.clear()} />
            <Button small label="Compare" disabled={picked.length < 2} onPress={() => router.push('/compare')} />
          </View>
        </View>
      )}

      <Modal visible={picker} transparent animationType="fade" onRequestClose={() => setPicker(false)}>
        <Pressable style={s.backdrop} onPress={() => setPicker(false)}>
          <View style={s.sheet}>
            <T v="h3">Your city</T>
            <ScrollView style={{ maxHeight: 420 }}>
              {cities.map((c) => (
                <Pressable key={c.id} onPress={() => choose(c)} style={s.opt}>
                  <Text style={[s.optText, city?.id === c.id && { color: colors.blue }]}>{c.name}</Text>
                  <Text style={s.optSub}>{c.status === 'live' ? tr('Live', lang) : tr('Soon', lang)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  h1: { fontFamily: font.displayXBold, fontSize: 31.5, lineHeight: 36, color: '#fff', letterSpacing: -0.4 },
  searchWrap: { paddingHorizontal: 16, marginTop: -4 },
  search: { backgroundColor: '#fff', borderRadius: 22, padding: 16, gap: 14, marginTop: -2, ...shadow.card },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  city: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: colors.lineStrong, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  cityText: { fontFamily: font.bodyMd, fontSize: 17, color: colors.ink },
  cardTitle: { fontFamily: font.display, fontSize: 21, lineHeight: 27, color: colors.ink },
  pinRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  resetRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  reset: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.blueSoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  resetText: { fontFamily: font.bodyBold, fontSize: 14, color: colors.blue },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sec: { paddingHorizontal: 16, gap: 12, marginTop: 28 },
  art: { height: 110, backgroundColor: '#EAF1FF', alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: colors.ink, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...shadow.card },
  barText: { color: '#fff', fontFamily: font.bodyBold, fontSize: 15, marginLeft: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(8,16,40,0.5)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: '#fff', borderRadius: 18, padding: 18, gap: 8 },
  opt: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.line },
  optText: { fontFamily: font.bodyBold, fontSize: 16.5, color: colors.ink },
  optSub: { fontFamily: font.body, fontSize: 13.5, color: colors.muted },
});
