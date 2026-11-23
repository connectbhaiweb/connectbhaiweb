import { MessageCircle } from 'lucide-react-native';
import { Linking, Pressable, StyleSheet } from 'react-native';
import { WA_URL } from '@/lib/site';

/** The website's floating WhatsApp button (bottom right, above the tab bar). */
export function FloatingWhatsApp() {
  return (
    <Pressable accessibilityLabel="Chat on WhatsApp" onPress={() => Linking.openURL(WA_URL)} style={s.btn}>
      <MessageCircle size={28} color="#fff" strokeWidth={2.2} />
    </Pressable>
  );
}
const s = StyleSheet.create({
  btn: { position: 'absolute', right: 14, bottom: 100, width: 54, height: 54, borderRadius: 27, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
});
