/* "Request this connection / callback" and "Book your SIM", then the WhatsApp OTP step for someone not logged in. */
import { useState } from 'react';
import { View } from 'react-native';

import { API } from '../../lib/api';
import { PRODUCT_NAME, inr, isPhone, isPin, productOf, todayISO } from '../../lib/api/base';
import type { ConnectionRequest } from '../../lib/api/rest';
import type { Plan } from '../../lib/api/types';
import { BSNL_SELF_KYC_URL } from '../../lib/contact';
import { isEmail, normPhone, useForm } from '../../lib/forms';
import { openUrl } from '../../lib/links';
import { currentPosition } from '../../lib/location';
import { useSession } from '../../lib/session';
import { ProviderLogo } from '../../ui/brand';
import { Check, DateInput, Field, Input, Select } from '../../ui/forms';
import { BigTick, Button, Chip, LinkButton, Notice, Row } from '../../ui/kit';
import { goDashboard } from '../../ui/nav';
import { DialogTitle, useGuard, useOverlay } from '../../ui/overlay';
import { PinInput } from '../../ui/pinInput';
import { T } from '../../ui/text';
import { colors, radius } from '../../ui/theme';
import { OtpStep } from '../account/login';
import { planSummary, priceUnit } from '../home/planText';

function PlanSummaryBox({ p, sim }: { p: Plan; sim?: boolean }) {
  return (
    <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14, gap: 8 }}>
      <Row wrap={false}>
        <ProviderLogo provider={p.provider} />
        <T w={800} style={{ flex: 1 }} raw>{`${p.provider.name} · ${p.name}`}</T>
      </Row>
      <Row gap={14}>
        {sim ? <T s={13.5} c={colors.muted}>{p.category === 'sim_postpaid' ? 'Postpaid' : 'Prepaid'}</T> : null}
        <T s={13.5} w={700}>{planSummary(p)}</T>
        <Row gap={0}>
          <T s={13.5} w={700} raw>{inr(p.price_monthly)}</T>
          <T s={13.5} c={colors.muted}>{priceUnit(p)}</T>
        </Row>
      </Row>
    </View>
  );
}

export function RequestDone({ reference, phone }: { reference: string; phone: string }) {
  const overlay = useOverlay();
  const { user } = useSession();
  const customer = (API.me() || user)?.role === 'customer';
  return (
    <View style={{ alignItems: 'center', gap: 12, paddingVertical: 8 }}>
      <BigTick />
      <T f="display" s={20} w={700} center>Request submitted</T>
      <T c={colors.muted} center>Your request number is</T>
      <T f="mono" s={22} w={600} c={colors.blue} raw testID="request-ref">{reference}</T>
      <T c={colors.muted} center>
        {'An assigned TIP will call you on '}
        <T w={700} c={colors.muted} raw>{phone}</T>
        {'. '}
        {customer ? 'Track every step in your dashboard.' : ''}
      </T>
      {customer ? (
        <Button
          label="Track in dashboard"
          style={{ alignSelf: 'center' }}
          onPress={() => {
            overlay.close();
            goDashboard('customer');
          }}
        />
      ) : (
        <Button label="Done" variant="ghost" onPress={overlay.close} style={{ alignSelf: 'center' }} />
      )}
    </View>
  );
}

type Context = { plan: Plan | null; product: string; pin: string; area: string; onDone: () => void };

/** Sends the request (logging in with an OTP first when needed), then shows its number. */
function useSubmit(onDone: () => void) {
  const overlay = useOverlay();
  const { user, sync } = useSession();
  const [busy, guard] = useGuard();
  const submit = (d: ConnectionRequest) =>
    guard(async () => {
      const send = async () => {
        const r = await API.requestConnection(d);
        sync();
        onDone();
        overlay.open(<RequestDone reference={r.ref_code} phone={d.phone} />);
      };
      if (user) return send();
      await API.sendOtp(d.phone, 'customer'); // verify the number on WhatsApp first
      overlay.open(<OtpStep phone={d.phone} purpose="request" name={d.name} afterVerify={send} />);
    });
  return [busy, submit] as const;
}

export function RequestDialog({ plan: p, product, pin, area, onDone }: Context) {
  const { user } = useSession();
  const me = user?.role === 'customer' ? user : null;
  const air = product === 'air_fiber';
  const form = useForm({
    name: me && me.full_name !== 'Customer' ? me.full_name : '', phone: me?.phone || '', pincode: pin, area, email: me?.email || '', address: '', date: '', consent: false,
  });
  const { values: v, errors: e, set } = form;
  const [areaHint, setAreaHint] = useState('');
  const [place, setPlace] = useState<{ text: string; ok: boolean } | null>(null);
  const [locating, guardLocate] = useGuard();
  const [busy, submit] = useSubmit(onDone);

  const send = () => {
    const d = { name: v.name.trim(), phone: normPhone(v.phone), email: v.email.trim(), pincode: v.pincode.trim(), area: v.area.trim(), address: v.address.trim() };
    const ok = form.check({
      name: d.name.length < 2 ? 'Enter your full name.' : '',
      phone: !isPhone(d.phone) ? 'Enter a valid 10-digit mobile number.' : '',
      email: d.email && !isEmail(d.email) ? 'Enter a valid email.' : '',
      pincode: !isPin(d.pincode) ? 'Enter a valid 6-digit PIN code.' : '',
      address: p && d.address.length < 5 ? 'Enter your installation address.' : '',
      date: v.date && v.date < todayISO() ? 'Choose today or a future date.' : '',
      consent: !v.consent ? 'Please agree so a TIP can contact you.' : '',
    });
    if (ok) submit({ ...d, preferred_date: v.date, plan_id: p?.id });
  };

  return (
    <View style={{ gap: 12 }}>
      <DialogTitle title={p ? (product === 'ott' ? 'Get this OTT pack' : air ? 'Book Air Fiber' : 'Request this connection') : 'Request a callback'} />
      {p ? <PlanSummaryBox p={p} /> : <T c={colors.muted}>{`Share your details and a TIP will call you to help choose${product !== 'broadband' ? ' ' + PRODUCT_NAME[product] : ' a plan'}.`}</T>}
      {air ? <Notice info text="Air Fiber uses a small outdoor unit and an indoor Wi-Fi router. The installer checks the signal at your home before installing." /> : null}
      <Input label="Full name" value={v.name} onChangeText={(x) => set('name', x)} error={e.name} autoComplete="name" />
      <Input label="Mobile number" value={v.phone} onChangeText={(x) => set('phone', normPhone(x).slice(0, 12))} error={e.phone} keyboardType="phone-pad" maxLength={16} autoComplete="tel" />
      <PinInput label="PIN code" placeholder="Enter your PIN code" value={v.pincode} onChange={(x) => set('pincode', x)} error={e.pincode} assist onAreas={(a) => setAreaHint(a[0])} />
      <Input label="Area / colony" value={v.area} onChangeText={(x) => set('area', x)} placeholder={areaHint ? 'e.g. ' + areaHint : undefined} />
      <Input label="Email (optional)" hint="Your agent, installer and admin can see it to send bills and updates." value={v.email} onChangeText={(x) => set('email', x)} error={e.email} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Input label="Address" placeholder="House no., street, landmark" value={v.address} onChangeText={(x) => set('address', x)} error={e.address} autoComplete="street-address" />
      {product !== 'ott' ? (
        <>
          <Row>
            <Button
              label={place?.ok ? 'Update location' : 'Pin my exact location'}
              variant="soft"
              small
              busy={locating}
              onPress={() =>
                guardLocate(
                  async () => {
                    const c = await currentPosition();
                    setPlace({ ok: true, text: `(${c.lat.toFixed(4)}, ${c.lng.toFixed(4)})` });
                  },
                  { onError: (m) => setPlace({ ok: false, text: m }) },
                )
              }
            />
            {place ? (
              <T s={14} c={place.ok ? colors.ok : colors.bad} w={700}>
                {place.ok ? 'Location pinned ' : ''}
                {place.text}
              </T>
            ) : (
              <T s={14} c={colors.muted}>Helps the installer find your home.</T>
            )}
          </Row>
          <DateInput label="Preferred installation date (optional)" value={v.date} onChange={(x) => set('date', x)} min={todayISO()} error={e.date} />
        </>
      ) : null}
      <Check label="I agree to be contacted by Connect Bhai and its DSAs and TIPs about this request." checked={v.consent} onChange={(x) => set('consent', x)} error={e.consent} />
      {!user ? <T s={14} c={colors.muted}>{`We'll send an OTP to this number on WhatsApp to confirm it. This also creates your account so you can track the request.`}</T> : null}
      <Button testID="request-submit" label={user ? 'Submit request' : 'Verify on WhatsApp and submit'} block busy={busy} onPress={send} />
    </View>
  );
}

export function SimDialog({ plan: p, pin, onDone }: { plan: Plan; pin: string; onDone: () => void }) {
  const { user } = useSession();
  const me = user?.role === 'customer' ? user : null;
  const post = p.category === 'sim_postpaid';
  const form = useForm({
    conn: 'new', forWhom: 'self', name: me?.full_name || '', phone: me?.phone || '', email: me?.email || '', portNumber: '', operator: 'Jio', preference: '', pincode: pin, slot: 'Morning (9–12)', address: '', kyc: 'doorstep', consent: false,
  });
  const { values: v, errors: e, set } = form;
  const [busy, submit] = useSubmit(onDone);
  const port = v.conn === 'port';

  const send = () => {
    const d = { name: v.name.trim(), phone: normPhone(v.phone), email: v.email.trim(), pincode: v.pincode.trim(), address: v.address.trim() };
    const portNumber = normPhone(v.portNumber);
    const sim = {
      connection: v.conn, type: post ? 'postpaid' : 'prepaid', for_whom: v.forWhom, port_number: port ? portNumber : null, current_operator: port ? v.operator : null,
      number_preference: port ? null : v.preference, delivery_slot: v.slot, kyc: v.kyc,
    };
    const ok = form.check({
      portNumber: port && !isPhone(portNumber) ? 'Enter the 10-digit number to port.' : '',
      preference: !port && v.preference && !/^\d{1,4}$/.test(v.preference) ? 'Use up to 4 digits.' : '',
      address: d.address.length < 5 ? 'Enter your installation address.' : '',
      name: d.name.length < 2 ? 'Enter your full name.' : '',
      phone: !isPhone(d.phone) ? 'Enter a valid 10-digit mobile number.' : '',
      email: d.email && !isEmail(d.email) ? 'Enter a valid email.' : '',
      pincode: !isPin(d.pincode) ? 'Enter a valid 6-digit PIN code.' : '',
      consent: !v.consent ? 'Please agree so a TIP can contact you.' : '',
    });
    if (ok) submit({ ...d, plan_id: p.id, sim });
  };

  return (
    <View style={{ gap: 12 }}>
      <DialogTitle title="Book your SIM" />
      <PlanSummaryBox p={p} sim />
      <Field label="What do you need?">
        <Row>
          <Chip label="New number" selected={!port} onPress={() => set('conn', 'new')} />
          <Chip label="Keep my number (port / MNP)" selected={port} onPress={() => set('conn', 'port')} />
        </Row>
      </Field>
      <Select label="This SIM is for" value={v.forWhom} onChange={(x) => set('forWhom', x)} options={[{ value: 'self', label: 'Myself' }, { value: 'family', label: 'A family member' }, { value: 'known', label: 'Someone I know' }]} />
      <Input label="Full name (as on Aadhaar)" value={v.name} onChangeText={(x) => set('name', x)} error={e.name} autoComplete="name" />
      <Input label="Your WhatsApp number (for OTP & delivery)" value={v.phone} onChangeText={(x) => set('phone', normPhone(x).slice(0, 12))} error={e.phone} keyboardType="phone-pad" maxLength={16} />
      <Input label="Email (optional)" hint="Your agent, installer and admin can see it to send bills and updates." value={v.email} onChangeText={(x) => set('email', x)} error={e.email} keyboardType="email-address" autoCapitalize="none" />
      {port ? (
        <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, padding: 14, gap: 12 }}>
          <Input label="Number to port" value={v.portNumber} onChangeText={(x) => set('portNumber', x)} error={e.portNumber} keyboardType="number-pad" maxLength={10} />
          <Select label="Current operator" value={v.operator} onChange={(x) => set('operator', x)} options={['Jio', 'Airtel', 'Vi', 'BSNL', 'Other'].map((o) => ({ value: o, label: o }))} />
          <T s={14} c={colors.muted}>To port, you need a UPC code: SMS PORT &lt;your 10-digit number&gt; to 1900 from that number. Our agent collects it at delivery. Your number keeps working until the switch.</T>
        </View>
      ) : (
        <Input label="Preferred number ending (optional)" placeholder="e.g. 786" hint="Subject to availability. BSNL customers can also choose a number on BSNL's own portal." value={v.preference} onChangeText={(x) => set('preference', x)} error={e.preference} keyboardType="number-pad" maxLength={4} />
      )}
      <PinInput label="Delivery PIN code" placeholder="Enter your PIN code" value={v.pincode} onChange={(x) => set('pincode', x)} error={e.pincode} assist />
      <Select label="Delivery time" value={v.slot} onChange={(x) => set('slot', x)} options={['Morning (9–12)', 'Afternoon (12–4)', 'Evening (4–8)'].map((o) => ({ value: o, label: o }))} />
      <Input label="Delivery address" placeholder="House no., street, landmark" value={v.address} onChangeText={(x) => set('address', x)} error={e.address} />
      <Field label="KYC">
        <Check radio label="Doorstep e-KYC by our agent (keep your original Aadhaar ready)" checked={v.kyc === 'doorstep'} onChange={() => set('kyc', 'doorstep')} />
        <Check radio label="I'll complete self-KYC online on the operator's portal" checked={v.kyc === 'self'} onChange={() => set('kyc', 'self')} />
        <T s={12.5} c={colors.muted}>For BSNL SIMs, self-KYC is on</T>
        <LinkButton label="BSNL's self-KYC portal" s={13} onPress={() => openUrl(BSNL_SELF_KYC_URL)} />
        <T s={12.5} c={colors.muted}>Connect Bhai never asks for your Aadhaar number in this form.</T>
      </Field>
      <Check label="I agree to be contacted by Connect Bhai and its DSAs and TIPs about this SIM." checked={v.consent} onChange={(x) => set('consent', x)} error={e.consent} />
      <Button label={user ? 'Book SIM' : 'Verify on WhatsApp and book SIM'} block busy={busy} onPress={send} />
    </View>
  );
}

export function useOpenRequest() {
  const overlay = useOverlay();
  return (plan: Plan | null, ctx: { product: string; pin: string; area: string; onDone: () => void }) => {
    if (plan && plan.category.startsWith('sim')) return overlay.open(<SimDialog plan={plan} pin={ctx.pin} onDone={ctx.onDone} />);
    const product = plan ? productOf(plan.category) : ctx.product;
    overlay.open(<RequestDialog plan={plan} {...ctx} product={product} />);
  };
}
