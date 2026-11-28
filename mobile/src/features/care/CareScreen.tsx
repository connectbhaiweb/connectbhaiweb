/* Care plan: the introduction (logged out or DSA), a customer's own modems, and every installed modem for TIP / admin. */
import { Activity, Gauge, Lock, Pencil, RotateCcw, ShieldCheck, SignalHigh, Wifi, Wrench } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { CARE_ART } from '../../content/generated/art';
import { API } from '../../lib/api';
import { tidyArea } from '../../lib/areas';
import type { Role } from '../../lib/api/base';
import { errMsg } from '../../lib/forms';
import { useSession } from '../../lib/session';
import { useAutoRefresh } from '../../lib/useAutoRefresh';
import { useLoad } from '../../lib/useLoad';
import { openLogin } from '../account/login';
import { Screen } from '../../ui/chrome';
import { Button, Card, Chip, Empty, Eyebrow, LoadError, Notice, Pill, Row, Section, Skeleton } from '../../ui/kit';
import { LocalList, ServerList } from '../../ui/list';
import { goTo } from '../../ui/nav';
import { useOverlay } from '../../ui/overlay';
import { T } from '../../ui/text';
import { colors, radius } from '../../ui/theme';
import { RouterCard } from './RouterCard';

const NOTE = `Status marked Live · Genie comes from the modem through Genie, your personal assistant, the Care plan system: the installer's own Genie or Connect Bhai's. Restart and Wi-Fi change are sent as Genie tasks.`;
const OUTAGE_MIN = 3; // offline modems in one area that suggest a line / OLT fault

function Intro({ loggedIn }: { loggedIn: boolean }) {
  const overlay = useOverlay();
  const steps = [
    [Wrench, '01', 'Scans the ONT serial', 'Internet band hua? Aap se pehle Bhai ko pata chalega.'],
    [Activity, '02', 'Modem reports every 5 minutes', `Bhai's Genie spots the problem and messages you on WhatsApp, while Bhai's team gets to work on it.`],
    [Gauge, '03', 'You control it in the app', 'Restart your Wi-Fi, change password and test speed on your app.'],
  ] as const;
  const feats = [[Wifi, 'Online / Offline'], [SignalHigh, 'Fiber signal'], [RotateCcw, 'Restart modem'], [Pencil, 'Wi-Fi name'], [Lock, 'Wi-Fi password'], [Gauge, 'Line speed test']] as const;
  return (
    <Section top={28} bottom={48} style={{ gap: 18 }}>
      <View style={{ alignItems: 'center', height: 200 }}>
        <SvgXml xml={CARE_ART} width="100%" height="100%" />
      </View>
      <View style={{ gap: 10, marginBottom: 10 }}>
        <Eyebrow text="Care plan · Genie, your personal assistant" />
        <T f="display" s={30} w={700} accessibilityRole="header">Connect Bhai Care plan</T>
        <T c={colors.muted}>Keep an eye on your home modem and fix common problems yourself.</T>
        {loggedIn ? (
          <T s={14} c={colors.muted}>Modem status is shown to the customer, the installing TIP and admin, so it is not available for DSA accounts.</T>
        ) : (
          <Button testID="care-login" label="Log in to Care plan" icon={<ShieldCheck size={18} color={colors.white} />} style={{ marginTop: 8 }} onPress={() => openLogin(overlay)} />
        )}
      </View>
      {steps.map(([Icon, n, title, text]) => (
        <Card key={n} gap={6}>
          <View style={{ width: 46, height: 46, borderRadius: radius.card, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
            <Icon size={22} color={colors.blue} />
          </View>
          <T f="mono" s={13} w={600} c={colors.sky} raw style={{ position: 'absolute', top: 18, right: 20 }}>{n}</T>
          <T f="display" s={18} w={700}>{title}</T>
          <T s={15} c={colors.muted}>{text}</T>
        </Card>
      ))}
      <Card pad={16} gap={14}>
        <T f="display" s={18} w={700}>What you can do</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {feats.map(([Icon, label]) => (
            <View key={label} style={{ width: '30%', flexGrow: 1, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, backgroundColor: colors.bg, paddingVertical: 14, paddingHorizontal: 6 }}>
              <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={20} color={colors.blue} />
              </View>
              <T s={13} w={600} center>{label}</T>
            </View>
          ))}
        </View>
      </Card>
    </Section>
  );
}

function Head({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={{ gap: 6, marginBottom: 4 }}>
      <Eyebrow text="Care plan · Genie, your personal assistant" />
      <T f="display" s={24} w={700} accessibilityRole="header">{title}</T>
      <T c={colors.muted}>{sub}</T>
      <Button label="Wi-Fi speed test" variant="ghost" onPress={() => goTo('/speed')} style={{ marginTop: 8 }} />
    </View>
  );
}

function Loading() {
  return (
    <Section top={28} style={{ gap: 14 }}>
      <Skeleton height={14} width="50%" />
      <Skeleton height={30} width="70%" />
      <Skeleton height={90} />
      <Skeleton height={220} />
    </Section>
  );
}

function CustomerCare() {
  const load = useLoad(async () => (await API.myBookings()).filter((b) => b.status === 'installed'), []);
  useAutoRefresh(() => load.reload(true));
  return (
    <Screen onRefresh={load.refresh} refreshing={load.refreshing}>
      {load.loading && !load.data ? (
        <Loading />
      ) : load.error ? (
        <Section top={60}><LoadError title="Could not load router status." message={load.error} onRetry={() => load.reload()} /></Section>
      ) : (
        <Section top={28} bottom={64} style={{ gap: 14 }}>
          <Head title="My Care plan" sub="Live status of your home modem. Restart it, change your Wi-Fi name or password, and test the line speed without Wi-Fi in between." />
          <Notice info text={NOTE} />
          {load.data!.length ? (
            <LocalList items={load.data!} text={(b) => `${b.plan?.name} ${b.plan?.provider.name} ${b.connection_ref || b.ref_code} ${b.ont_serial || ''}`} render={(b) => <RouterCard key={b.id} b={b} role="customer" onChanged={() => load.reload(true)} />} />
          ) : (
            <Empty>
              <T w={800} center>No installed connection yet.</T>
              <T c={colors.muted} center>Your modem appears here after installation.</T>
            </Empty>
          )}
        </Section>
      )}
    </Screen>
  );
}

const FILTERS: [string, string][] = [['all', 'All'], ['offline', 'Offline'], ['weak', 'Weak signal'], ['reboots', '3+ restarts in 7 days'], ['unlinked', 'Not linked']];

function ManyCare({ role }: { role: Role }) {
  const [filter, setFilter] = useState('all');
  const [round, setRound] = useState(0);
  const load = useLoad(async () => {
    const summary = await API.carePlanSummary();
    const areas = new Map<string, string[]>();
    let tips: Awaited<ReturnType<typeof API.adminAcs>> = [];
    if (role === 'admin') {
      try {
        (await API.adminLocations()).forEach((l) => {
          const name = tidyArea(l.area);
          const list = areas.get(l.pincode) || [];
          if (name && !list.some((x) => x.toLowerCase() === name.toLowerCase())) areas.set(l.pincode, [...list, name]);
        });
      } catch {
        /* the cards then show the PIN code only */
      }
      try {
        tips = await API.adminAcs();
      } catch (e) {
        console.warn(errMsg(e));
      }
    }
    return { summary, areas, tips };
  }, [role]);
  const again = () => {
    setRound((n) => n + 1);
    return load.reload(true);
  };
  useAutoRefresh(again);

  if (load.loading && !load.data) return <Screen><Loading /></Screen>;
  if (load.error)
    return (
      <Screen><Section top={60}><LoadError title="Could not load router status." message={load.error} onRetry={() => load.reload()} /></Section></Screen>
    );
  const { summary: sm, areas, tips } = load.data!;
  const zones = (sm.zones as { pincode: string; n: number; on: number; off: number; weak: number }[])
    .map((z) => {
      const names = areas.get(z.pincode) || [];
      return { ...z, pin: z.pincode, name: names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : '') };
    })
    .sort((a, b) => b.off - a.off || b.n - a.n);
  const alerts = zones.filter((z) => z.off >= OUTAGE_MIN);
  const kpi = (label: string, value: number, c: string = colors.ink, small?: string) => (
    <View style={{ width: '47%', flexGrow: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14 }}>
      <T s={12.5} w={800} c={colors.muted} caps={0.7}>{label}</T>
      <T f="display" s={28} w={700} c={c} raw>{value}</T>
      {small ? <T s={13} c={colors.muted}>{small}</T> : null}
    </View>
  );
  return (
    <Screen
      refreshing={load.refreshing}
      onRefresh={async () => {
        setRound((n) => n + 1);
        await load.refresh();
      }}>
      <Section top={28} bottom={64} style={{ gap: 14 }}>
        <Head title={role === 'tip' ? 'Care plan · modems I installed' : 'Care plan · all modems'} sub="Every installed modem through Genie, your personal assistant: online / offline, fiber signal and restarts, by area. Search by customer, phone or reference." />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {kpi('Installed', sm.installed, colors.ink, `${sm.linked} on Genie`)}
          {kpi('Online', sm.online, colors.ok)}
          {kpi('Offline', sm.offline, colors.bad)}
          {kpi('Weak fiber signal', sm.weak, colors.warn)}
        </View>
        {role === 'admin' ? (
          <Card gap={10}>
            <T f="display" s={18} w={700}>Genie setup</T>
            <T s={14} c={colors.muted}>{`Each TIP's modems report to one Genie. Use the TIP's own Genie through its API (nothing changes on the modem), or Connect Bhai's Genie. The app never talks to a modem directly: app → Connect Bhai backend → Genie → modem. It does not touch BSNL's systems.`}</T>
            <LocalList
              items={tips}
              empty="No TIPs yet."
              text={(p) => `${p.name} ${p.firm} ${p.phone}`}
              render={(p) => (
                <View key={p.id} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 14, gap: 8 }}>
                  <T w={800} raw>{p.name}</T>
                  <Row>
                    <Pill label="Connect Bhai Genie" tone="ok" />
                    <Pill label={p.acs_agreement ? 'Written OK on file' : 'Written OK missing'} tone={p.acs_agreement ? 'ok' : 'warn'} />
                  </Row>
                  <Row gap={4}>
                    <T s={13.5} c={colors.muted}>Linked modems</T>
                    <T s={13.5} w={700} raw>{p.linked}</T>
                  </Row>
                </View>
              )}
            />
          </Card>
        ) : null}
        {zones.length ? (
          <Card gap={10}>
            <T f="display" s={18} w={700}>Modems by area</T>
            {alerts.length ? (
              <View style={{ backgroundColor: colors.badSoft, borderRadius: radius.md, padding: 12 }}>
                <T s={14} w={600} c={colors.bad}>
                  {`${alerts.map((z) => z.pin + (z.name ? ' · ' + z.name : '')).join(', ')}: ${OUTAGE_MIN} `}
                  {'or more modems offline together. This usually means a line or OLT fault, not a problem in one home.'}
                </T>
              </View>
            ) : null}
            {zones.slice(0, 4).map((z) => (
              <View key={z.pin} style={{ borderWidth: 1, borderColor: colors.line, borderLeftWidth: 4, borderLeftColor: z.off >= OUTAGE_MIN ? colors.bad : z.off || z.weak ? colors.warn : colors.ok, borderRadius: radius.md, padding: 12, gap: 4 }}>
                <T w={800} raw>{z.pin}</T>
                <T s={13} c={colors.muted}>{`${z.name ? z.name + ' · ' : ''}${z.n} modem${z.n === 1 ? '' : 's'}`}</T>
                <Row gap={6}>
                  <Pill label={`${z.on} online`} tone="ok" />
                  {z.off ? <Pill label={`${z.off} offline`} tone="bad" /> : null}
                  {z.weak ? <Pill label={`${z.weak} weak signal`} tone="warn" /> : null}
                </Row>
              </View>
            ))}
            {zones.length > 4 ? <T s={13} c={colors.muted}>{`Top 4 areas shown, +${zones.length - 4} more. All modems are listed below with search.`}</T> : null}
          </Card>
        ) : null}
        <Row>
          {FILTERS.map(([k, label]) => (
            <Chip key={k} label={label} selected={filter === k} onPress={() => setFilter(k)} />
          ))}
        </Row>
        <Notice info text={NOTE} />
        <ServerList
          key={filter}
          depsKey={`${filter}:${round}`}
          label="Search modems"
          empty="No installed modems yet."
          load={(page, limit, q) => API.pageBookings({ page, limit, q, status: 'installed', devices: true, device: filter === 'all' ? undefined : filter })}
          render={(b) => <RouterCard key={b.id} b={b} role={role} withCustomer onChanged={again} />}
        />
      </Section>
    </Screen>
  );
}

export default function CareScreen() {
  const { ready, user } = useSession();
  if (!ready) return <Screen><Loading /></Screen>;
  if (!user || user.role === 'dsa') return <Screen><Intro loggedIn={!!user} /></Screen>;
  if (user.role === 'customer') return <CustomerCare key={user.id} />;
  return <ManyCare key={user.id} role={user.role} />;
}
