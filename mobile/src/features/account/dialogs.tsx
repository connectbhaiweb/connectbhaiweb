/* My account: edit name / email (as on the website) and "Delete account" (added in the app for the stores). */
import { View } from 'react-native';

import { API } from '../../lib/api';
import { ROLE_NAME } from '../../lib/api/base';
import { isEmail, normPhone, useForm } from '../../lib/forms';
import { useSession } from '../../lib/session';
import { Input } from '../../ui/forms';
import { Button, Notice, Row } from '../../ui/kit';
import { goDashboard, goHome } from '../../ui/nav';
import { DialogTitle, useGuard, useOverlay } from '../../ui/overlay';
import { T } from '../../ui/text';
import { colors } from '../../ui/theme';

type Overlay = ReturnType<typeof useOverlay>;
export const openAccount = (overlay: Overlay) => overlay.open(<AccountDialog />, 'account');
export const openDeleteAccount = (overlay: Overlay) => overlay.open(<DeleteAccount />, 'delete-account');

function AccountDialog() {
  const overlay = useOverlay();
  const { user, signOut } = useSession();
  if (!user) return null;
  return (
    <View style={{ gap: 12 }}>
      <DialogTitle title="My account" />
      <View style={{ gap: 2, marginTop: -8 }}>
        <T w={800} raw>{user.full_name}</T>
        <T s={14} c={colors.muted}>{ROLE_NAME[user.role]}</T>
        <T s={14} c={colors.muted} raw>{`+91 ${user.phone}${user.email ? ' · ' + user.email : ''}`}</T>
      </View>
      <Button label="My dashboard" block onPress={() => { overlay.close(); goDashboard(user.role); }} />
      <Button label="Edit name / email" variant="ghost" block onPress={() => overlay.open(<EditProfile />)} />
      <Button label="Log out" variant="ghost" block onPress={() => signOut().then(() => { overlay.close(); goHome(); })} />
      {user.role !== 'admin' ? <Button testID="delete-open" label="Delete account" variant="danger" block onPress={() => openDeleteAccount(overlay)} /> : null}
    </View>
  );
}

function EditProfile() {
  const overlay = useOverlay();
  const { user, sync } = useSession();
  const [busy, guard] = useGuard();
  const { values: v, errors: e, set, check } = useForm({ name: user?.full_name || '', email: user?.email || '' });
  const save = () => {
    const d = { name: v.name.trim(), email: v.email.trim() };
    if (!check({ name: d.name.length < 2 ? 'Enter your name.' : '', email: d.email && !isEmail(d.email) ? 'Enter a valid email.' : '' })) return;
    guard(async () => {
      await API.setMyProfile(d);
      sync();
      overlay.close();
      overlay.toast('Details saved.');
    });
  };
  return (
    <View style={{ gap: 12 }}>
      <DialogTitle title="Edit name / email" />
      <Input label="Full name" value={v.name} onChangeText={(x) => set('name', x)} error={e.name} autoComplete="name" />
      <Input label="Email (optional)" value={v.email} onChangeText={(x) => set('email', x)} error={e.email} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Button label="Save" block busy={busy} onPress={save} />
    </View>
  );
}

function DeleteAccount() {
  const overlay = useOverlay();
  const { user, sync } = useSession();
  const [busy, guard] = useGuard();
  const { values: v, errors: e, set, check } = useForm({ phone: '' });
  if (!user) return null;
  const remove = () => {
    if (!check({ phone: normPhone(v.phone) !== user.phone ? 'Enter the mobile number of this account.' : '' })) return;
    guard(async () => {
      await API.deleteMyAccount();
      sync();
      overlay.close();
      goHome();
      overlay.toast('Your account has been deleted.');
    });
  };
  return (
    <View style={{ gap: 12 }}>
      <DialogTitle title="Delete account" />
      <Notice text="This permanently deletes your account and personal data. It cannot be undone." />
      <T s={14} c={colors.muted}>
        {user.role === 'customer'
          ? 'Your name and contact details are removed. Payment receipts we must keep by law stay, without your profile. Your requests stay with your DSA and TIP without your details.'
          : 'Your profile, bookings, payouts, charges, tickets and messages are removed, even if payments or work are pending. Leads you worked on stay without your name.'}
      </T>
      <Input testID="delete-phone" label="Type your mobile number to confirm" placeholder="10-digit mobile" value={v.phone} onChangeText={(x) => set('phone', normPhone(x).slice(0, 12))} error={e.phone} keyboardType="phone-pad" maxLength={16} />
      <Row>
        <Button testID="delete-confirm" label="Delete my account" variant="danger" busy={busy} onPress={remove} />
        <Button label="Cancel" variant="ghost" onPress={overlay.close} />
      </Row>
    </View>
  );
}
