import { router, useLocalSearchParams } from 'expo-router';
import { Check, CircleCheck, X } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Field, Pill, T } from '@/components/ui';
import { requestOtp } from '@/lib/api';
import { requestConnection } from '@/lib/catalog';
import { tr, useLang } from '@/lib/i18n';
import { dayChoices } from '@/lib/partner';
import { useSession } from '@/lib/session';
import { colors, font } from '@/lib/theme';

/* Website "Request this connection" / "Request a callback" form. A visitor who is not logged in confirms the number with an OTP first (this also creates their account). */
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function RequestConnection() {
  const { pincode, plan_id, plan_name, area: areaParam } = useLocalSearchParams<{ pincode: string; plan_id: string; plan_name: string; area?: string }>();
  const { user, signIn } = useSession();
  const { lang } = useLang();
  const customer = user?.role === 'customer';
  const [name, setName] = useState(customer && user.name !== 'Customer' ? user.name : '');
  const [phone, setPhone] = useState(customer ? user.phone : '');
  const [pin, setPin] = useState(String(pincode ?? ''));
  const [area, setArea] = useState(String(areaParam ?? ''));
  const [email, setEmail] = useState(customer ? String(user.email ?? '') : '');
  const [address, setAddress] = useState('');
  const [when, setWhen] = useState<number | null>(null);
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ref, setRef] = useState('');
  const days = dayChoices();

  const send = async () => requestConnection({
    name, phone, pincode: pin, area, email, address, plan_id: plan_id ? Number(plan_id) : undefined,
    preferredDate: when === null ? undefined : iso(days[when].date),
  });
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    setBusy(false);
  };
  const submit = () => run(async () => {
    if (user) { setRef((await send()).ref_code); return; }
    await requestOtp(phone, 'customer'); setStep('otp');
  });
  const verify = () => run(async () => { await signIn(phone, code, name.trim(), 'customer'); setRef((await send()).ref_code); });
  const ok = name.trim().length >= 2 && phone.length === 10 && /^[1-9]\d{5}$/.test(pin) && consent;

  if (ref) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={[s.wrap, { alignItems: 'center', paddingTop: 48 }]}>
          <View style={s.tick}><CircleCheck size={40} color={colors.green} strokeWidth={2.2} /></View>
          <T v="h1" style={{ textAlign: 'center' }}>Request submitted</T>
          <T style={{ textAlign: 'center' }}>Your request number is</T>
          <Text style={s.ref}>{ref}</Text>
          <T style={{ textAlign: 'center' }}>{`An assigned TIP will call you on ${phone}. Track every step in your dashboard.`}</T>
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
            <T v="h1" style={{ flex: 1 }}>{step === 'otp' ? 'Enter WhatsApp OTP' : plan_name ? 'Request this connection' : 'Request a callback'}</T>
            <Pressable accessibilityLabel="Close" onPress={() => router.back()} style={s.x}><X size={20} color={colors.ink} /></Pressable>
          </View>
          {step === 'otp' ? (
            <>
              <T v="small" style={{ fontSize: 14.5 }}>{`Sent to WhatsApp +91 ${phone.slice(0, 5)} ${phone.slice(5)}. This confirms your number before we create the request.`}</T>
              <Field label="6-digit OTP" mono placeholder="OTP" keyboardType="number-pad" maxLength={8} textContentType="oneTimeCode" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, ''))} autoFocus />
              {!!error && <T style={{ color: colors.bad }}>{error}</T>}
              <Button block label="Verify and submit request" loading={busy} disabled={code.length < 4} onPress={verify} />
              <Button kind="ghost" label="Resend OTP" onPress={() => run(async () => { await requestOtp(phone, 'customer'); })} />
              <Button kind="ghost" label="Change number" onPress={() => { setStep('form'); setCode(''); setError(''); }} />
            </>
          ) : (
            <>
              {!!plan_name
                ? <Card style={{ gap: 4 }}><T v="label">Selected plan</T><T v="h3">{plan_name}</T></Card>
                : <T v="small" style={{ fontSize: 14.5 }}>Share your details and a TIP will call you to help choose a plan.</T>}
              <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" />
              <Field label="Mobile number" mono keyboardType="number-pad" maxLength={10} value={phone} editable={!customer} onChangeText={(t) => setPhone(t.replace(/\D/g, ''))} />
              <Field label="PIN code" mono placeholder="Enter your PIN code" keyboardType="number-pad" maxLength={6} value={pin} onChangeText={(t) => setPin(t.replace(/\D/g, ''))} />
              <Field label="Area / colony" value={area} onChangeText={setArea} />
              <Field label="Email (optional)" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail} />
              <T v="small" style={{ fontSize: 13, marginTop: -8 }}>Your agent, installer and admin can see it to send bills and updates.</T>
              <Field label="Address" placeholder="House no., street, landmark" value={address} onChangeText={setAddress} autoComplete="street-address" />
              <T v="label">Preferred installation date (optional)</T>
              <View style={s.chips}>{days.map((d, i) => <Pill key={d.label} label={d.label} on={when === i} onPress={() => setWhen(when === i ? null : i)} />)}</View>
              <Pressable style={s.consent} onPress={() => setConsent(!consent)}>
                <View style={[s.box, consent && s.boxOn]}>{consent && <Check size={15} color="#fff" strokeWidth={3} />}</View>
                <Text style={s.consentText}>{tr('I agree to be contacted by Connect Bhai and its DSAs and TIPs about this request.', lang)}</Text>
              </Pressable>
              {!user && <T v="small" style={{ fontSize: 13 }}>We will send an OTP to this number on WhatsApp to confirm it. This also creates your account so you can track the request.</T>}
              {!!error && <T style={{ color: colors.bad }}>{error}</T>}
              <Button block label={user ? 'Submit request' : 'Verify on WhatsApp and submit'} loading={busy} disabled={!ok} onPress={submit} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  wrap: { padding: 20, gap: 14, paddingBottom: 40 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  x: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  tick: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  ref: { fontFamily: font.displayXBold, fontSize: 24, color: colors.blue },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  consent: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  consentText: { flex: 1, fontFamily: font.body, fontSize: 14, lineHeight: 20, color: colors.text },
});
