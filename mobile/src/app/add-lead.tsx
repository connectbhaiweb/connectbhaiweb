import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from '@/components/text';

import { Button, Field, Muted, Screen, useBusy } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { phoneDigits } from '@/lib/format';
import { useTheme } from '@/lib/theme';

/* DSA: add a customer lead (same call as the website) */
export default function AddLead() {
  const t = useTheme();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pincode, setPincode] = useState('');
  const [address, setAddress] = useState('');
  const [done, setDone] = useState('');
  const { busy, error, run } = useBusy();

  const submit = () => run(async () => {
    if (name.trim().length < 2) throw new ApiError('Enter the customer name.');
    if (!/^[6-9]\d{9}$/.test(phoneDigits(phone))) throw new ApiError('Enter a valid 10-digit mobile number.');
    if (!/^\d{6}$/.test(pincode)) throw new ApiError('Enter the 6-digit PIN code.');
    const l = await api.addLead({ name, phone: phoneDigits(phone), pincode, address });
    setDone(l.ref_code);
  });

  return (
    <Screen tabBar={false}>
      {done ? (
        <>
          <Text style={{ color: t.ok, fontSize: 18, fontWeight: '800' }}>Lead added</Text>
          <Muted>Reference {done}. The installer for this area will contact the customer.</Muted>
          <Button label="Done" onPress={() => router.back()} />
        </>
      ) : (
        <>
          <Muted>Add only customers who agreed to be contacted by Connect Bhai.</Muted>
          <Field label="Customer name" value={name} onChangeText={setName} autoComplete="name" />
          <Field label="Mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={14} />
          <Field label="PIN code" value={pincode} onChangeText={setPincode} keyboardType="number-pad" maxLength={6} />
          <Field label="Address (optional)" value={address} onChangeText={setAddress} multiline />
          {error ? <Text style={{ color: t.bad }} accessibilityRole="alert">{error}</Text> : null}
          <Button label="Add lead" onPress={submit} loading={busy} />
        </>
      )}
    </Screen>
  );
}
