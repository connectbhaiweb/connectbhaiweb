import { router } from 'expo-router';
import { CircleCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { BackBar } from '@/components/BackBar';
import { Button, Card, Field, Pill, Segmented, T } from '@/components/ui';
import { api } from '@/lib/api';
import { inr } from '@/lib/catalog';
import { payCharge } from '@/lib/pay';
import { loadCities, type City } from '@/lib/site';
import { colors } from '@/lib/theme';

/* Website home "DSA / TIP application" (Grow with Connect Bhai). Documents (Aadhaar, PAN, bank proof) can be sent later; the API makes them optional. */
type Kind = 'dsa' | 'tip';
type Settings = { tip_onboarding_fee?: number | string; gst_percent?: number | string };

export default function Apply() {
  const [kind, setKind] = useState<Kind>('dsa');
  const [f, setF] = useState({ name: '', firm: '', phone: '', email: '', pincodes: '', address: '', pincode: '', aadhaar: '', pan: '', gst: '', bank: '', acct: '', ifsc: '' });
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const [cities, setCities] = useState<City[]>([]);
  const [cityId, setCityId] = useState<number | null>(null);
  const [fee, setFee] = useState<{ amount: number; gst: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<'' | 'applied' | 'paid'>('');

  useEffect(() => {
    loadCities().then((c) => { setCities(c); setCityId(c.find((x) => x.status === 'live')?.id ?? null); }).catch(() => {});
    api<Settings>('GET', '/settings/public', undefined, { anon: true }).then((d) => setFee({ amount: Number(d.tip_onboarding_fee) || 0, gst: Number(d.gst_percent) || 18 })).catch(() => {});
  }, []);

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const d = await api<{ user: { id: number }; charge?: { id: number } | null; payment_token?: string }>('POST', '/partners/register', {
        role: kind, name: f.name.trim(), phone: f.phone, email: f.email.trim() || undefined, address: f.address.trim(), pincode: f.pincode,
        city_id: cityId ?? undefined, business_name: f.firm.trim() || undefined, gst_number: f.gst.trim().toUpperCase() || undefined,
        aadhaar: f.aadhaar, pan: f.pan.trim().toUpperCase(), bank_name: f.bank.trim(), bank_account: f.acct, bank_ifsc: f.ifsc.trim().toUpperCase(),
        service_pincodes: f.pincodes.split(',').map((x) => x.trim()).filter(Boolean),
      }, { anon: true });
      if (kind === 'tip' && d.charge && d.payment_token) { await payCharge(d.charge.id, { name: f.name, phone: f.phone }, d.payment_token); setDone('paid'); }
      else setDone('applied');
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    setBusy(false);
  };
  const ok = f.name.trim().length >= 2 && f.phone.length === 10 && f.address.trim().length >= 5 && /^[1-9]\d{5}$/.test(f.pincode)
    && f.aadhaar.replace(/\s/g, '').length === 12 && /^[A-Za-z]{5}\d{4}[A-Za-z]$/.test(f.pan.trim()) && f.bank.trim() && /^\d{6,20}$/.test(f.acct) && /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(f.ifsc.trim());

  return (
    <View style={s.screen}>
      <AppHeader />
      <BackBar />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.wrap}>
          {done ? (
            <Card style={{ gap: 12, alignItems: 'center' }}>
              <CircleCheck size={44} color={colors.green} />
              <T v="h1" style={{ textAlign: 'center' }}>Application submitted</T>
              <T style={{ textAlign: 'center' }}>{done === 'paid' ? 'Registration fee received. Admin will verify your details and approve you. You can then log in with your mobile number.' : 'Admin will verify your details and approve you. You can then log in with your mobile number.'}</T>
              <Button block label="Done" onPress={() => router.back()} />
            </Card>
          ) : (
            <>
              <T v="eyebrow">For DSAs & TIPs</T>
              <T v="h1">Grow with Connect Bhai</T>
              <T v="small" style={{ fontSize: 14.5, lineHeight: 21 }}>Join as a Direct Selling Agent (DSA) or a Telecom Infrastructure Partner (TIP). Admin verifies every DSA and TIP before leads are assigned.</T>
              <Card style={{ gap: 12 }}>
                <T v="h3">DSA / TIP application</T>
                <T v="label">I am a</T>
                <Segmented<Kind> items={[{ key: 'dsa', label: 'DSA' }, { key: 'tip', label: 'TIP' }]} value={kind} onChange={setKind} />
                <T v="small">{kind === 'dsa' ? 'Direct Selling Agent (DSA)' : 'Telecom Infrastructure Partner (TIP)'}</T>
                <Field label="Full name" value={f.name} onChangeText={set('name')} autoComplete="name" />
                <Field label="Firm / shop name" value={f.firm} onChangeText={set('firm')} />
                <Field label="Mobile number" mono keyboardType="number-pad" maxLength={10} value={f.phone} onChangeText={(t) => set('phone')(t.replace(/\D/g, ''))} />
                <Field label="Email" keyboardType="email-address" autoCapitalize="none" value={f.email} onChangeText={set('email')} />
                <T v="label">Your city</T>
                <View style={s.chips}>{cities.filter((c) => c.status === 'live').map((c) => <Pill key={c.id} label={c.name} on={cityId === c.id} onPress={() => setCityId(c.id)} />)}</View>
                <T v="small" style={{ fontSize: 13 }}>DSAs and TIPs can register before we launch in their city.</T>
                <Field label="PIN codes you serve" placeholder="e.g. 452010, 452016" value={f.pincodes} onChangeText={set('pincodes')} />
                <T v="small" style={{ fontSize: 13 }}>Separate with commas</T>
                <T v="h3" style={{ marginTop: 6 }}>KYC and bank details</T>
                <Field label="Address" value={f.address} onChangeText={set('address')} autoComplete="street-address" />
                <Field label="Your PIN code" mono keyboardType="number-pad" maxLength={6} value={f.pincode} onChangeText={(t) => set('pincode')(t.replace(/\D/g, ''))} />
                <Field label="Aadhaar number" mono placeholder="1234 5678 9012" keyboardType="number-pad" maxLength={14} value={f.aadhaar} onChangeText={set('aadhaar')} />
                <T v="small" style={{ fontSize: 13 }}>Stored encrypted; only the last 4 digits are ever shown.</T>
                <Field label="PAN" mono placeholder="ABCDE1234F" autoCapitalize="characters" maxLength={10} value={f.pan} onChangeText={set('pan')} />
                <Field label="GSTIN (optional)" mono autoCapitalize="characters" maxLength={15} value={f.gst} onChangeText={set('gst')} />
                <Field label="Bank name" value={f.bank} onChangeText={set('bank')} />
                <Field label="Bank account number" mono keyboardType="number-pad" maxLength={20} value={f.acct} onChangeText={(t) => set('acct')(t.replace(/\D/g, ''))} />
                <Field label="IFSC" mono placeholder="SBIN0001234" autoCapitalize="characters" maxLength={11} value={f.ifsc} onChangeText={set('ifsc')} />
                <T v="small" style={{ fontSize: 13 }}>Aadhaar, PAN and bank proof photos can be shared with admin after you apply.</T>
                <Card style={{ backgroundColor: colors.blueSoft, padding: 12 }}>
                  <T v="small" style={{ color: colors.ink, fontSize: 13.5 }}>{kind === 'dsa' ? 'DSA registration is free. A DSA earns a commission on every installed lead.' : `TIP registration fee, paid online when you submit: ${inr(fee?.amount ?? 0)} plus ${fee?.gst ?? 18}% GST. DSA registration is free: a DSA earns a commission on every installed lead.`}</T>
                </Card>
                {!!error && <T v="small" style={{ color: colors.bad, fontSize: 14 }}>{error}</T>}
                <Button block label={kind === 'tip' ? 'Submit and pay registration fee' : 'Submit application'} loading={busy} disabled={!ok} onPress={submit} />
              </Card>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.bg }, wrap: { padding: 16, gap: 14, paddingBottom: 40 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
