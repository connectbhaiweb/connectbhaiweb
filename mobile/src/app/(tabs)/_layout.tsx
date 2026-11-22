import { Tabs, router } from 'expo-router';
import { Gauge, Menu, Search, ShieldCheck } from 'lucide-react-native';
import { useEffect } from 'react';
import type { ColorValue } from 'react-native';
import { tr, useLang } from '@/lib/i18n';
import { LANDING } from '@/lib/portal';
import { useSession } from '@/lib/session';
import { colors, font } from '@/lib/theme';

let landedFor = '';   // module level: this layout remounts when the user comes back from the portal, and must not redirect again

export default function TabsLayout() {
  const { user } = useSession();
  const { lang } = useLang();
  const role = user?.role;
  useEffect(() => {
    const key = role ?? '';
    if (landedFor === key) return;
    landedFor = key;
    if (role) router.navigate(LANDING[role]);   // after login, open the portal like the website
  }, [role]);

  const icon = (Icon: typeof Search) => function TabIcon({ color }: { color: ColorValue }) { return <Icon size={22} color={color} strokeWidth={2.2} />; };
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: colors.blue, tabBarInactiveTintColor: '#7C8AA8',
      tabBarLabelStyle: { fontFamily: font.bodyBold, fontSize: 11.5 },
      tabBarStyle: { backgroundColor: '#fff', borderTopColor: colors.line, paddingTop: 6 },
    }}>
      <Tabs.Screen name="index" options={{ title: tr('Plans', lang), tabBarIcon: icon(Search) }} />
      <Tabs.Screen name="care" options={{ title: tr('Care plan', lang), tabBarIcon: icon(ShieldCheck) }} />
      <Tabs.Screen name="speed" options={{ title: tr('Speed test', lang), tabBarIcon: icon(Gauge) }} />
      <Tabs.Screen name="account" options={{ title: tr('More', lang), tabBarIcon: icon(Menu) }} />
    </Tabs>
  );
}
