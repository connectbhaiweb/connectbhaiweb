/* One installed connection on the Care plan: status, facts, restart, Wi-Fi change, line test and history. An ONU read
   from Zabbix shows Online / Offline only. */
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { API } from '../../lib/api';
import { fdate, fdt, type Role } from '../../lib/api/base';
import type { Device, FullBooking, SpeedRecord } from '../../lib/api/types';
import { errMsg, useForm } from '../../lib/forms';
import { Input } from '../../ui/forms';
import { Button, Card, Notice, Pill, Row, type Tone } from '../../ui/kit';
import { goTo } from '../../ui/nav';
import { DialogTitle, useGuard, useOverlay } from '../../ui/overlay';
import { T } from '../../ui/text';
import { colors, radius } from '../../ui/theme';
import { planLine } from '../home/planText';
import { Progress, type ActionKind } from './progress';
import { useTicketDialog } from './ticket';

export const stateMsg = (d?: Device | null) =>
  !d ? 'Status refreshed.'
    : d.status_only && d.state === 'unknown' ? 'Status unavailable'
    : d.state === 'online' ? 'Router is online.'
    : d.state === 'offline' ? `Router is offline${d.last_seen ? ' (last seen ' + fdt(d.last_seen) + ')' : ''}.`
    : 'The router has not reported to Genie yet.';

const rx = (v: number | null): [string, Tone] | null => (v == null ? null : v >= -25 ? ['Good', 'ok'] : v >= -27 ? ['Weak', 'warn'] : ['Bad', 'bad']);
const upTime = (h: number | null) => (!h ? 'just restarted' : h < 24 ? Math.round(h) + ' h' : Math.floor(h / 24) + ' d ' + Math.round(h % 24) + ' h');

/** The time now, kept fresh enough for "last seen 5 min ago". */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function DeviceStatus({ d }: { d: Device | null }) {
  const now = useNow();
  if (d?.status_only) return d.state === 'online' ? <Pill label="Online" tone="ok" /> : d.state === 'offline' ? <Pill label="Offline" tone="bad" /> : <Pill label="Status unavailable" tone="grey" />;
  const live = !!d && !d.is_simulated;
  const tag = live ? <Pill label="Live · Genie" tone="blue" /> : null;
  if (!d || d.state === 'unknown') return <Row><Pill label={live ? 'Not reporting to Genie' : 'Not reporting yet'} tone="grey" />{tag}</Row>;
  const m = d.last_seen ? Math.max(0, Math.round((now - new Date(d.last_seen).getTime()) / 60000)) : null;
  return (
    <Row>
      {d.state === 'online' ? <Pill label="Online" tone="ok" /> : <Pill label="Offline" tone="bad" />}
      {tag}
      {m !== null ? <T s={13} c={colors.muted}>{`last seen ${m < 1 ? 'just now' : m < 120 ? m + ' min ago' : fdt(d.last_seen)}`}</T> : null}
    </Row>
  );
}

const Meta = ({ label, value, warn }: { label: string; value: string; warn?: boolean }) => (
  <Row gap={4} style={{ maxWidth: '100%' }}>
    <T s={13.5} c={colors.muted}>{label}</T>
    <T s={13.5} w={700} c={warn ? colors.warn : colors.ink}>{value}</T>
  </Row>
);

function WifiDialog({ ssid, onSend }: { ssid: string; onSend: (ssid: string, password: string) => Promise<void> }) {
  const overlay = useOverlay();
  const [busy, guard] = useGuard();
  const { values: v, errors: e, set, check } = useForm({ ssid: '', password: '' });
  const send = () => {
    const name = v.ssid.trim();
    const pw = v.password;
    const ok = check({
      ssid: !name && !pw ? 'Enter a new name, a new password, or both.' : name && name === ssid ? 'This is the current Wi-Fi name.' : name && !/^[\x20-\x7E]{1,32}$/.test(name) ? 'Up to 32 English letters, digits or symbols.' : '',
      password: pw && (pw.length < 8 || pw.length > 63) ? '8 to 63 characters.' : '',
    });
    if (ok)
      guard(async () => {
        await onSend(name, pw);
        overlay.close();
        overlay.toast('Wi-Fi change sent.');
      });
  };
  return (
    <View style={{ gap: 12 }}>
      <DialogTitle title="Change Wi-Fi name / password" />
      <Notice text="Every phone and laptop on this Wi-Fi will disconnect. After about 1 minute, join the new Wi-Fi name with the new password." />
      <Input label="New Wi-Fi name" placeholder={ssid} hint={`Now: ${ssid || '—'}. Leave empty to keep it.`} value={v.ssid} onChangeText={(x) => set('ssid', x)} error={e.ssid} maxLength={32} autoCapitalize="none" autoCorrect={false} />
      <Input label="New Wi-Fi password" hint="8 to 63 characters. Leave empty to keep it." value={v.password} onChangeText={(x) => set('password', x)} error={e.password} maxLength={63} secureTextEntry autoCapitalize="none" />
      <Button label="Change Wi-Fi" block busy={busy} onPress={send} />
    </View>
  );
}

function RestartDialog({ onSend }: { onSend: () => Promise<void> }) {
  const overlay = useOverlay();
  const [busy, guard] = useGuard();
  return (
    <View style={{ gap: 12 }}>
      <DialogTitle title="Restart modem?" />
      <T c={colors.muted} style={{ marginTop: -10 }}>Internet and Wi-Fi will be off for about 2 minutes while the modem restarts. Phones and laptops reconnect by themselves.</T>
      <Row>
        <Button label="Restart now" busy={busy} onPress={() => guard(async () => { await onSend(); overlay.close(); overlay.toast('Restart sent.'); })} />
        <Button label="Cancel" variant="ghost" onPress={overlay.close} />
      </Row>
    </View>
  );
}

type Acts = Awaited<ReturnType<typeof API.deviceLog>>;

function History({ bookingId, round }: { bookingId: string; round: number }) {
  const [tests, setTests] = useState<SpeedRecord[] | null>(null);
  const [acts, setActs] = useState<Acts | null>(null);
  useEffect(() => {
    let off = false;
    API.speedTests(bookingId).then((x) => !off && setTests(x)).catch(() => !off && setTests([]));
    API.deviceLog(bookingId).then((x) => !off && setActs(x)).catch(() => !off && setActs([]));
    return () => {
      off = true;
    };
  }, [bookingId, round]);
  const line = { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 2, paddingVertical: 4, borderBottomWidth: 1, borderColor: colors.line } as const;
  const head = (text: string) => <T s={13} w={800} c={colors.muted}>{text}</T>;
  return (
    <View style={{ gap: 12, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.line, paddingTop: 8 }}>
      <View style={{ gap: 4 }}>
        {head('Recent speed tests')}
        {!tests ? <T s={13} c={colors.muted}>Loading…</T> : !tests.length ? <T s={13} c={colors.muted}>No speed tests yet.</T> : tests.map((t) => (
          <View key={t.id} style={line}>
            <T s={13} w={700}>{t.kind === 'router' ? 'Line test' : 'Wi-Fi'}</T>
            <T s={13}>{`${t.status === 'done' ? Number(t.download_mbps).toFixed(1) + ' Mbps' : t.status === 'failed' ? 'Failed' : 'Running…'}${t.upload_mbps ? ' ↓ · ' + Number(t.upload_mbps).toFixed(1) + ' ↑' : ''}${t.ping_ms ? ' · ' + Math.round(t.ping_ms) + ' ms' : ''}`}</T>
            <T s={13} c={colors.muted} raw>{fdt(t.created_at)}</T>
          </View>
        ))}
      </View>
      <View style={{ gap: 4 }}>
        {head('Recent modem actions')}
        {!acts ? <T s={13} c={colors.muted}>Loading…</T> : !acts.length ? <T s={13} c={colors.muted}>No restarts or Wi-Fi changes yet.</T> : acts.map((a) => (
          <View key={a.id} style={line}>
            <T s={13} w={700}>{a.action === 'reboot' ? 'Restart' : a.action === 'wifi' ? 'Wi-Fi change' : a.action}</T>
            {a.detail ? <T s={13}>{a.detail}</T> : null}
            <T s={13} c={colors.muted}>{a.status === 'done' ? 'Done' : a.status === 'failed' ? 'Failed' : 'Waiting for the modem'}</T>
            <T s={13} c={colors.muted} raw>{`${a.by_name || ''} · ${fdt(a.created_at)}`}</T>
          </View>
        ))}
      </View>
    </View>
  );
}

export function RouterCard({ b, role, withCustomer, onChanged }: { b: FullBooking; role: Role; withCustomer?: boolean; onChanged: () => void }) {
  const overlay = useOverlay();
  const openTicket = useTicketDialog();
  const [refreshing, guardRefresh] = useGuard();
  const [action, setAction] = useState<{ kind: ActionKind; ssid?: string; n: number } | null>(null);
  const [test, setTest] = useState<{ running: boolean; text: string }>({ running: false, text: '' });
  const [round, setRound] = useState(0);
  const finished = useCallback(() => setRound((n) => n + 1), []);

  const d = b.device;
  const refresh = () =>
    guardRefresh(async () => {
      overlay.toast(stateMsg(await API.refreshDevice(b.id)));
      onChanged();
    });
  const complain = () => openTicket({ booking_id: b.id, title: 'Report modem offline', category: 'No internet', description: `My modem shows Offline in Connect Bhai since ${fdt(new Date().toISOString())}. Please check the line.` });
  const title = (
    <View style={{ gap: 2 }}>
      <T w={800}>{`${withCustomer && b.lead ? b.lead.name + ' · ' : ''}${planLine(b.plan)}`}</T>
      <T f="mono" s={13} c={colors.muted} raw style={{ textAlign: 'right' }}>{b.connection_ref || b.ref_code}</T>
    </View>
  );
  const who = withCustomer && b.lead ? <T s={13.5} c={colors.muted} raw>{`${b.lead.phone} · ${b.lead.pincode || ''}`}</T> : null;

  if (d?.status_only)
    return (
      <Card pad={16} gap={8} style={{ borderRadius: radius.md }}>
        {title}
        <DeviceStatus d={d} />
        {who}
        <Meta label="ONT serial" value={d.serial} />
        <Row>
          <Button label="Refresh status" variant="ghost" small busy={refreshing} onPress={refresh} />
          {role === 'customer' && d.state === 'offline' ? <Button label="Raise complaint" variant="danger" small onPress={complain} /> : null}
        </Row>
      </Card>
    );

  const linked = !!d?.acs;
  const active = d?.active !== false;
  const on = d?.state === 'online';
  const off = d?.state === 'offline';
  const canAct = linked && role !== 'dsa';
  const quality = linked ? rx(d!.rx_dbm) : null;
  const weak = !!quality && quality[0] !== 'Good';
  const manyRestarts = linked && (d!.reboots_7d || 0) >= 3;
  const send = async (kind: ActionKind, params?: { ssid?: string; password?: string }) => {
    const result = await API.deviceAction(b.id, kind, params);
    setAction((a) => ({ kind, ssid: params?.ssid || result.ssid || '', n: (a?.n || 0) + 1 }));
    finished();
  };
  const routerTest = async () => {
    setTest({ running: true, text: 'The router is downloading a test file. This can take 1–5 minutes.' });
    try {
      const t = await API.routerTest(b.id, () => setTest({ running: true, text: 'Waiting for the modem to check in with Genie (up to 5 minutes)…' }));
      setTest({ running: false, text: `Router speed: ${Number(t.download_mbps).toFixed(1)} Mbps (line speed, without Wi-Fi).` });
      finished();
    } catch (e) {
      setTest({ running: false, text: errMsg(e) });
    }
  };

  return (
    <Card pad={16} gap={8} style={{ borderRadius: radius.md }}>
      {title}
      <DeviceStatus d={d} />
      {quality ? <Pill label={`Fiber signal ${quality[0]} · ${Number(d!.rx_dbm).toFixed(1)} dBm`} tone={quality[1]} /> : null}
      <Button label="Refresh status" variant="ghost" small busy={refreshing} disabled={!linked} onPress={refresh} />
      <View style={{ gap: 2 }}>
        {who}
        <Meta label="ONT serial" value={b.ont_serial || 'not linked'} />
        {linked ? <Meta label="Genie" value={d!.acs === 'partner' ? (b.tip ? `${b.tip.name}'s Genie` : `Partner's Genie`) : 'Connect Bhai Genie'} /> : b.ont_serial ? <Meta label="ACS" value="not set for this TIP" warn /> : null}
        {d?.model ? <Meta label="Modem" value={`${d.make} ${d.model}`.trim()} /> : null}
        <Meta label="Installed" value={fdate(b.installed_at)} />
        {b.tip ? <Meta label="Installer" value={b.tip.name} /> : null}
      </View>
      {linked ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(
            [
              ['Wi-Fi name', d!.ssid || '—'],
              ['Devices on Wi-Fi', on ? String(d!.clients ?? '—') : '0'],
              ['Running for', on ? upTime(d!.uptime_h) : 'Offline'],
              ['Restarts 7 / 30 days', `${d!.reboots_7d || 0} / ${d!.reboots_30d || 0}`],
            ] as const
          ).map(([label, value]) => (
            <View key={label} style={{ width: '100%', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, borderRadius: radius.input, paddingHorizontal: 10, paddingVertical: 8 }}>
              <T s={11.5} w={800} c={colors.muted} caps={0.6}>{label}</T>
              <T s={14} w={700}>{value}</T>
            </View>
          ))}
        </View>
      ) : null}
      {weak ? <Notice text={`Fiber signal is ${quality![0].toLowerCase()} (${Number(d!.rx_dbm).toFixed(1)} dBm; good is −25 dBm or better). ${role === 'customer' ? 'Your installer can see this and will check the fiber.' : 'Check the fiber connector, patch cord and splitter before the customer complains.'}`} /> : null}
      {manyRestarts && role !== 'customer' ? <Notice text={`Restarted ${d!.reboots_7d} times in 7 days. Check the power adapter or the modem.`} /> : null}
      <Row>
        {canAct ? (
          <>
            <Button label="Restart modem" small disabled={!on} onPress={() => overlay.open(<RestartDialog onSend={() => send('reboot')} />)} />
            <Button label="Change Wi-Fi name / password" variant="soft" small disabled={!on} onPress={() => overlay.open(<WifiDialog ssid={d!.ssid || ''} onSend={(ssid, password) => send('wifi', { ssid, password })} />)} />
          </>
        ) : null}
        <Button label={test.running ? 'Router test running…' : 'Line speed test'} variant="ghost" small disabled={!(linked && active && on) || test.running} onPress={routerTest} />
        {withCustomer ? null : <Button label="Wi-Fi speed test" variant="ghost" small onPress={() => goTo('/speed')} />}
        {role === 'customer' && off ? <Button label="Raise complaint" variant="danger" small onPress={complain} /> : null}
      </Row>
      {!linked ? (
        <T s={13.5} c={colors.muted}>{b.ont_serial ? 'Genie is not set up for this TIP yet. Admin sets it under Care plan → Genie setup.' : 'Not linked yet: the installer adds the ONT serial when marking the installation complete.'}</T>
      ) : !active ? (
        <T s={13.5} c={colors.muted}>Care plan is not active for this modem, so restart, Wi-Fi change and the line test are off.</T>
      ) : !on ? (
        <T s={13.5} c={colors.muted}>
          {off ? 'The modem is offline. ' : 'The modem has not reported yet. '}
          {'Restart, Wi-Fi change and the line test need it online. Refresh status to check again.'}
        </T>
      ) : null}
      {test.text ? <T s={13.5} accessibilityLiveRegion="polite">{test.text}</T> : null}
      {action ? <Progress key={action.n} bookingId={b.id} kind={action.kind} ssid={action.ssid} onFinished={finished} /> : null}
      <History bookingId={b.id} round={round} />
    </Card>
  );
}
