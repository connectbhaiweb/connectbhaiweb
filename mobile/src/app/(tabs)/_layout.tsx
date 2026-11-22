import { Tabs, router } from 'expo-router';
import { Gauge, LayoutDashboard, Menu, Search, ShieldCheck } from 'lucide-react-native';
import { useEffect } from 'react';
import type { ColorValue } from 'react-native';
import { tr, useLang } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { colors, font } from '@/lib/theme';

/** The website's top menu as the bottom bar: Plans, Care plan, Speed test, and for a logged-in user their portal. */
const PORTAL = { customer: 'My dashboard', dsa: 'DSA portal', tip: 'TIP portal', admin: 'Admin portal' } as const;
const LANDING = { customer: '/portal/requests', dsa: '/portal/home', tip: '/portal/home', admin: '/portal/home' } as const;

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
      <Tabs.Screen name="dashboard" options={{ title: tr(role ? PORTAL[role] : 'Dashboard', lang), href: role ? undefined : null, tabBarIcon: icon(LayoutDashboard) }}
        listeners={{ tabPress: (e) => { e.preventDefault(); if (role) router.navigate(LANDING[role]); } }} />
      <Tabs.Screen name="account" options={{ title: tr('More', lang), tabBarIcon: icon(Menu) }} />
    </Tabs>
  );
}
