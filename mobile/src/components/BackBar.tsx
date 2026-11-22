import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';
import { tr, useLang } from '@/lib/i18n';
import { colors, font } from '@/lib/theme';

/** "Back" link under the header, for pages opened from the More menu. */
export function BackBar() {
  const { lang } = useLang();
  return (
    <Pressable onPress={() => router.back()} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 12, paddingTop: 12 }}>
      <ChevronLeft size={20} color={colors.blue} strokeWidth={2.6} />
      <Text style={{ fontFamily: font.bodyBold, fontSize: 15, color: colors.blue }}>{tr('Back', lang)}</Text>
    </Pressable>
  );
}
