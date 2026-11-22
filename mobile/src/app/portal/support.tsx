import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { Button, Card, Chip, Field, Pill, T } from '@/components/ui';
import { fDate } from '@/lib/customer';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useCustomer } from '@/lib/useCustomer';
import { CATEGORIES, loadTickets, raiseTicket, type Ticket } from '@/lib/support';
import { PHONE_E164, WA_URL } from '@/lib/site';
import { colors, font } from '@/lib/theme';

/* Website /my/support: contacts (you, agent, installer, admin) and complaints & service requests. */
const TONE: Record<string, 'green' | 'amber' | 'blue' | 'grey'> = { resolved: 'green', closed: 'green', open: 'amber', in_progress: 'blue' };

export default function Support() {
  const { user, data, busy, load } = useCustomer();
  const { reload } = useSession();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const saveProfile = async () => {
    setError('');
    try { await api('PATCH', '/users/me', { name: name.trim(), email: email.trim() || undefined }); await reload(); setEditing(false); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
  };
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [type, setType] = useState<'complaint' | 'service_request'>('complaint');
  const [lead, setLead] = useState<number | null>(null);
  const [cat, setCat] = useState(0);
  const [desc, setDesc] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const refresh = useCallback(async () => { try { setTickets(await loadTickets()); } catch { setTickets([]); } await load(); }, [load]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const leads = (data?.leads ?? []).filter((l) => l.status !== 'lost');
  const act = leads[0];
  const submit = async () => {
    setError(''); setDone('');
    if (type === 'complaint' && !lead) { setError('Choose the connection for a complaint.'); return; }
    if (desc.trim().length < 5) { setError('Describe the issue in a few words.'); return; }
    setSending(true);
    try { const r = await raiseTicket({ leadId: lead ?? undefined, category: CATEGORIES[cat][1], description: desc }); setDone(r.ticket_code); setDesc(''); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    setSending(false);
  };
  const contact = (title: string, name?: string | null, phone?: string | null, empty?: string) => (
    <Card key={title} style={{ gap: 6 }}>
      <T v="eyebrow">{title}</T>
      {name ? (
        <>
          <T v="h3">{name}</T>{!!phone && <T v="small">Mobile +91 {phone}</T>}
          {!!phone && <View style={{ flexDirection: 'row', gap: 8 }}><Button small kind="outline" label="Call" onPress={() => Linking.openURL(`tel:+91${phone}`)} /><Button small kind="wa" label="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/91${phone}`)} /><Button small kind="soft" label="Chat" onPress={() => router.navigate('/portal/chat')} /></View>}
        </>
      ) : <T v="small">{empty ?? ''}</T>}
    </Card>
  );

  return (
    <View style={s.screen}>
      <AppHeader />
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={busy && !!data} onRefresh={refresh} />}>
        <Text style={s.h1}>Complaints & requests</Text>
        {!data && <ActivityIndicator size="large" color={colors.blue} style={{ marginTop: 20 }} />}
        {data && (
          <>
            <Card style={{ gap: 6 }}>
              <T v="eyebrow">You (customer)</T>
              <T v="h3">{user?.name}</T><T v="small">{`Mobile +91 ${user?.phone}`}</T>
              <T v="small">{`Email ${String(user?.email ?? '') || 'not added'}`}</T>
              {!editing ? <Button small kind="outline" label="Edit name / email" onPress={() => { setName(user?.name === 'Customer' ? '' : user?.name ?? ''); setEmail(String(user?.email ?? '')); setEditing(true); }} style={{ alignSelf: 'flex-start' }} /> : (
                <View style={{ gap: 10 }}>
                  <Field label="Full name" value={name} onChangeText={setName} />
                  <Field label="Email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
                  <View style={{ flexDirection: 'row', gap: 8 }}><Button small label="Save" disabled={name.trim().length < 2} onPress={saveProfile} /><Button small kind="ghost" label="Cancel" onPress={() => setEditing(false)} /></View>
                </View>
              )}
            </Card>
            {contact('Your agent (DSA)', act?.dsa?.name, act?.dsa?.phone, act ? 'Assigned shortly. You get a WhatsApp message.' : 'Request a connection first.')}
            {contact('TIP (installer)', act?.tip?.name, act?.tip?.phone, act ? 'Finding an installer. Their name and number show here once assigned.' : 'Request a connection first.')}
            <Card style={{ gap: 6 }}>
              <T v="eyebrow">Connect Bhai admin</T><T v="h3">Connect Bhai Support</T>
              <View style={{ flexDirection: 'row', gap: 8 }}><Button small kind="outline" label="Call" onPress={() => Linking.openURL(`tel:${PHONE_E164}`)} /><Button small kind="wa" label="WhatsApp" onPress={() => Linking.openURL(WA_URL)} /></View>
            </Card>

            {tickets === null ? <ActivityIndicator color={colors.blue} /> : tickets.length === 0 ? (
              <Card><T v="h3">No complaints or requests.</T></Card>
            ) : tickets.map((t) => (
              <Card key={t.id} style={{ gap: 8 }}>
                <View style={s.row}><T v="h3" style={{ flex: 1, textTransform: 'capitalize' }}>{t.category}</T><Chip label={t.status.replace(/_/g, ' ')} tone={TONE[t.status] ?? 'grey'} /></View>
                <T>{t.description}</T>
                <T v="small">{`${t.code} · Raised ${fDate(t.createdAt)}`}</T>
              </Card>
            ))}

            <Card style={{ gap: 12 }}>
              <T v="h2">Raise a complaint or service request</T>
              <T v="label">Type</T>
              <View style={s.chips}><Pill label="Complaint" on={type === 'complaint'} onPress={() => setType('complaint')} /><Pill label="Service request" on={type === 'service_request'} onPress={() => setType('service_request')} /></View>
              <T v="label">Connection</T>
              <View style={s.chips}>{leads.length ? leads.map((l) => <Pill key={l.id} label={`${l.ref} · ${l.plan?.name ?? ''}`} on={lead === l.id} onPress={() => setLead(lead === l.id ? null : l.id)} />) : <T v="small">No connection yet</T>}</View>
              <T v="label">Category</T>
              <View style={s.chips}>{CATEGORIES.map(([l], i) => <Pill key={l} label={l} on={cat === i} onPress={() => setCat(i)} />)}</View>
              <Field label="Describe the issue" placeholder="What is happening and since when?" multiline maxLength={1000} value={desc} onChangeText={setDesc} />
              {!!error && <T v="small" style={{ color: colors.bad, fontSize: 14 }}>{error}</T>}
              {!!done && <T v="small" style={{ color: colors.green, fontSize: 14 }}>{`Submitted. Your ticket number is ${done}.`}</T>}
              <Button label="Submit" loading={sending} onPress={submit} />
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, wrap: { padding: 12, gap: 10, paddingBottom: 40 },
  h1: { fontFamily: font.displayXBold, fontSize: 23, color: colors.ink, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
