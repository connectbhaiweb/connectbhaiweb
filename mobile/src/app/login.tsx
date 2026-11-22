import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Hero } from '@/components/Hero';
import { Button, Field, T } from '@/components/ui';
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
        <T v="h2">{sent ? 'Enter the OTP' : 'Your mobile number'}</T>
        <T v="small">{sent ? `We sent a 6-digit OTP to ${phone}.` : 'We will send you a one-time password.'}</T>
        {!sent ? (
          <Field mono placeholder="10-digit number" keyboardType="number-pad" maxLength={10} value={phone} onChangeText={(t) => setPhone(t.replace(/\D/g, ''))} autoFocus />
        ) : (
          <Field mono placeholder="OTP" keyboardType="number-pad" maxLength={8} textContentType="oneTimeCode" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, ''))} autoFocus />
        )}
        {!!error && <T style={{ color: colors.bad }}>{error}</T>}
        <Button block label={sent ? 'Verify and log in' : 'Send OTP'} loading={busy} disabled={sent ? code.length < 4 : phone.length !== 10} onPress={sent ? verify : send} />
        {sent && <Button kind="ghost" label="Change number" onPress={() => { setSent(false); setCode(''); setError(''); }} />}
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
