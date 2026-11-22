import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { LeadRow } from '@/components/partner';
import { Field, Pill, T } from '@/components/ui';
import { loadLeads, type Lead } from '@/lib/partner';
import { colors, font } from '@/lib/theme';

const FILTERS = [['all', 'All'], ['new', 'New'], ['contacted', 'Contacted'], ['follow_up', 'Follow-up'], ['booked', 'Booked'], ['installed', 'Installed'], ['lost', 'Lost']] as const;

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [f, setF] = useState<string>('all');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setError('');
    try { setLeads(await loadLeads()); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    setBusy(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return leads.filter((l) => (f === 'all' || l.status === f || (f === 'new' && l.status === 'assigned')) && (!t || [l.name, l.phone, l.ref, l.pincode].some((x) => x.toLowerCase().includes(t))));
  }, [leads, f, q]);
  const count = (k: string) => (k === 'all' ? leads.length : leads.filter((l) => l.status === k || (k === 'new' && l.status === 'assigned')).length);

  return (
    <View style={s.screen}>
      <AppHeader />
      <FlatList
        data={shown} keyExtractor={(l) => String(l.id)} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 30 }}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <Text style={s.title}>Leads</Text>
            <Field placeholder="Search name, mobile, PIN or ref" value={q} onChangeText={setQ} autoCorrect={false} />
            <View style={s.chips}>{FILTERS.map(([k, label]) => <Pill key={k} label={`${label} ${count(k)}`} on={f === k} onPress={() => setF(k)} />)}</View>
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
  title: { fontFamily: font.displayXBold, fontSize: 26, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { color: colors.bad, fontFamily: font.bodyMd },
});
