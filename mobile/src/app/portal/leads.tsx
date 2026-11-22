import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Kpi, LeadRow } from '@/components/partner';
import { PortalHead } from '@/components/PortalHead';
import { Field, Pill, T } from '@/components/ui';
import { loadLeads, type Lead } from '@/lib/partner';
import { colors } from '@/lib/theme';

/* Website /dsa/leads, /tip/leads, /admin/leads on a phone: head, tiles, filters, one card per lead. */
const now = () => Date.now();
const FILTERS: [string, string, (l: Lead) => boolean][] = [
  ['open', 'Open', (l) => ['new', 'assigned', 'contacted', 'follow_up', 'booked'].includes(l.status)],
  ['due', 'Follow-up due', (l) => l.status === 'follow_up' && !!l.followUp && new Date(l.followUp).getTime() <= now()],
  ['new', 'New to call', (l) => l.status === 'new' || l.status === 'assigned'],
  ['contacted', 'Contacted', (l) => l.status === 'contacted'],
  ['booked', 'Booked', (l) => l.status === 'booked'],
  ['installed', 'Installed', (l) => l.status === 'installed'],
  ['lost', 'Lost', (l) => l.status === 'lost'],
  ['all', 'All', () => true],
];

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [f, setF] = useState('open');
  const [q, setQ] = useState('');
  const load = useCallback(async () => {
    setError('');
    try { setLeads(await loadLeads()); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    setBusy(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const test = FILTERS.find(([k]) => k === f)![2];
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return leads.filter((l) => test(l) && (!t || [l.name, l.phone, l.ref, l.pincode].some((x) => x.toLowerCase().includes(t))));
  }, [leads, test, q]);
  const n = (k: string) => leads.filter(FILTERS.find(([x]) => x === k)![2]).length;

  return (
    <View style={s.screen}>
      <AppHeader />
      <FlatList
        data={shown} keyExtractor={(l) => String(l.id)} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 30 }}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <PortalHead />
            <View style={s.grid}>
              <Kpi label="Open leads" value={n('open')} />
              <Kpi label="Follow-ups due" value={n('due')} hint="today or earlier" />
              <Kpi label="Booked" value={n('booked')} />
              <Kpi label="Installed" value={n('installed')} tone={colors.green} />
            </View>
            <View style={s.chips}>{FILTERS.map(([k, label]) => <Pill key={k} label={label} on={f === k} onPress={() => setF(k)} />)}</View>
            <Field placeholder="Search name, phone, code…" value={q} onChangeText={setQ} autoCorrect={false} />
            {busy && <ActivityIndicator size="large" color={colors.blue} />}
            {!!error && <Text style={s.error}>{error}</Text>}
            {!busy && shown.length === 0 && <T v="small" style={{ fontSize: 14.5 }}>No leads here yet.</T>}
          </View>
        }
        renderItem={({ item }) => <LeadRow lead={item} />}
      />
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { color: colors.bad },
});
