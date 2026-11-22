import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { CalendarDays, ChevronLeft } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Button, Card, Chip, Field, Pill, T } from '@/components/ui';
import { fDate, leadChip, planTitle } from '@/lib/customer';
import { assignDsa, assignTip, bookInstall, completeInstall, startInstall, dayChoices, loadLead, loadPartners, setStatus, tipOptions, type Lead, type Partner, type TipOption } from '@/lib/partner';
import { useSession } from '@/lib/session';
import { colors, font } from '@/lib/theme';

type Panel = '' | 'follow' | 'lost' | 'book' | 'tip' | 'done' | 'dsa';

export default function LeadDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const [lead, setLead] = useState<Lead | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<Panel>('');
  const [day, setDay] = useState(1);
  const [reason, setReason] = useState('');
  const [tips, setTips] = useState<TipOption[]>([]);
  const [tipId, setTipId] = useState<number | null>(null);
  const [tel, setTel] = useState('');
  const [order, setOrder] = useState('');
  const [dsas, setDsas] = useState<Partner[]>([]);
  const [dsaId, setDsaId] = useState<number | null>(null);
  const [conn, setConn] = useState('');
  const [serial, setSerial] = useState('');
  const days = dayChoices();

  const load = useCallback(async () => {
    try { const l = await loadLead(Number(id)); setLead(l); setTel(l.telephoneNo); setOrder(l.orderNo); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await fn(); setPanel(''); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    setBusy(false);
  };
  const openTip = async () => {
    setPanel('tip');
    try { setTips(await tipOptions(Number(id))); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load installers.'); }
  };

  const openDsa = async () => {
    setPanel('dsa');
    try { setDsas((await loadPartners('dsa')).filter((p) => p.status === 'approved')); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load DSAs.'); }
  };
  const mine = user?.role === 'dsa' || user?.role === 'admin' || user?.role === 'tip';
  const installer = user?.role === 'tip' || user?.role === 'admin';
  const assigner = user?.role === 'dsa' || user?.role === 'admin';
  const st = lead?.status;
  const open = st === 'new' || st === 'assigned' || st === 'contacted' || st === 'follow_up';
  const [chip, tone] = st ? leadChip(st) : ['', 'blue' as const];
  const wa = lead ? `https://wa.me/91${lead.phone}?text=${encodeURIComponent(`Namaste ${lead.name}, this is about your Connect Bhai request ${lead.ref}`)}` : '';

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader />
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={s.back} hitSlop={8}><ChevronLeft size={20} color={colors.blue} strokeWidth={2.6} /><Text style={s.backText}>Back</Text></Pressable>
        {!lead && !error && <ActivityIndicator size="large" color={colors.blue} />}
        {lead && (
          <>
            <Card style={{ gap: 10 }}>
              <View style={s.top}><View style={{ flex: 1 }}><Text style={s.name}>{lead.name || 'Customer'}</Text><T v="small">{lead.ref} · {fDate(lead.createdAt)}</T></View><Chip label={chip} tone={tone} /></View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button small kind="call" label="Call" onPress={() => Linking.openURL(`tel:+91${lead.phone}`)} style={{ flex: 1 }} />
                <Button small kind="wa" label="WhatsApp" onPress={() => Linking.openURL(wa)} style={{ flex: 1 }} />
              </View>
              <Row k="Mobile" v={`+91 ${lead.phone}`} />
              <Row k="PIN code" v={`${lead.pincode}${lead.area ? `, ${lead.area}` : ''}`} />
              {!!lead.address && <Row k="Address" v={lead.address} />}
              <Row k="Plan" v={planTitle(lead.plan)} />
              {lead.followUp && st === 'follow_up' && <Row k="Follow-up" v={fDate(lead.followUp)} />}
              {lead.booking && <Row k="Install" v={lead.booking.status === 'installed' ? `Done ${fDate(lead.booking.installedAt)}` : `Scheduled ${fDate(lead.booking.scheduledAt)}`} />}
              {lead.tip && <Row k="Installer" v={lead.tip.firm || lead.tip.name} />}
              {!!lead.telephoneNo && <Row k="Telephone no." v={lead.telephoneNo} />}
              {!!lead.orderNo && <Row k="Order no." v={lead.orderNo} />}
              {!!lead.notes && <Row k="Notes" v={lead.notes} />}
            </Card>

            {mine && open && (
              <Card style={{ gap: 10 }}>
                <T v="h3">What next?</T>
                {st !== 'contacted' && <Button kind="soft" label="Mark as contacted" loading={busy && panel === ''} onPress={() => act(() => setStatus(lead.id, 'contacted'))} />}
                <Button label="Book installation" icon={CalendarDays} onPress={() => setPanel(panel === 'book' ? '' : 'book')} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button small kind="outline" label="Follow up later" onPress={() => setPanel(panel === 'follow' ? '' : 'follow')} style={{ flex: 1 }} />
                  <Button small kind="outline" label="Mark lost" onPress={() => setPanel(panel === 'lost' ? '' : 'lost')} style={{ flex: 1 }} />
                </View>
                {(panel === 'book' || panel === 'follow') && (
                  <View style={{ gap: 10 }}>
                    <T v="label">{panel === 'book' ? 'Install date' : 'Follow up on'}</T>
                    <View style={s.chips}>{days.map((d, i) => <Pill key={d.label} label={d.label} on={day === i} onPress={() => setDay(i)} />)}</View>
                    <Button label={panel === 'book' ? 'Confirm booking' : 'Save follow-up'} loading={busy}
                      onPress={() => act(() => (panel === 'book' ? bookInstall(lead.id, days[day].date) : setStatus(lead.id, 'follow_up', { followUp: days[day].date })))} />
                  </View>
                )}
                {panel === 'lost' && (
                  <View style={{ gap: 10 }}>
                    <Field label="Why was it lost?" value={reason} onChangeText={setReason} placeholder="Reason" />
                    <Button kind="danger" label="Mark as lost" loading={busy} disabled={reason.trim().length < 2} onPress={() => act(() => setStatus(lead.id, 'lost', { note: reason.trim() }))} />
                  </View>
                )}
              </Card>
            )}

            {user?.role === 'admin' && open && (
              <Card style={{ gap: 10 }}>
                <T v="h3">{lead.dsa ? `DSA: ${lead.dsa.name}` : 'No DSA yet'}</T>
                {panel !== 'dsa' ? <Button kind="outline" label={lead.dsa ? 'Change DSA' : 'Assign DSA'} onPress={openDsa} /> : (
                  <View style={{ gap: 10 }}>
                    <View style={s.chips}>{dsas.map((d) => <Pill key={d.id} label={d.name} on={dsaId === d.id} onPress={() => setDsaId(d.id)} />)}</View>
                    <Button label="Assign" loading={busy} disabled={!dsaId} onPress={() => act(() => assignDsa(lead.id, dsaId!))} />
                  </View>
                )}
              </Card>
            )}
            {assigner && st === 'booked' && (
              <Card style={{ gap: 10 }}>
                <T v="h3">{lead.tip ? 'Change installer' : 'Assign an installer'}</T>
                {panel !== 'tip' ? <Button label={lead.tip ? 'Change installer' : 'Assign installer'} onPress={openTip} /> : (
                  <View style={{ gap: 10 }}>
                    <View style={s.chips}>{tips.map((t) => <Pill key={t.id} label={`${t.firm || t.name}${t.covers ? ' ✓' : ''}`} on={tipId === t.id} onPress={() => setTipId(t.id)} />)}</View>
                    <Field label="Telephone number" keyboardType="number-pad" maxLength={11} value={tel} onChangeText={(t) => setTel(t.replace(/\D/g, ''))} />
                    <Field label="Order number" autoCapitalize="characters" maxLength={11} value={order} onChangeText={(t) => setOrder(t.replace(/[^A-Za-z0-9-]/g, ''))} />
                    <Button label="Assign" loading={busy} disabled={!tipId || !tel || !order} onPress={() => act(() => assignTip(lead.id, tipId!, tel, order))} />
                  </View>
                )}
              </Card>
            )}
            {installer && st === 'booked' && lead.booking?.status === 'scheduled' && (
              <Card style={{ gap: 10 }}>
                <T v="h3">Installation</T>
                <T v="small">Scheduled {fDate(lead.booking.scheduledAt)}</T>
                <Button kind="soft" label="I have reached the site" loading={busy && panel === ''} onPress={() => act(() => startInstall(lead.booking!.id))} />
                <Button label="Complete installation" onPress={() => setPanel(panel === 'done' ? '' : 'done')} />
                {panel === 'done' && (
                  <View style={{ gap: 10 }}>
                    <Field label="Connection ID" value={conn} onChangeText={setConn} autoCapitalize="characters" maxLength={60} />
                    <Field label="Router serial (optional)" value={serial} onChangeText={setSerial} autoCapitalize="characters" maxLength={60} />
                    <Button label="Mark installed" loading={busy} disabled={conn.trim().length < 2} onPress={() => act(() => completeInstall(lead.booking!.id, { connectionId: conn, routerSerial: serial }))} />
                  </View>
                )}
              </Card>
            )}
            {!mine && <T v="small">Only the people on this lead can change it.</T>}
          </>
        )}
        {!!error && <T v="small" style={{ color: colors.red, fontSize: 14 }}>{error}</T>}
      </ScrollView>
    </View>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <View style={s.row}><Text style={s.k}>{k}</Text><Text style={s.v}>{v}</Text></View>
);
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  wrap: { padding: 16, gap: 14, paddingBottom: 40 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  backText: { fontFamily: font.bodyBold, fontSize: 15, color: colors.blue },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: font.displayXBold, fontSize: 22, color: colors.ink },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, borderTopWidth: 1, borderTopColor: colors.rowLine, paddingTop: 8 },
  k: { fontFamily: font.body, fontSize: 14, color: colors.muted },
  v: { fontFamily: font.bodyBold, fontSize: 14, color: colors.ink, flexShrink: 1, textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
