import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { CustomerGate } from '@/components/CustomerGate';
import { PaymentsCard } from '@/components/dashboard';
import { Card, T } from '@/components/ui';
import { useCustomer } from '@/lib/useCustomer';
import { colors, font } from '@/lib/theme';

/* Customer "Payments" tab. */
export default function CustomerPayments() {
  const { user, data, busy, error, load } = useCustomer();
  return (
    <View style={s.screen}>
      <AppHeader />
      {user?.role !== 'customer' ? <CustomerGate loggedIn={!!user} /> : (
        <ScrollView contentContainerStyle={s.wrap} refreshControl={<RefreshControl refreshing={busy && !!data} onRefresh={load} />}>
          <Text style={s.h1}>Payments</Text>
          {busy && !data && <ActivityIndicator size="large" color={colors.blue} style={{ marginTop: 24 }} />}
          {!!error && !data && <Card><T v="small">{error}</T></Card>}
          {data && <PaymentsCard charges={data.charges} />}
        </ScrollView>
      )}
    </View>
  );
}
const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.bg }, wrap: { padding: 12, gap: 10, paddingBottom: 28 }, h1: { fontFamily: font.displayXBold, fontSize: 23, color: colors.ink, marginTop: 4 } });
