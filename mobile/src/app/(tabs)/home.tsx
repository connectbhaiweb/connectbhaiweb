import { router, useFocusEffect } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Kpi, LeadRow } from '@/components/partner';
import { Button, Card, T } from '@/components/ui';
import { inr } from '@/lib/catalog';
import { loadCommissions, loadDash, loadLeads, type Commission, type Dash, type Lead } from '@/lib/partner';
import { useSession } from '@/lib/session';
import { colors, font } from '@/lib/theme';

export default function Home() {
  const { user } = useSession();
  const [dash, setDash] = useState<Dash | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [comm, setComm] = useState<Commission[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (user?.role !== 'dsa') { setBusy(false); return; }
    setError('');
    try {
      const [d, l, c] = await Promise.all([loadDash(), loadLeads(), loadCommissions().catch(() => [])]);
      setDash(d); setLeads(l); setComm(c);
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    setBusy(false);
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const first = (user?.name ?? '').split(' ')[0];
  const sum = (st: string[]) => comm.filter((c) => st.includes(c.status)).reduce((a, c) => a + c.amount, 0);
  const todo = leads.filter((l) => ['new', 'assigned', 'follow_up'].includes(l.status)).slice(0, 5);

  if (user && user.role !== 'dsa') {
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
        <Text style={s.hi}>Namaste, {first} 👋</Text>
        <T v="small" style={{ fontSize: 14.5, marginTop: -6 }}>Your leads, installs and commission.</T>
        <Button label="Add a lead" icon={Plus} onPress={() => router.push('/lead/new')} />
        {busy && <ActivityIndicator size="large" color={colors.blue} style={{ marginTop: 24 }} />}
        {!!error && <Text style={s.error}>{error}</Text>}
        {dash && (
          <>
            <View style={s.grid}>
              <Kpi label="New leads" value={dash.leads.new} tone={colors.blue} onPress={() => router.navigate('/(tabs)/leads')} />
              <Kpi label="Follow-ups" value={dash.leads.follow_up} onPress={() => router.navigate('/(tabs)/leads')} />
              <Kpi label="Booked" value={dash.leads.booked} onPress={() => router.navigate('/(tabs)/installs')} />
              <Kpi label="Installed" value={dash.leads.installed} tone={colors.green} onPress={() => router.navigate('/(tabs)/installs')} />
            </View>
            <Card style={{ gap: 6 }}>
              <T v="label">Commission</T>
              <View style={s.commRow}>
                <View><Text style={s.commNum}>{inr(sum(['paid']))}</Text><T v="small">Paid</T></View>
                <View><Text style={[s.commNum, { color: colors.warn }]}>{inr(sum(['pending', 'approved']))}</Text><T v="small">Pending</T></View>
              </View>
            </Card>
            <T v="h2">Needs your attention</T>
            {todo.length === 0 && <T v="small" style={{ fontSize: 14.5 }}>You are all caught up. New leads will show here.</T>}
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
  hi: { fontFamily: font.displayXBold, fontSize: 26, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  commRow: { flexDirection: 'row', gap: 36 },
  commNum: { fontFamily: font.displayXBold, fontSize: 24, color: colors.ink },
  error: { color: colors.bad, fontFamily: font.bodyMd },
});
