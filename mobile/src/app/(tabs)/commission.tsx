import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Kpi } from '@/components/partner';
import { Card, Chip, T } from '@/components/ui';
import { inr } from '@/lib/catalog';
import { fDate } from '@/lib/customer';
import { loadCommissions, type Commission } from '@/lib/partner';
import { colors, font } from '@/lib/theme';

const TONE: Record<string, 'green' | 'amber' | 'red' | 'blue'> = { paid: 'green', pending: 'amber', approved: 'blue', cancelled: 'red' };

export default function CommissionTab() {
  const [rows, setRows] = useState<Commission[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try { setRows(await loadCommissions()); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    setBusy(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const sum = (st: string[]) => rows.filter((c) => st.includes(c.status)).reduce((a, c) => a + c.amount, 0);
  return (
    <View style={s.screen}>
      <AppHeader />
      <FlatList
        data={rows} keyExtractor={(c) => String(c.id)} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 30 }}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <Text style={s.title}>Commission</Text>
            <View style={s.grid}>
              <Kpi label="Paid" value={inr(sum(['paid']))} tone={colors.green} />
              <Kpi label="Pending" value={inr(sum(['pending', 'approved']))} tone={colors.warn} />
            </View>
            {busy && <ActivityIndicator size="large" color={colors.blue} />}
            {!!error && <Text style={s.error}>{error}</Text>}
            {!busy && rows.length === 0 && <T v="small" style={{ fontSize: 14.5 }}>Commission shows here once an install you brought is completed.</T>}
          </View>
        }
        renderItem={({ item }) => (
          <Card style={{ gap: 6, padding: 14 }}>
            <View style={s.row}><Text style={s.amt}>{inr(item.amount)}</Text><Chip label={item.status === 'cancelled' ? 'Rejected' : item.status[0].toUpperCase() + item.status.slice(1)} tone={TONE[item.status] ?? 'blue'} /></View>
            <T v="small">{item.customer} · {item.leadRef}</T>
            <T v="small">{item.paidAt ? `Paid ${fDate(item.paidAt)}` : `Earned ${fDate(item.createdAt)}`}</T>
          </Card>
        )}
      />
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontFamily: font.displayXBold, fontSize: 26, color: colors.ink },
  grid: { flexDirection: 'row', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amt: { fontFamily: font.displayXBold, fontSize: 22, color: colors.ink },
  error: { color: colors.bad, fontFamily: font.bodyMd },
});
