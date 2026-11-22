import { Tabs } from 'expo-router';
import { ClipboardList, CreditCard, Handshake, House, IndianRupee, Menu, Search, Users, Wrench } from 'lucide-react-native';
import { tr, useLang } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { colors, font } from '@/lib/theme';

/** Bottom tabs per role. A tab a role does not use is hidden (href: null). The "More" tab holds the rest. */
const SHOWN: Record<string, string[]> = {
  guest: ['index', 'requests', 'account'],
  customer: ['index', 'requests', 'account'],
  dsa: ['home', 'leads', 'installs', 'commission', 'account'],
  tip: ['home', 'leads', 'payments', 'account'],
  admin: ['home', 'leads', 'partners', 'account'],
};

export default function TabsLayout() {
  const { user } = useSession();
  const { lang } = useLang();
  const shown = SHOWN[user?.role ?? 'guest'];
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
      {tab('requests', 'My bookings', ClipboardList)}
      {tab('home', 'Home', House)}
      {tab('leads', 'Leads', Users)}
      {tab('installs', 'Installs', Wrench)}
      {tab('partners', 'Partners', Handshake)}
      {tab('payments', 'Payments', CreditCard)}
      {tab('commission', 'Commission', IndianRupee)}
      {tab('account', 'More', Menu)}
    </Tabs>
  );
}
