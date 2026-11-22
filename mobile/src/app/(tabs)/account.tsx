import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Header } from '@/components/Header';
import { deleteMyAccount } from '@/lib/catalog';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

const TITLE = { customer: 'Customer', dsa: 'DSA', tip: 'TIP partner', admin: 'Admin' } as const;

export default function Account() {
  const { user, signOut } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try { await deleteMyAccount(phone); await signOut(); setConfirming(false); setPhone(''); }
    catch (e) { Alert.alert('Could not delete account', e instanceof Error ? e.message : 'Please try again.'); }
    setBusy(false);
  };

  return (
    <View style={s.screen}>
      <Header />
      <View style={s.wrap}>
        {!user ? (
          <>
            <Text style={s.h1}>Welcome to ConnectBhai</Text>
            <Text style={s.sub}>Log in with your mobile number to track your requests.</Text>
            <Pressable style={s.btn} onPress={() => router.push('/login')}><Text style={s.btnText}>Log in</Text></Pressable>
          </>
        ) : (
          <>
            <Text style={s.h1}>{user.name}</Text>
            <Text style={s.sub}>{TITLE[user.role]} · {user.phone}</Text>
            {user.role !== 'customer' && <Text style={s.sub}>The {TITLE[user.role]} dashboard is coming soon in the app.</Text>}
            <Pressable style={s.outline} onPress={signOut}><Text style={s.outlineText}>Log out</Text></Pressable>
            {user.role !== 'admin' && !confirming && (
              <Pressable onPress={() => setConfirming(true)}><Text style={s.danger}>Delete my account</Text></Pressable>
            )}
            {confirming && (
              <View style={s.box}>
                <Text style={s.sub}>This permanently deletes your account details. Type your mobile number to confirm.</Text>
                <TextInput style={s.input} keyboardType="number-pad" maxLength={10} placeholder="Your 10-digit number"
                  value={phone} onChangeText={(t) => setPhone(t.replace(/\D/g, ''))} />
                <Pressable style={[s.del, (phone !== user.phone || busy) && { opacity: 0.5 }]} disabled={phone !== user.phone || busy} onPress={remove}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Delete my account</Text>}
                </Pressable>
                <Pressable onPress={() => { setConfirming(false); setPhone(''); }}><Text style={s.link}>Cancel</Text></Pressable>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  wrap: { padding: 20, gap: 12 },
  h1: { fontSize: 24, fontWeight: '800', color: colors.navy },
  sub: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  btn: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  outline: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: '#fff' },
  outlineText: { fontWeight: '600', color: colors.text },
  danger: { color: colors.danger, textAlign: 'center', padding: 10, fontWeight: '600' },
  box: { gap: 10, backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, fontSize: 17 },
  del: { backgroundColor: colors.danger, borderRadius: 12, padding: 14, alignItems: 'center' },
  link: { color: colors.primary, textAlign: 'center', fontWeight: '600' },
});
