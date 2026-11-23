import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { CareExplainer } from '@/components/CareExplainer';
import { Kpi } from '@/components/partner';
import { PortalHead } from '@/components/PortalHead';
import { Card, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

/* Website Care plan for partners: a DSA sees the explainer; a TIP / admin sees the modem summary and list. */
type Summary = { installed: number; linked: number; online: number; offline: number; weak: number; unlinked: number };

export default function PartnerCare() {
  const { user } = useSession();
  const [sum, setSum] = useState<Summary | null>(null);
  const [devices, setDevices] = useState<{ id: number }[] | null>(null);
  const [error, setError] = useState('');
  const modems = user?.role === 'tip' || user?.role === 'admin';
  const load = useCallback(async () => {
    if (!modems) return;
    setError('');
    try {
      const [s, d] = await Promise.all([api<Summary>('GET', '/care-plan/summary'), api<{ items: { id: number }[] }>('GET', '/care-plan/devices?limit=50')]);
      setSum(s); setDevices(d.items);
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
  }, [modems]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return (
    <View style={s.screen}>
      <AppHeader />
      <ScrollView contentContainerStyle={s.wrap} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
        <PortalHead contacts={false} />
        <T v="eyebrow">Care plan · Genie, your personal assistant</T>
        <T v="h1">{user?.role === 'tip' ? 'Care plan · modems I installed' : user?.role === 'admin' ? 'Care plan · all modems' : 'Connect Bhai Care plan'}</T>
        {modems ? (
          <>
            <T v="small" style={{ fontSize: 14.5, lineHeight: 21 }}>Every installed modem through Genie, your personal assistant: online / offline, fiber signal and restarts, by area.</T>
            {!sum && !error && <ActivityIndicator size="large" color={colors.blue} />}
            {!!error && <T v="small" style={{ color: colors.bad }}>{error}</T>}
            {sum && (
              <View style={s.grid}>
                <Kpi label="Installed" value={sum.installed} />
                <Kpi label="Linked to Genie" value={sum.linked} />
                <Kpi label="Online" value={sum.online} tone={colors.green} />
                <Kpi label="Offline" value={sum.offline} tone={colors.bad} />
                <Kpi label="Weak signal" value={sum.weak} tone={colors.warn} />
                <Kpi label="Not linked" value={sum.unlinked} />
              </View>
            )}
            {devices?.length === 0 && <Card style={{ gap: 6 }}><T v="h3">Genie has no modems yet.</T><T v="small">A modem appears here after it checks in. Enter the ONT serial when you complete an installation.</T></Card>}
          </>
        ) : <CareExplainer />}
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.bg }, wrap: { padding: 12, gap: 12, paddingBottom: 40 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 } });
