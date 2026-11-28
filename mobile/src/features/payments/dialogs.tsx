/* Registration fee: the amount, the Razorpay payment, and the receipt. The server prices every charge. */
import { useState } from 'react';
import { View } from 'react-native';

import { API } from '../../lib/api';
import { ROLE_HOME, inr } from '../../lib/api/base';
import type { Charge } from '../../lib/api/types';
import { errMsg } from '../../lib/forms';
import { useSession } from '../../lib/session';
import { BigTick, Button, Facts, Notice } from '../../ui/kit';
import { goDashboard } from '../../ui/nav';
import { DialogTitle, useOverlay } from '../../ui/overlay';
import { T } from '../../ui/text';
import { colors } from '../../ui/theme';

export function PayRegistration({ charge: c, who }: { charge: Charge; who: { name: string; phone: string; email?: string } }) {
  const overlay = useOverlay();
  const { sync } = useSession();
  const [state, setState] = useState<'ready' | 'busy' | 'failed'>('ready');
  const pay = async () => {
    setState('busy');
    try {
      const paid = await API.payPublicCharge(c.id, 'upi', who);
      sync();
      overlay.open(<PaySuccess charge={paid} />);
    } catch (e) {
      setState('failed');
      overlay.toast(errMsg(e), true);
    }
  };
  return (
    <View style={{ gap: 12 }}>
      <DialogTitle title="Pay registration fee" />
      <T s={14} c={colors.muted} style={{ marginTop: -8 }}>{`Application received for ${who.name} (+91 ${who.phone}). Pay the registration fee now to complete your registration. Admin then checks your KYC and agreement and activates your account.`}</T>
      <Facts rows={[[c.description, inr(c.base_amount)], ['GST', inr(c.gst_amount)], ['Total', inr(c.amount)], ['Reference', c.ref_code, true]]} />
      <Button testID="pay-registration" label={state === 'busy' ? 'Processing payment…' : state === 'failed' ? 'Try again' : `Pay ${inr(c.amount)}`} block disabled={state === 'busy'} onPress={pay} />
      <T s={14} c={colors.muted} center>🔒 Secure payment by Razorpay. You choose UPI, card, net banking or wallet on the next screen.</T>
      <T s={14} c={colors.muted}>You can also pay later: log in with WhatsApp OTP on this mobile number and open Payments.</T>
    </View>
  );
}

export function PaySuccess({ charge: c }: { charge: Charge }) {
  const overlay = useOverlay();
  const user = API.me();
  return (
    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
      <BigTick />
      <T f="display" s={20} w={700} center>Payment successful</T>
      <T c={colors.muted} center>{c.description}</T>
      <T f="display" s={28} w={800} raw>{inr(c.amount)}</T>
      <T s={14} c={colors.muted} center>
        {'Receipt '}
        {c.ref_code}
        {' · Payment ID '}
        {c.gateway_payment_id || ''}
      </T>
      <T s={14} c={colors.muted} center>Keep this reference for your records.</T>
      {c.kind === 'registration_fee' ? (
        <Notice info text={user ? 'Registration fee received and you are logged in. Admin will verify your KYC and agreement, then leads open in your portal.' : 'Registration fee received. Admin will verify your KYC and agreement and activate your account.'} />
      ) : null}
      {user && ROLE_HOME[user.role] ? (
        <Button label="Go to my dashboard" style={{ alignSelf: 'center' }} onPress={() => { overlay.close(); goDashboard(user.role); }} />
      ) : (
        <Button label="Done" style={{ alignSelf: 'center' }} onPress={overlay.close} />
      )}
    </View>
  );
}
