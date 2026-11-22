import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { tr, useLang } from '@/lib/i18n';
import { ADDRESS, AREAS, FACEBOOK, HOURS, INSTAGRAM, LEGAL, SITE } from '@/lib/site';
import { colors, font } from '@/lib/theme';

/** The website footer: links, contact, social, legal pages (legal pages open on the website). */
export function Footer() {
  const { lang } = useLang();
  const link = (label: string, onPress: () => void) => <Pressable key={label} onPress={onPress} hitSlop={6}><Text style={s.link}>{tr(label, lang)}</Text></Pressable>;
  return (
    <View style={s.wrap}>
      <Text style={s.head}>{tr('Customers', lang)}</Text>
      {link('Search by PIN code', () => router.navigate('/'))}
      {link('Wi-Fi speed test', () => router.navigate('/speed'))}
      {link('Care plan', () => router.navigate('/care'))}
      {link('Become a DSA or TIP', () => router.push('/apply'))}
      <Text style={[s.head, { marginTop: 14 }]}>{tr('Contact', lang)}</Text>
      <Text style={s.text}>{ADDRESS}</Text>
      <Text style={s.text}>{tr(HOURS, lang)}</Text>
      <Text style={s.text}>{tr(AREAS, lang)}</Text>
      <View style={{ flexDirection: 'row', gap: 18, marginTop: 6 }}>
        {link('Facebook', () => Linking.openURL(FACEBOOK))}
        {link('Instagram', () => Linking.openURL(INSTAGRAM))}
      </View>
      <View style={s.legal}>{LEGAL.map(([l, p]) => link(l, () => Linking.openURL(SITE + p)))}</View>
      <Text style={s.copy}>© {new Date().getFullYear()} Connect Bhai. All Rights Reserved.</Text>
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { backgroundColor: colors.trust, padding: 20, paddingBottom: 28, gap: 8, marginTop: 24 },
  head: { fontFamily: font.display, fontSize: 16, color: '#fff' },
  link: { fontFamily: font.bodyMd, fontSize: 14.5, color: '#8FB4FF' },
  text: { fontFamily: font.body, fontSize: 13.5, color: colors.trustInk, lineHeight: 19 },
  legal: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)' },
  copy: { fontFamily: font.body, fontSize: 12, color: colors.trustInk, marginTop: 4 },
});
