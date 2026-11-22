import { Gamepad2, Laptop, MonitorPlay, Video } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Footer } from '@/components/Footer';
import { Button, Card, T } from '@/components/ui';
import { tr, useLang } from '@/lib/i18n';
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

  return (
    <View style={s.screen}>
      <AppHeader />
      <ScrollView contentContainerStyle={{ paddingBottom: 0 }}>
        <View style={s.body}>
          <T v="eyebrow">Free Wi-Fi speed test</T>
          <T v="h1">How fast is your Wi-Fi?</T>
          <T v="small" style={{ fontSize: 14.5, lineHeight: 21 }}>Run a free test on this phone and check your download speed and latency before choosing a broadband plan.</T>
          <Card style={{ alignItems: 'center', gap: 6, paddingVertical: 28 }}>
            <Text style={s.big}>{f1(status === 'idle' ? null : live)}</Text>
            <T v="small">Mbps download</T>
            <T v="small" style={{ marginTop: 6 }}>{status === 'running' ? PHASE[phase] : status === 'done' ? (res.down ? quality(res.down) : 'Test complete') : status === 'error' ? 'Could not run the test. Check your internet and try again.' : 'Ready · tap Start'}</T>
          </Card>
          <Button label={status === 'running' ? 'Testing…' : status === 'done' ? 'Test again' : 'Start speed test'} loading={status === 'running'} onPress={start} />
          {status === 'done' && (
            <View style={s.grid}>
              {([['Download', res.down, 'Mbps'], ['Upload', res.up, 'Mbps'], ['Ping', res.ping, 'ms'], ['Jitter', res.jit, 'ms']] as const).map(([l, v, u]) => (
                <Card key={l} style={{ width: '48%', padding: 14, gap: 2 }}><T v="label">{l}</T><Text style={s.val}>{f1(v)} <Text style={s.unit}>{u}</Text></Text></Card>
              ))}
            </View>
          )}
          <Card style={{ gap: 10 }}>
            <T v="h3">What your line can do</T>
            {USES.map((u) => {
              const f = fit(u, res);
              return (
                <View key={u.k} style={s.use}>
                  <u.Icon size={18} color={colors.blue} /><Text style={s.useText}>{tr(u.k, lang)}</Text>
                  <Text style={[s.fit, { color: f ? TONE[f] : colors.muted }]}>{f ? tr(f, lang) : `${u.need}+ Mbps`}</Text>
                </View>
              );
            })}
          </Card>
        </View>
        <Footer />
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: 16, gap: 14 },
  big: { fontFamily: font.displayXBold, fontSize: 64, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  val: { fontFamily: font.displayXBold, fontSize: 24, color: colors.ink },
  unit: { fontFamily: font.bodyMd, fontSize: 13, color: colors.muted },
  use: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  useText: { flex: 1, fontFamily: font.bodyMd, fontSize: 15, color: colors.ink },
  fit: { fontFamily: font.bodyBold, fontSize: 14 },
});
