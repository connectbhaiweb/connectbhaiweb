import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

const TITLE = { customer: 'Customer', dsa: 'DSA', tip: 'TIP partner', admin: 'Admin' } as const;

export default function Home() {
  const { user, signOut } = useSession();
  if (!user) return null;
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.wrap}>
        <Text style={s.hi}>Hello, {user.name}</Text>
        <Text style={s.role}>{TITLE[user.role]} dashboard coming soon</Text>
        <Pressable style={s.btn} onPress={signOut}><Text style={s.btnText}>Log out</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  wrap: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  hi: { fontSize: 26, fontWeight: '800', color: colors.text },
  role: { fontSize: 16, color: colors.muted },
  btn: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  btnText: { color: colors.text, fontWeight: '600' },
});
