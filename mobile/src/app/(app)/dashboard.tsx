import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/text';

import { Button, Card, Chip, ContactButtons, Empty, H2, Muted, Row, Screen, Strong, callSupport, useLoad } from '@/components/ui';
import { api, type Lead, type LeadEvent } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { STEPS, fDate, fDayTime, inr, leadChip, planPrice, planTitle, stepOf } from '@/lib/format';
import { useTheme } from '@/lib/theme';

type Head = { title: string; subtitle: string; right: React.ReactNode };

export default function Home() {
  const { user, signOut } = useAuth();
  const t = useTheme();
  const first = (user?.name || '').split(' ')[0];
  const logout = <Pressable onPress={signOut} accessibilityRole="button" accessibilityLabel="Log out" hitSlop={10}><Ionicons name="log-out-outline" size={26} color={t.muted} /></Pressable>;
  const sub = user?.role === 'customer' ? 'Manage your bookings, payments and service requests' : user?.role === 'admin' ? 'Administrator' : user?.role === 'dsa' ? 'DSA partner' : 'TIP partner';
  const head = { title: `Namaste${first ? ', ' + first : ''}`, subtitle: sub, right: logout };
  return user?.role === 'customer' ? <CustomerHome head={head} /> : user?.role === 'admin' ? <AdminHome head={head} /> : <PartnerHome head={head} role={user?.role === 'tip' ? 'tip' : 'dsa'} />;
}

/* ---------- customer (website CustomerDashboard) ---------- */
const RX = (v: number | string | null | undefined): [string, number, string] | null => {
  if (v == null) return null; const n = Number(v);
  return n >= -25 ? ['Good', 4, '#16A34A'] : n >= -27 ? ['Weak', 2, '#D97706'] : ['Bad', 1, '#DC2626'];
};

function CustomerHome({ head }: { head: Head }) {
  const t = useTheme();
  const [ref, setRef] = useState<number | null>(null);
  const [paying, setPaying] = useState<number | null>(null);
  const [payErr, setPayErr] = useState('');
  const load = useLoad(async () => {
    const [leads, bookings, charges, tickets, devices] = await Promise.all([api.leads(), api.bookings(), api.charges(), api.tickets(), api.devices()]);
    const events: Record<number, LeadEvent[]> = {};
    await Promise.all(leads.map(l => api.leadEvents(l.id).then(e => { events[l.id] = e; }).catch(() => { events[l.id] = []; })));
    const live = bookings.find(b => b.status === 'completed');
    const dev = live ? devices.find(d => d.lead_id === live.lead_id) : undefined;
    const detail = dev ? await api.deviceDetail(dev.id).catch(() => null) : null;
    return { leads, bookings, charges, tickets, events, dev, detail, live };
  });
  const d = load.data;
  const current = d && (d.leads.find(l => l.id === ref) || d.leads.find(l => l.status !== 'lost' && l.status !== 'cancelled') || d.leads[0]);
  const booking = d && current ? d.bookings.find(b => b.lead_id === current.id) : undefined;
  const due = d ? d.charges.filter(c => ['pending', 'due', 'failed'].includes(c.status)) : [];
  const first = (head.title.replace('Namaste, ', '') || '').trim();

  const pay = async (id: number) => {
    setPaying(id); setPayErr('');
    try { await api.payCharge(id); load.reload(); } catch (e) { setPayErr((e as Error).message); }
    setPaying(null);
  };

  return (
    <Screen title="" load={load} scroll>
      {/* header */}
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: t.ink, fontFamily: 'display', fontWeight: '800', fontSize: 28 }}>Namaste{first ? `, ${first}` : ''} 👋</Text>
          {head.right}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: t.blueSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Ionicons name="person" size={13} color={t.blue} /><Text style={{ color: t.blue, fontWeight: '700', fontSize: 12.5 }}>Customer</Text>
        </View>
        <Text style={{ color: t.muted, fontSize: 14.5, lineHeight: 21 }}>Manage your bookings, payments and service requests — all in one place.</Text>
        <View style={{ marginTop: 6 }}><Button label="Find plans" icon="arrow-forward" onPress={() => router.push('/home')} /></View>
      </View>

      {current && d ? <BookingCard lead={current} scheduled={booking?.scheduled_at} events={d.events[current.id] || []} /> : (
        <Card><Empty icon="wifi" title="No bookings yet" hint="Search your PIN code, compare plans and request a connection." /></Card>
      )}

      {/* router status */}
      {d ? (() => {
        const dev = d.dev, installed = !!d.live, on = !!dev && dev.online === true, off = !!dev && dev.online === false;
        const rx = installed && dev ? RX(dev.rx_power_dbm) : null;
        const last = (d.detail?.speed_tests || []).find(x => Number(x.download_mbps));
        const [chip, tone] = !installed ? ['Not installed', 'grey' as const] : on ? ['Online', 'green' as const] : off ? ['Offline', 'red' as const] : ['Unknown', 'grey' as const];
        return (
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Ionicons name="wifi" size={20} color={t.blue} /><H2>Router status</H2></View>
              <Chip label={chip} tone={tone} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{ width: 84, height: 60, borderRadius: 12, backgroundColor: t.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="wifi" size={34} color={on ? t.blue : t.muted} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Muted>Internet speed</Muted>
                <Text style={{ color: t.ink, fontFamily: 'display', fontWeight: '800', fontSize: 24 }}>{last ? `${Math.floor(Number(last.download_mbps))} Mbps` : '—'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {rx ? (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>{[1, 2, 3, 4].map(i => <View key={i} style={{ width: 5, height: 5 + i * 3, borderRadius: 1.5, backgroundColor: i <= rx[1] ? rx[2] : t.line }} />)}</View>
                      <Text style={{ color: t.muted, fontSize: 13 }}>Signal: <Text style={{ color: rx[2], fontWeight: '800' }}>{rx[0]}</Text></Text>
                    </>
                  ) : <Muted>{installed ? 'Signal: not reported yet' : 'Shows after installation'}</Muted>}
                </View>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Button small kind="secondary" icon="refresh" label="Restart router" onPress={() => router.push('/care')} disabled={!(installed && dev && on)} /></View>
              <View style={{ flex: 1 }}><Button small icon="settings" label="Change Wi-Fi" onPress={() => router.push('/care')} disabled={!(installed && dev && on)} /></View>
            </View>
            {installed && !dev ? <Muted>Restart and Wi-Fi change work once your installer links the modem.</Muted> : installed && dev && !on ? <Muted>The modem is offline. Restart and Wi-Fi change need it online.</Muted> : null}
          </Card>
        );
      })() : null}

      {/* payments due */}
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Ionicons name="card" size={20} color={t.blue} /><H2>Payments due</H2></View>
        {due[0] ? (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}><Muted>{due[0].description}</Muted><Text style={{ color: t.ink, fontFamily: 'display', fontWeight: '800', fontSize: 26 }}>{inr(due[0].total_amount)}</Text></View>
              <Chip label={due[0].status === 'failed' ? 'Failed' : 'Due'} tone="red" />
            </View>
            <Muted>{/install/i.test(due[0].description) ? 'Pay to confirm your installation slot.' : `Includes GST · Ref ${due[0].invoice_no || due[0].id}`}{due.length > 1 ? ` · ${due.length - 1} more due` : ''}</Muted>
            {payErr ? <Text style={{ color: t.bad }} accessibilityRole="alert">{payErr}</Text> : null}
            <Button label="Pay now" icon="arrow-forward" onPress={() => pay(due[0].id)} loading={paying === due[0].id} />
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View><Muted>Nothing to pay right now</Muted><Text style={{ color: t.ink, fontFamily: 'display', fontWeight: '800', fontSize: 26 }}>{inr(0)}</Text></View>
              <Chip label="Paid" tone="green" />
            </View>
            <Button small kind="secondary" label="View payments" onPress={() => router.push('/payments')} />
          </>
        )}
        <Muted>Pay securely by UPI, card or net banking.</Muted>
      </Card>

      {/* speed test */}
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: t.blueSoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="speedometer" size={24} color={t.blue} /></View>
        <View style={{ flex: 1 }}><H2>Run speed test</H2><Muted>Check your current internet speed.</Muted></View>
        <Button small label="Test now" onPress={() => router.push('/speed')} />
      </Card>

      {/* support */}
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Ionicons name="headset" size={20} color={t.blue} /><H2>Support</H2></View>
        <Muted>{d && d.tickets.filter(x => ['open', 'in_progress'].includes(x.status)).length ? `${d.tickets.filter(x => ['open', 'in_progress'].includes(x.status)).length} open request(s)` : 'No open complaints.'}</Muted>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button small kind="secondary" icon="headset" label="Complaints" onPress={() => router.push('/tickets')} />
          <Button small kind="secondary" icon="chatbubbles" label="Chat" onPress={() => router.push('/chat')} />
          <Button small kind="secondary" icon="call" label="Call support" onPress={callSupport} />
        </View>
      </Card>

      {/* past requests */}
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Ionicons name="time" size={20} color={t.blue} /><H2>Your past requests</H2></View>
        {d && d.leads.filter(l => l.id !== current?.id).length ? d.leads.filter(l => l.id !== current?.id).map(l => {
          const [chip, tone] = leadChip(l.status);
          return (
            <Pressable key={l.id} onPress={() => setRef(l.id)} accessibilityRole="button" accessibilityLabel={`View details of ${l.ref_code}`}
              style={{ borderTopWidth: 1, borderTopColor: t.line, paddingTop: 10, gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ color: t.blue, fontFamily: 'mono', fontWeight: '600', fontSize: 13 }}>{l.ref_code}</Text>
                <Chip label={chip} tone={tone} />
              </View>
              <Text style={{ color: t.ink, fontWeight: '700' }}>{planTitle(l.plan)}</Text>
              <Muted>{[l.pincode, l.area?.name].filter(Boolean).join(', ')} · {fDate(l.created_at)}</Muted>
            </Pressable>
          );
        }) : <Muted>No other requests yet. Each new connection you request shows up here.</Muted>}
      </Card>
    </Screen>
  );
}

function Person({ label, p, kind, text, store }: { label: string; p?: { name: string; business_name?: string | null; phone?: string | null } | null; kind: string; text: string; store?: boolean }) {
  const t = useTheme();
  const name = p ? (store ? p.business_name || p.name : p.name) : null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: t.line, paddingTop: 12 }}>
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: store ? t.okSoft : t.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
        {p ? <Text style={{ color: store ? t.ok : t.blue, fontWeight: '800' }}>{p.name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}</Text> : <Ionicons name="person" size={20} color={t.muted} />}
      </View>
      <View style={{ flex: 1 }}>
        <Muted>{label}</Muted>
        <Text style={{ color: t.ink, fontWeight: '800' }}>{name || 'Assigned shortly'}</Text>
        <Text style={{ color: t.muted, fontSize: 12.5 }}>{p ? kind : 'You get a WhatsApp message'}</Text>
      </View>
      {p?.phone ? <ContactButtons phone={p.phone} text={text} /> : null}
    </View>
  );
}

function BookingCard({ lead, scheduled, events }: { lead: Lead; scheduled?: string | null; events: LeadEvent[] }) {
  const t = useTheme();
  const [chip, tone] = leadChip(lead.status);
  const at = stepOf(lead), lost = lead.status === 'lost' || lead.status === 'cancelled';
  const when = (s: string) => { const e = [...events].reverse().find(x => x.to_status === s || (s === 'contacted' && x.to_status === 'followup')); return e ? e.created_at : null; };
  const sub = [fDayTime(lead.created_at), lead.tip ? lead.tip.business_name || lead.tip.name : lead.dsa?.name || '', fDayTime(when('contacted')),
    scheduled ? `Installation scheduled ${fDate(scheduled)}` : fDayTime(when('scheduled')), fDayTime(when('installed'))];
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.ink, fontFamily: 'display', fontWeight: '800', fontSize: 18 }}>Booking #{lead.ref_code}</Text>
          <Text style={{ color: t.ink, marginTop: 4 }}><Text style={{ fontWeight: '800' }}>{planTitle(lead.plan)}</Text> · {planPrice(lead.plan)}</Text>
          <Muted>{[lead.pincode, lead.area?.name, 'Indore'].filter(Boolean).join(', ')}</Muted>
        </View>
        <Chip label={chip} tone={tone} />
      </View>
      <View>
        {STEPS.map((label, i) => {
          const state = lost ? 'todo' : i < at || (at === 4 && i === 4) ? 'done' : i === at ? 'now' : 'todo';
          return (
            <View key={label} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: state === 'todo' ? t.lineStrong : t.blue, backgroundColor: state === 'done' ? t.blue : t.surface }}>
                  {state === 'done' ? <Ionicons name="checkmark" size={15} color={t.blueInk} /> : state === 'now' ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: t.blue }} /> : null}
                </View>
                {i < STEPS.length - 1 ? <View style={{ width: 2, flex: 1, minHeight: 14, backgroundColor: state === 'done' ? t.blue : t.line }} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: 10 }}>
                <Text style={{ color: state === 'todo' ? t.muted : t.ink, fontWeight: state === 'now' ? '800' : '700' }}>{label}</Text>
                {state !== 'todo' && sub[i] ? <Muted>{sub[i]}</Muted> : null}
              </View>
            </View>
          );
        })}
      </View>
      {lost ? <Muted>This request was closed. Search your PIN code again to request a new connection.</Muted> : null}
      <Person label="Your agent" p={lead.dsa} kind="DSA · Indore" text={`Namaste, about my Connect Bhai request ${lead.ref_code}`} />
      <Person label="Your installer" p={lead.tip} kind={`${lead.plan?.category?.name ? lead.plan.category.name + ' ' : ''}TIP · Indore`} text={`Namaste, about my connection ${lead.ref_code}`} store />
    </Card>
  );
}

/* ---------- DSA / TIP ---------- */
function PartnerHome({ role, head }: { role: 'dsa' | 'tip'; head: Head }) {
  const load = useLoad(async () => {
    const [leads, commissions, bookings] = await Promise.all([api.leads(), role === 'dsa' ? api.commissions() : Promise.resolve([]), role === 'tip' ? api.bookings() : Promise.resolve([])]);
    return { leads, commissions, bookings };
  }, [role]);
  const d = load.data;
  const count = (...s: string[]) => (d ? d.leads.filter(l => s.includes(l.status)).length : 0);
  const earned = d ? d.commissions.filter(c => c.status === 'paid').reduce((a, c) => a + Number(c.amount), 0) : 0;
  const pending = d ? d.commissions.filter(c => ['pending', 'approved'].includes(c.status)).reduce((a, c) => a + Number(c.amount), 0) : 0;
  const upcoming = d ? d.bookings.filter(b => b.status === 'scheduled' || b.status === 'rescheduled').length : 0;

  return (
    <Screen {...head} load={load}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Stat label="New leads" value={count('new')} tone="blue" />
        <Stat label="In progress" value={count('contacted', 'followup', 'scheduled')} tone="amber" />
        <Stat label="Installed" value={count('installed')} tone="green" />
      </View>
      {role === 'dsa' ? (
        <Card>
          <H2>Commission</H2>
          <Row label="Paid so far" value={inr(earned)} />
          <Row label="Pending / approved" value={inr(pending)} />
          <Button small kind="secondary" label="See commission" onPress={() => router.push('/commission')} />
        </Card>
      ) : (
        <Card>
          <H2>Installations</H2>
          <Row label="Scheduled" value={String(upcoming)} />
          <Button small kind="secondary" label="Open installs" onPress={() => router.push('/bookings')} />
        </Card>
      )}
      {role === 'dsa' ? <Button label="Add a lead" icon="add-circle" onPress={() => router.push('/add-lead')} /> : null}
      <Button label="View all leads" kind="secondary" onPress={() => router.push('/leads')} />
    </Screen>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'amber' | 'green' }) {
  const t = useTheme();
  const c = { blue: t.blue, amber: t.warn, green: t.ok }[tone];
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: 16 }}>
      <Text style={{ color: c, fontSize: 28, fontWeight: '800' }}>{value}</Text>
      <Muted>{label}</Muted>
    </Card>
  );
}

/* ---------- admin ---------- */
function AdminHome({ head }: { head: Head }) {
  return (
    <Screen {...head}>
      <Card>
        <H2>Admin tools are on the web</H2>
        <Muted>The administrator dashboard (partners, billing, plans, locations, reports) is available on the Connect Bhai website. This app is for customers, DSAs and TIP partners.</Muted>
      </Card>
    </Screen>
  );
}
