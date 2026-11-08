import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Button } from '@/components/ui';

/* Wi-Fi speed test (website /speed). Measures ping, download and upload against Cloudflare's public speed endpoints. */
const DOWN = 'https://speed.cloudflare.com/__down?bytes=';
const UP = 'https://speed.cloudflare.com/__up';
const DEEP = '#0A2A78', SKY = '#8DB4FF', PALE = '#C9D8FF';
const ARC = Math.PI * 110;

const mbps = (bytes: number, ms: number) => (bytes * 8) / (ms / 1000) / 1e6;
const frac = (v: number) => Math.min(1, Math.sqrt(v / 500));   // gauge scale: 0 to 500 Mbps, easing

function Gauge({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={260} height={160} viewBox="0 0 260 160">
        <Path d="M20 140 A110 110 0 0 1 240 140" stroke="rgba(141,180,255,0.22)" strokeWidth={16} strokeLinecap="round" fill="none" />
        <Path d="M20 140 A110 110 0 0 1 240 140" stroke={SKY} strokeWidth={16} strokeLinecap="round" fill="none" strokeDasharray={`${ARC} ${ARC}`} strokeDashoffset={ARC * (1 - frac(value))} />
      </Svg>
      <View style={{ marginTop: -78, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontFamily: 'display', fontWeight: '800', fontSize: 46 }}>{value ? value.toFixed(value < 10 ? 1 : 0) : '0'}</Text>
        <Text style={{ color: PALE, fontWeight: '700' }}>Mbps · {label}</Text>
      </View>
    </View>
  );
}

export default function Speed() {
  const [phase, setPhase] = useState<'idle' | 'ping' | 'down' | 'up' | 'done'>('idle');
  const [live, setLive] = useState(0);
  const [r, setR] = useState<{ down: number; up: number; ping: number; jitter: number } | null>(null);
  const [error, setError] = useState('');
  const running = useRef(false);

  const run = async () => {
    if (running.current) return;
    running.current = true; setError(''); setR(null); setLive(0);
    try {
      setPhase('ping');
      const times: number[] = [];
      for (let i = 0; i < 6; i++) { const t0 = Date.now(); await fetch(DOWN + '0', { cache: 'no-store' }); times.push(Date.now() - t0); }
      const ping = Math.min(...times), jitter = times.slice(1).reduce((a, x, i) => a + Math.abs(x - times[i]), 0) / (times.length - 1);

      setPhase('down');
      let down = 0;
      for (const size of [1e6, 5e6, 15e6]) {
        const t0 = Date.now(); const buf = await (await fetch(DOWN + size, { cache: 'no-store' })).arrayBuffer();
        down = Math.max(down, mbps(buf.byteLength, Date.now() - t0)); setLive(down);
      }

      setPhase('up');
      let up = 0;
      for (const size of [0.3e6, 1e6, 3e6]) {
        const body = 'x'.repeat(size); const t0 = Date.now();
        await fetch(UP, { method: 'POST', body, cache: 'no-store' });
        up = Math.max(up, mbps(size, Date.now() - t0)); setLive(up);
      }
      setR({ down, up, ping, jitter }); setPhase('done'); setLive(down);
    } catch {
      setError('The speed test could not finish. Check that you are online and try again.'); setPhase('idle');
    }
    running.current = false;
  };

  const label = phase === 'up' ? 'Upload' : phase === 'ping' ? 'Testing latency' : phase === 'idle' ? 'Ready' : 'Download';
  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: DEEP }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 22 }}>
        <View>
          <Text style={{ color: SKY, fontSize: 12, fontWeight: '800', letterSpacing: 1.7 }}>WI-FI SPEED TEST</Text>
          <Text style={{ color: '#fff', fontFamily: 'display', fontWeight: '800', fontSize: 28, lineHeight: 32, marginTop: 6 }}>How fast is your internet right now?</Text>
          <Text style={{ color: PALE, fontSize: 15, lineHeight: 22, marginTop: 8 }}>Free, takes about 30 seconds. Stand near your router for the most accurate result.</Text>
        </View>
        <Gauge value={live} label={label} />
        <Button label={phase === 'idle' || phase === 'done' ? (phase === 'done' ? 'Test again' : 'Start test') : 'Testing…'} icon="speedometer" onPress={run} loading={phase !== 'idle' && phase !== 'done'} />
        {error ? <Text style={{ color: '#FFB4AB' }} accessibilityRole="alert">{error}</Text> : null}
        {r ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {[['Download', r.down.toFixed(1), 'Mbps'], ['Upload', r.up.toFixed(1), 'Mbps'], ['Ping', String(Math.round(r.ping)), 'ms'], ['Jitter', String(Math.round(r.jitter)), 'ms']].map(([k, v, u]) => (
              <View key={k} style={{ width: '47.5%', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(141,180,255,0.25)' }}>
                <Text style={{ color: PALE, fontSize: 13, fontWeight: '700' }}>{k}</Text>
                <Text style={{ color: '#fff', fontFamily: 'display', fontWeight: '800', fontSize: 26 }}>{v} <Text style={{ color: PALE, fontSize: 13 }}>{u}</Text></Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
