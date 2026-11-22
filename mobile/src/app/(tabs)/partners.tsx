import { useFocusEffect } from 'expo-router';
import { Phone } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Button, Card, Chip, Field, Pill, Segmented, T } from '@/components/ui';
import { loadPartners, setPartnerStatus, type Partner } from '@/lib/partner';
import { colors, font } from '@/lib/theme';

const TONE: Record<string, 'green' | 'amber' | 'red' | 'blue'> = { approved: 'green', pending: 'amber', rejected: 'red', suspended: 'red' };
const FILTERS = ['all', 'pending', 'approved', 'rejected', 'suspended'] as const;

export default function Partners() {
  const [role, setRole] = useState<'dsa' | 'tip'>('dsa');
  const [rows, setRows] = useState<Partner[]>([]);
  const [busy, setBusy] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [f, setF] = useState<(typeof FILTERS)[number]>('all');
  const [q, setQ] = useState('');

  const load = useCallback(async (r: 'dsa' | 'tip') => {
    setError('');
    try { setRows(await loadPartners(r)); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    setBusy(false);
  }, []);
  useFocusEffect(useCallback(() => { load(role); }, [load, role]));

  const act = async (p: Partner, st: 'approved' | 'rejected' | 'suspended') => {
    setActing(p.id); setError('');
    try { await setPartnerStatus(p.id, st); await load(role); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    setActing(null);
  };
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((p) => (f === 'all' || p.status === f) && (!t || [p.name, p.firm, p.phone, p.code].some((x) => x.toLowerCase().includes(t))));
  }, [rows, f, q]);
  const count = (k: string) => (k === 'all' ? rows.length : rows.filter((p) => p.status === k).length);

  return (
    <View style={s.screen}>
      <AppHeader />
      <FlatList
        data={shown} keyExtractor={(p) => String(p.id)} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => load(role)} />}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 30 }}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <Text style={s.title}>Partners</Text>
            <Segmented items={[{ key: 'dsa', label: 'DSA' }, { key: 'tip', label: 'TIP' }]} value={role} onChange={(r) => { setBusy(true); setRows([]); setRole(r); }} />
            <Field placeholder="Search name, firm, mobile or code" value={q} onChangeText={setQ} autoCorrect={false} />
            <View style={s.chips}>{FILTERS.map((k) => <Pill key={k} label={`${k[0].toUpperCase()}${k.slice(1)} ${count(k)}`} on={f === k} onPress={() => setF(k)} />)}</View>
            {busy && <ActivityIndicator size="large" color={colors.blue} />}
            {!!error && <Text style={s.error}>{error}</Text>}
            {!busy && shown.length === 0 && <T v="small" style={{ fontSize: 14.5 }}>No partners here.</T>}
          </View>
        }
        renderItem={({ item: p }) => (
          <Card style={{ gap: 8, padding: 14 }}>
            <View style={s.row}>
              <View style={{ flex: 1 }}><Text style={s.name}>{p.firm || p.name}</Text><T v="small">{p.firm ? `${p.name} · ` : ''}{p.code}</T></View>
              <Chip label={p.status[0].toUpperCase() + p.status.slice(1)} tone={TONE[p.status] ?? 'blue'} />
            </View>
            <View style={s.line}><Phone size={14} color={colors.muted} /><Text style={s.meta}>{p.phone}</Text>{!!p.pincode && <Text style={s.meta}>· PIN {p.pincode}</Text>}</View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button small kind="call" label="Call" onPress={() => Linking.openURL(`tel:+91${p.phone}`)} style={{ flex: 1 }} />
              {p.status !== 'approved' && <Button small label="Approve" loading={acting === p.id} disabled={acting !== null} onPress={() => act(p, 'approved')} style={{ flex: 1 }} />}
              {p.status === 'pending' && <Button small kind="outline" label="Reject" disabled={acting !== null} onPress={() => act(p, 'rejected')} style={{ flex: 1 }} />}
              {p.status === 'approved' && <Button small kind="outline" label="Suspend" disabled={acting !== null} onPress={() => act(p, 'suspended')} style={{ flex: 1 }} />}
            </View>
          </Card>
        )}
      />
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontFamily: font.displayXBold, fontSize: 26, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: font.display, fontSize: 17, color: colors.ink },
  line: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { fontFamily: font.bodyMd, fontSize: 14, color: colors.text },
  error: { color: colors.bad, fontFamily: font.bodyMd },
});
