/* The rest of the home page: featured Care card, How it works, cities, the Care plan teaser, partners, FAQ, About. */
import { ArrowRight, Check as Tick, Gauge, Headphones, Heart, Lock, RotateCcw, Search, Star, Wifi } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { ABOUT_STEPS } from '../../content/generated/about';
import { ROUTER_ART, STEP_ART } from '../../content/generated/art';
import { FAQ_CATS, FAQ_ITEMS } from '../../content/generated/faq';
import type { City } from '../../lib/api/types';
import { BUSINESS_AREAS, SUPPORT } from '../../lib/contact';
import { callPhone, whatsApp } from '../../lib/links';
import { Button, Card, Chip, Eyebrow, LinkButton, Row, SecHead, Section } from '../../ui/kit';
import { goTo } from '../../ui/nav';
import { T } from '../../ui/text';
import { colors, radius } from '../../ui/theme';
import { citySort } from './cities';

export function CareCard() {
  const rows: [string, React.ReactNode][] = [
    ['Modem', <Row key="m" gap={5}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' }} /><T s={12.5} w={800} c={colors.ok}>Online</T></Row>],
    ['Fiber signal', (
      <Row key="f" gap={6}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>{[5, 8, 11, 14].map((h) => <View key={h} style={{ width: 3, height: h, borderRadius: 1, backgroundColor: colors.blue }} />)}</View>
        <T s={12.5} w={800}>Strong</T>
      </Row>
    )],
    ['Speed', <T key="s" s={12.5} w={800} raw>98 Mbps</T>],
  ];
  const feats = [[RotateCcw, 'Restart'], [Wifi, 'Wi-Fi name'], [Lock, 'Password'], [Gauge, 'Speed test']] as const;
  return (
    <View style={{ borderRadius: 22, borderWidth: 1, borderColor: '#BFD2FF', paddingHorizontal: 16, paddingVertical: 14, gap: 10, backgroundColor: '#F5F8FF', experimental_backgroundImage: 'linear-gradient(160deg, #FFFFFF, #EEF4FF)' }}>
      <View style={{ position: 'absolute', top: 10, right: 14, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F7AE18', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 1 }}>
        <Star size={11} color="#3B2300" fill="#3B2300" />
        <T s={11} w={800} c="#3B2300">Featured</T>
      </View>
      <Row wrap={false} gap={12} style={{ marginTop: 14 }}>
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' }}>
          <Heart size={26} color={colors.white} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T f="display" s={17} w={700}>Connect Bhai Care plan</T>
          <T s={12.5} c="#4A5876" lh={17}>Live modem status, restart and Wi-Fi control, right from your phone.</T>
        </View>
      </Row>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: '#D6E0F5', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 }}>
        <SvgXml xml={ROUTER_ART} width={72} height={50} />
        <View style={{ flex: 1, gap: 4 }}>
          {rows.map(([label, value]) => (
            <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <T s={12.5} c="#4A5876">{label}</T>
              {value}
            </View>
          ))}
        </View>
      </View>
      <Row gap={6}>
        {feats.map(([Icon, label]) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.blueSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Icon size={14} color={colors.blue} />
            <T s={11.5} w={700}>{label}</T>
          </View>
        ))}
      </Row>
      <Pressable accessibilityRole="button" onPress={() => goTo('/care')} style={{ minHeight: 42, borderRadius: radius.card, backgroundColor: colors.blue, experimental_backgroundImage: 'linear-gradient(90deg, #1450E6, #2F7BFF)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <T s={15} w={800} c={colors.white}>Explore Care plan</T>
        <ArrowRight size={17} color={colors.white} />
      </Pressable>
    </View>
  );
}

const STEPS = [
  [Search, '01 / Compare', 'Search your PIN code', 'See only the plans that are actually offered in your area, with speed, price, data and OTT/TV benefits.'],
  [Tick, '02 / Choose', 'Request a connection', 'Pick a plan and share your details. You get a request number immediately.'],
  [Wifi, '03 / Connect', 'Track installation', 'An assigned TIP calls you, books the installation and updates every step in your dashboard.'],
  [Heart, '04 / Care', 'Stay looked after', 'Check your modem status, restart it and change your Wi-Fi from your dashboard, and raise a ticket whenever you need help.'],
] as const;

export function HowSection({ tight }: { tight?: boolean }) {
  return (
    <Section top={tight ? 0 : 56}>
      <SecHead eyebrow="How it works" title="From search to a working connection" />
      <View style={{ gap: 18 }}>
        {STEPS.map(([Icon, n, title, text], i) => (
          <View key={n} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, paddingHorizontal: 20, paddingBottom: 20, gap: 8 }}>
            <View style={{ marginHorizontal: -20, marginBottom: 18, paddingTop: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderColor: colors.line, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, experimental_backgroundImage: 'linear-gradient(180deg, #E8EFFF, rgba(232,239,255,0))' }}>
              <View style={{ width: '100%', height: 110 }}>
                <SvgXml xml={STEP_ART[i]} width="100%" height="100%" />
              </View>
              <View style={{ position: 'absolute', left: 20, bottom: -16, width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={20} color={colors.white} />
              </View>
            </View>
            <T f="mono" s={13} w={600} c={colors.blue} style={{ marginTop: 6 }}>{n}</T>
            <T f="display" s={18} w={700}>{title}</T>
            <T c={colors.muted}>{text}</T>
          </View>
        ))}
      </View>
    </Section>
  );
}

export function CitiesSection({ cities, city, onPick, onRegister }: { cities: City[]; city: string; onPick: (id: string) => void; onRegister: () => void }) {
  const [all, setAll] = useState(false);
  const sorted = cities.slice().sort(citySort);
  const shown = all ? sorted : sorted.filter((c) => c.status === 'live' || c.tier <= 2);
  const live = sorted.filter((c) => c.status === 'live');
  return (
    <Section top={0}>
      <SecHead eyebrow="Madhya Pradesh" title={`Live in ${live.map((c) => c.name).join(', ') || 'Indore'}. Coming to every district of MP.`} sub={`Pick your city. Where we are live you can compare and book right away. Everywhere else, join the waiting list and we'll WhatsApp you the day we launch there.`} />
      <Row>
        {shown.map((c) => {
          const on = c.id === city;
          const isLive = c.status === 'live';
          return (
            <Pressable key={c.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onPick(c.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1.5, borderColor: on ? colors.blue : colors.lineStrong, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, boxShadow: on ? `0 0 0 3px ${colors.blueSoft}` : undefined }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isLive ? colors.ok : colors.lineStrong }} />
              <T s={14} w={700}>{c.name}</T>
              <T s={11} w={800} c={isLive ? colors.ok : colors.muted} caps={0.6}>{isLive ? 'Live' : 'Soon'}</T>
            </Pressable>
          );
        })}
      </Row>
      <View style={{ marginTop: 14, gap: 10 }}>
        {all ? null : <Button label={`Show all ${sorted.length} districts`} variant="ghost" small onPress={() => setAll(true)} />}
        <View style={{ gap: 2 }}>
          <T s={14} c={colors.muted}>Run a broadband or mobile shop in your city?</T>
          <LinkButton label="Register as a DSA or TIP before launch" onPress={onRegister} />
        </View>
      </View>
    </Section>
  );
}

const MODEM_STEPS = [
  ['Installer links the modem', `Scans the ONT serial; the modem reports to the installer's or Connect Bhai's Genie`],
  ['Modem reports every 5 minutes', 'Status, fiber signal, Wi-Fi and restarts'],
  ['You control it in the app', 'Restart, Wi-Fi change, line speed test'],
] as const;

export function RouterSection() {
  return (
    <Section top={0}>
      <Card gap={14} style={{ borderLeftWidth: 4, borderLeftColor: colors.blue }}>
        <Eyebrow text="Care plan · Genie, your personal assistant" />
        <T f="display" s={24} w={700}>Connect Bhai Care plan: looking after your internet</T>
        <T c={colors.muted}>With the Care plan and Genie, your personal assistant, your modem is watched 24x7. See the Online/Offline status and fiber signal, change your Wi-Fi name or password, restart the modem and test the line speed, all from the app. If the line goes down, your installer will know before you call.</T>
        <Row>
          <Button label="Open my Care plan" onPress={() => goTo('/care')} />
          <Button label="Wi-Fi speed test" variant="ghost" onPress={() => goTo('/speed')} />
        </Row>
        <View style={{ gap: 16, marginTop: 10 }}>
          {MODEM_STEPS.map(([title, text], i) => (
            <View key={title} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                <T s={13} w={800} c={colors.blue} raw>{i + 1}</T>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T w={700}>{title}</T>
                <T s={14} c={colors.muted}>{text}</T>
              </View>
            </View>
          ))}
        </View>
      </Card>
    </Section>
  );
}

export function PartnerIntro() {
  return (
    <Card>
      <Eyebrow text="For DSAs & TIPs" />
      <T f="display" s={28} w={700}>Grow with Connect Bhai</T>
      <T c={colors.muted}>Join as a Direct Selling Agent (DSA) or a Telecom Infrastructure Partner (TIP). Admin verifies every DSA and TIP before leads are assigned.</T>
      {['Verified leads from your service PIN codes', 'Follow-ups, installation status and commissions in one portal', 'Transparent commission approval and payment records'].map((x) => (
        <View key={x} style={{ flexDirection: 'row', gap: 8 }}>
          <Tick size={16} color={colors.blue} strokeWidth={3} style={{ marginTop: 4 }} />
          <T style={{ flex: 1 }}>{x}</T>
        </View>
      ))}
    </Card>
  );
}

export function FaqSection({ onLayout }: { onLayout?: (e: LayoutChangeEvent) => void }) {
  const [cat, setCat] = useState('All');
  const [open, setOpen] = useState(0);
  const list = FAQ_ITEMS.filter(([c]) => cat === 'All' || c === cat);
  return (
    <View onLayout={onLayout}>
      <Section style={{ gap: 12 }}>
        <View style={{ alignSelf: 'flex-start', borderWidth: 1.5, borderColor: colors.blue, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 3 }}>
          <T s={13} w={800} c={colors.blue}>FAQ</T>
        </View>
        <T f="display" s={26} w={700} accessibilityRole="header">Got questions? We have answers, Bhai.</T>
        <T c={colors.muted}>Everything you need to know about comparing, booking and installing your connection.</T>
        <Card pad={18} gap={14} style={{ borderRadius: 18, marginTop: 10, marginBottom: 10 }}>
          <Row wrap={false} gap={14} style={{ alignItems: 'flex-start' }}>
            <View style={{ width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Headphones size={22} color={colors.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <T w={800}>Still need help?</T>
              <T s={13.5} c={colors.muted}>Our experts reply in minutes, in Hindi and English.</T>
            </View>
          </Row>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Call us" style={{ flex: 1 }} onPress={() => callPhone(SUPPORT.phone)} />
            <Button label="WhatsApp" variant="ghost" style={{ flex: 1 }} onPress={() => whatsApp(SUPPORT.phone)} />
          </View>
        </Card>
        <Row>
          {FAQ_CATS.map((c) => (
            <Chip key={c} tab label={c} selected={cat === c} onPress={() => { setCat(c); setOpen(0); }} />
          ))}
        </Row>
        <View style={{ gap: 8 }}>
          {list.map(([, q, a], i) => {
            const on = open === i;
            return (
              <View key={q} style={{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: on ? 2 : 1, borderColor: on ? colors.blue : colors.line }}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: on }} onPress={() => setOpen(on ? -1 : i)} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 18, paddingVertical: 14 }}>
                  <T f="display" s={15} w={700} c={on ? colors.blue : colors.ink} style={{ flex: 1 }}>{q}</T>
                  <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: on ? colors.blue : colors.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <T s={18} lh={22} c={on ? colors.white : colors.blue} raw>{on ? '×' : '+'}</T>
                  </View>
                </Pressable>
                {on ? (
                  <View style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
                    <T s={14.5} c={colors.muted} style={{ borderTopWidth: 1, borderColor: colors.line, paddingTop: 10 }}>{a}</T>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </Section>
    </View>
  );
}

export function AboutSection() {
  return (
    <Section top={24}>
      <SecHead title="About Connect Bhai" sub="Connect Bhai is a broadband marketplace for Madhya Pradesh, live in Indore. Compare. Choose. Connect. Care." />
      <View style={{ gap: 18, marginBottom: 28 }}>
        {ABOUT_STEPS.map(([title, text], i) => (
          <Card key={title} gap={8}>
            <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' }}>
              <T w={800} c={colors.white} raw>{i + 1}</T>
            </View>
            <T f="display" s={18} w={700}>{title}</T>
            <T c={colors.muted}>{text}</T>
          </Card>
        ))}
      </View>
      <View style={{ gap: 10 }}>
        <T f="display" s={18} w={700}>Areas we serve</T>
        <Row>
          {BUSINESS_AREAS.map((a) => (
            <View key={a} style={{ backgroundColor: colors.blueSoft, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 4 }}>
              <T w={600}>{a}</T>
            </View>
          ))}
        </Row>
        <LinkButton label="Run the free Wi-Fi speed test" s={16} onPress={() => goTo('/speed')} />
        <LinkButton label="How the Care plan fixes router and Wi-Fi problems" s={16} onPress={() => goTo('/care')} />
      </View>
    </Section>
  );
}
