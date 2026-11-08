import { Image } from 'expo-image';
import { View } from 'react-native';
import { Text } from '@/components/text';

/* Brand logo (same file as the website: frontend/public/brand/logo-full.png, 452x96) */
export function Logo({ height = 36 }: { height?: number }) {
  return <Image source={require('../../assets/brand/logo-full.png')} style={{ height, width: (height * 452) / 96 }} contentFit="contain" accessibilityLabel="Connect Bhai" />;
}

/* Provider logos (same SVGs as the website). Other providers show a coloured initial, like the website does. */
const LOGOS: Record<string, number> = {
  jio: require('../../assets/logos/jio.svg'), airtel: require('../../assets/logos/airtel.svg'), bsnl: require('../../assets/logos/bsnl.svg'),
};
export function ProviderLogo({ name, url, size = 34 }: { name: string; url?: string | null; size?: number }) {
  const local = LOGOS[(name || '').toLowerCase()];
  if (local) return <Image source={local} style={{ width: size, height: size }} contentFit="contain" accessibilityLabel={name} />;
  if (url && /^https?:/.test(url)) return <Image source={{ uri: url }} style={{ width: size, height: size }} contentFit="contain" accessibilityLabel={name} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#E8EFFF', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#1450E6', fontWeight: '800' }}>{(name || '?')[0].toUpperCase()}</Text>
    </View>
  );
}
