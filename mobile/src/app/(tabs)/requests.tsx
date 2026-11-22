import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Header } from '@/components/Header';
import { myLeads, type MyLead } from '@/lib/catalog';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

const STATUS: Record<string, string> = {
  new: 'Request received', contacted: 'Partner contacted you', followup: 'Follow-up scheduled', scheduled: 'Installation booked',
  installed: 'Installed', lost: 'Closed',
};
const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '');

export default function Requests() {
  const { user } = useSession();
  const [items, setItems] = useState<MyLead[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true); setError('');
    try { setItems(await myLeads()); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    setBusy(false);
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={s.screen}>
      <Header />
      {!user ? (
        <View style={s.center}>
          <Text style={s.h1}>Track your connection</Text>
          <Text style={s.sub}>Log in to see your requests, installation booking and payment status.</Text>
          <Pressable style={s.btn} onPress={() => router.push('/login')}><Text style={s.btnText}>Log in</Text></Pressable>
        </View>
      ) : (
        <FlatList
          data={items ?? []}
          keyExtractor={(l) => String(l.id)}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={busy && !!items} onRefresh={load} />}
          ListHeaderComponent={busy && !items ? <ActivityIndicator color={colors.primary} /> : error ? <Text style={s.error}>{error}</Text> : undefined}
          ListEmptyComponent={items && !busy ? <Text style={s.sub}>No requests yet. Search plans by PIN code and request a connection.</Text> : undefined}
          renderItem={({ item }) => {
            const b = item.bookings?.[0];
            return (
              <View style={s.card}>
                <View style={s.rowBetween}>
                  <Text style={s.ref}>{item.ref_code}</Text>
                  <Text style={s.status}>{STATUS[item.status] ?? item.status}</Text>
                </View>
                <Text style={s.plan}>{item.plan ? `${item.plan.category?.name ?? ''} ${item.plan.name}`.trim() : 'Callback request'}</Text>
                {item.plan && <Text style={s.sub}>₹{item.plan.price} per month</Text>}
                <Text style={s.sub}>PIN {item.pincode}{item.address ? ` · ${item.address}` : ''}</Text>
                {b?.scheduled_at && <Text style={s.sub}>Installation: {when(b.scheduled_at)}</Text>}
                {item.telephone_no && <Text style={s.sub}>Telephone no: {item.telephone_no}</Text>}
                {item.order_no && <Text style={s.sub}>Order no: {item.order_no}</Text>}
                <Text style={s.small}>Requested {when(item.created_at)}</Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  list: { padding: 16, gap: 12 },
  h1: { fontSize: 22, fontWeight: '800', color: colors.navy },
  sub: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  small: { fontSize: 12, color: colors.muted },
  error: { color: colors.danger },
  btn: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, gap: 4, borderWidth: 1, borderColor: colors.border },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
  ref: { fontWeight: '700', color: colors.text },
  status: { fontWeight: '700', color: colors.primary },
  plan: { fontSize: 17, fontWeight: '700', color: colors.text },
});
