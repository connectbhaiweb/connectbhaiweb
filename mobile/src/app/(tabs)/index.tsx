import { router } from 'expo-router';
import { RotateCcw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Hero } from '@/components/Hero';
import { Faq } from '@/components/Faq';
import { Footer } from '@/components/Footer';
import { Button, Card, Field, Pill, Segmented, T } from '@/components/ui';
import { joinWaitlist, loadCities, type City } from '@/lib/site';
import { CATEGORIES, popularPins, type Category } from '@/lib/catalog';
import { tr, useLang } from '@/lib/i18n';
import { compare } from '@/lib/plan-state';
import { colors, font, shadow } from '@/lib/theme';

export default function Home() {
  const [pin, setPin] = useState('');
  const [type, setType] = useState<Category>('fiber');
  const [pins, setPins] = useState<{ pin: string; area: string }[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [city, setCity] = useState<City | null>(null);
  const [allCities, setAllCities] = useState(false);
  const { lang } = useLang();
  const [wl, setWl] = useState({ name: '', phone: '', done: false, busy: false, error: '' });

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
    if (p.length !== 6) return;
    compare.clear();
    router.push({ pathname: '/plans', params: { pin: p, type: t } });
  };

  const TITLE: Record<Category, [string, string]> = {
    fiber: ['Check Fiber Plans At Your Pincode', 'Enter your 6-digit PIN code'],
    air_fiber: ['Book Air Fiber', 'Wireless home internet, no fiber cable needed. Check availability at your PIN code.'],
    tv: ['TV channel packs', "IPTV over your fiber line. Check what's available at your PIN code."],
    ott: ['OTT packs', "Streaming app bundles you can add to any connection. Check what's available at your PIN code."],
  };
  const live = cities.filter((c) => c.status === 'live');
  const shownCities = allCities ? cities : cities.filter((c) => c.status === 'live' || c.status === 'soon').slice(0, 8);

  return (
    <View style={s.screen}>
      <AppHeader />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 0 }}>
        <Hero>
          <T v="eyebrow" style={{ color: colors.sky }}>{`Broadband marketplace · ${city?.name ?? 'Madhya Pradesh'}`}</T>
          <Text style={s.h1}>Compare. Choose.{'\n'}Connect. <Text style={{ color: colors.sky }}>Care.</Text></Text>
          <T style={{ color: '#C9D8FF' }}>Fiber, Air Fiber, TV and OTT in one place. Compare what&apos;s available at your address side by side, and book in under a minute.</T>
        </Hero>
        <View style={s.searchWrap}>
          <View style={s.search}>
            <View style={s.cityRow}><T v="label">Your city</T><View style={s.city}><Text style={s.cityText}>{city?.name ?? 'Indore'}</Text></View></View>
            <Segmented items={CATEGORIES.map((c) => ({ key: c.key, label: c.label }))} value={type} onChange={setType} />
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
            ) : (
              <>
                <Text style={s.cardTitle}>{tr(TITLE[type][0], lang)}</Text>
                <T v="small" style={{ fontSize: 15 }}>{TITLE[type][1]}</T>
                <View style={s.pinRow}>
                  <Field mono placeholder="Enter your PIN code" keyboardType="number-pad" maxLength={6} value={pin} containerStyle={{ flex: 1 }}
                    onChangeText={(t) => setPin(t.replace(/\D/g, ''))} returnKeyType="search"
                    onSubmitEditing={(e) => go(e.nativeEvent.text)} />
                  <Button label="Search" disabled={pin.length !== 6} onPress={() => go(pin)} style={{ height: 58 }} />
                </View>
                {!!pin && <Pressable onPress={() => setPin('')} style={s.reset}><RotateCcw size={14} color={colors.blue} strokeWidth={2.4} /><Text style={s.resetText}>{tr('Reset', lang)}</Text></Pressable>}
                <View style={s.chips}>{pins.map((p) => <Pill key={p.pin} label={`${p.pin} · ${p.area}`} on={pin === p.pin} onPress={() => go(p.pin)} />)}</View>
              </>
            )}
          </View>
        </View>
        <View style={s.links}>
          <T v="small" style={{ fontSize: 14 }}>Free for customers · BSNL TIPs, DSAs & local ISPs · Installation tracked end to end</T>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button small kind="outline" label="Test your Wi-Fi speed →" onPress={() => router.navigate('/speed')} />
            <Button small kind="soft" label="♥ Care plan →" onPress={() => router.navigate('/care')} />
          </View>
        </View>

        <View style={s.sec}>
          <T v="eyebrow">How it works</T>
          <T v="h1">From search to a working connection</T>
          {HOW.map(([n, h, p]) => (
            <Card key={n} style={{ gap: 6 }}><T v="eyebrow">{n}</T><T v="h2">{h}</T><T v="small" style={{ fontSize: 14.5, lineHeight: 21 }}>{p}</T></Card>
          ))}
        </View>

        <View style={s.sec}>
          <T v="eyebrow">Madhya Pradesh</T>
          <T v="h1">{`Live in ${live.map((c) => c.name).join(', ') || 'Indore'}. Coming to every district of MP.`}</T>
          <T v="small" style={{ fontSize: 14.5, lineHeight: 21 }}>Pick your city. Where we are live you can compare and book right away. Everywhere else, join the waiting list and we will WhatsApp you the day we launch there.</T>
          <View style={s.chips}>{shownCities.map((c) => <Pill key={c.id} label={`${c.name} · ${c.status === 'live' ? tr('Live', lang) : tr('Soon', lang)}`} on={city?.id === c.id} onPress={() => { setCity(c); setWl({ name: '', phone: '', done: false, busy: false, error: '' }); }} />)}</View>
          {!allCities && cities.length > shownCities.length && <Button small kind="outline" label={`Show all ${cities.length} districts`} onPress={() => setAllCities(true)} />}
        </View>

        <View style={s.sec}>
          <Card style={{ gap: 10 }}>
            <T v="eyebrow">Care plan · Genie, your personal assistant</T>
            <T v="h2">Connect Bhai Care plan: looking after your internet</T>
            <T v="small" style={{ fontSize: 14.5, lineHeight: 21 }}>Your modem is watched 24x7. See the Online/Offline status and fiber signal, change your Wi-Fi name or password, restart the modem and test the line speed, all from the app.</T>
            <Button label="Explore Care plan →" onPress={() => router.navigate('/care')} />
          </Card>
          <Card style={{ gap: 10 }}>
            <T v="eyebrow">For DSAs & TIPs</T>
            <T v="h2">Grow with Connect Bhai</T>
            <T v="small" style={{ fontSize: 14.5, lineHeight: 21 }}>Join as a Direct Selling Agent (DSA) or a Telecom Infrastructure Partner (TIP). Admin verifies every DSA and TIP before leads are assigned.</T>
            <Button kind="soft" label="Become a DSA or TIP" onPress={() => router.push('/apply')} />
          </Card>
        </View>
        <Faq />
        <Footer />
      </ScrollView>
    </View>
  );
}

const HOW: [string, string, string][] = [
  ['01 / Compare', 'Search your PIN code', 'See only the plans that are actually offered in your area, with speed, price, data and OTT/TV benefits.'],
  ['02 / Choose', 'Request a connection', 'Pick a plan and share your details. You get a request number immediately.'],
  ['03 / Connect', 'Track installation', 'An assigned TIP calls you, books the installation and updates every step in your dashboard.'],
  ['04 / Care', 'Stay looked after', 'Check your modem status, restart it and change your Wi-Fi from your dashboard, and raise a ticket whenever you need help.'],
];

const s = StyleSheet.create({
  links: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },
  sec: { paddingHorizontal: 16, gap: 12, marginTop: 28 },
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
