import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Dimensions, Easing, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/brand';
import { Text } from '@/components/text';

/* Side menu that slides in from the left (the website's burger menu on phones). */
const W = Math.min(320, Math.round(Dimensions.get('window').width * 0.82));

export type DrawerItem = { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; danger?: boolean };

export function Drawer({ visible, onClose, items, footer }: { visible: boolean; onClose: () => void; items: DrawerItem[]; footer?: ReactNode }) {
  const [x] = useState(() => new Animated.Value(-W));
  const [fade] = useState(() => new Animated.Value(0));
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(x, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(x, { toValue: -W, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,12,30,0.55)', opacity: fade }}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close menu" />
        </Animated.View>
        <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: W, backgroundColor: '#0A2A78', transform: [{ translateX: x }], shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, elevation: 16 }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(141,180,255,.18)' }}>
              <Logo height={34} />
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close menu" hitSlop={10}><Ionicons name="close" size={26} color="#fff" /></Pressable>
            </View>
            <View style={{ padding: 12, gap: 4 }}>
              {items.map(it => (
                <Pressable key={it.label} onPress={() => { onClose(); setTimeout(it.onPress, 230); }} accessibilityRole="button"
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, backgroundColor: pressed ? 'rgba(141,180,255,.16)' : 'transparent' })}>
                  <Ionicons name={it.icon} size={22} color={it.danger ? '#FFB4AB' : '#8DB4FF'} />
                  <Text style={{ color: it.danger ? '#FFB4AB' : '#fff', fontSize: 16, fontWeight: '700' }}>{it.label}</Text>
                </Pressable>
              ))}
            </View>
            {footer ? <View style={{ marginTop: 'auto', padding: 16 }}>{footer}</View> : null}
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}
