import { router } from 'expo-router';
import { Activity, Gauge, KeyRound, Pencil, RotateCw, ShieldCheck, Signal, Wifi, Wrench } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Footer } from '@/components/Footer';
import { RouterCard } from '@/components/dashboard';
import { Button, Card, T } from '@/components/ui';
import { tr, useLang } from '@/lib/i18n';
import { useCustomer } from '@/lib/useCustomer';
import { colors, font } from '@/lib/theme';

/* Website /care: logged out (and DSA) see the explainer; a customer sees their own router. */
const STEPS: [string, typeof Wrench, string, string][] = [
  ['01', Wrench, 'Scans the ONT serial', 'Internet band hua? Aap se pehle Bhai ko pata chalega.'],
  ['02', Activity, 'Modem reports every 5 minutes', "Bhai's Genie spots the problem and messages you on WhatsApp, while Bhai's team gets to work on it."],
  ['03', Gauge, 'You control it in the app', 'Restart your Wi-Fi, change password and test speed on your app.'],
];
const FEATS: [typeof Wifi, string][] = [[Wifi, 'Online / Offline'], [Signal, 'Fiber signal'], [RotateCw, 'Restart modem'], [Pencil, 'Wi-Fi name'], [KeyRound, 'Wi-Fi password'], [Gauge, 'Line speed test']];

export default function Care() {
  const { lang } = useLang();
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
            <>
              {!user && <Button icon={ShieldCheck} label="Log in to Care plan" onPress={() => router.push('/login')} />}
              {!!user && <T v="small">Modem status is shown to the customer, the installing TIP and admin. The modem list for TIP and admin is not in the app yet.</T>}
              {STEPS.map(([n, Icon, t, d]) => (
                <Card key={n} style={{ gap: 6 }}>
                  <View style={s.row}><View style={s.ico}><Icon size={20} color={colors.blue} /></View><T v="eyebrow">{n}</T></View>
                  <T v="h2">{t}</T><T v="small" style={{ fontSize: 14.5, lineHeight: 21 }}>{d}</T>
                </Card>
              ))}
              <Card style={{ gap: 12 }}>
                <T v="h3">What you can do</T>
                {FEATS.map(([Icon, l]) => <View key={l} style={s.row}><Icon size={20} color={colors.blue} /><Text style={s.feat}>{tr(l, lang)}</Text></View>)}
              </Card>
            </>
          )}
        </View>
        <Footer />
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, body: { padding: 16, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ico: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  feat: { fontFamily: font.bodyMd, fontSize: 15.5, color: colors.ink },
});
