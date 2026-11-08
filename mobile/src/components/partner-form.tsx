import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/text';

import { Button, Card, Field, Muted, Segment, Strong, useBusy, useLoad } from '@/components/ui';
import { api, ApiError, type Charge, type PickedFile } from '@/lib/api';
import { inr, phoneDigits } from '@/lib/format';
import { useTheme } from '@/lib/theme';

/* DSA / TIP application (website "For DSAs & TIPs" form): KYC, bank details, documents, registration fee. */
const DOCS = [['aadhaar', 'Aadhaar card (photo or PDF)'], ['pan', 'PAN card'], ['bank_proof', 'Bank proof (cancelled cheque or passbook page)']] as const;

export function PartnerForm() {
  const t = useTheme();
  const cities = useLoad(() => api.cities());
  const [f, setF] = useState({ role: 'dsa', name: '', firm: '', phone: '', email: '', city: '', pincodes: '', address: '', pincode: '', aadhaar: '', pan: '', gst: '', bank: '', acct: '', ifsc: '' });
  const [files, setFiles] = useState<Partial<Record<(typeof DOCS)[number][0], PickedFile>>>({});
  const [done, setDone] = useState<{ charge?: Charge; token?: string } | null>(null);
  const [paid, setPaid] = useState(false);
  const { busy, error, setError, run } = useBusy();
  const pay = useBusy();
  const set = (k: keyof typeof f) => (v: string) => setF(x => ({ ...x, [k]: v }));
  const cityId = Number(f.city || cities.data?.[0]?.id || 0);

  const pick = async (k: (typeof DOCS)[number][0]) => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    setFiles(x => ({ ...x, [k]: { uri: a.uri, name: a.name, mimeType: a.mimeType, size: a.size } }));
  };

  const submit = () => run(async () => {
    const aadhaar = f.aadhaar.replace(/\s/g, ''), pan = f.pan.toUpperCase().trim(), gst = f.gst.toUpperCase().trim(), ifsc = f.ifsc.toUpperCase().trim();
    const pins = f.pincodes.split(',').map(x => x.trim()).filter(Boolean);
    if (f.name.trim().length < 2) throw new ApiError('Enter your name.');
    if (!/^[6-9]\d{9}$/.test(phoneDigits(f.phone))) throw new ApiError('Enter a valid 10-digit mobile number.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) throw new ApiError(f.email ? 'Enter a valid email.' : 'Enter your email.');
    if (!pins.length || !pins.every(p => /^\d{6}$/.test(p))) throw new ApiError('Enter 6-digit PIN codes separated by commas.');
    if (f.address.trim().length < 5) throw new ApiError('Enter your address.');
    if (!/^\d{6}$/.test(f.pincode)) throw new ApiError('Enter a valid 6-digit PIN code for your address.');
    if (!/^\d{12}$/.test(aadhaar)) throw new ApiError('Aadhaar must be 12 digits.');
    if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) throw new ApiError('Enter a valid PAN, e.g. ABCDE1234F.');
    if (gst && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(gst)) throw new ApiError('Enter a valid GSTIN.');
    if (f.bank.trim().length < 2) throw new ApiError('Enter the bank name.');
    if (!/^\d{6,20}$/.test(f.acct)) throw new ApiError('Enter the account number (digits only).');
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) throw new ApiError('Enter a valid IFSC, e.g. SBIN0001234.');
    const documents: Record<string, unknown> = {};
    for (const [k] of DOCS) { const file = files[k]; if (file) documents[k] = await api.uploadFile(file, 'kyc'); }
    const r = await api.applyPartner({
      role: f.role as 'dsa' | 'tip', name: f.name.trim(), phone: phoneDigits(f.phone), email: f.email, address: f.address, pincode: f.pincode, city_id: cityId,
      business_name: f.firm || undefined, gst_number: gst || undefined, aadhaar, pan, bank_name: f.bank, bank_account: f.acct, bank_ifsc: ifsc, service_pincodes: pins,
      documents: Object.keys(documents).length ? documents : undefined,
    });
    setDone({ charge: r.charge, token: r.payment_token });
  });

  if (done) {
    const c = done.charge;
    return (
      <>
        <Card>
          <Text style={{ color: t.ok, fontSize: 18, fontWeight: '800' }}>{paid ? 'Registration fee paid' : 'Application received'}</Text>
          <Muted style={{ marginVertical: 8 }}>{c && !paid ? `Pay the registration fee of ${inr(c.total_amount)} (including GST) to complete your application.` : 'Admin will verify your details and contact you. After approval you can log in with your mobile number.'}</Muted>
          {c && !paid ? (
            <>
              {pay.error ? <Text style={{ color: t.bad, marginBottom: 8 }} accessibilityRole="alert">{pay.error}</Text> : null}
              <Button label={`Pay ${inr(c.total_amount)}`} icon="card" loading={pay.busy} onPress={async () => { if (await pay.run(() => api.payPublicCharge(c.id, done.token!))) setPaid(true); }} />
            </>
          ) : null}
        </Card>
      </>
    );
  }

  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: t.ink, fontFamily: 'display', fontWeight: '700', fontSize: 18, marginBottom: 8 }}>DSA / TIP application</Text>
      <Strong style={{ marginTop: 4 }}>I am a</Strong>
      <Segment options={[{ value: 'dsa', label: 'Direct Selling Agent (DSA)' }, { value: 'tip', label: 'BSNL TIP' }]} value={f.role as 'dsa' | 'tip'} onChange={set('role')} />
      <Field label="Full name" value={f.name} onChangeText={set('name')} autoComplete="name" />
      <Field label="Firm / shop name" value={f.firm} onChangeText={set('firm')} />
      <Field label="Mobile number" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" maxLength={16} />
      <Field label="Email" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
      <Text style={{ color: t.muted, fontWeight: '600', fontSize: 13, marginBottom: 6 }}>Your city</Text>
      <Segment options={(cities.data || []).map(c => ({ value: String(c.id), label: c.name }))} value={String(cityId)} onChange={set('city')} />
      <Field label="PIN codes you serve" value={f.pincodes} onChangeText={set('pincodes')} placeholder="452010, 452016" />
      <Strong style={{ marginBottom: 8 }}>KYC and bank details</Strong>
      <Field label="Address" value={f.address} onChangeText={set('address')} />
      <Field label="Your PIN code" value={f.pincode} onChangeText={set('pincode')} keyboardType="number-pad" maxLength={6} />
      <Field label="Aadhaar number" value={f.aadhaar} onChangeText={set('aadhaar')} keyboardType="number-pad" maxLength={14} placeholder="1234 5678 9012" />
      <Muted style={{ marginTop: -8, marginBottom: 12 }}>Stored encrypted; only the last 4 digits are ever shown.</Muted>
      <Field label="PAN" value={f.pan} onChangeText={set('pan')} autoCapitalize="characters" maxLength={10} placeholder="ABCDE1234F" />
      <Field label="GSTIN (optional)" value={f.gst} onChangeText={set('gst')} autoCapitalize="characters" maxLength={15} />
      <Field label="Bank name" value={f.bank} onChangeText={set('bank')} />
      <Field label="Bank account number" value={f.acct} onChangeText={set('acct')} keyboardType="number-pad" maxLength={20} />
      <Field label="IFSC" value={f.ifsc} onChangeText={set('ifsc')} autoCapitalize="characters" maxLength={11} placeholder="SBIN0001234" />
      <Strong style={{ marginBottom: 4 }}>Documents</Strong>
      <Muted style={{ marginBottom: 10 }}>JPG, PNG or PDF, up to 5 MB each. Stored privately; only Connect Bhai admin can open them.</Muted>
      {DOCS.map(([k, label]) => (
        <View key={k} style={{ marginBottom: 12, gap: 6 }}>
          <Text style={{ color: t.muted, fontWeight: '600', fontSize: 13 }}>{label}</Text>
          <Button small kind="secondary" icon="attach" label={files[k]?.name || 'Choose file'} onPress={() => pick(k)} />
        </View>
      ))}
      <Muted>The registration fee (plus GST) is paid online when you submit this form.</Muted>
      {error ? <Text style={{ color: t.bad }} accessibilityRole="alert">{error}</Text> : null}
      <Button label="Submit and pay registration fee" onPress={() => { setError(''); submit(); }} loading={busy} />
    </View>
  );
}
