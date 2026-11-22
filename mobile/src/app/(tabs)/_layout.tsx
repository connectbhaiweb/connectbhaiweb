import { Tabs, router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { CalendarDays, CreditCard, House, Menu, Search, ShieldCheck, Users, Wrench } from 'lucide-react-native';
import { tr, useLang } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { colors, font } from '@/lib/theme';

/** Bottom tabs per role, as on the website's phone view (first items in the bar, the rest under More). A tab a role does not use is hidden (href: null). */
const SHOWN: Record<string, string[]> = {
  guest: ['index', 'requests', 'account'],
  customer: ['requests', 'devices', 'billing', 'account'],
  dsa: ['home', 'leads', 'installs', 'account'],
  tip: ['home', 'leads', 'payments', 'account'],
  admin: ['home', 'leads', 'account'],
};
const LANDING: Record<string, '/requests' | '/home'> = { customer: '/requests', dsa: '/home', tip: '/home', admin: '/home' };

export default function TabsLayout() {
  const { user } = useSession();
  const { lang } = useLang();
  const role = user?.role ?? 'guest';
  const shown = SHOWN[role];
  const landed = useRef('');
  useEffect(() => { if (landed.current !== role) { landed.current = role; if (LANDING[role]) router.navigate(LANDING[role]); } }, [role]);
  const tab = (name: string, title: string, Icon: typeof Search) => (
    <Tabs.Screen key={name} name={name} options={{ title: tr(title, lang), href: shown.includes(name) ? undefined : null, tabBarIcon: ({ color }) => <Icon size={22} color={color} strokeWidth={2.2} /> }} />
  );
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: colors.blue, tabBarInactiveTintColor: '#7C8AA8',
      tabBarLabelStyle: { fontFamily: font.bodyBold, fontSize: 11.5 },
      tabBarStyle: { backgroundColor: '#fff', borderTopColor: colors.line, paddingTop: 6 },
    }}>
      {tab('index', 'Plans', Search)}
      {tab('requests', 'Bookings', CalendarDays)}
      {tab('devices', 'Care plan', ShieldCheck)}
      {tab('billing', 'Payments', CreditCard)}
      {tab('home', role === 'admin' ? 'Overview' : 'Home', House)}
      {tab('leads', 'Leads', Users)}
      {tab('installs', 'Installs', Wrench)}
      {tab('payments', 'Payments', CreditCard)}
      {tab('account', 'More', Menu)}
    </Tabs>
  );
}
