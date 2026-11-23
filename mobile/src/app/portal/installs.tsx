import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { LeadRow } from '@/components/partner';
import { PortalHead } from '@/components/PortalHead';
import { Pill, T } from '@/components/ui';
import { loadLeads, type Lead } from '@/lib/partner';
import { colors, font } from '@/lib/theme';

export default function Installs() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [f, setF] = useState<'booked' | 'installed'>('booked');
  const load = useCallback(async () => {
    setError('');
    try { setLeads((await loadLeads()).filter((l) => l.status === 'booked' || l.status === 'installed')); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    setBusy(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const shown = leads.filter((l) => l.status === f);
  return (
    <View style={s.screen}>
      <AppHeader />
      <FlatList
        data={shown} keyExtractor={(l) => String(l.id)} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 30 }}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <PortalHead />
            <View style={s.chips}>
              <Pill label={`Booked ${leads.filter((l) => l.status === 'booked').length}`} on={f === 'booked'} onPress={() => setF('booked')} />
              <Pill label={`Installed ${leads.filter((l) => l.status === 'installed').length}`} on={f === 'installed'} onPress={() => setF('installed')} />
            </View>
            {busy && <ActivityIndicator size="large" color={colors.blue} />}
            {!!error && <Text style={s.error}>{error}</Text>}
            {!busy && shown.length === 0 && <T v="small" style={{ fontSize: 14.5 }}>{f === 'booked' ? 'No booked installs. Book a lead from the Leads tab.' : 'No installs completed yet.'}</T>}
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
  chips: { flexDirection: 'row', gap: 8 },
  error: { color: colors.bad, fontFamily: font.bodyMd },
});
