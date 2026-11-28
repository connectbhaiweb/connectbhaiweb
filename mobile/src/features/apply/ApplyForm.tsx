/* "DSA / TIP application": the same fields, checks and messages as the website. A DSA never sees a fee; a TIP pays
   the registration fee right after applying. */
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { API } from '../../lib/api';
import { inr, isPhone, isPin } from '../../lib/api/base';
import type { PartnerApplication } from '../../lib/api/rest';
import type { City, Settings, Upload } from '../../lib/api/types';
import { errMsg, isEmail, normPhone, useForm } from '../../lib/forms';
import { Input, Select } from '../../ui/forms';
import { BigTick, Button, Card, Notice, Skeleton } from '../../ui/kit';
import { useOverlay } from '../../ui/overlay';
import { PinInput } from '../../ui/pinInput';
import { T } from '../../ui/text';
import { colors } from '../../ui/theme';
import { cityOptions } from '../home/cities';
import { PayRegistration } from '../payments/dialogs';
import { KycUpload, type Kyc } from './KycUpload';

const EMPTY = { type: 'dsa', name: '', firm: '', phone: '', email: '', city: '', pins: '', address: '', pincode: '', aadhaar: '', pan: '', gst: '', bank: '', account: '', ifsc: '' };
type Docs = { aadhaar: Kyc | null; pan: Kyc | null; bank_proof: Kyc | null };
const NO_DOCS: Docs = { aadhaar: null, pan: null, bank_proof: null };

function Received({ name, tip }: { name: string; tip: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
      <BigTick />
      <T f="display" s={20} w={700} center>Application received</T>
      <T c={colors.muted} center>{`Thank you, ${name}. We are saving your details${tip ? ' and preparing your registration payment' : ''}. You can keep this window open, it takes a moment.`}</T>
      <View style={{ alignSelf: 'stretch', gap: 8 }}>
        <Skeleton height={14} width="60%" />
        <Skeleton height={40} />
      </View>
    </View>
  );
}

function Registered() {
  const overlay = useOverlay();
  return (
    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
      <BigTick />
      <T f="display" s={20} w={700} center>Registration received</T>
      <T c={colors.muted} center>Admin will verify your details and contact you on WhatsApp.</T>
      <Button label="Done" onPress={overlay.close} style={{ alignSelf: 'center' }} />
    </View>
  );
}

export function ApplyForm({ cities, city }: { cities: City[]; city: string }) {
  const overlay = useOverlay();
  const { values: v, errors: e, set, check, reset } = useForm<typeof EMPTY & Record<string, string>>({ ...EMPTY });
  const [docs, setDocs] = useState<Docs>(NO_DOCS);
  const [docErrors, setDocErrors] = useState<Partial<Record<keyof Docs, string>>>({});
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);
  const badPins = useRef(false);
  const tip = v.type === 'tip';

  useEffect(() => {
    API.getSettings().then(setSettings).catch(() => {});
  }, []);

  const setDoc = (k: keyof Docs) => (value: Kyc | null) => {
    setDocs((d) => ({ ...d, [k]: value }));
    setDocErrors((d) => ({ ...d, [k]: undefined }));
  };

  const submit = () => {
    const d = {
      type: v.type as 'dsa' | 'tip', name: v.name.trim(), firm: v.firm.trim(), phone: normPhone(v.phone), email: v.email.trim(), pincodes: v.pins.trim().replace(/,\s*$/, ''), city_id: v.city || city,
      address: v.address.trim(), pincode: v.pincode.trim(), aadhaar: v.aadhaar.trim(), pan: v.pan.trim().toUpperCase(), gst_number: v.gst.trim().toUpperCase(),
      bank_name: v.bank.trim(), bank_account: v.account.trim(), bank_ifsc: v.ifsc.trim().toUpperCase(),
    };
    const fieldsOk = check({
      address: d.address.length < 5 ? 'Enter your address.' : '',
      pincode: !isPin(d.pincode) ? 'Enter a valid 6-digit PIN code.' : '',
      aadhaar: !/^\d{4}\s?\d{4}\s?\d{4}$/.test(d.aadhaar) ? 'Aadhaar must be 12 digits.' : '',
      pan: !/^[A-Z]{5}\d{4}[A-Z]$/.test(d.pan) ? 'Enter a valid PAN, e.g. ABCDE1234F.' : '',
      gst: d.gst_number && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(d.gst_number) ? 'Enter a valid GSTIN.' : '',
      bank: d.bank_name.length < 2 ? 'Enter the bank name.' : '',
      account: !/^\d{6,20}$/.test(d.bank_account) ? 'Enter the account number (digits only).' : '',
      ifsc: !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(d.bank_ifsc) ? 'Enter a valid IFSC, e.g. SBIN0001234.' : '',
      name: d.name.length < 2 ? 'Enter your name.' : '',
      phone: !isPhone(d.phone) ? 'Enter a valid 10-digit mobile number.' : '',
      email: !isEmail(d.email) ? (d.email ? 'Enter a valid email.' : 'Enter your email.') : '',
      pins: !d.pincodes || !d.pincodes.split(',').every((p) => isPin(p.trim())) ? 'Enter 6-digit PIN codes separated by commas.' : badPins.current ? 'Some PIN codes were not found. Please correct them.' : '',
    });
    // the server requires all three documents: say so on the form
    const missing = {
      aadhaar: docs.aadhaar ? undefined : 'Upload your Aadhaar card (photo or PDF).',
      pan: docs.pan ? undefined : 'Upload your PAN card (photo or PDF).',
      bank_proof: docs.bank_proof ? undefined : 'Upload your bank proof (photo or PDF).',
    };
    setDocErrors(missing);
    if (!fieldsOk || Object.values(missing).some(Boolean)) {
      overlay.toast('Please check the highlighted fields.', true);
      return;
    }
    setBusy(true);
    overlay.open(<Received name={d.name} tip={d.type === 'tip'} />);
    (async () => {
      try {
        const documents: Record<string, Upload> = {};
        try {
          // all three together, reusing the uploads that already started when the files were chosen
          await Promise.all(
            (Object.keys(docs) as (keyof Docs)[]).map(async (k) => {
              const doc = docs[k]!;
              documents[k] = await doc.upload.catch(() => API.uploadFile(doc.file, 'kyc'));
            }),
          );
        } catch (err) {
          if (!/not configured/i.test((err as Error).message || '')) throw err; // local development without file storage: continue without files
        }
        const application: PartnerApplication = { ...d, documents: Object.keys(documents).length ? documents : undefined };
        const r = await API.applyPartner(application);
        reset();
        setDocs(NO_DOCS);
        setRound((n) => n + 1);
        // the payment step is for a TIP only; a DSA never sees a payment window
        if (r.charge && d.type === 'tip') overlay.open(<PayRegistration charge={r.charge} who={{ name: d.name, phone: d.phone, email: d.email }} />);
        else overlay.open(<Registered />);
      } catch (err) {
        overlay.close(); // back to the form, nothing typed is lost
        overlay.toast(errMsg(err), true);
      } finally {
        setBusy(false);
      }
    })();
  };

  const field = (k: string, label: string, more: Partial<React.ComponentProps<typeof Input>> = {}) => (
    <Input testID={'apply-' + k} label={label} value={v[k]} onChangeText={(x) => set(k, x)} error={e[k]} {...more} />
  );
  const heading = (text: string) => <T f="display" s={18} w={700} style={{ marginTop: 10 }}>{text}</T>;
  const upper = { autoCapitalize: 'characters' as const, autoCorrect: false };

  return (
    <Card gap={12}>
      <T f="display" s={18} w={700}>DSA / TIP application</T>
      <Select label="I am a" value={v.type} onChange={(x) => set('type', x)} options={[{ value: 'dsa', label: 'Direct Selling Agent (DSA)' }, { value: 'tip', label: 'Telecom Infrastructure Partner (TIP)' }]} />
      {field('name', 'Full name', { autoComplete: 'name' })}
      {field('firm', 'Firm / shop name')}
      {field('phone', 'Mobile number', { keyboardType: 'phone-pad', maxLength: 16, onChangeText: (x) => set('phone', normPhone(x).slice(0, 12)) })}
      {field('email', 'Email', { keyboardType: 'email-address', autoCapitalize: 'none', autoComplete: 'email' })}
      <Select label="Your city" hint="DSAs and TIPs can register before we launch in their city." value={v.city || city} onChange={(x) => set('city', x)} options={cityOptions(cities, true)} />
      <PinInput key={'pins' + round} label="PIN codes you serve" placeholder="Enter PIN codes, e.g. 452010, 452016" hint="Separate with commas" many value={v.pins} onChange={(x) => set('pins', x)} error={e.pins} onBad={(bad) => (badPins.current = bad)} />
      {heading('KYC and bank details')}
      {field('address', 'Address', { autoComplete: 'street-address' })}
      <PinInput key={'pin' + round} label="Your PIN code" value={v.pincode} onChange={(x) => set('pincode', x)} error={e.pincode} assist />
      {field('aadhaar', 'Aadhaar number', { keyboardType: 'number-pad', maxLength: 14, placeholder: '1234 5678 9012', hint: 'Stored encrypted; only the last 4 digits are ever shown.' })}
      {field('pan', 'PAN', { maxLength: 10, placeholder: 'ABCDE1234F', ...upper })}
      {field('gst', 'GSTIN (optional)', { maxLength: 15, ...upper })}
      {field('bank', 'Bank name')}
      {field('account', 'Bank account number', { keyboardType: 'number-pad', maxLength: 20 })}
      {field('ifsc', 'IFSC', { maxLength: 11, placeholder: 'SBIN0001234', ...upper })}
      {heading('Documents')}
      <T s={14} c={colors.muted}>JPG, PNG or PDF, up to 5 MB each. Stored privately; only Connect Bhai admin can open them.</T>
      <KycUpload key={'a' + round} testID="doc-aadhaar" label="Aadhaar card (photo or PDF)" value={docs.aadhaar} onChange={setDoc('aadhaar')} error={docErrors.aadhaar} />
      <KycUpload key={'p' + round} testID="doc-pan" label="PAN card" value={docs.pan} onChange={setDoc('pan')} error={docErrors.pan} />
      <KycUpload key={'b' + round} testID="doc-bank" label="Bank proof (cancelled cheque or passbook page)" value={docs.bank_proof} onChange={setDoc('bank_proof')} error={docErrors.bank_proof} />
      <Notice info>
        {!tip ? (
          <T s={14} w={600} c={colors.blue}>
            <T s={14} w={800} c={colors.blue}>DSA registration is free.</T> {'A DSA earns a commission on every installed lead.'}
          </T>
        ) : settings ? (
          <T s={14} w={600} c={colors.blue}>
            {'TIP registration fee, paid online when you submit: '}
            <T s={14} w={800} c={colors.blue} raw>{inr(settings.registration_fee_tip)}</T>
            {` plus ${settings.gst_percent || 18}% GST (UPI, card, net banking or wallet). `}
            <T s={14} w={800} c={colors.blue}>DSA registration is free</T>
            {': a DSA earns a commission on every installed lead.'}
          </T>
        ) : (
          <T s={14} w={600} c={colors.blue}>The registration fee (plus GST) is paid online when you submit this form.</T>
        )}
      </Notice>
      <Button testID="apply-submit" label={tip ? 'Submit and pay registration fee' : 'Submit application'} block busy={busy} onPress={submit} />
    </Card>
  );
}
