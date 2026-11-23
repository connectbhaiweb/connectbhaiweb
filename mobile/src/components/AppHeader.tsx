import { Clock, Headset, MessageCircle, Phone, Scale, Search, ShieldCheck } from 'lucide-react-native';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { LANDING } from '@/lib/portal';
import { WA_URL } from '@/lib/site';
import { tr, useLang } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { colors, font } from '@/lib/theme';

const TRUST = [[ShieldCheck, 'Trusted Providers'], [Scale, 'Unbiased Comparison'], [Clock, 'Fast Installation'], [Headset, 'Free Expert Assistance']] as const;

/* The website's trust bar + navy header (frontend/src/components/TrustBar.jsx, Header.jsx). */
export function AppHeader() {
  const { top } = useSafeAreaInsets();
  const { user } = useSession();
  const { lang, setLang } = useLang();
  const inPortal = usePathname().startsWith('/portal');
  return (
    <View style={{ backgroundColor: colors.trust }}>
      <View style={[s.trust, { paddingTop: top, height: 40 + top }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.trustRow} style={{ flex: 1 }}>
          {TRUST.map(([Icon, label]) => (
            <View key={label} style={s.trustItem}><Icon size={15} color="#5EE0A8" strokeWidth={2} /><Text style={s.trustText}>{tr(label, lang)}</Text></View>
          ))}
        </ScrollView>
        <Pressable accessibilityLabel="Call Connect Bhai" onPress={() => Linking.openURL('tel:+919479935365')} style={s.call}><Phone size={17} color="#5EE0A8" strokeWidth={2.2} /></Pressable>
      </View>
      <View style={s.head}>
        <Pressable onPress={() => router.navigate('/')} accessibilityLabel="Connect Bhai home"><Image source={require('../../assets/images/logo-full.png')} style={s.logo} resizeMode="contain" /></Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {user && <Pressable accessibilityLabel="Search plans" onPress={() => router.navigate('/')} style={s.icon}><Search size={20} color="#fff" strokeWidth={2.2} /></Pressable>}
          {user && <Pressable accessibilityLabel="WhatsApp" onPress={() => Linking.openURL(WA_URL)} style={[s.icon, { backgroundColor: '#25D366' }]}><MessageCircle size={20} color="#fff" strokeWidth={2.4} /></Pressable>}
          <View style={s.pill}>
            {(['en', 'hi'] as const).map((l) => (
              <Pressable key={l} accessibilityLabel={l === 'en' ? 'English' : 'Hindi'} onPress={() => setLang(l)} style={[s.seg, lang === l && s.segOn]}>
                <Text style={[s.segText, lang === l && s.segTextOn]}>{l === 'en' ? 'EN' : 'हिं'}</Text>
              </Pressable>
            ))}
          </View>
          {user ? (
            <Pressable accessibilityLabel="My account" onPress={() => router.navigate(inPortal ? '/profile' : LANDING[user.role])} style={s.avatar}><Text style={s.avatarText}>{(user.name || '?').charAt(0).toUpperCase()}</Text></Pressable>
          ) : (
            <Pressable onPress={() => router.push('/login')} style={s.login}><Text style={s.loginText}>{tr('Log in', lang)}</Text></Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', padding: 3 },
  seg: { minWidth: 34, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segOn: { backgroundColor: '#2F54E0' },
  segText: { color: '#C9D8FF', fontFamily: font.bodyBold, fontSize: 13 },
  segTextOn: { color: '#fff' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.blueDeep, fontFamily: font.displayXBold, fontSize: 16 },
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
