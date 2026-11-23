import { router } from 'expo-router';
import { Activity, Gauge, KeyRound, Pencil, RotateCw, ShieldCheck, Signal, Wifi, Wrench } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, T } from '@/components/ui';
import { WebArt } from '@/components/WebArt';
import { ART_CARE } from '@/lib/web-art.generated';
import { tr, useLang } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { colors, font } from '@/lib/theme';

const STEPS: [string, typeof Wrench, string, string][] = [
  ['01', Wrench, 'Scans the ONT serial', 'Internet band hua? Aap se pehle Bhai ko pata chalega.'],
  ['02', Activity, 'Modem reports every 5 minutes', "Bhai's Genie spots the problem and messages you on WhatsApp, while Bhai's team gets to work on it."],
  ['03', Gauge, 'You control it in the app', 'Restart your Wi-Fi, change password and test speed on your app.'],
];
const FEATS: [typeof Wifi, string][] = [[Wifi, 'Online / Offline'], [Signal, 'Fiber signal'], [RotateCw, 'Restart modem'], [Pencil, 'Wi-Fi name'], [KeyRound, 'Wi-Fi password'], [Gauge, 'Line speed test']];


/* The website's public Care plan page content (also what a DSA sees). */
export function CareExplainer() {
  const { lang } = useLang();
  const { user } = useSession();
  return (
    <>
              <WebArt html={ART_CARE} minHeight={170} css=".care-art{display:block;margin:0 auto;max-width:300px}" />
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
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ico: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  feat: { fontFamily: font.bodyMd, fontSize: 15.5, color: colors.ink },
});
