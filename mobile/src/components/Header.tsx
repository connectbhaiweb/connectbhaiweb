import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/lib/theme';

export function Header() {
  const { top } = useSafeAreaInsets();
  return (
    <View style={[s.bar, { paddingTop: top + 10 }]}>
      <Image source={require('../../assets/images/logo-full.png')} style={s.logo} resizeMode="contain" />
    </View>
  );
}
const s = StyleSheet.create({
  bar: { backgroundColor: colors.navy, paddingBottom: 12, paddingHorizontal: 16 },
  logo: { height: 34, width: 160 },
});
