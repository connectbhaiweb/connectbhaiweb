import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Hero } from '@/components/Hero';
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
      <Hero>
        <View style={s.topRow}>
          <Image source={require('../../assets/images/logo-full.png')} style={s.logo} resizeMode="contain" />
          <Pressable accessibilityLabel="Close" onPress={() => router.back()} style={s.x}><X size={20} color="#fff" /></Pressable>
        </View>
        <T v="h1" style={{ color: '#fff', marginTop: 18 }}>Log in</T>
        <T style={{ color: '#C9D8FF' }}>Customers, DSAs, installers and admins log in with a mobile number.</T>
      </Hero>
      <View style={s.card}>
        <T v="h2">Log in to Connect Bhai</T>
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
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { height: 34, width: 160 },
  x: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  card: { margin: 16, marginTop: -12, backgroundColor: '#fff', borderRadius: 22, padding: 18, gap: 12, borderWidth: 1, borderColor: colors.cardLine },
});
