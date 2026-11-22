import { router, useLocalSearchParams } from 'expo-router';
import { CircleCheck, X } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Field, T } from '@/components/ui';
import { requestConnection } from '@/lib/catalog';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

export default function RequestConnection() {
  const { pincode, plan_id, plan_name } = useLocalSearchParams<{ pincode: string; plan_id: string; plan_name: string }>();
  const { user } = useSession();
  const [name, setName] = useState(user?.role === 'customer' && user.name !== 'Customer' ? user.name : '');
  const [phone, setPhone] = useState(user?.role === 'customer' ? user.phone : '');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ref, setRef] = useState('');

  const submit = async () => {
    setBusy(true); setError('');
    try { setRef((await requestConnection({ name, phone, pincode, address, plan_id: plan_id ? Number(plan_id) : undefined })).ref_code); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    setBusy(false);
  };
  const ok = name.trim().length >= 2 && phone.length === 10;

  if (ref) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={[s.wrap, { alignItems: 'center', paddingTop: 48 }]}>
          <View style={s.tick}><CircleCheck size={40} color={colors.green} strokeWidth={2.2} /></View>
          <T v="h1" style={{ textAlign: 'center' }}>Request sent</T>
          <T style={{ textAlign: 'center' }}>Your reference is <T v="h3">{ref}</T>. A partner will call you to confirm the plan and book the installation.</T>
          <Button block label="Done" onPress={() => router.dismissAll()} />
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
          <View style={s.top}>
            <T v="h1" style={{ flex: 1 }}>{plan_name ? 'Request this connection' : 'Request a callback'}</T>
            <Pressable accessibilityLabel="Close" onPress={() => router.back()} style={s.x}><X size={20} color={colors.ink} /></Pressable>
          </View>
          {!!plan_name && <Card style={{ gap: 4 }}><T v="label">Selected plan</T><T v="h3">{plan_name}</T><T v="small">PIN code {pincode}</T></Card>}
          {!plan_name && <T v="small">PIN code {pincode}</T>}
          <Field label="Your name" placeholder="Full name" value={name} onChangeText={setName} />
          <Field label="Mobile number" placeholder="10-digit mobile number" keyboardType="number-pad" maxLength={10} value={phone} onChangeText={(t) => setPhone(t.replace(/\D/g, ''))} />
          <Field label="Address (optional)" placeholder="House no, street, landmark" multiline value={address} onChangeText={setAddress} />
          {!!error && <T style={{ color: colors.bad }}>{error}</T>}
          <Button block label="Send request" loading={busy} disabled={!ok} onPress={submit} />
          <T v="small" style={{ textAlign: 'center' }}>A partner will call you to confirm. No payment now.</T>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  wrap: { padding: 20, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  x: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  tick: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
});
