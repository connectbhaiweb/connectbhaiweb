import { Redirect, Tabs } from 'expo-router';
import { CalendarDays, CreditCard, House, Menu, ShieldCheck, Users, Wrench } from 'lucide-react-native';
import { tr, useLang } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { colors, font } from '@/lib/theme';

/** The role dashboard (website: My dashboard / DSA portal / TIP portal / Admin portal). Its own bottom bar; "More" has the other pages and a way back to the website. */
const SHOWN: Record<string, string[]> = {
  customer: ['requests', 'devices', 'billing', 'more'],
  dsa: ['home', 'leads', 'installs', 'more'],
  tip: ['home', 'leads', 'payments', 'more'],
  admin: ['home', 'leads', 'more'],
};

export default function PortalLayout() {
  const { user, ready } = useSession();
  const { lang } = useLang();
  if (ready && !user) return <Redirect href="/" />;
  const shown = SHOWN[user?.role ?? 'customer'];
  const tab = (name: string, title: string, Icon: typeof House) => (
    <Tabs.Screen key={name} name={name} options={{ title: tr(title, lang), href: shown.includes(name) ? undefined : null, tabBarIcon: ({ color }) => <Icon size={22} color={color} strokeWidth={2.2} /> }} />
  );
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: colors.blue, tabBarInactiveTintColor: '#7C8AA8',
      tabBarLabelStyle: { fontFamily: font.bodyBold, fontSize: 11.5 },
      tabBarStyle: { backgroundColor: '#fff', borderTopColor: colors.line, paddingTop: 6 },
    }}>
      {tab('requests', 'Bookings', CalendarDays)}
      {tab('devices', 'Care plan', ShieldCheck)}
      {tab('billing', 'Payments', CreditCard)}
      {tab('home', user?.role === 'admin' ? 'Overview' : 'Home', House)}
      {tab('leads', 'Leads', Users)}
      {tab('installs', 'Installs', Wrench)}
      {tab('payments', 'Payments', CreditCard)}
      {tab('more', 'More', Menu)}
    </Tabs>
  );
}
