import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { CustomerGate } from '@/components/CustomerGate';
import { RouterCard } from '@/components/dashboard';
import { Card, T } from '@/components/ui';
import { useCustomer } from '@/lib/useCustomer';
import { colors, font } from '@/lib/theme';

/* Customer "Care plan" tab: router status, restart, Wi-Fi and speed test. */
export default function CarePlan() {
  const { user, data, busy, error, load } = useCustomer();
  const lead = data?.leads.find((l) => l.booking?.status === 'installed');
  const device = data?.devices.find((d) => d.leadId === lead?.id);
  return (
    <View style={s.screen}>
      <AppHeader />
      {user?.role !== 'customer' ? <CustomerGate loggedIn={!!user} /> : (
        <ScrollView contentContainerStyle={s.wrap} refreshControl={<RefreshControl refreshing={busy && !!data} onRefresh={load} />}>
          <Text style={s.h1}>Care plan</Text>
          {busy && !data && <ActivityIndicator size="large" color={colors.blue} style={{ marginTop: 24 }} />}
          {!!error && !data && <Card><T v="small">{error}</T></Card>}
          {data && <RouterCard lead={lead} device={device} />}
        </ScrollView>
      )}
    </View>
  );
}
const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.bg }, wrap: { padding: 12, gap: 10, paddingBottom: 28 }, h1: { fontFamily: font.displayXBold, fontSize: 23, color: colors.ink, marginTop: 4 } });
