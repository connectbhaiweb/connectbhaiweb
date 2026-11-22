import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Kpi } from '@/components/partner';
import { Button, Card, Chip, T } from '@/components/ui';
import { inr } from '@/lib/catalog';
import { fDate } from '@/lib/customer';
import { loadFees, type Fee } from '@/lib/partner';
import { payCharge } from '@/lib/pay';
import { useSession } from '@/lib/session';
import { colors, font } from '@/lib/theme';

const TONE: Record<string, 'green' | 'red' | 'amber' | 'blue'> = { paid: 'green', due: 'amber', failed: 'red' };

export default function Payments() {
  const { user } = useSession();
  const [rows, setRows] = useState<Fee[]>([]);
  const [busy, setBusy] = useState(true);
  const [paying, setPaying] = useState<number | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try { setRows(await loadFees()); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    setBusy(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pay = async (f: Fee) => {
    setPaying(f.id); setError('');
    try { await payCharge(f.id, { name: user?.name, phone: user?.phone }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Payment failed.'); }
    setPaying(null);
  };
  const sum = (st: string[]) => rows.filter((c) => st.includes(c.status)).reduce((a, c) => a + c.amount, 0);

  return (
    <View style={s.screen}>
      <AppHeader />
      <FlatList
        data={rows} keyExtractor={(c) => String(c.id)} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 30 }}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <Text style={s.title}>Payments</Text>
            <T v="small" style={{ fontSize: 14 }}>Fees you pay to Connect Bhai.</T>
            <View style={s.grid}>
              <Kpi label="Due" value={inr(sum(['due', 'failed']))} tone={colors.warn} />
              <Kpi label="Paid" value={inr(sum(['paid']))} tone={colors.green} />
            </View>
            {busy && <ActivityIndicator size="large" color={colors.blue} />}
            {!!error && <Text style={s.error}>{error}</Text>}
            {!busy && rows.length === 0 && <T v="small" style={{ fontSize: 14.5 }}>Nothing to pay yet. Fees appear here after an install.</T>}
          </View>
        }
        renderItem={({ item }) => (
          <Card style={{ gap: 8, padding: 14 }}>
            <View style={s.row}><Text style={s.amt}>{inr(item.amount)}</Text><Chip label={item.status === 'due' ? 'Due' : item.status === 'paid' ? 'Paid' : 'Failed'} tone={TONE[item.status] ?? 'blue'} /></View>
            <T v="small">{item.description}</T>
            <T v="small">{item.paidAt ? `Paid ${fDate(item.paidAt)}` : `${item.ref} · ${fDate(item.createdAt)}`}</T>
            {item.status !== 'paid' && <Button label="Pay now" loading={paying === item.id} disabled={paying !== null} onPress={() => pay(item)} />}
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
