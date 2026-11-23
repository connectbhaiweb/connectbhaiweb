import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Button, Card, Field, T } from '@/components/ui';
import { addLead } from '@/lib/partner';
import { colors } from '@/lib/theme';

export default function NewLead() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pincode, setPincode] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const ok = name.trim().length > 1 && phone.length === 10 && pincode.length === 6;
  const save = async () => {
    setBusy(true); setError('');
    try { const r = await addLead({ name, phone, pincode, address }); setDone(r.ref_code); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    setBusy(false);
  };
  return (
    <View style={s.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader />
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        {done ? (
          <Card style={{ gap: 10 }}>
            <T v="h2">Lead added</T>
            <T v="body">Reference {done}. It is now in your Leads list.</T>
            <Button label="Back to leads" onPress={() => router.back()} />
          </Card>
        ) : (
          <Card style={{ gap: 12 }}>
            <T v="h2">Add a lead</T>
            <T v="small" style={{ fontSize: 14 }}>Only add a customer who agreed to be contacted by Connect Bhai.</T>
            <Field label="Customer name" value={name} onChangeText={setName} autoCapitalize="words" />
            <Field label="Mobile number" keyboardType="number-pad" maxLength={10} value={phone} onChangeText={(t) => setPhone(t.replace(/\D/g, ''))} />
            <Field label="PIN code" keyboardType="number-pad" maxLength={6} value={pincode} onChangeText={(t) => setPincode(t.replace(/\D/g, ''))} />
            <Field label="Address (optional)" value={address} onChangeText={setAddress} />
            {!!error && <T v="small" style={{ color: colors.red }}>{error}</T>}
            <Button label="Add lead" disabled={!ok} loading={busy} onPress={save} />
            <Button kind="ghost" label="Cancel" onPress={() => router.back()} />
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.bg }, wrap: { padding: 16 } });
