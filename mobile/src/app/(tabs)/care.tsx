import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { CareExplainer } from '@/components/CareExplainer';
import { Footer } from '@/components/Footer';
import { RouterCard } from '@/components/dashboard';
import { Button, T } from '@/components/ui';
import { useCustomer } from '@/lib/useCustomer';
import { colors } from '@/lib/theme';

/* Website /care: logged out (and DSA) see the explainer; a customer sees their own router. */
export default function Care() {
  const { user, data } = useCustomer();
  const lead = data?.leads.find((l) => l.booking?.status === 'installed');
  const device = data?.devices.find((d) => d.leadId === lead?.id);
  const customer = user?.role === 'customer';
  return (
    <View style={s.screen}>
      <AppHeader />
      <ScrollView>
        <View style={s.body}>
          <T v="eyebrow">Care plan · Genie, your personal assistant</T>
          <T v="h1">{customer ? 'My Care plan' : 'Connect Bhai Care plan'}</T>
          <T v="small" style={{ fontSize: 14.5, lineHeight: 21 }}>{customer ? 'Live status of your home modem. Restart it, change your Wi-Fi name or password, and test the line speed without Wi-Fi in between.' : 'Keep an eye on your home modem and fix common problems yourself.'}</T>
          {customer ? (
            <>
              <RouterCard lead={lead} device={device} />
              <Button kind="outline" label="Wi-Fi speed test" onPress={() => router.navigate('/speed')} />
            </>
          ) : (
            <CareExplainer />
          )}
        </View>
        <Footer />
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.bg }, body: { padding: 16, gap: 14 } });
