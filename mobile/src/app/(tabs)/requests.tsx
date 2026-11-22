import { router } from 'expo-router';
import { ArrowRight, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { CustomerGate } from '@/components/CustomerGate';
import { BookingCard, NoBooking, PastRequests } from '@/components/dashboard';
import { Button, Card, T } from '@/components/ui';
import { type Lead } from '@/lib/customer';
import { useCustomer } from '@/lib/useCustomer';
import { colors, font } from '@/lib/theme';

/* Customer home: the website's /my dashboard in phone layout. */
export default function MyBookings() {
  const { user, data, busy, error, load } = useCustomer();
  const [selected, setSelected] = useState<number | null>(null);

  const first = (user?.name ?? '').split(' ')[0];
  const current = data?.leads.find((l) => l.status !== 'lost') ?? data?.leads[0];
  const sel: Lead | undefined = data?.leads.find((l) => l.id === selected) ?? current;
  const hasPlan = !!data?.leads.some((l) => l.status !== 'lost');

  return (
    <View style={s.screen}>
      <AppHeader />
      {!user || user.role !== 'customer' ? (
        <CustomerGate loggedIn={!!user} />
      ) : (
        <ScrollView contentContainerStyle={s.wrap} refreshControl={<RefreshControl refreshing={busy && !!data} onRefresh={load} />}>
          <View style={s.hello}>
            <Text style={s.h1}>Namaste{first ? `, ${first}` : ''} 👋</Text>
            <View style={s.role}><UserRound size={15} color={colors.actionInk} strokeWidth={2.2} /><Text style={s.roleText}>Customer</Text></View>
            <T v="small" style={{ fontSize: 13.5 }}>Manage your bookings, payments and service requests.</T>
          </View>
          <Button block iconRight={ArrowRight} label={hasPlan ? 'New connection' : 'Find plans'} onPress={() => router.navigate('/find')} />

          {busy && !data && <ActivityIndicator size="large" color={colors.blue} style={{ marginTop: 24 }} />}
          {!!error && !data && (
            <Card style={{ gap: 10 }}><T v="h3">Could not load your dashboard.</T><T v="small">{error}</T><Button label="Try again" onPress={load} /></Card>
          )}
          {data && (
            <>
              {sel ? <BookingCard lead={sel} onPaid={load} /> : <NoBooking />}
              <PastRequests leads={data.leads.filter((l) => l !== sel)} onOpen={(l) => setSelected(l.id)} />
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  wrap: { padding: 12, gap: 10, paddingBottom: 28 },
  hello: { gap: 6, marginBottom: 2, marginTop: 4 },
  h1: { fontFamily: font.displayXBold, fontSize: 23, color: colors.ink, letterSpacing: -0.3 },
  role: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.chipBlue, borderRadius: 8, paddingHorizontal: 10, height: 28 },
  roleText: { fontFamily: font.bodyBold, fontSize: 13, color: '#0B1A4A' },
});
