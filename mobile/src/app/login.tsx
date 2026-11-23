import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Button, Field, Pill, T } from '@/components/ui';
import { requestOtp } from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

export default function Login() {
  const { signIn, signInPassword } = useSession();
  const [mode, setMode] = useState<'otp' | 'pw'>('otp');
  const [pw, setPw] = useState('');
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
  const login = () => run(async () => { await signInPassword(phone, pw); router.back(); });
  const verify = () => run(async () => { await signIn(phone, code); router.back(); });

  return (
    <View style={s.screen}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.center} pointerEvents="box-none">
      <View style={s.card}>
        <View style={s.head}><T v="h2" style={{ flex: 1 }}>Log in to Connect Bhai</T><Pressable accessibilityLabel="Close" onPress={() => router.back()} style={s.x}><X size={18} color={colors.ink} /></Pressable></View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pill label="Mobile + password" on={mode === 'pw'} onPress={() => { setMode('pw'); setError(''); }} />
          <Pill label="WhatsApp OTP" on={mode === 'otp'} onPress={() => { setMode('otp'); setError(''); }} />
        </View>
        {mode === 'pw' ? (
          <>
            <Field label="Username (your mobile number)" mono placeholder="10-digit mobile" keyboardType="number-pad" maxLength={10} value={phone} onChangeText={(t) => setPhone(t.replace(/\D/g, ''))} />
            <Field label="Password" secureTextEntry autoCapitalize="none" autoComplete="current-password" value={pw} onChangeText={setPw} />
            {!!error && <T style={{ color: colors.bad }}>{error}</T>}
            <Button block label="Log in" loading={busy} disabled={phone.length !== 10 || !pw} onPress={login} />
            <T v="small" style={{ fontSize: 14 }}><T v="small" style={{ fontSize: 14, color: colors.blue, textDecorationLine: 'underline' }} onPress={() => { setMode('otp'); setError(''); }}>Forgot password?</T> Partners and customers can log in with an OTP on WhatsApp.</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pill label="Admin" onPress={() => setPhone('9999999999')} />
              <T v="small" style={{ flex: 1, fontSize: 13 }}>Fills the admin username. Enter the password and tap Log in.</T>
            </View>
          </>
        ) : (
          <>
            {!sent && <T v="small">We will send a 6-digit OTP to your WhatsApp. New here? The same step creates your customer account.</T>}
            {sent && <T v="small">{`Sent to WhatsApp +91 ${phone.slice(0, 5)} ${phone.slice(5)}.`}</T>}
            {!sent ? (
              <Field label="WhatsApp number" mono placeholder="10-digit mobile" keyboardType="number-pad" maxLength={10} value={phone} onChangeText={(t) => setPhone(t.replace(/\D/g, ''))} autoFocus />
            ) : (
              <Field label="6-digit OTP" mono placeholder="OTP" keyboardType="number-pad" maxLength={8} textContentType="oneTimeCode" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, ''))} autoFocus />
            )}
            {!!error && <T style={{ color: colors.bad }}>{error}</T>}
            <Button block label={sent ? 'Verify and log in' : 'Send OTP on WhatsApp'} loading={busy} disabled={sent ? code.length < 4 : phone.length !== 10} onPress={sent ? verify : send} />
            {sent && <Button kind="ghost" label="Resend OTP" onPress={send} />}
            {sent && <Button kind="ghost" label="Change number" onPress={() => { setSent(false); setCode(''); setError(''); }} />}
          </>
        )}
      </View>
      </KeyboardAvoidingView>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'rgba(6,14,40,0.62)' },
  center: { flex: 1, justifyContent: 'center', padding: 18 },
  card: { backgroundColor: '#fff', borderRadius: 22, padding: 20, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  x: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
