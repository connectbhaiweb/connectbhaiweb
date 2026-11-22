import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    try {
      const r = await requestConnection({ name, phone, pincode, address, plan_id: plan_id ? Number(plan_id) : undefined });
      setRef(r.ref_code);
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    setBusy(false);
  };
  const ok = name.trim().length >= 2 && phone.length === 10;

  if (ref) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.wrap}>
          <Text style={s.h1}>Request sent</Text>
          <Text style={s.sub}>Your reference is {ref}. A partner will call you to confirm the plan and book the installation.</Text>
          <Pressable style={s.btn} onPress={() => router.dismissAll()}><Text style={s.btnText}>Done</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
          <Text style={s.h1}>{plan_name ? 'Request this connection' : 'Request a callback'}</Text>
          {!!plan_name && <Text style={s.plan}>{plan_name}</Text>}
          <Text style={s.sub}>PIN code {pincode}</Text>
          <TextInput style={s.input} placeholder="Your name" value={name} onChangeText={setName} />
          <TextInput style={s.input} placeholder="10-digit mobile number" keyboardType="number-pad" maxLength={10}
            value={phone} onChangeText={(t) => setPhone(t.replace(/\D/g, ''))} />
          <TextInput style={[s.input, { height: 90 }]} placeholder="Address (optional)" multiline value={address} onChangeText={setAddress} />
          {!!error && <Text style={s.error}>{error}</Text>}
          <Pressable style={[s.btn, (!ok || busy) && s.dim]} disabled={!ok || busy} onPress={submit}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Send request</Text>}
          </Pressable>
          <Pressable onPress={() => router.back()}><Text style={s.link}>Cancel</Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  wrap: { padding: 20, gap: 12 },
  h1: { fontSize: 24, fontWeight: '800', color: colors.navy },
  plan: { fontSize: 17, fontWeight: '700', color: colors.text },
  sub: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 17, backgroundColor: '#fff' },
  error: { color: colors.danger },
  btn: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
  dim: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { color: colors.primary, textAlign: 'center', padding: 8, fontWeight: '600' },
});
