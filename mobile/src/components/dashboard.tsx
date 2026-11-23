import { router } from 'expo-router';
import { ArrowRight, CalendarDays, Check, ChevronRight, CircleCheck, CircleX, Clock, CreditCard, FileText, Gauge, KeyRound, MapPin, Phone, Store, UserCheck, RotateCw, UserRound, Wifi } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, Field, T } from '@/components/ui';
import { inr } from '@/lib/catalog';
import { payPlan } from '@/lib/pay';
import { changeWifi, restartRouter, runSpeedTest, type SpeedResult } from '@/lib/router';
import { useSession } from '@/lib/session';
import { STEPS, STEP_OF, fDate, fDayTime, leadChip, planTitle, type Charge, type Device, type Lead, type Person } from '@/lib/customer';
import { colors, font } from '@/lib/theme';

const STEP_ICON = [FileText, UserCheck, Phone, CalendarDays, Wifi] as const;
const TONE_ICON = { green: CircleCheck, red: CircleX, blue: CalendarDays, amber: CalendarDays } as const;
const cityOf = (pin: string) => (/^452/.test(pin) ? 'Indore' : '');

export function BookingCard({ lead, onPaid }: { lead: Lead; onPaid?: () => void }) {
  const { user } = useSession();
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const pay = async () => {
    setPaying(true); setPayError('');
    try { await payPlan(lead.id, { name: user?.name, phone: user?.phone }); onPaid?.(); }
    catch (e) { setPayError(e instanceof Error ? e.message : 'Payment failed.'); }
    setPaying(false);
  };
  const [chip, tone] = leadChip(lead.status);
  const at = STEP_OF[lead.status] ?? 0, lost = lead.status === 'lost';
  const sub = [fDayTime(lead.createdAt), lead.tip ? lead.tip.firm || lead.tip.name : lead.dsa?.name ?? '', '', lead.booking?.scheduledAt ? `Scheduled ${fDate(lead.booking.scheduledAt)}` : '', lead.booking?.installedAt ? fDayTime(lead.booking.installedAt) : ''];
  const ChipIcon = TONE_ICON[tone];
  return (
    <Card style={{ padding: 12, gap: 12, borderRadius: 14 }}>
      <View style={s.top}>
        <View style={s.ico}><Wifi size={28} color="#2B7BFF" strokeWidth={2.4} /></View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.bkTitle}>Booking #{lead.ref}</Text>
          <Text style={s.plan}>{planTitle(lead.plan)}</Text>
          {lead.plan && <Text style={s.planPrice}>{inr(lead.plan.price)}/month + GST</Text>}
          <View style={s.loc}><MapPin size={13} color={colors.text} strokeWidth={2.2} /><Text style={s.locText} numberOfLines={1}>{[lead.pincode, lead.area, cityOf(lead.pincode)].filter(Boolean).join(', ')}</Text></View>
          {(lead.telephoneNo || lead.orderNo) && (
            <Text style={s.small}>Telephone no. <Text style={s.bold}>{lead.telephoneNo || '—'}</Text>  ·  Order no. <Text style={s.bold}>{lead.orderNo || '—'}</Text></Text>
          )}
        </View>
      </View>
      <View style={{ alignItems: 'flex-start' }}><Chip label={chip} tone={tone} icon={ChipIcon} /></View>

      <View style={s.track}>
        {STEPS.map(([k, label], i) => {
          const state = lost ? 'todo' : i < at || (at === 4 && i === 4) ? 'done' : i === at ? 'now' : 'todo';
          const Ico = STEP_ICON[i];
          return (
            <View key={k} style={s.step}>
              {i > 0 && <View style={[s.link, state !== 'todo' ? { backgroundColor: i <= at && !lost ? '#35A75E' : colors.stepOff } : null, state === 'now' && { backgroundColor: '#35A75E' }]} />}
              <View style={[s.node, state === 'done' && { backgroundColor: colors.green }, state === 'now' && s.nodeNow, state === 'todo' && s.nodeTodo]}>
                {state === 'done' ? <Check size={15} color="#fff" strokeWidth={3} /> : state === 'now' ? <Ico size={15} color="#fff" strokeWidth={2.4} /> : null}
              </View>
              <View style={[s.stepTxt, state === 'now' && s.stepNow]}>
                <Text style={[s.stepLabel, state === 'now' && { color: '#1150E0' }, lost && { color: '#7A869F' }]} numberOfLines={1}>{label}</Text>
                {state !== 'todo' && !!sub[i] && <Text style={[s.stepSub, state === 'now' && { color: '#1150E0' }]} numberOfLines={2}>{sub[i]}</Text>}
              </View>
            </View>
          );
        })}
      </View>
      {lost && <T v="small" style={{ color: colors.red }}>This request was closed. Search your PIN code again to request a new connection.</T>}

      {!lost && lead.plan && lead.plan.price > 0 && (
        <View style={s.pay}>
          <View style={{ flex: 1 }}>
            <Text style={s.payTitle}>{lead.payment ? 'Plan paid' : 'Your plan payment'}</Text>
            <Text style={s.small}>{lead.payment ? `${inr(lead.payment.amount)}${lead.payment.paidAt ? ` · ${fDate(lead.payment.paidAt)}` : ''}` : `${inr(lead.plan.price)} incl. GST · pay Connect Bhai directly`}</Text>
          </View>
          {lead.payment ? <Chip label="Paid" tone="green" icon={Check} /> : <Button small label={paying ? 'Opening…' : 'Pay now'} disabled={paying} onPress={pay} />}
        </View>
      )}
      {!!payError && <T v="small" style={{ color: colors.red }}>{payError}</T>}

      <View style={{ gap: 8 }}>
        {lead.dsa && <PersonRow label="Your agent" p={lead.dsa} kind="DSA" city={cityOf(lead.pincode)} text={`Namaste, about my Connect Bhai request ${lead.ref}`} />}
        <PersonRow label="Your installer" p={lead.tip} kind="Installation partner" city={cityOf(lead.pincode)} text={`Namaste, about my connection ${lead.ref}`} store />
      </View>
    </Card>
  );
}

function PersonRow({ label, p, kind, city, text, store }: { label: string; p: Person | null; kind: string; city: string; text: string; store?: boolean }) {
  const name = p ? (store ? p.firm || p.name : p.name) : null;
  const initials = p ? p.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() : '';
  const Ava = store ? Store : UserRound;
  return (
    <View style={s.person}>
      <View style={[s.ava, store && { backgroundColor: '#E9F0FE' }]}>{p && !store ? <Text style={s.avaText}>{initials}</Text> : <Ava size={20} color={store ? '#1E5FEA' : colors.ink} />}</View>
      <View style={{ flex: 1 }}>
        <Text style={s.small}>{label}</Text>
        <Text style={s.personName} numberOfLines={1}>{name || 'Finding an installer'}</Text>
        <Text style={s.small} numberOfLines={1}>{p ? [kind, city].filter(Boolean).join(' · ') : 'Shown here once assigned'}</Text>
      </View>
      {p?.phone ? (
        <View style={{ gap: 6 }}>
          <Button small kind="call" icon={Phone} label="Call" onPress={() => Linking.openURL(`tel:+91${p.phone}`)} style={s.act} />
          <Button small kind="wa" label="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/91${p.phone}?text=${encodeURIComponent(text)}`)} style={s.act} />
        </View>
      ) : null}
    </View>
  );
}

export function NoBooking() {
  return (
    <Card style={{ gap: 12, alignItems: 'flex-start' }}>
      <View style={s.ico}><Wifi size={28} color="#2B7BFF" strokeWidth={2.4} /></View>
      <T v="h2">No bookings yet</T>
      <T v="small" style={{ fontSize: 14.5 }}>Search your PIN code, compare plans and request a connection.</T>
      <Button label="Find plans" iconRight={ArrowRight} onPress={() => router.navigate('/')} />
    </Card>
  );
}

const rxOf = (v: number | null): [string, string] | null => (v == null ? null : v >= -25 ? ['Good', '#15803D'] : v >= -27 ? ['Weak', '#B45309'] : ['Bad', '#B91C1C']);
export function RouterCard({ lead, device }: { lead: Lead | undefined; device: Device | undefined }) {
  const installed = lead?.booking?.status === 'installed';
  const on = device?.online === true, off = device?.online === false;
  const [chip, tone] = !installed ? (['Not installed', 'grey'] as const) : on ? (['Online', 'green'] as const) : off ? (['Offline', 'red'] as const) : (['Status unavailable', 'grey'] as const);
  const rx = installed ? rxOf(device?.rxDbm ?? null) : null;
  const [busy, setBusy] = useState<'' | 'restart' | 'wifi' | 'speed'>('');
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [wifi, setWifi] = useState(false);
  const [ssid, setSsid] = useState('');
  const [pw, setPw] = useState('');
  const [speed, setSpeed] = useState<SpeedResult | null>(null);
  const live = installed && !!lead?.carePlan && !!device;

  const run = async (kind: 'restart' | 'wifi' | 'speed', fn: () => Promise<string | void>) => {
    setBusy(kind); setNote(null);
    try { const t = await fn(); if (t) setNote({ ok: true, text: t }); }
    catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong.' }); }
    setBusy('');
  };
  const restart = () => Alert.alert('Restart router?', 'Your internet will drop for about 2 minutes.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Restart', style: 'destructive', onPress: () => run('restart', async () => { await restartRouter(device!.id); return 'Restart sent. It runs when the router next checks in (about a minute).'; }) },
  ]);
  const saveWifi = () => {
    if (!ssid.trim() || (pw && pw.length < 8)) { setNote({ ok: false, text: 'Enter a Wi-Fi name, and a password of at least 8 characters.' }); return; }
    run('wifi', async () => { await changeWifi(device!.id, ssid.trim(), pw); setWifi(false); setSsid(''); setPw(''); return 'Wi-Fi change sent. Devices reconnect after it applies.'; });
  };
  const test = () => run('speed', async () => { setSpeed(null); setSpeed(await runSpeedTest(device!.id)); });

  return (
    <Card style={{ gap: 10, padding: 12, borderRadius: 14 }}>
      <View style={s.head}><View style={s.h2}><Wifi size={20} color={colors.actionInk} strokeWidth={2.6} /><Text style={s.h2Text}>Router status</Text></View><Chip dot label={chip} tone={tone} /></View>
      <Text style={s.small}>
        {installed ? (rx ? <>Signal: <Text style={{ fontFamily: font.bodyXBold, color: rx[1] }}>{rx[0]}</Text></> : 'Signal: not reported yet') : 'Shows after installation'}
      </Text>
      {installed && !lead?.carePlan && <T v="small">Activate the Care plan to see live status and manage your router.</T>}
      {live && (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button small kind="outline" icon={RotateCw} label="Restart" loading={busy === 'restart'} disabled={!!busy || off} onPress={restart} style={{ flex: 1 }} />
            <Button small kind="outline" icon={KeyRound} label="Wi-Fi" disabled={!!busy || off} onPress={() => { setNote(null); setWifi(!wifi); }} style={{ flex: 1 }} />
            <Button small kind="outline" icon={Gauge} label="Speed" loading={busy === 'speed'} disabled={!!busy} onPress={test} style={{ flex: 1 }} />
          </View>
          {wifi && (
            <View style={{ gap: 10 }}>
              <Field label="New Wi-Fi name" value={ssid} onChangeText={setSsid} autoCapitalize="none" autoCorrect={false} maxLength={32} />
              <Field label="New password (optional)" value={pw} onChangeText={setPw} autoCapitalize="none" autoCorrect={false} secureTextEntry maxLength={63} />
              <Button label="Save Wi-Fi" loading={busy === 'wifi'} onPress={saveWifi} />
            </View>
          )}
          {busy === 'speed' && <T v="small">Testing your line. This can take 1 to 3 minutes…</T>}
          {speed && (
            <View style={s.speedRow}>
              <View style={s.speedCell}><Text style={s.speedNum}>{speed.down ?? '–'}</Text><Text style={s.small}>Download Mbps</Text></View>
              <View style={s.speedCell}><Text style={s.speedNum}>{speed.up ?? '–'}</Text><Text style={s.small}>Upload Mbps</Text></View>
              <View style={s.speedCell}><Text style={s.speedNum}>{speed.ping ?? '–'}</Text><Text style={s.small}>Ping ms</Text></View>
            </View>
          )}
          {speed?.simulated && <T v="small">Simulated result (test environment).</T>}
          {off && <T v="small">The router is offline, so restart and Wi-Fi change are unavailable.</T>}
          {note && <T v="small" style={{ color: note.ok ? colors.greenInk : colors.red }}>{note.text}</T>}
        </View>
      )}
    </Card>
  );
}

export function PaymentsCard({ charges }: { charges: Charge[] }) {
  const due = charges.filter((c) => ['due', 'failed'].includes(c.status));
  const c = due[0];
  const last = charges.filter((x) => x.status === 'paid').sort((a, b) => String(b.paidAt ?? '').localeCompare(String(a.paidAt ?? '')))[0];
  return (
    <Card style={{ gap: 8, padding: 12, borderRadius: 14 }}>
      <View style={s.h2}><CreditCard size={20} color={colors.actionInk} strokeWidth={2.4} /><Text style={s.h2Text}>Payments due</Text></View>
      <View style={s.payRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.small}>{c ? c.description : last ? 'Last payment' : 'No payments yet'}</Text>
          <Text style={s.amt}>{inr(c ? c.amount : last ? last.amount : 0)}</Text>
        </View>
        <Chip label={c ? (c.status === 'failed' ? 'Failed' : 'Due') : last ? 'Paid' : 'Nothing due'} tone={c ? 'red' : last ? 'green' : 'blue'} />
      </View>
      <Text style={s.small}>{c ? `Includes GST · Ref ${c.ref}` : last ? `Nothing due right now${last.paidAt ? ` · paid ${fDate(last.paidAt)}` : ''}` : 'Charges show here when there is something to pay.'}</Text>
    </Card>
  );
}

export function PastRequests({ leads, onOpen }: { leads: Lead[]; onOpen: (l: Lead) => void }) {
  return (
    <Card style={{ padding: 12, gap: 4, borderRadius: 14 }}>
      <View style={s.h2}><Clock size={20} color={colors.actionInk} strokeWidth={2.4} /><Text style={s.h2Text}>Your past requests</Text></View>
      {leads.length ? leads.map((l, i) => {
        const [label, tone] = leadChip(l.status);
        return (
          <Pressable key={l.id} onPress={() => onOpen(l)} style={[s.past, i > 0 && { borderTopWidth: 1, borderColor: colors.rowLine }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.pastRef}>{l.ref}</Text>
              <Text style={s.pastPlan} numberOfLines={1}>{planTitle(l.plan)}</Text>
              <Text style={s.small}>{l.pincode} · {fDate(l.createdAt)}</Text>
            </View>
            <Chip label={label === 'Request received' ? 'Requested' : label} tone={tone} />
            <ChevronRight size={18} color={colors.actionInk} />
          </Pressable>
        );
      }) : <T v="small" style={{ paddingVertical: 8 }}>No other requests yet. Each new connection you request shows up here.</T>}
    </Card>
  );
}

const s = StyleSheet.create({
  speedRow: { flexDirection: 'row', gap: 8 },
  speedCell: { flex: 1, backgroundColor: colors.blueSoft, borderRadius: 12, padding: 10, alignItems: 'center' },
  speedNum: { fontFamily: font.displayXBold, fontSize: 22, color: colors.ink },
  top: { flexDirection: 'row', gap: 10 },
  ico: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#E5EDFE', alignItems: 'center', justifyContent: 'center' },
  bkTitle: { fontFamily: font.display, fontSize: 17, color: colors.ink },
  plan: { fontFamily: font.bodyXBold, fontSize: 13.5, color: colors.ink },
  planPrice: { fontFamily: font.body, fontSize: 13, color: colors.text },
  loc: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: colors.loc, borderRadius: 8, paddingHorizontal: 8, height: 24, maxWidth: '100%' },
  locText: { fontFamily: font.body, fontSize: 12, color: colors.text, flexShrink: 1 },
  small: { fontFamily: font.body, fontSize: 12.5, color: colors.muted },
  bold: { fontFamily: font.bodyXBold, color: colors.ink },
  track: { flexDirection: 'row', marginHorizontal: -4, marginTop: 4 },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  link: { position: 'absolute', top: 13, right: '50%', left: '-50%', marginRight: 13, marginLeft: 13, height: 2, borderRadius: 1, backgroundColor: colors.stepOff },
  node: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  nodeNow: { width: 30, height: 30, borderRadius: 15, marginTop: -1, backgroundColor: '#0A5CFB', shadowColor: '#0A5CFB', shadowOpacity: 0.35, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
  nodeTodo: { width: 26, height: 26, borderRadius: 13, marginTop: 1, backgroundColor: '#fff', borderWidth: 2, borderColor: colors.stepOff },
  stepTxt: { alignItems: 'center', paddingHorizontal: 1, gap: 2 },
  stepNow: { backgroundColor: '#E2ECFD', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 3, alignSelf: 'stretch' },
  stepLabel: { fontFamily: font.bodyXBold, fontSize: 11, color: colors.ink },
  stepSub: { fontFamily: font.body, fontSize: 10, textAlign: 'center', color: '#2A3656', lineHeight: 13 },
  pay: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bg, borderRadius: 12, padding: 10 },
  payTitle: { fontFamily: font.bodyXBold, fontSize: 14, color: colors.ink },
  person: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#E3E9F5', borderRadius: 12, padding: 9 },
  ava: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#DCE6FF', alignItems: 'center', justifyContent: 'center' },
  avaText: { fontFamily: font.display, fontSize: 13, color: '#0B1A4A' },
  personName: { fontFamily: font.display, fontSize: 14, color: colors.ink },
  act: { width: 104, height: 32 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  h2: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  h2Text: { fontFamily: font.display, fontSize: 16, color: colors.ink },
  payRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 },
  amt: { fontFamily: font.display, fontSize: 21, color: colors.ink },
  past: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  pastRef: { fontFamily: font.bodyXBold, fontSize: 13, color: colors.ink },
  pastPlan: { fontFamily: font.bodyMd, fontSize: 13, color: colors.text },
});
