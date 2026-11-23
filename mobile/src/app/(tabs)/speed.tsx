import { router } from 'expo-router';
import { Gamepad2, Laptop, MonitorPlay, Tag, Timer, Video } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Footer } from '@/components/Footer';
import { Gauge } from '@/components/Gauge';
import { tr, useLang } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { runSpeedTest, type Phase, type SpeedRes } from '@/lib/speedtest';
import { colors, font } from '@/lib/theme';

/* Website /speed: a free Wi-Fi speed test with a guide to what each use needs. */
const USES = [
  { k: '4K streaming', Icon: MonitorPlay, need: 25, ping: 0 },
  { k: 'Video calls', Icon: Video, need: 10, ping: 0 },
  { k: 'Online gaming', Icon: Gamepad2, need: 15, ping: 50 },
  { k: 'Work from home', Icon: Laptop, need: 20, ping: 0 },
];
const fit = (u: (typeof USES)[number], r: SpeedRes) => {
  if (r.down == null) return null;
  return r.down >= u.need && (!u.ping || (r.ping ?? 0) <= u.ping) ? 'Smooth' : r.down >= u.need * 0.5 ? 'Limited' : 'Too slow';
};
const TONE = { Smooth: colors.green, Limited: colors.warn, 'Too slow': colors.bad } as const;
const quality = (d: number) => (d >= 100 ? 'Excellent connection' : d >= 40 ? 'Good connection' : d >= 15 ? 'Fair connection' : 'Slow connection');
const f1 = (v: number | null) => (v == null ? '–' : v.toFixed(1));
const PHASE: Record<Phase, string> = { ping: 'Checking latency…', download: 'Testing download…', upload: 'Testing upload…' };

export default function Speed() {
  const { lang } = useLang();
  const { user } = useSession();
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [phase, setPhase] = useState<Phase>('ping');
  const [live, setLive] = useState(0);
  const [res, setRes] = useState<SpeedRes>({ down: null, up: null, ping: null, jit: null });

  const start = async () => {
    setStatus('running'); setLive(0); setRes({ down: null, up: null, ping: null, jit: null });
    try {
      const r = await runSpeedTest(setPhase, setLive);
      setRes(r); setLive(r.down ?? 0); setStatus('done');
    } catch { setStatus('error'); }
  };

  const steps: [Phase, string][] = [['ping', 'Ping'], ['download', 'Download'], ['upload', 'Upload']];
  const at = status === 'done' ? 3 : status === 'running' ? steps.findIndex(([p]) => p === phase) : -1;
  return (
    <View style={s.screen}>
      <AppHeader />
      <ScrollView contentContainerStyle={{ paddingBottom: 0 }}>
        <View style={s.body}>
          <Text style={s.eyebrow}>{tr('Wi-Fi speed test', lang).toUpperCase()}</Text>
          <Text style={s.h1}>{tr('How fast is your internet right now?', lang)}</Text>
          <View style={s.badges}>
            {[[Timer, 'About 30 seconds'], [Tag, 'Free to use'], [Laptop, 'Phone or laptop']].map(([Icon, t]) => {
              const I = Icon as typeof Timer;
              return <View key={t as string} style={s.badge}><I size={18} color="#7FA2FF" /><Text style={s.badgeText}>{tr(t as string, lang)}</Text></View>;
            })}
          </View>
          <Pressable onPress={status === 'running' ? undefined : start} style={[s.go, status === 'running' && { opacity: 0.7 }]}>
            <Text style={s.goText}>{status === 'running' ? tr('Testing…', lang) : tr(status === 'done' ? 'Test again' : 'Test speed now', lang)} →</Text>
          </Pressable>
          <View style={s.panel}>
            <Pressable onPress={status === 'running' ? undefined : start}><Gauge value={status === 'idle' ? 0 : live} /></Pressable>
            <View style={s.status}><Text style={s.statusText}>{status === 'running' ? tr(PHASE[phase], lang) : status === 'done' ? (res.down ? tr(quality(res.down), lang) : tr('Test complete', lang)) : status === 'error' ? tr('Could not run the test. Check your internet and try again.', lang) : tr('Ready · tap the dial to start', lang)}</Text></View>
            <View style={s.steps}>
              {steps.map(([, l], i) => (
                <View key={l} style={{ alignItems: 'center', gap: 6 }}>
                  <View style={[s.stepDot, i <= at && { backgroundColor: '#4C7DFF', borderColor: '#4C7DFF' }]}><Text style={s.stepNum}>{i + 1}</Text></View>
                  <Text style={s.stepText}>{tr(l, lang)}</Text>
                </View>
              ))}
            </View>
          </View>
          {status === 'done' && (
            <View style={s.grid}>
              {([['Download', res.down, 'Mbps'], ['Upload', res.up, 'Mbps'], ['Ping', res.ping, 'ms'], ['Jitter', res.jit, 'ms']] as const).map(([l, v, u]) => (
                <View key={l} style={s.stat}><Text style={s.statL}>{tr(l, lang).toUpperCase()}</Text><Text style={s.val}>{f1(v)} <Text style={s.unit}>{u}</Text></Text></View>
              ))}
            </View>
          )}
          <View style={s.stat}>
            <Text style={s.useHead}>{status === 'done' && res.down ? `${tr('What can you do at', lang)} ${Math.round(res.down)} Mbps` : tr('What your line can do', lang)}</Text>
            {USES.map((u) => {
              const f = fit(u, res);
              return (
                <View key={u.k} style={s.use}>
                  <u.Icon size={18} color="#7FA2FF" /><Text style={s.useText}>{tr(u.k, lang)}</Text>
                  <Text style={[s.fit, { color: f ? TONE[f] : '#9DB0D8' }]}>{f ? tr(f, lang) : `${u.need}+ Mbps`}</Text>
                </View>
              );
            })}
          </View>
          {!user && <Pressable onPress={() => router.push('/login')}><Text style={s.login}><Text style={{ color: '#7FA2FF' }}>{tr('Log in', lang)}</Text> {tr('to save results and report slow speed.', lang)}</Text></Pressable>}
        </View>
        <Footer />
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#050E27' },
  body: { padding: 16, gap: 14 },
  eyebrow: { fontFamily: font.bodyXBold, fontSize: 13, letterSpacing: 2, color: '#6F97FF', textAlign: 'center' },
  h1: { fontFamily: font.displayXBold, fontSize: 27, lineHeight: 32, color: '#fff', textAlign: 'center' },
  badges: { flexDirection: 'row', gap: 8 },
  badge: { flex: 1, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 6 },
  badgeText: { fontFamily: font.bodyBold, fontSize: 13, color: '#fff', textAlign: 'center' },
  go: { height: 56, borderRadius: 14, backgroundColor: '#2F54E0', alignItems: 'center', justifyContent: 'center' },
  goText: { fontFamily: font.bodyXBold, fontSize: 17, color: '#fff' },
  panel: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.045)', borderRadius: 24, padding: 14, alignItems: 'center', gap: 12 },
  status: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  statusText: { fontFamily: font.bodyBold, fontSize: 14.5, color: '#fff', textAlign: 'center' },
  steps: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', paddingHorizontal: 10 },
  stepDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  stepNum: { color: '#fff', fontFamily: font.bodyBold, fontSize: 12 },
  stepText: { color: '#B9C8EA', fontFamily: font.bodyMd, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  stat: { width: '100%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 18, padding: 14, gap: 8 },
  statL: { fontFamily: font.bodyBold, fontSize: 12, letterSpacing: 1, color: '#9DB0D8' },
  val: { fontFamily: font.displayXBold, fontSize: 24, color: '#fff' },
  unit: { fontFamily: font.bodyMd, fontSize: 13, color: '#9DB0D8' },
  useHead: { fontFamily: font.display, fontSize: 17, color: '#fff' },
  use: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  useText: { flex: 1, fontFamily: font.bodyMd, fontSize: 15, color: '#fff' },
  fit: { fontFamily: font.bodyBold, fontSize: 14 },
  login: { fontFamily: font.bodyMd, fontSize: 14, color: '#B9C8EA', textAlign: 'center' },
});
