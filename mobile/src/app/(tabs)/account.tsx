import { router } from 'expo-router';
import { LogOut, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Button, Card, Chip, Field, Segmented, T } from '@/components/ui';
import { deleteMyAccount } from '@/lib/catalog';
import { useLang } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

const TITLE = { customer: 'Customer', dsa: 'DSA', tip: 'TIP partner', admin: 'Admin' } as const;

export default function Account() {
  const { user, signOut } = useSession();
  const { lang, setLang } = useLang();
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
      <AppHeader />
      <ScrollView contentContainerStyle={s.wrap}>
        {!user ? (
          <Card style={{ gap: 12 }}>
            <T v="h1">Welcome to Connect Bhai</T>
            <T v="small" style={{ fontSize: 14.5 }}>Log in with your mobile number to track your requests and manage your connection.</T>
            <Button label="Log in" onPress={() => router.push('/login')} />
          </Card>
        ) : (
          <>
            <Card style={{ gap: 8 }}>
              <Chip label={TITLE[user.role]} tone="blue" />
              <T v="h1">{user.name}</T>
              <T v="small" style={{ fontSize: 14.5 }}>+91 {user.phone}</T>
            </Card>
            <Card style={{ gap: 10 }}>
              <T v="label">Language</T>
              <Segmented items={[{ key: 'en', label: 'English' }, { key: 'hi', label: 'हिन्दी' }]} value={lang} onChange={setLang} />
            </Card>
            <Button kind="outline" icon={LogOut} label="Log out" onPress={signOut} />
            {user.role !== 'admin' && !confirming && <Button kind="ghost" icon={Trash2} label="Delete my account" onPress={() => setConfirming(true)} style={{ borderColor: colors.bad }} />}
            {confirming && (
              <Card style={{ gap: 12 }}>
                <T v="h3">Delete your account</T>
                <T v="small" style={{ fontSize: 14 }}>This permanently deletes your account details. Type your mobile number to confirm.</T>
                <Field mono keyboardType="number-pad" maxLength={10} placeholder="10-digit number" value={phone} onChangeText={(t) => setPhone(t.replace(/\D/g, ''))} />
                <Button kind="danger" label="Delete my account" loading={busy} disabled={phone !== user.phone} onPress={remove} />
                <Button kind="ghost" label="Cancel" onPress={() => { setConfirming(false); setPhone(''); }} />
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.bg }, wrap: { padding: 16, gap: 12 } });
