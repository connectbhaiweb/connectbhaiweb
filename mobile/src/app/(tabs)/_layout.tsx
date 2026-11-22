import { Tabs } from 'expo-router';
import { ClipboardList, Search, UserRound } from 'lucide-react-native';
import { colors, font } from '@/lib/theme';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: colors.blue, tabBarInactiveTintColor: '#7C8AA8',
      tabBarLabelStyle: { fontFamily: font.bodyBold, fontSize: 11.5 },
      tabBarStyle: { backgroundColor: '#fff', borderTopColor: colors.line, paddingTop: 6 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Plans', tabBarIcon: ({ color }) => <Search size={22} color={color} strokeWidth={2.2} /> }} />
      <Tabs.Screen name="requests" options={{ title: 'My bookings', tabBarIcon: ({ color }) => <ClipboardList size={22} color={color} strokeWidth={2.2} /> }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ color }) => <UserRound size={22} color={color} strokeWidth={2.2} /> }} />
    </Tabs>
  );
}
