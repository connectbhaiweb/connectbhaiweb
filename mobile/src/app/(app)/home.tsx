import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StatusBar, ScrollView, TextInput, View } from 'react-native';
import { Text, fontFor } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

import { Logo } from '@/components/brand';
import { Drawer } from '@/components/drawer';
import { PartnerForm } from '@/components/partner-form';
import { Story } from '@/components/story';
import { CAT_LABEL, PlanCard, otts } from '@/components/plan-card';
import { Button, Card, Field, Muted, Sheet, Strong, useBusy } from '@/components/ui';
import { api, ApiError, type City, type Plan } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { SUPPORT } from '@/lib/config';
import { inr, phoneDigits } from '@/lib/format';
import { useTheme } from '@/lib/theme';

/* The website's home page for phones (frontend globals.css + ui.js renderHome): header, hero + PIN search, results,
   how it works, Care plan, FAQ, footer. Colours, fonts and sizes are the website's own. */
const DEEP = '#0A2A78', SKY = '#8DB4FF', PALE = '#C9D8FF';
const TABS = [['fiber', 'Fiber'], ['airfiber', 'Air Fiber'], ['sim', 'SIM'], ['tv', 'TV'], ['ott', 'OTT']] as const;
type Tab = (typeof TABS)[number][0];
const BLURB: Record<Tab, [string, string]> = {
  fiber: ['Check fiber plans at your address', 'Enter your 6-digit PIN code'],
  airfiber: ['Book Air Fiber', 'Wireless home internet, no fiber cable needed. Check availability at your PIN code.'],
  sim: ['Book a SIM online', 'SIM booking is not available in the app yet.'],
  tv: ['TV channel packs', "IPTV over your fiber line. Check what's available at your PIN code."],
  ott: ['OTT packs', 'Streaming apps bundled for your connection. Check what is available at your PIN code.'],
};
const CATS = ['All', 'Plans', 'Booking & payment', 'Installation', 'Router & speed'];
const FAQ: [string, string, string][] = [
  ['Plans', 'How can I compare plans by pincode?', 'Enter your 6-digit pincode or area on the home page. We show only the plans and TIPs that serve your address, and you can compare up to 3 plans side by side.'],
  ['Plans', 'Are only verified providers shown?', 'Partners (DSAs and BSNL TIPs) are verified by our admin team before any lead is assigned to them, and plans are reviewed before they go live. Plans marked as sample data are placeholders until verified tariffs are added.'],
  ['Router & speed', 'Can I run a speed test before choosing?', 'Yes. The Wi-Fi speed test is free, takes about 30 seconds and works on your phone or laptop. Log in if you want to save the result or report slow speed to support.'],
  ['Booking & payment', 'How do I pay the booking amount?', 'Requesting a connection is free for customers. When a payment is due, you get a WhatsApp message with the amount and can pay online by UPI, card or net banking. Your payments are also listed under Payments in your dashboard.'],
  ['Installation', 'How long does installation take?', 'After you request a connection, an assigned TIP calls you and books a time. Every step (assigned, contacted, booked, installed) is updated in your dashboard, so you always see where it stands. Exact timing depends on your area and the TIP.'],
  ['Router & speed', 'Can I check my router status after installation?', 'Yes, with the Connect Bhai Care plan and Gene, your personal assistant, you can see if your router is online, check fiber signal, restart it, change your Wi-Fi name or password and run a line speed test from the app.'],
];

const Eyebrow = ({ children, color }: { children: string; color: string }) => <Text style={{ color, fontSize: 12, fontWeight: '800', letterSpacing: 1.7 }}>{children.toUpperCase()}</Text>;

export default function Home() {
  const t = useTheme();
  const { user, signOut } = useAuth();
  const scroller = useRef<any>(null);
  const resultsY = useRef(0);
  const [tab, setTab] = useState<Tab>('fiber');
  const [pin, setPin] = useState('');
  const [pins, setPins] = useState<{ pin: string; area: string }[]>([]);
  const [res, setRes] = useState<{ plans: Plan[]; areas: string[]; city?: string; serviceable: boolean; tab: Tab; pin: string } | null>(null);
  const [sort, setSort] = useState<'price' | 'speed' | 'value'>('price');
  const [minSpeed, setMinSpeed] = useState(0);
  const [cmp, setCmp] = useState<number[]>([]);
  const [showCmp, setShowCmp] = useState(false);
  const [req, setReq] = useState<Plan | 'callback' | null>(null);
  const [menu, setMenu] = useState(false);
  const [faq, setFaq] = useState(0);
  const [faqCat, setFaqCat] = useState('All');
  const search = useBusy();
  const [cities, setCities] = useState<City[]>([]);
  const [city, setCity] = useState<number | null>(null);
  const [cityMenu, setCityMenu] = useState(false);
  const [allCities, setAllCities] = useState(false);
  const [wl, setWl] = useState({ name: '', phone: '', done: '' });
  const waitlist = useBusy();

  useEffect(() => { api.popularPins().then(setPins).catch(() => {}); }, []);
  useEffect(() => { api.cities().then(c => { setCities(c); setCity(c.find(x => x.status === 'live')?.id ?? c[0]?.id ?? null); }).catch(() => {}); }, []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cityRef = useRef<any>(null);
  const [cityBox, setCityBox] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const openCity = () => {
    if (cityMenu) { setCityMenu(false); return; }
    cityRef.current?.measureInWindow((x: number, y: number, w: number, h: number) => { setCityBox({ x, y, w, h }); setCityMenu(true); });
  };
  const cityRow = cities.find(c => c.id === city);
  const soon = !!cityRow && cityRow.status !== 'live';
  const liveNames = cities.filter(c => c.status === 'live').map(c => c.name).join(', ') || 'Indore';
  const shownCities = allCities ? cities : cities.slice(0, 7);
  const joinWaitlist = () => waitlist.run(async () => {
    if (wl.name.trim().length < 2) throw new ApiError('Enter your name.');
    if (!/^[6-9]\d{9}$/.test(phoneDigits(wl.phone))) throw new ApiError('Enter a valid 10-digit mobile number.');
    const r = await api.joinWaitlist({ cityId: city!, phone: phoneDigits(wl.phone), name: wl.name.trim() });
    setWl(x => ({ ...x, done: r.city || cityRow?.name || '' }));
  });

  const find = (p = pin, tb = tab) => search.run(async () => {
    if (tb === 'sim') throw new ApiError('SIM booking is not available in the app yet.');
    if (!/^\d{6}$/.test(p)) throw new ApiError('Enter a valid 6-digit PIN code.');
    const info = await api.pincode(p);
    const plans = info.serviceable ? await api.plansForPin(p, tb) : [];
    setRes({ plans, areas: (info.areas || []).slice(0, 4).map(a => a.name.split(',')[0]), city: info.city?.name, serviceable: info.serviceable, tab: tb, pin: p });
    setCmp([]); setMinSpeed(0);
    setTimeout(() => scroller.current?.scrollTo({ y: Math.max(0, resultsY.current - 8), animated: true }), 250);
  });
  const locate = () => search.run(async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') throw new ApiError('Location permission was not given. Enter your PIN code instead.');
    const pos = await Location.getCurrentPositionAsync({});
    const g = await api.geoReverse(pos.coords.latitude, pos.coords.longitude);
    if (!g.pincode) throw new ApiError('Could not find a PIN code for your location.');
    setPin(g.pincode); await find(g.pincode);
  });

  const per = (p: Plan) => (p.speed_mbps ? Number(p.price) / p.speed_mbps : Infinity);
  const plans = (res?.plans || []).filter(p => !minSpeed || (p.speed_mbps || 0) >= minSpeed)
    .sort((a, b) => (sort === 'speed' ? (b.speed_mbps || 0) - (a.speed_mbps || 0) : sort === 'value' ? per(a) - per(b) : Number(a.price) - Number(b.price)));
  const speedy = !!res && (res.tab === 'fiber' || res.tab === 'airfiber');
  const toggle = (id: number) => setCmp(c => (c.includes(id) ? c.filter(x => x !== id) : c.length >= 3 ? c : [...c, id]));
  const chosen = (res?.plans || []).filter(p => cmp.includes(p.id));
  const goTop = () => scroller.current?.scrollTo({ y: 0, animated: true });
  const careRoute = () => router.push(user ? (user.role === 'customer' ? '/care' : '/dashboard') : '/login');

  const headBtn = { borderColor: 'rgba(141,180,255,.6)', borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 } as const;
  const faqList = FAQ.filter(([c]) => faqCat === 'All' || c === faqCat);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: DEEP }} edges={['top']}>
      {/* header (website .top) */}
      <View style={{ minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, backgroundColor: DEEP, borderBottomWidth: 1, borderBottomColor: 'rgba(141,180,255,.18)' }}>
        <Pressable onPress={goTop} accessibilityRole="button" accessibilityLabel="Connect Bhai home"><Logo height={36} /></Pressable>
        <View style={{ flex: 1 }} />
        {user ? (
          <Pressable onPress={() => router.push('/dashboard')} accessibilityRole="button" accessibilityLabel="My dashboard">
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: t.blue, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{(user.name || '?').split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')}</Text>
            </View>
          </Pressable>
        ) : (
          <Pressable onPress={() => router.push('/login')} accessibilityRole="button" style={headBtn}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 13.5 }}>Log in</Text></Pressable>
        )}
        <Pressable onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="Open menu" style={{ ...headBtn, paddingHorizontal: 10, paddingVertical: 10 }}>
          <Ionicons name="menu" size={26} color="#fff" />
        </Pressable>
      </View>

      <ScrollView ref={scroller} style={{ backgroundColor: t.bg }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        {/* hero (website .hero: deep blue + faint grid) */}
        <View style={{ backgroundColor: DEEP, paddingTop: 36, paddingBottom: 40, paddingHorizontal: 16, overflow: 'hidden' }}>
          <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 }} width="100%" height="100%">
            <Defs><Pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse"><Path d="M44 0H0V44" stroke="rgba(141,180,255,0.22)" strokeWidth="1" fill="none" /></Pattern></Defs>
            <Rect width="100%" height="100%" fill="url(#grid)" />
          </Svg>

          <Text style={{ color: '#fff', fontFamily: 'display', fontWeight: '800', fontSize: 31.5, lineHeight: 34, letterSpacing: -0.3 }}>Compare.{'\n'}Choose. <Text style={{ color: SKY, fontFamily: 'display', fontWeight: '800' }}>Connect.</Text></Text>

          <View style={{ zIndex: 20, backgroundColor: t.surface, borderRadius: 18, padding: 14, marginTop: 22, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, zIndex: 50 }}>
              <Text style={{ color: t.muted, fontSize: 13, fontWeight: '800', letterSpacing: 0.8 }}>YOUR CITY</Text>
              <View style={{ flex: 1 }}>
              <Pressable ref={cityRef} onPress={openCity} accessibilityRole="button" accessibilityLabel="Choose your city" accessibilityState={{ expanded: cityMenu }} style={{ minHeight: 43, borderRadius: 9, borderWidth: 1.5, borderColor: cityMenu ? t.blue : t.lineStrong, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, backgroundColor: t.surface }}>
                <Text style={{ color: t.ink, fontSize: 16, fontWeight: '700' }}>{cityRow?.name || 'Indore'}</Text>
                <Ionicons name={cityMenu ? 'chevron-up' : 'chevron-down'} size={16} color={t.muted} />
              </Pressable>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 4, backgroundColor: t.blueSoft, borderRadius: 14, padding: 4, marginBottom: 14 }}>
              {TABS.map(([k, l]) => (
                <Pressable key={k} onPress={() => { setTab(k); setRes(null); search.setError(''); }} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}
                  style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: tab === k ? t.surface : 'transparent',
                    ...(tab === k ? { shadowColor: '#0A2864', shadowOpacity: 0.14, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 } : {}) }}>
                  <Text numberOfLines={1} style={{ color: tab === k ? t.blue : t.muted, fontSize: 13, fontWeight: '700' }}>{l}</Text>
                </Pressable>
              ))}
            </View>
            {soon ? (
              <View>
                <Text style={{ color: t.ink, fontFamily: 'display', fontWeight: '700', fontSize: 19, lineHeight: 22 }}>{wl.done ? `You're on the list for ${wl.done}` : `Coming soon to ${cityRow?.name}`}</Text>
                <Text style={{ color: t.muted, fontSize: 14, marginTop: 2, marginBottom: 12 }}>{wl.done ? "We'll WhatsApp you the day we launch." : "Join the waiting list and we'll WhatsApp you the day we launch here."}</Text>
                {wl.done ? null : (
                  <>
                    <Field label="Your name" value={wl.name} onChangeText={v => setWl(x => ({ ...x, name: v }))} autoComplete="name" />
                    <Field label="WhatsApp number" value={wl.phone} onChangeText={v => setWl(x => ({ ...x, phone: v }))} keyboardType="phone-pad" maxLength={16} />
                    {waitlist.error ? <Text style={{ color: t.bad, marginBottom: 8 }} accessibilityRole="alert">{waitlist.error}</Text> : null}
                    <Button label="Join the waiting list" onPress={joinWaitlist} loading={waitlist.busy} />
                  </>
                )}
              </View>
            ) : (<>
            <Text style={{ color: t.ink, fontFamily: 'display', fontWeight: '700', fontSize: 19, lineHeight: 22 }}>{BLURB[tab][0]}</Text>
            <Text style={{ color: t.muted, fontSize: 14, marginTop: 2 }}>{BLURB[tab][1]}</Text>
            {tab !== 'sim' ? (
              <>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <TextInput value={pin} onChangeText={setPin} keyboardType="number-pad" maxLength={6} placeholder="452010" placeholderTextColor={t.muted} accessibilityLabel="PIN code" onSubmitEditing={() => find()}
                    style={{ flex: 1, minWidth: 0, height: 61, fontFamily: fontFor('mono', '500'), fontSize: 22, letterSpacing: 4, paddingHorizontal: 14, borderWidth: 1.5, borderColor: t.lineStrong, borderRadius: 12, backgroundColor: t.bg, color: t.ink }} />
                  <Pressable onPress={() => find()} disabled={search.busy} accessibilityRole="button" accessibilityLabel="Search"
                    style={{ height: 61, paddingHorizontal: 18, borderRadius: 10, backgroundColor: t.blue, alignItems: 'center', justifyContent: 'center', opacity: search.busy ? 0.6 : 1 }}>
                    <Text style={{ color: t.blueInk, fontSize: 15, fontWeight: '700' }}>{search.busy ? '…' : 'Search'}</Text>
                  </Pressable>
                </View>
                <Pressable onPress={locate} accessibilityRole="button" style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                  <Text style={{ color: t.blue, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' }}>Use my current location</Text>
                </Pressable>
                {search.error ? <Text style={{ color: t.bad, fontSize: 13, marginTop: 6 }} accessibilityRole="alert">{search.error}</Text> : null}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginTop: 10 }}>
                  {pins.map(p => (
                    <Pressable key={p.pin} onPress={() => { setPin(p.pin); find(p.pin); }} accessibilityRole="button"
                      style={{ borderWidth: 1.5, borderColor: pin === p.pin ? t.blue : t.lineStrong, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: t.surface }}>
                      <Text style={{ color: t.ink, fontSize: 13.5, fontWeight: '700' }}>{p.pin} · {p.area}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}
            </>)}
          </View>

          {/* Bhai story, final frame */}
          <View style={{ marginTop: 24, zIndex: 1 }}><Story /></View>
          <Text style={{ color: PALE, fontSize: 15, lineHeight: 22, marginTop: 12 }}><Text style={{ color: '#fff', fontWeight: '800' }}>Meet Bhai</Text>, your internet guide. He finds the plans, compares them, and stays with you till the router says <Text style={{ fontStyle: 'italic' }}>Connected</Text>.</Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 8, marginTop: 22 }}>
            {['Free for customers', 'BSNL TIPs, DSAs & local ISPs', 'Installation tracked end to end'].map(x => (
              <View key={x} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: SKY }} /><Text style={{ color: PALE, fontSize: 14 }}>{x}</Text></View>
            ))}
          </View>
          <View style={{ marginTop: 16, gap: 10 }}>
            <Pressable onPress={() => router.push('/speed')} accessibilityRole="button" style={{ ...headBtn, alignSelf: 'flex-start' }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13.5 }}>Test your Wi-Fi speed →</Text>
            </Pressable>
            <Pressable onPress={careRoute} accessibilityRole="button" style={{ ...headBtn, alignSelf: 'flex-start' }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13.5 }}>Care plan →</Text>
            </Pressable>
          </View>
        </View>

        {/* results */}
        {res ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 36, gap: 14 }} onLayout={e => { resultsY.current = e.nativeEvent.layout.y; }}>
            <Eyebrow color={t.blue}>{[res.city, res.areas.join(', ')].filter(Boolean).join(' · ') || 'Results'}</Eyebrow>
            {!res.serviceable ? (
              <View style={{ backgroundColor: t.surface, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.lineStrong, borderRadius: 14, padding: 28, alignItems: 'center', gap: 10 }}>
                <Text style={{ color: t.ink, fontWeight: '800' }}>We are not in your area yet</Text>
                <Muted>We will add PIN code {res.pin} soon. Try another PIN code.</Muted>
              </View>
            ) : (
              <>
                <Text style={{ color: t.ink, fontFamily: 'display', fontWeight: '700', fontSize: 20 }}>{plans.length} of {res.plans.length} {res.tab === 'ott' ? 'OTT packs' : 'plans'} match</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {([['price', 'Price: low to high'], ...(speedy ? [['speed', 'Speed: high to low'], ['value', 'Best value (₹ per Mbps)']] : [])] as ['price' | 'speed' | 'value', string][]).map(([k, l]) => (
                    <Chip key={k} on={sort === k} label={l} onPress={() => setSort(k)} />
                  ))}
                  {speedy ? [0, 50, 100, 200, 300].map(s => <Chip key={s} on={minSpeed === s} label={s ? `${s}+ Mbps` : 'Any speed'} onPress={() => setMinSpeed(s)} />) : null}
                </ScrollView>
                {plans.length === 0 ? (
                  <View style={{ backgroundColor: t.surface, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.lineStrong, borderRadius: 14, padding: 28, alignItems: 'center' }}><Text style={{ color: t.ink, fontWeight: '800' }}>No plans match these filters.</Text></View>
                ) : null}
                {plans.map(p => <PlanCard key={p.id} plan={p} selected={cmp.includes(p.id)} onCompare={() => toggle(p.id)} onRequest={() => setReq(p)} />)}
                <Text style={{ color: t.muted, fontSize: 14 }}>{"Can't decide? "}<Text style={{ color: t.blue, fontWeight: '700', textDecorationLine: 'underline' }} onPress={() => setReq('callback')}>Request a callback</Text> and a TIP will help you choose.</Text>
              </>
            )}
          </View>
        ) : null}

        {/* how it works */}
        <View style={{ padding: 16, paddingVertical: 44, gap: 8 }}>
          <Eyebrow color={t.blue}>How it works</Eyebrow>
          <Text style={{ color: t.ink, fontFamily: 'display', fontWeight: '800', fontSize: 26, lineHeight: 30, marginBottom: 16 }}>From search to a working connection</Text>
          <View style={{ gap: 18 }}>
            {[['01 / Compare', 'Search your PIN code', 'See only the plans that are actually offered in your area, with speed, price, data and OTT/TV benefits.'],
              ['02 / Choose', 'Request a connection', 'Pick a plan and share your details. You get a request number immediately.'],
              ['03 / Connect', 'Track installation', 'An assigned TIP calls you, books the installation and updates every step in your dashboard.']].map(([n, h, p]) => (
              <View key={n} style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 14, padding: 20, gap: 8 }}>
                <Text style={{ color: t.blue, fontFamily: 'mono', fontWeight: '600', fontSize: 13 }}>{n}</Text>
                <Text style={{ color: t.ink, fontFamily: 'display', fontWeight: '700', fontSize: 18 }}>{h}</Text>
                <Text style={{ color: t.muted, fontSize: 16, lineHeight: 24 }}>{p}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* cities (website citiesSection) */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 44, gap: 8 }}>
          <Eyebrow color={t.blue}>Madhya Pradesh</Eyebrow>
          <Text style={{ color: t.ink, fontFamily: 'display', fontWeight: '800', fontSize: 26, lineHeight: 30 }}>Live in {liveNames}. Coming to every district of MP.</Text>
          <Text style={{ color: t.muted, fontSize: 16, lineHeight: 24 }}>{"Pick your city. Where we are live you can compare and book right away. Everywhere else, join the waiting list and we'll WhatsApp you the day we launch there."}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {shownCities.map(c => (
              <Pressable key={c.id} onPress={() => { setCity(c.id); goTop(); }} accessibilityRole="button" accessibilityState={{ selected: city === c.id }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1.5, borderColor: city === c.id ? t.blue : t.lineStrong, backgroundColor: t.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.status === 'live' ? t.ok : t.lineStrong }} />
                <Text style={{ color: t.ink, fontWeight: '700', fontSize: 14 }}>{c.name}</Text>
                <Text style={{ color: c.status === 'live' ? t.ok : t.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.7 }}>{c.status === 'live' ? 'LIVE' : 'SOON'}</Text>
              </Pressable>
            ))}
          </View>
          {!allCities && cities.length > 7 ? <View style={{ alignSelf: 'flex-start', marginTop: 6 }}><Button small kind="secondary" label={`Show all ${cities.length} districts`} onPress={() => setAllCities(true)} /></View> : null}
          <Text style={{ color: t.muted, fontSize: 14, marginTop: 6 }}>Run a broadband or mobile shop in your city? <Text style={{ color: t.blue, fontWeight: '700', textDecorationLine: 'underline' }} onPress={() => router.push('/partner')}>Register as a DSA or TIP before launch</Text></Text>
        </View>

        {/* care plan (website .tr-hero) */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 44 }}>
          <View style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderLeftWidth: 4, borderLeftColor: t.blue, borderRadius: 14, padding: 20, gap: 12 }}>
            <Eyebrow color={t.blue}>Care plan · Gene, your personal assistant</Eyebrow>
            <Text style={{ color: t.ink, fontFamily: 'display', fontWeight: '800', fontSize: 24, lineHeight: 28 }}>Connect Bhai Care plan: Bhai looks after your internet</Text>
            <Text style={{ color: t.muted, fontSize: 16, lineHeight: 24 }}>With the Care plan and Gene, your personal assistant, your modem is watched 24x7. See Online / Offline and fiber signal, change your Wi-Fi name or password, restart the modem and test the line speed, all from the app. If the line goes down, your installer knows before you call.</Text>
            <Button label="Open my Care plan" onPress={careRoute} />
            <Button label="Wi-Fi speed test" kind="secondary" onPress={() => router.push('/speed')} />
            {[['Installer links the modem', "Scans the ONT serial; the modem reports to the installer's or Connect Bhai's Gene"], ['Modem reports every 5 minutes', 'Status, fiber signal, Wi-Fi and restarts'], ['You control it in the app', 'Restart, Wi-Fi change, line speed test']].map(([h, p], i) => (
              <View key={h} style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: t.blueSoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: t.blue, fontWeight: '800', fontSize: 13 }}>{i + 1}</Text></View>
                <View style={{ flex: 1 }}><Text style={{ color: t.ink, fontWeight: '800' }}>{h}</Text><Text style={{ color: t.muted, fontSize: 14, lineHeight: 20 }}>{p}</Text></View>
              </View>
            ))}
          </View>
        </View>

        {/* partners */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 44 }}>
          <View style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 14, padding: 20, gap: 8 }}>
            <Eyebrow color={t.blue}>For DSAs & TIPs</Eyebrow>
            <Text style={{ color: t.ink, fontFamily: 'display', fontWeight: '800', fontSize: 28, lineHeight: 32 }}>Grow with Connect Bhai</Text>
            <Text style={{ color: t.muted, fontSize: 16, lineHeight: 24 }}>Join as a Direct Selling Agent (DSA) or a BSNL TIP. Admin verifies every DSA and TIP before leads are assigned.</Text>
            {['Verified leads from your service PIN codes', 'Follow-ups, installation status and commissions in one portal', 'Transparent commission approval and payment records'].map(x => (
              <View key={x} style={{ flexDirection: 'row', gap: 8 }}><Ionicons name="checkmark-circle" size={18} color={t.ok} /><Text style={{ color: t.ink, flex: 1, fontSize: 15, lineHeight: 22 }}>{x}</Text></View>
            ))}
          </View>
          <View style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 14, padding: 20, marginTop: 18 }}>
            <PartnerForm />
          </View>
        </View>

        {/* FAQ (website Faq.jsx) */}
        <View style={{ padding: 16, paddingBottom: 44, gap: 12 }}>
          <View style={{ alignSelf: 'flex-start', backgroundColor: t.blueSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}><Text style={{ color: t.blue, fontWeight: '800', fontSize: 12, letterSpacing: 1.2 }}>FAQ</Text></View>
          <Text style={{ color: t.ink, fontFamily: 'display', fontWeight: '800', fontSize: 28, lineHeight: 32 }}>Got questions? We have answers, Bhai.</Text>
          <Text style={{ color: t.muted, fontSize: 16, lineHeight: 24 }}>Everything you need to know about comparing, booking and installing your connection.</Text>
          <View style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 16, padding: 18, gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.blueSoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="headset" size={22} color={t.blue} /></View>
              <View style={{ flex: 1 }}><Text style={{ color: t.ink, fontWeight: '800' }}>Still need help?</Text><Text style={{ color: t.muted, fontSize: 14 }}>Our experts reply in minutes, in Hindi and English.</Text></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button small icon="call" label="Call us" onPress={() => Linking.openURL('tel:+91' + SUPPORT.phone)} />
              <Button small kind="secondary" icon="logo-whatsapp" label="WhatsApp" onPress={() => Linking.openURL('https://wa.me/91' + SUPPORT.phone)} />
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {CATS.map(c => <Chip key={c} on={faqCat === c} label={c} onPress={() => { setFaqCat(c); setFaq(0); }} />)}
          </ScrollView>
          {faqList.map(([, q, a], i) => {
            const open = faq === i;
            return (
              <Pressable key={q} onPress={() => setFaq(open ? -1 : i)} accessibilityRole="button" accessibilityState={{ expanded: open }}
                style={{ backgroundColor: t.surface, borderWidth: open ? 1.5 : 1, borderColor: open ? t.blue : t.line, borderRadius: 16, paddingHorizontal: 22, paddingVertical: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  <Text style={{ flex: 1, color: open ? t.blue : t.ink, fontFamily: 'display', fontWeight: '700', fontSize: 16, lineHeight: 21 }}>{q}</Text>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: open ? t.blue : t.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={open ? 'close' : 'add'} size={18} color={open ? t.blueInk : t.blue} />
                  </View>
                </View>
                {open ? <Text style={{ color: t.muted, fontSize: 16, lineHeight: 24, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: t.line }}>{a}</Text> : null}
              </Pressable>
            );
          })}
        </View>

        {/* footer (website Footer.jsx) */}
        <View style={{ backgroundColor: DEEP, padding: 20, paddingVertical: 32, gap: 18 }}>
          <View style={{ gap: 8 }}>
            <Logo height={36} />
            <Text style={{ color: PALE, fontSize: 14, lineHeight: 21 }}>Compare. Choose. Connect. A broadband marketplace for Madhya Pradesh, live in Indore, connecting customers with BSNL TIPs, Direct Selling Agents and local internet providers.</Text>
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14, marginBottom: 2 }}>Customers</Text>
            {([['Search by PIN code', goTop], ['Wi-Fi speed test', () => router.push('/speed')], ['Care plan', careRoute], ['My dashboard', () => router.push(user ? '/dashboard' : '/login')]] as [string, () => void][]).map(([l, f]) => (
              <Pressable key={l} onPress={f} accessibilityRole="button"><Text style={{ color: PALE, fontSize: 14, fontWeight: '600' }}>{l}</Text></Pressable>
            ))}
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14, marginBottom: 2 }}>Contact</Text>
            <Text style={{ color: PALE, fontSize: 14 }}>Indore, Madhya Pradesh</Text>
            <Text style={{ color: PALE, fontSize: 14 }}>www.connectbhai.com</Text>
            <Text style={{ color: PALE, fontSize: 12.5, lineHeight: 18, marginTop: 4 }}>Plans shown here are sample data until verified tariffs are added. Connect Bhai is an independent marketplace and does not claim live integration with any ISP.</Text>
          </View>
        </View>
      </ScrollView>

      {/* compare bar */}
      {cmp.length > 0 ? (
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 12, backgroundColor: DEEP, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{cmp.length} selected (max 3)</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button small kind="secondary" label="Clear" onPress={() => setCmp([])} />
            <Button small label="Compare" onPress={() => (cmp.length < 2 ? search.setError('Select at least 2 plans to compare.') : setShowCmp(true))} />
          </View>
        </View>
      ) : null}

      <Modal visible={cityMenu} transparent animationType="fade" onRequestClose={() => setCityMenu(false)} statusBarTranslucent>
        <Pressable style={{ flex: 1 }} onPress={() => setCityMenu(false)} accessibilityLabel="Close city list">
          <View style={{ position: 'absolute', top: cityBox.y + cityBox.h + 4 + (Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0), left: cityBox.x, width: cityBox.w, backgroundColor: t.surface, borderWidth: 1.5, borderColor: t.lineStrong, borderRadius: 10, paddingVertical: 4, elevation: 12, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }}>
            {cities.map(c => (
              <Pressable key={c.id} onPress={() => { setCity(c.id); setCityMenu(false); setRes(null); }} accessibilityRole="menuitem"
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 12, backgroundColor: c.id === city ? t.blueSoft : 'transparent' }}>
                <Text style={{ color: t.ink, fontSize: 16, fontWeight: c.id === city ? '800' : '600' }}>{c.name}</Text>
                <Text style={{ color: c.status === 'live' ? t.ok : t.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.7 }}>{c.status === 'live' ? 'LIVE' : 'SOON'}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Drawer visible={menu} onClose={() => setMenu(false)}
        items={[
          { label: 'Plans', icon: 'search', onPress: goTop },
          { label: 'Wi-Fi speed test', icon: 'speedometer', onPress: () => router.push('/speed') },
          { label: 'Care plan', icon: 'shield-checkmark', onPress: careRoute },
          { label: 'Become a DSA or TIP', icon: 'people', onPress: () => router.push('/partner') },
          ...(user ? [{ label: 'My dashboard', icon: 'grid' as const, onPress: () => router.push('/dashboard') }, { label: 'Log out', icon: 'log-out-outline' as const, onPress: () => signOut(), danger: true }]
                   : [{ label: 'Log in', icon: 'person-outline' as const, onPress: () => router.push('/login') }]),
        ]} />

      <Sheet visible={showCmp} title="Compare plans" onClose={() => setShowCmp(false)}>
        <ScrollView horizontal>
          <View>
            {([['Plan', (p: Plan) => p.name], ['Provider', (p: Plan) => p.category?.name || ''], ...(speedy ? [['Speed', (p: Plan) => (p.speed_mbps ? p.speed_mbps + ' Mbps' : '—')]] : []), ['Price', (p: Plan) => inr(p.price) + '/month'],
              ...(speedy ? [['₹ per Mbps', (p: Plan) => (p.speed_mbps ? '₹' + (Number(p.price) / p.speed_mbps).toFixed(1) : '—')], ['Data', (p: Plan) => p.data_limit || 'Unlimited'], ['Installation', (p: Plan) => (Number(p.install_charge) ? inr(p.install_charge) : 'Free')]] : []),
              ['OTT apps', (p: Plan) => otts(p).join(', ') || '—']] as [string, (p: Plan) => string][]).map(([label, fn]) => (
              <View key={label} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: t.line, paddingVertical: 8 }}>
                <Text style={{ width: 96, color: t.muted, fontWeight: '700' }}>{label}</Text>
                {chosen.map(p => <Text key={p.id} style={{ width: 140, color: t.ink, fontWeight: '600' }}>{fn(p)}</Text>)}
              </View>
            ))}
            <View style={{ flexDirection: 'row', paddingVertical: 10 }}>
              <View style={{ width: 96 }} />
              {chosen.map(p => <View key={p.id} style={{ width: 140, paddingRight: 8 }}><Button small label="Choose" onPress={() => { setShowCmp(false); setReq(p); }} /></View>)}
            </View>
          </View>
        </ScrollView>
        <Muted>{CAT_LABEL[res?.tab || 'fiber']} plans for PIN {res?.pin}</Muted>
      </Sheet>

      <RequestSheet target={req} pin={res?.pin || pin} area={res?.areas[0] || ''} onClose={() => setReq(null)} />
    </SafeAreaView>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5, borderColor: on ? t.blue : t.lineStrong, backgroundColor: on ? t.blue : t.surface }}>
      <Text style={{ color: on ? t.blueInk : t.ink, fontWeight: '700', fontSize: 13.5 }}>{label}</Text>
    </Pressable>
  );
}

/* Request a connection or a callback. Guests verify their number with a WhatsApp OTP first (this also creates their customer account), like the website. */
function RequestSheet({ target, pin, area, onClose }: { target: Plan | 'callback' | null; pin: string; area: string; onClose: () => void }) {
  const t = useTheme();
  const { user, signIn } = useAuth();
  const isCustomer = user?.role === 'customer';
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pinV, setPinV] = useState('');
  const [areaV, setAreaV] = useState('');
  const [address, setAddress] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'form' | 'otp' | 'done'>('form');
  const [ref, setRef] = useState('');
  const { busy, error, setError, run } = useBusy();

  useEffect(() => {
    if (!target) return;
    setStep('form'); setCode(''); setError(''); setRef('');
    setName(isCustomer ? user!.name : ''); setPhone(isCustomer ? user!.phone : ''); setPinV(pin); setAreaV(area); setAddress('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const plan = target && target !== 'callback' ? target : null;
  const check = () => {
    if (name.trim().length < 2) throw new ApiError('Enter your full name.');
    if (!/^[6-9]\d{9}$/.test(phoneDigits(phone))) throw new ApiError('Enter a valid 10-digit mobile number.');
    if (!/^\d{6}$/.test(pinV)) throw new ApiError('Enter a valid 6-digit PIN code.');
  };
  const create = async () => {
    const l = await api.requestConnection({ name, phone: phoneDigits(phone), pincode: pinV, address: [areaV && 'Area: ' + areaV, address].filter(Boolean).join(' | ') || undefined, planId: plan?.id });
    setRef(l.ref_code); setStep('done');
  };
  const submit = () => run(async () => {
    check();
    if (!user) { await api.sendOtp(phoneDigits(phone)); setStep('otp'); return; }   // verify the number on WhatsApp first
    await create();
  });
  const verify = () => run(async () => {
    if (!/^\d{4,8}$/.test(code)) throw new ApiError('Enter the OTP we sent on WhatsApp.');
    signIn(await api.verifyOtp(phoneDigits(phone), code, name));
    await create();
  });

  return (
    <Sheet visible={!!target} title={step === 'done' ? 'Request placed' : plan ? (plan.category?.type === 'airfiber' ? 'Book Air Fiber' : plan.category?.type === 'ott' ? 'Get this OTT pack' : 'Request this connection') : 'Request a callback'} onClose={onClose}>
      {step === 'done' ? (
        <>
          <Text style={{ color: t.ok, fontSize: 18, fontWeight: '800' }}>Your request number is {ref}</Text>
          <Muted style={{ marginVertical: 10 }}>An installer for your area will call you soon. Track every step in your dashboard.</Muted>
          <Button label="Open my dashboard" onPress={() => { onClose(); router.push('/dashboard'); }} />
        </>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {plan ? <Card style={{ marginBottom: 12 }}><Strong>{plan.category?.name} · {plan.name}</Strong><Muted>{inr(plan.price)}/month</Muted></Card>
            : <Muted style={{ marginBottom: 12 }}>Share your details and a TIP will call you to help choose a plan.</Muted>}
          <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" editable={step === 'form'} />
          <Field label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={16} editable={step === 'form' && !isCustomer} />
          <Field label="PIN code" value={pinV} onChangeText={setPinV} keyboardType="number-pad" maxLength={6} editable={step === 'form'} />
          <Field label="Area / colony" value={areaV} onChangeText={setAreaV} editable={step === 'form'} />
          <Field label="Address (optional)" value={address} onChangeText={setAddress} multiline editable={step === 'form'} />
          {step === 'otp' ? <Field label="OTP sent on WhatsApp" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={8} autoFocus /> : null}
          {error ? <Text style={{ color: t.bad, marginBottom: 10 }} accessibilityRole="alert">{error}</Text> : null}
          {step === 'otp' ? (
            <View style={{ gap: 8 }}>
              <Button label="Verify and submit" onPress={verify} loading={busy} />
              <Button label="Back" kind="secondary" onPress={() => { setStep('form'); setError(''); }} disabled={busy} />
            </View>
          ) : <Button label={user ? 'Submit request' : 'Send OTP on WhatsApp'} onPress={submit} loading={busy} />}
        </KeyboardAvoidingView>
      )}
    </Sheet>
  );
}
