import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

import { Logo } from '@/components/brand';
import { Button, Field, Muted, Segment, useBusy } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { useAuth } from '@/lib/auth';
import { phoneDigits } from '@/lib/format';
import { useTheme } from '@/lib/theme';

/* Same login as the website for every role (customer, DSA, TIP, admin):
   "Mobile + password" or "WhatsApp OTP". The role comes back from the server. */
const DEEP = '#0A2A78', SKY = '#8DB4FF', PALE = '#C9D8FF';

export default function Login() {
  const t = useTheme();
  const { signIn } = useAuth();
  const [mode, setMode] = useState<'pw' | 'otp'>('pw');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, setError, run } = useBusy();

  const digits = phoneDigits(phone);
  const checkPhone = () => { if (!/^[6-9]\d{9}$/.test(digits)) throw new ApiError('Enter a valid 10-digit mobile number.'); };

  const sendOtp = () => run(async () => { checkPhone(); await api.sendOtp(digits); setStep('code'); });
  const verify = () => run(async () => {
    if (!/^\d{4,8}$/.test(code)) throw new ApiError('Enter the OTP we sent on WhatsApp.');
    signIn(await api.verifyOtp(digits, code, name));
  });
  const passwordLogin = () => run(async () => {
    checkPhone();
    if (!password) throw new ApiError('Enter your password.');
    signIn(await api.loginPassword(digits, password));
  });
  const switchMode = (m: 'pw' | 'otp') => { setMode(m); setStep('phone'); setCode(''); setError(''); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: DEEP }}>
      <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 }} width="100%" height="100%">
        <Defs><Pattern id="g" width="44" height="44" patternUnits="userSpaceOnUse"><Path d="M44 0H0V44" stroke="rgba(141,180,255,0.22)" strokeWidth="1" fill="none" /></Pattern></Defs>
        <Rect width="100%" height="100%" fill="url(#g)" />
      </Svg>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
          <Logo height={36} />
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}
            style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(141,180,255,.6)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 16, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: SKY, fontSize: 12, fontWeight: '800', letterSpacing: 1.7 }}>WELCOME BACK</Text>
          <Text style={{ color: '#fff', fontFamily: 'display', fontWeight: '800', fontSize: 28, lineHeight: 32, marginTop: 6 }}>Compare. Choose. <Text style={{ color: SKY, fontFamily: 'display', fontWeight: '800' }}>Connect.</Text></Text>
          <Text style={{ color: PALE, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 20 }}>Customers, DSAs and TIP partners log in here to track bookings, leads, installations and payments.</Text>

          <View style={{ backgroundColor: t.surface, borderRadius: 18, padding: 18, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 8 }}>
            <Text style={{ color: t.ink, fontFamily: 'display', fontWeight: '700', fontSize: 20, marginBottom: 12 }}>Log in to Connect Bhai</Text>
            <Segment options={[{ value: 'pw', label: 'Mobile + password' }, { value: 'otp', label: 'WhatsApp OTP' }]} value={mode} onChange={switchMode} />

            {mode === 'otp' ? (
              <>
                <Muted style={{ marginBottom: 12 }}>{"We'll send a 6-digit OTP to your WhatsApp. New here? The same step creates your customer account."}</Muted>
                <Field label="WhatsApp number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={16} placeholder="10-digit mobile"
                  editable={step === 'phone'} autoComplete="tel" textContentType="telephoneNumber" />
                {step === 'code' ? (
                  <>
                    <Field label="OTP" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={8} placeholder="6-digit OTP" autoFocus />
                    <Field label="Your name (only if you are new)" value={name} onChangeText={setName} placeholder="Full name" autoComplete="name" />
                  </>
                ) : null}
              </>
            ) : (
              <>
                <Field label="Username (your mobile number)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={16} placeholder="10-digit mobile"
                  autoComplete="username" textContentType="username" autoCorrect={false} />
                <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password"
                  autoCapitalize="none" autoCorrect={false} spellCheck={false} />
              </>
            )}

            {error ? <Text style={{ color: t.bad, marginBottom: 12 }} accessibilityRole="alert">{error}</Text> : null}

            {mode === 'pw' ? <Button label="Log in" onPress={passwordLogin} loading={busy} />
              : step === 'phone' ? <Button label="Send OTP on WhatsApp" onPress={sendOtp} loading={busy} />
              : (
                <View style={{ gap: 10 }}>
                  <Button label="Verify and continue" onPress={verify} loading={busy} />
                  <Button label="Send OTP again" kind="secondary" onPress={sendOtp} disabled={busy} />
                  <Button label="Change number" kind="secondary" onPress={() => { setStep('phone'); setCode(''); setError(''); }} />
                </View>
              )}
            {mode === 'pw' ? <Muted style={{ marginTop: 12 }}>No password yet? Use the WhatsApp OTP tab, it works for every account.</Muted> : null}
            {__DEV__ ? <Muted style={{ marginTop: 8, fontSize: 11 }}>Dev build · server: {API_URL.replace(/^https?:\/\//, '').split('/')[0]}</Muted> : null}
          </View>

          <View style={{ flexDirection: 'row', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
            {['Free for customers', 'Installation tracked end to end'].map(x => (
              <View key={x} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: SKY }} /><Text style={{ color: PALE, fontSize: 14 }}>{x}</Text></View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
