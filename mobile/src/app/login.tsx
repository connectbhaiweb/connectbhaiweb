import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { requestOtp } from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

export default function Login() {
  const { signIn } = useSession();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    setBusy(false);
  };
  const send = () => run(async () => { await requestOtp(phone); setSent(true); });
  const verify = () => run(async () => { await signIn(phone, code); router.back(); });

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.wrap}>
        <View style={s.logoBox}><Image source={require('../../assets/images/logo-full.png')} style={s.logo} resizeMode="contain" /></View>
        <Text style={s.sub}>{sent ? `Enter the OTP sent to ${phone}` : 'Log in with your mobile number'}</Text>

        {!sent ? (
          <TextInput style={s.input} placeholder="10-digit mobile number" keyboardType="number-pad" maxLength={10}
            value={phone} onChangeText={(t) => setPhone(t.replace(/\D/g, ''))} autoFocus />
        ) : (
          <TextInput style={s.input} placeholder="OTP" keyboardType="number-pad" maxLength={8}
            textContentType="oneTimeCode" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, ''))} autoFocus />
        )}

        {!!error && <Text style={s.error}>{error}</Text>}

        <Pressable style={[s.btn, busy && s.dim]} disabled={busy || (sent ? code.length < 4 : phone.length !== 10)} onPress={sent ? verify : send}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{sent ? 'Verify and log in' : 'Send OTP'}</Text>}
        </Pressable>

        {sent && (
          <Pressable onPress={() => { setSent(false); setCode(''); setError(''); }}>
            <Text style={s.link}>Change number</Text>
          </Pressable>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  wrap: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 },
  logoBox: { backgroundColor: colors.navy, borderRadius: 14, padding: 14, alignSelf: 'flex-start' },
  logo: { height: 36, width: 170 },
  sub: { fontSize: 16, color: colors.muted, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 18, backgroundColor: '#fff' },
  error: { color: colors.danger },
  btn: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
  dim: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { color: colors.primary, textAlign: 'center', padding: 8 },
});
