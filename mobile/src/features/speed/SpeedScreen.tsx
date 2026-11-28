/* Wi-Fi speed test. Measured with the website's Cloudflare module and plan in a hidden WebView (speed/engine.ts). */
import { Activity, ArrowRight, Check, Clock, Download, Gamepad2, Laptop, MonitorPlay, Tag, Timer, Upload, Video, type LucideIcon } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View, type ScrollViewInstance } from 'react-native';
import { WebView } from 'react-native-webview';

import { API } from '../../lib/api';
import { fdt } from '../../lib/api/base';
import { errMsg } from '../../lib/forms';
import { useSession } from '../../lib/session';
import { parseSpeedEvent, speedPage } from '../../speed/engine';
import { openLogin } from '../account/login';
import { useTicketDialog } from '../care/ticket';
import { Screen } from '../../ui/chrome';
import { Select } from '../../ui/forms';
import { LinkButton, Row } from '../../ui/kit';
import { useOverlay } from '../../ui/overlay';
import { T } from '../../ui/text';
import { colors, radius } from '../../ui/theme';
import { Gauge } from './Gauge';

type Result = { down: number | null; up: number | null; ping: number | null; jit: number | null };
const EMPTY: Result = { down: null, up: null, ping: null, jit: null };
type Status = 'idle' | 'running' | 'done' | 'error';

const quality = (d: number): [string, string, string] =>
  d >= 100 ? ['Excellent connection', '#6EE7B7', 'rgba(16,185,129,0.15)'] : d >= 40 ? ['Good connection', '#7DD3FC', 'rgba(14,165,233,0.15)'] : d >= 10 ? ['Slow connection', '#FCD34D', 'rgba(245,158,11,0.15)'] : ['Very slow connection', '#FDA4AF', 'rgba(244,63,94,0.15)'];
const USES: { k: string; Icon: LucideIcon; need: number; ping?: number }[] = [
  { k: '4K streaming', Icon: MonitorPlay, need: 25 },
  { k: 'Video calls', Icon: Video, need: 10 },
  { k: 'Online gaming', Icon: Gamepad2, need: 15, ping: 50 },
  { k: 'Work from home', Icon: Laptop, need: 20 },
];
const fitColor: Record<string, string> = { Smooth: '#6EE7B7', Limited: '#FCD34D', 'Too slow': '#FDA4AF' };
const glass = { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)' } as const;
const dim = '#9FB3D9';

export default function SpeedScreen() {
  const overlay = useOverlay();
  const { user } = useSession();
  const openTicket = useTicketDialog();
  const scroll = useRef<ScrollViewInstance | null>(null);
  const stageY = useRef(0);
  const [status, setStatus] = useState<Status>('idle');
  const [phase, setPhase] = useState('Ready · tap the dial to start');
  const [step, setStep] = useState(0); // 1 ping, 2 download, 3 upload, 4 done
  const [live, setLive] = useState(0);
  const [result, setResult] = useState<Result>(EMPTY);
  const [run, setRun] = useState(0);
  const [connections, setConnections] = useState<{ value: string; label: string }[]>([]);
  const [connection, setConnection] = useState('');
  const watchdog = useRef<ReturnType<typeof setTimeout>>(undefined);

  /* the saved-connection picker follows login / logout */
  useEffect(() => {
    let off = false;
    const load = async () => {
      if (user?.role !== 'customer') return [];
      try {
        return (await API.myBookings())
          .filter((b) => b.status === 'installed')
          .map((b) => ({ value: b.id, label: b.plan ? `${b.plan.provider.name} · ${b.plan.name} (${b.plan.speed_mbps} Mbps)` : b.ref_code }));
      } catch {
        return [];
      }
    };
    load().then((list) => {
      if (off) return;
      setConnections(list);
      setConnection(list[0]?.value || '');
    });
    return () => {
      off = true;
    };
  }, [user]);

  const fail = useCallback((message: string) => {
    clearTimeout(watchdog.current);
    setStep(0);
    setPhase(message);
    setStatus('error');
  }, []);
  useEffect(() => () => clearTimeout(watchdog.current), []);

  const start = () => {
    if (status === 'running') return;
    setStatus('running');
    setStep(0);
    setLive(0);
    setResult(EMPTY);
    setPhase('Connecting to the test server…');
    setRun((n) => n + 1);
    clearTimeout(watchdog.current);
    watchdog.current = setTimeout(() => fail('The test stopped. Check your internet and try again.'), 180000);
    scroll.current?.scrollTo({ y: stageY.current - 12, animated: true });
  };

  const onMessage = async (data: string) => {
    const e = parseSpeedEvent(data);
    if (!e || status !== 'running') return;
    if (e.type === 'error') return fail(e.reason === 'load' ? 'Could not load the speed test. Check your internet and try again.' : 'The test stopped. Check your internet and try again.');
    if (e.type === 'phase') {
      const key = e.phase === 'ping' ? 'ping' : e.phase === 'download' ? 'down' : 'up';
      setStep(e.phase === 'ping' ? 1 : e.phase === 'download' ? 2 : 3);
      setPhase(e.phase === 'ping' ? 'Checking ping…' : e.phase === 'download' ? 'Checking download…' : 'Checking upload…');
      if (e.value) {
        setResult((r) => ({ ...r, [key]: e.value }));
        if (e.phase !== 'ping') setLive(e.value);
      }
      return;
    }
    clearTimeout(watchdog.current);
    setResult({ down: e.down, up: e.up, ping: e.ping, jit: e.jitter });
    setLive(e.down || 0);
    setPhase('Test complete');
    setStep(4);
    setStatus('done');
    if (user) {
      try {
        await API.recordSpeedTest(connection || null, { down: e.down, up: e.up, ping: e.ping, jit: e.jitter });
        overlay.toast('Result saved' + (connections.length ? ' to your connection.' : '.'));
      } catch (err) {
        overlay.toast(errMsg(err), true);
      }
    }
  };

  const report = () => {
    if (!user) return openLogin(overlay);
    if (user.role !== 'customer') return overlay.toast('Only customers can raise complaints.');
    const f = (v: number | null, d = 1) => (v == null || isNaN(v) ? '–' : Number(v).toFixed(d));
    openTicket({ booking_id: connection, description: `Wi-Fi speed test on ${fdt(new Date().toISOString())}: ${f(result.down)} Mbps download, ${f(result.up)} Mbps upload, ${f(result.ping, 0)} ms ping. Speed feels slow.` });
  };

  const running = status === 'running';
  const done = status === 'done';
  const [qLabel, qColor, qBg] = done ? quality(result.down || 0) : [phase, '#FFFFFF', 'rgba(255,255,255,0.1)'];
  const stats: [string, LucideIcon, number | null, string, number][] = [['Download', Download, result.down, 'Mbps', 1], ['Upload', Upload, result.up, 'Mbps', 1], ['Ping', Clock, result.ping, 'ms', 0], ['Jitter', Activity, result.jit, 'ms', 0]];
  const fit = (u: (typeof USES)[number]) => {
    if (!done) return null;
    const ok = result.down! >= u.need && (!u.ping || result.ping! <= u.ping);
    return ok ? 'Smooth' : result.down! >= u.need * 0.5 ? 'Limited' : 'Too slow';
  };

  return (
    <Screen scrollRef={scroll} bg={colors.night}>
      <View style={{ backgroundColor: colors.night, paddingHorizontal: 16, paddingVertical: 16, gap: 16, experimental_backgroundImage: 'radial-gradient(circle at 50% 38%, rgba(29,107,255,0.22), rgba(5,11,31,0) 60%)' }}>
        <View style={{ alignItems: 'center', gap: 16 }}>
          <T s={13} w={800} c="#3D8BFF" caps={2} center accessibilityRole="header">Wi-Fi speed test</T>
          <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch' }}>
            {([[Timer, 'About 30 seconds'], [Tag, 'Free to use'], [Laptop, 'Phone or laptop']] as const).map(([Icon, label]) => (
              <View key={label} style={{ ...glass, flex: 1, borderRadius: radius.lg, alignItems: 'center', gap: 4, padding: 8 }}>
                <Icon size={16} color="#7DD3FC" />
                <T s={12.5} w={600} c="#fff" center>{label}</T>
              </View>
            ))}
          </View>
          <View style={{ alignSelf: 'stretch', gap: 8 }}>
            {connections.length ? (
              <View style={{ gap: 4 }}>
                <T s={13} w={600} c={dim}>Save result to</T>
                <Select label="Save result to" noLabel compact value={connection} onChange={setConnection} options={connections} />
              </View>
            ) : null}
            <Pressable testID="speed-start" accessibilityRole="button" accessibilityState={{ disabled: running }} disabled={running} onPress={start} style={{ height: 56, borderRadius: 16, backgroundColor: colors.blue, borderWidth: 1, borderColor: 'rgba(156,195,255,0.45)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: running ? 0.7 : 1 }}>
              <T s={17} w={700} c="#fff">{running ? 'Testing…' : done ? 'Test again' : 'Test speed now'}</T>
              {!running && !done ? <ArrowRight size={20} color="#fff" /> : null}
            </Pressable>
            {done ? <LinkButton label="Report slow speed" c="#7DD3FC" onPress={report} style={{ alignSelf: 'center' }} /> : null}
          </View>
        </View>

        <View onLayout={(e) => (stageY.current = e.nativeEvent.layout.y)} style={{ ...glass, borderRadius: 28, padding: 16, alignItems: 'center', gap: 12 }}>
          <Pressable testID="speed-dial" accessibilityRole="button" accessibilityLabel="Tap the dial to start the speed test" onPress={start} style={{ width: '100%', maxWidth: 300 }}>
            <Gauge value={live} />
          </Pressable>
          <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: done ? qColor : 'rgba(255,255,255,0.2)', backgroundColor: qBg, paddingHorizontal: 20, paddingVertical: 7 }}>
            {done ? <Check size={16} color={qColor} /> : null}
            <T testID="speed-phase" s={15} w={700} c={qColor} center style={{ flexShrink: 1 }}>{qLabel}</T>
          </View>
          <View style={{ flexDirection: 'row', width: '100%', maxWidth: 330 }}>
            {['Ping', 'Download', 'Upload'].map((label, i) => {
              const n = i + 1;
              const on = step === n;
              const ok = step > n || step === 4;
              return (
                <View key={label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                  {i > 0 ? <View style={{ position: 'absolute', right: '50%', top: 12, width: '100%', height: 1, backgroundColor: ok || on ? 'rgba(52,211,153,0.6)' : 'rgba(255,255,255,0.15)' }} /> : null}
                  <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', borderColor: ok ? '#34D399' : on ? '#38BDF8' : 'rgba(255,255,255,0.25)', backgroundColor: ok ? '#10B981' : on ? '#12457A' : '#0B1738' }}>
                    {ok ? <Check size={14} color="#fff" /> : <T s={11} lh={14} c="#fff" raw>{n}</T>}
                  </View>
                  <T s={13} w={600} c={colors.heroText}>{label}</T>
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {stats.map(([label, Icon, v, unit, decimals]) => (
            <View key={label} style={{ ...glass, width: '47%', flexGrow: 1, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: 'rgba(23,50,122,0.7)', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={20} color="#BAE6FD" />
              </View>
              <View style={{ flex: 1 }}>
                <T s={11.5} w={700} c={dim} caps={0.6} numberOfLines={1} adjustsFontSizeToFit>{label}</T>
                <Row gap={4} wrap={false} style={{ alignItems: 'baseline' }}>
                  <T testID={'speed-' + label.toLowerCase()} f="display" s={20} w={800} c="#fff" raw numberOfLines={1}>{v == null ? '–' : v.toFixed(decimals)}</T>
                  <T s={13} w={700} c="#fff" raw>{unit}</T>
                </Row>
              </View>
            </View>
          ))}
        </View>

        <View style={{ ...glass, borderRadius: 24, padding: 16, gap: 12 }}>
          <T f="display" s={20} w={800} c="#fff">What can you do at</T>
          <T f="display" s={20} w={800} c="#2F9BFF" style={{ marginTop: -12 }}>{done ? `${Math.round(result.down!)} Mbps?` : 'your speed?'}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
            {USES.map((u) => {
              const s = fit(u);
              return (
                <View key={u.k} style={{ width: '50%', alignItems: 'center', gap: 4 }}>
                  <u.Icon size={28} color={s ? '#BAE6FD' : '#5F7AB0'} />
                  <T s={13} w={700} c="#fff" center>{u.k}</T>
                  <T s={14} w={700} c={s ? fitColor[s] : '#6F86B8'} center>{s ? `✓ ${s}` : 'Run the test'}</T>
                </View>
              );
            })}
          </View>
        </View>
        {!user ? (
          <Row gap={4} style={{ justifyContent: 'center' }}>
            <LinkButton label="Log in" s={13} c="#7DD3FC" onPress={() => openLogin(overlay)} />
            <T s={13} c="#8CA0C8">to save results and report slow speed.</T>
          </Row>
        ) : null}
      </View>
      {running ? (
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', height: 1, width: 1, opacity: 0, overflow: 'hidden' }}>
          <WebView
            key={run}
            originWhitelist={['*']}
            source={{ html: speedPage(), baseUrl: 'https://speed.cloudflare.com/' }}
            onMessage={(e) => onMessage(e.nativeEvent.data)}
            onError={() => fail('Could not load the speed test. Check your internet and try again.')}
            javaScriptEnabled
            setSupportMultipleWindows={false}
          />
        </View>
      ) : null}
    </Screen>
  );
}
