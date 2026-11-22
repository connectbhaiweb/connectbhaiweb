import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Kpi, LeadRow } from '@/components/partner';
import { Button, Card, T } from '@/components/ui';
import { inr } from '@/lib/catalog';
import { fDate } from '@/lib/customer';
import { loadCommissions, loadDash, loadFees, loadLeads, type Commission, type Dash, type Fee, type Lead } from '@/lib/partner';
import { useSession } from '@/lib/session';
import { colors, font } from '@/lib/theme';

export default function Home() {
  const { user } = useSession();
  const [dash, setDash] = useState<Dash | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [comm, setComm] = useState<Commission[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (user?.role !== 'dsa' && user?.role !== 'tip' && user?.role !== 'admin') { setBusy(false); return; }
    setError('');
    try {
      const [d, l, c, f] = await Promise.all([loadDash(), loadLeads(), user.role === 'dsa' || user.role === 'admin' ? loadCommissions().catch(() => []) : Promise.resolve([]), user.role === 'tip' ? loadFees().catch(() => []) : Promise.resolve([])]);
      setDash(d); setLeads(l); setComm(c); setFees(f);
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    setBusy(false);
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const first = (user?.name ?? '').split(' ')[0];
  const sum = (st: string[]) => comm.filter((c) => st.includes(c.status)).reduce((a, c) => a + c.amount, 0);
  const isTip = user?.role === 'tip';
  const feeDue = fees.filter((f) => f.status !== 'paid').reduce((a, f) => a + f.amount, 0);
  const isAdmin = user?.role === 'admin';
  const todo = leads.filter((l) => (isTip ? l.status === 'booked' : isAdmin ? l.status === 'new' && !l.dsa : ['new', 'assigned', 'follow_up'].includes(l.status))).slice(0, 5);

  if (user && user.role !== 'dsa' && user.role !== 'tip' && user.role !== 'admin') {
    return (
      <View style={s.screen}><AppHeader />
        <View style={s.wrap}><Card style={{ gap: 8 }}><T v="h2">Hello, {first}</T><T v="small" style={{ fontSize: 14.5 }}>Your dashboard is being built for the app. Use the website for now.</T></Card></View>
      </View>
    );
  }
  return (
    <View style={s.screen}>
      <AppHeader />
      <ScrollView contentContainerStyle={s.wrap} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
        {user?.role === 'dsa' ? (
          <>
            <Text style={s.title}>Agent portal</Text>
            <T v="small" style={{ fontSize: 14.5, marginTop: -6 }}>Manage your leads, installations and earnings from Connect Bhai.</T>
          </>
        ) : (
          <>
            <Text style={s.hi}>Namaste, {first} 👋</Text>
            <T v="small" style={{ fontSize: 14.5, marginTop: -6 }}>{isTip ? 'Your installs and payments.' : 'Everything across Connect Bhai.'}</T>
          </>
        )}
        {busy && <ActivityIndicator size="large" color={colors.blue} style={{ marginTop: 24 }} />}
        {!!error && <Text style={s.error}>{error}</Text>}
        {dash && user?.role === 'dsa' && <DsaHome dash={dash} leads={leads} comm={comm} pins={String(user.service_pincodes ?? '')} />}
        {dash && user?.role !== 'dsa' && (
          <>
            <View style={s.grid}>
              <Kpi label="New leads" value={dash.leads.new} tone={colors.blue} onPress={() => router.navigate('/portal/leads')} />
              <Kpi label="Follow-ups" value={dash.leads.follow_up} onPress={() => router.navigate('/portal/leads')} />
              <Kpi label="Booked" value={dash.leads.booked} onPress={() => router.navigate(user?.role === 'dsa' ? '/portal/installs' : '/portal/leads')} />
              <Kpi label="Installed" value={dash.leads.installed} tone={colors.green} onPress={() => router.navigate(user?.role === 'dsa' ? '/portal/installs' : '/portal/leads')} />
            </View>
            {isTip ? (
              <Card style={{ gap: 6 }}>
                <T v="label">Fees to pay</T>
                <Text style={[s.commNum, { color: feeDue ? colors.warn : colors.ink }]}>{inr(feeDue)}</Text>
                <Button small kind="outline" label="Open payments" onPress={() => router.navigate('/portal/payments')} />
              </Card>
            ) : (
            <Card style={{ gap: 6 }}>
              <T v="label">Commission</T>
              <View style={s.commRow}>
                <View><Text style={s.commNum}>{inr(sum(['paid']))}</Text><T v="small">Paid</T></View>
                <View><Text style={[s.commNum, { color: colors.warn }]}>{inr(sum(['pending', 'approved']))}</Text><T v="small">Pending</T></View>
              </View>
            </Card>
            )}
            <T v="h2">{isTip ? 'Installs to do' : isAdmin ? 'Leads waiting for a DSA' : 'Needs your attention'}</T>
            {todo.length === 0 && <T v="small" style={{ fontSize: 14.5 }}>{isTip ? 'No installs waiting. Booked leads assigned to you show here.' : isAdmin ? 'Every lead has a DSA.' : 'You are all caught up. New leads will show here.'}</T>}
            {todo.map((l) => <LeadRow key={l.id} lead={l} />)}
          </>
        )}
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  wrap: { padding: 16, gap: 14, paddingBottom: 30 },
  title: { fontFamily: font.displayXBold, fontSize: 26, color: colors.ink },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  link: { fontFamily: font.bodyBold, fontSize: 14.5, color: colors.blue },
  pipe: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pipeBox: { width: '23%', flexGrow: 1, borderRadius: 12, padding: 10, gap: 4 },
  pipeLabel: { fontFamily: font.bodyMd, fontSize: 13, color: colors.ink },
  pipeNum: { fontFamily: font.displayXBold, fontSize: 22, color: colors.ink },
  commSmall: { fontFamily: font.bodyBold, fontSize: 14, color: colors.ink },
  hi: { fontFamily: font.displayXBold, fontSize: 26, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  commRow: { flexDirection: 'row', gap: 36 },
  commNum: { fontFamily: font.displayXBold, fontSize: 24, color: colors.ink },
  error: { color: colors.bad, fontFamily: font.bodyMd },
});

function DsaHome({ dash, leads, comm }: { dash: Dash; leads: Lead[]; comm: Commission[]; pins: string }) {
  const sum = (st: string[]) => comm.filter((c) => st.includes(c.status)).reduce((a, c) => a + c.amount, 0);
  const total = leads.length;
  const month = new Date().getMonth(), year = new Date().getFullYear();
  const inMonth = (d: string) => { const x = new Date(d); return x.getMonth() === month && x.getFullYear() === year; };
  const leadsMonth = leads.filter((l) => inMonth(l.createdAt)).length;
  const installed = dash.leads.installed;
  const installedMonth = leads.filter((l) => l.status === 'installed' && inMonth(l.createdAt)).length;
  const conv = installed + dash.leads.lost ? Math.round((installed / (installed + dash.leads.lost)) * 100) : 0;
  const pipeline: [string, number, string][] = [['New', leads.filter((l) => l.status === 'new').length, '#E3ECFF'], ['Assigned', leads.filter((l) => l.status === 'assigned').length, '#E3ECFF'], ['Contacted', dash.leads.contacted, '#FFEFD5'], ['Follow-up', dash.leads.follow_up, '#FFEFD5'], ['Booked', dash.leads.booked, '#E3ECFF'], ['Installed', installed, '#DDF5E4'], ['Lost', dash.leads.lost, '#FDE4E4']];
  const call = leads.filter((l) => ['new', 'assigned', 'follow_up'].includes(l.status)).slice(0, 5);
  return (
    <>
      <View style={s.grid}>
        <Kpi label="Your leads" value={total} hint={`${leadsMonth} this month`} tone={colors.blue} />
        <Kpi label="Installed" value={installed} hint={`${installedMonth} this month · ${conv}% conversion`} tone={colors.green} />
        <Kpi label="Total earned" value={inr(sum(['pending', 'approved', 'paid']))} hint={`${inr(comm[0]?.amount ?? 0)} per installation`} />
        <Kpi label="Paid to you" value={inr(sum(['paid']))} hint={`${inr(sum(['approved']))} approved · ${inr(sum(['pending']))} awaiting`} />
      </View>
      <Card style={{ gap: 12 }}>
        <View style={s.rowBetween}><T v="h3">Lead pipeline</T><Text style={s.link} onPress={() => router.navigate('/portal/leads')}>All leads ({total}) →</Text></View>
        <View style={s.pipe}>{pipeline.map(([l, n, bg]) => <View key={l} style={[s.pipeBox, { backgroundColor: bg }]}><Text numberOfLines={1} adjustsFontSizeToFit style={s.pipeLabel}>{l}</Text><Text style={s.pipeNum}>{n}</Text></View>)}</View>
      </Card>
      <View style={s.rowBetween}><T v="h2">Leads to call today</T><Text style={s.link} onPress={() => router.navigate('/portal/leads')}>View all leads</Text></View>
      {call.length === 0 ? <T v="small" style={{ fontSize: 14.5 }}>You are all caught up. New leads will show here.</T> : call.map((l) => <LeadRow key={l.id} lead={l} />)}
      <Card style={{ gap: 10 }}>
        <View style={s.rowBetween}><T v="h3">My commission</T></View>
        <View style={s.commRow}>
          <View><Text style={[s.commNum, { color: colors.warn }]}>{inr(sum(['pending']))}</Text><T v="small">Pending</T></View>
          <View><Text style={s.commNum}>{inr(sum(['approved']))}</Text><T v="small">Approved</T></View>
          <View><Text style={[s.commNum, { color: colors.green }]}>{inr(sum(['paid']))}</Text><T v="small">Paid</T></View>
        </View>
      </Card>
      <Card style={{ gap: 8 }}>
        <View style={s.rowBetween}><T v="h3">Recent payout history</T><Text style={s.link} onPress={() => router.navigate('/commission')}>View all</Text></View>
        {comm.slice(0, 3).map((c) => <View key={c.id} style={s.rowBetween}><T v="small">{`${fDate(c.createdAt)} · ${c.leadRef}`}</T><Text style={s.commSmall}>{inr(c.amount)} · {c.status}</Text></View>)}
        {comm.length === 0 && <T v="small">No payouts yet.</T>}
      </Card>
    </>
  );
}
