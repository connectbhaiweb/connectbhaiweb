import { Clock, Headset, Phone, Scale, ShieldCheck, UserRound } from 'lucide-react-native';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSession } from '@/lib/session';
import { colors, font } from '@/lib/theme';

const TRUST = [[ShieldCheck, 'Trusted Providers'], [Scale, 'Unbiased Comparison'], [Clock, 'Fast Installation'], [Headset, 'Free Expert Assistance']] as const;

/* The website's trust bar + navy header (frontend/src/components/TrustBar.jsx, Header.jsx). */
export function AppHeader() {
  const { top } = useSafeAreaInsets();
  const { user } = useSession();
  return (
    <View style={{ backgroundColor: colors.trust }}>
      <View style={[s.trust, { paddingTop: top, height: 40 + top }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.trustRow} style={{ flex: 1 }}>
          {TRUST.map(([Icon, label]) => (
            <View key={label} style={s.trustItem}><Icon size={15} color="#5EE0A8" strokeWidth={2} /><Text style={s.trustText}>{label}</Text></View>
          ))}
        </ScrollView>
        <Pressable accessibilityLabel="Call Connect Bhai" onPress={() => Linking.openURL('tel:+919479935365')} style={s.call}><Phone size={17} color="#5EE0A8" strokeWidth={2.2} /></Pressable>
      </View>
      <View style={s.head}>
        <Image source={require('../../assets/images/logo-full.png')} style={s.logo} resizeMode="contain" />
        {user ? (
          <Pressable onPress={() => router.push('/(tabs)/account')} style={s.who}><UserRound size={16} color="#fff" /><Text style={s.whoText} numberOfLines={1}>{user.name.split(' ')[0]}</Text></Pressable>
        ) : (
          <Pressable onPress={() => router.push('/login')} style={s.login}><Text style={s.loginText}>Log in</Text></Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  trust: { flexDirection: 'row', alignItems: 'center', height: 40 + 0, paddingLeft: 14, paddingRight: 8 },
  trustRow: { alignItems: 'center', gap: 22 },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  trustText: { color: colors.trustInk, fontFamily: font.body, fontSize: 12.5 },
  call: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  head: { backgroundColor: colors.blueDeep, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, height: 62 },
  logo: { height: 32, width: 150 },
  login: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)', borderRadius: 10, paddingHorizontal: 16, height: 38, alignItems: 'center', justifyContent: 'center' },
  loginText: { color: '#fff', fontFamily: font.bodyBold, fontSize: 14.5 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)', borderRadius: 10, paddingHorizontal: 12, height: 38, maxWidth: 140 },
  whoText: { color: '#fff', fontFamily: font.bodyBold, fontSize: 14 },
});
