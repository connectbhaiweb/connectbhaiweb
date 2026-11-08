import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useAuth } from '@/lib/auth';
import type { Role } from '@/lib/api';
import { useTheme } from '@/lib/theme';

type Tab = { name: string; title: string; icon: keyof typeof Ionicons.glyphMap };
const ALL: Tab[] = [
  { name: 'home', title: 'Plans', icon: 'search' },
  { name: 'dashboard', title: 'Dashboard', icon: 'home' },
  { name: 'leads', title: 'Leads', icon: 'people' },
  { name: 'bookings', title: 'Installs', icon: 'construct' },
  { name: 'tickets', title: 'Support', icon: 'headset' },
  { name: 'care', title: 'Care plan', icon: 'shield-checkmark' },
  { name: 'payments', title: 'Payments', icon: 'card' },
  { name: 'commission', title: 'Commission', icon: 'wallet' },
  { name: 'chat', title: 'Chat', icon: 'chatbubbles' },
];
/* Which tabs each role sees. The role comes from the server after login. */
const BY_ROLE: Record<Role, string[]> = {
  customer: ['home', 'dashboard', 'tickets', 'care', 'payments'],
  dsa: ['dashboard', 'leads', 'commission', 'chat'],
  tip: ['dashboard', 'leads', 'bookings', 'tickets', 'chat'],
  admin: ['dashboard'],
};

export default function AppTabs() {
  const t = useTheme();
  const { user } = useAuth();
  const show = user ? BY_ROLE[user.role] : ['home'];   // guests see the website-style home only
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: t.blue, tabBarInactiveTintColor: t.muted,
      tabBarStyle: user ? { backgroundColor: t.surface, borderTopColor: t.line } : { display: 'none' }, tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    }}>
      <Tabs.Screen name="index" options={{ href: null }} />
      {ALL.map(tab => (
        <Tabs.Screen key={tab.name} name={tab.name}
          options={{ title: tab.title, href: show.includes(tab.name) ? undefined : null, tabBarIcon: ({ color, size }) => <Ionicons name={tab.icon} size={size} color={color as string} /> }} />
      ))}
    </Tabs>
  );
}
