/* Log in: WhatsApp OTP or mobile + password, then the name on a first login. The web's "Forgot password" and
   "Admin" autofill are not shown (the live API refuses the first; the second is a test helper). */
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { API } from '../../lib/api';
import type { User } from '../../lib/api/types';
import { errMsg, normPhone, phoneError, useForm } from '../../lib/forms';
import { useSession } from '../../lib/session';
import { Input, OtpBoxes } from '../../ui/forms';
import { Button, Chip, LinkButton, Row } from '../../ui/kit';
import { goDashboard } from '../../ui/nav';
import { DialogTitle, useGuard, useOverlay } from '../../ui/overlay';
import { T } from '../../ui/text';
import { colors } from '../../ui/theme';

type Overlay = ReturnType<typeof useOverlay>;
export const openLogin = (overlay: Overlay, tab: 'otp' | 'pw' = 'otp') => overlay.open(<LoginDialog tab={tab} />, 'login-' + tab);

function useAfterLogin() {
  const overlay = useOverlay();
  const { sync } = useSession();
  return (u: User) => {
    sync();
    if (!u.full_name) return overlay.open(<SetName />);
    overlay.close();
    overlay.toast(`Welcome, ${u.role === 'customer' ? u.full_name.split(' ')[0] : u.full_name}.`);
    goDashboard(u.role);
  };
}

function LoginDialog({ tab }: { tab: 'otp' | 'pw' }) {
  const overlay = useOverlay();
  const done = useAfterLogin();
  const [otp, setOtp] = useState(tab === 'otp');
  const [busy, guard] = useGuard();
  const { values: v, errors: e, set, check } = useForm({ phone: '', password: '' });

  const send = () => {
    const phone = normPhone(v.phone);
    if (!check({ phone: phoneError(v.phone) })) return;
    guard(
      async () => {
        await API.sendOtp(phone);
        overlay.open(<OtpStep phone={phone} purpose="login" />);
      },
      { onError: (m) => check({ phone: m }) },
    );
  };
  const signIn = () => {
    const phone = normPhone(v.phone);
    if (!check({ phone: phoneError(v.phone), password: !v.password ? 'Enter your password.' : '' })) return;
    guard(async () => done(await API.signInPassword(phone, v.password)), { onError: (m) => check({ password: m }) });
  };

  return (
    <View style={{ gap: 12 }}>
      <DialogTitle title="Log in to Connect Bhai" />
      <Row style={{ marginTop: -6 }}>
        <Chip label="Mobile + password" selected={!otp} onPress={() => { setOtp(false); check({}); }} />
        <Chip label="WhatsApp OTP" selected={otp} onPress={() => { setOtp(true); check({}); }} />
      </Row>
      {otp ? (
        <>
          <T c={colors.muted}>{`We'll send a 6-digit OTP to your WhatsApp. New here? The same step creates your customer account.`}</T>
          <Input testID="login-phone" label="WhatsApp number" placeholder="10-digit mobile" value={v.phone} onChangeText={(x) => set('phone', normPhone(x).slice(0, 12))} error={e.phone} keyboardType="phone-pad" maxLength={16} autoComplete="tel" onSubmitEditing={send} />
          <Button testID="login-send" label="Send OTP on WhatsApp" block busy={busy} onPress={send} />
        </>
      ) : (
        <>
          <Input testID="login-phone" label="Username (your mobile number)" placeholder="10-digit mobile" value={v.phone} onChangeText={(x) => set('phone', normPhone(x).slice(0, 12))} error={e.phone} keyboardType="phone-pad" maxLength={16} autoComplete="username" />
          <Input testID="login-password" label="Password" value={v.password} onChangeText={(x) => set('password', x)} error={e.password} secureTextEntry autoComplete="current-password" autoCapitalize="none" onSubmitEditing={signIn} />
          <Button testID="login-submit" label="Log in" block busy={busy} onPress={signIn} />
        </>
      )}
    </View>
  );
}

type OtpProps = { phone: string; purpose: 'login' | 'request'; name?: string; afterVerify?: () => Promise<unknown> | void };

export function OtpStep({ phone, purpose, name, afterVerify }: OtpProps) {
  const overlay = useOverlay();
  const done = useAfterLogin();
  const { sync } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [wait, setWait] = useState(30);
  const [busy, guard] = useGuard();
  const [resending, guardResend] = useGuard();
  const role = purpose === 'request' ? 'customer' : undefined;

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const verify = () => {
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit OTP.');
    guard(
      async () => {
        let user: User;
        try {
          user = await API.verifyOtp(phone, code, purpose === 'request' ? name : '', role);
        } catch (e) {
          return setError(errMsg(e));
        }
        if (afterVerify) {
          sync();
          await afterVerify();
          return;
        }
        done(user);
      },
    );
  };

  return (
    <View style={{ gap: 12 }}>
      <DialogTitle title="Enter WhatsApp OTP" />
      <T c={colors.muted} style={{ marginTop: -10 }}>
        {'Sent to WhatsApp '}
        <T w={700} c={colors.muted} raw>{`+91 ${phone.slice(0, 5)} ${phone.slice(5)}`}</T>
        {purpose === 'request' ? '. This confirms your number before we create the request.' : ''}
      </T>
      <OtpBoxes value={code} onChange={(x) => { setCode(x); setError(''); }} error={error} />
      <Button testID="otp-submit" label={purpose === 'request' ? 'Verify and submit request' : 'Verify'} block busy={busy} disabled={code.length !== 6} onPress={verify} />
      <Row gap={6} style={{ justifyContent: 'center' }}>
        <T s={14} c={colors.muted}>{`Didn't get it?`}</T>
        {wait > 0 ? (
          <T s={14} w={700} c={colors.muted}>{`Resend in ${wait}s`}</T>
        ) : (
          <LinkButton
            label={resending ? 'Please wait…' : 'Resend OTP'}
            onPress={() =>
              guardResend(async () => {
                await API.sendOtp(phone, role);
                overlay.toast('OTP sent again on WhatsApp.');
                setCode('');
                setWait(30);
              })
            }
          />
        )}
        <T s={14} c={colors.muted} raw>·</T>
        <LinkButton label="Change number" onPress={() => openLogin(overlay, 'otp')} />
      </Row>
    </View>
  );
}

function SetName() {
  const overlay = useOverlay();
  const { sync } = useSession();
  const [busy, guard] = useGuard();
  const { values: v, errors: e, set, check } = useForm({ name: '' });
  const save = () => {
    const name = v.name.trim();
    if (!check({ name: name.length < 2 ? 'Enter your name.' : '' })) return;
    guard(async () => {
      const u = await API.setMyName(name);
      sync();
      overlay.close();
      overlay.toast(`Welcome, ${name.split(' ')[0]}.`);
      if (u) goDashboard(u.role);
    });
  };
  return (
    <View style={{ gap: 12 }}>
      <DialogTitle title="Welcome to Connect Bhai" sub="What should we call you?" />
      <Input label="Full name" value={v.name} onChangeText={(x) => set('name', x)} error={e.name} autoComplete="name" onSubmitEditing={save} />
      <Button label="Continue" block busy={busy} onPress={save} />
    </View>
  );
}
