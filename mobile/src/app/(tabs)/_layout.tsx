import { Tabs } from 'expo-router';
import { colors } from '@/lib/theme';
import { useSession } from '@/lib/session';

export default function TabsLayout() {
  const { user } = useSession();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarLabelStyle: { fontSize: 14, fontWeight: '600' }, tabBarIconStyle: { display: 'none' } }}>
      <Tabs.Screen name="index" options={{ title: 'Plans' }} />
      <Tabs.Screen name="requests" options={{ title: 'My requests', href: !user || user.role === 'customer' ? undefined : null }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}
