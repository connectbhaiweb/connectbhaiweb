/* "Report slow speed" / "Report modem offline": a complaint for one of the customer's connections. */
import { useState } from 'react';
import { View } from 'react-native';

import { API } from '../../lib/api';
import { errMsg, useForm } from '../../lib/forms';
import { Input, Select } from '../../ui/forms';
import { Button } from '../../ui/kit';
import { DialogTitle, useGuard, useOverlay } from '../../ui/overlay';

type Prefill = { title?: string; booking_id?: string; category?: string; description: string };
type Option = { value: string; label: string };

function TicketDialog({ prefill, options }: { prefill: Prefill; options: Option[] }) {
  const overlay = useOverlay();
  const [busy, guard] = useGuard();
  const { values: v, errors: e, set, check } = useForm({ booking: prefill.booking_id || '', description: prefill.description });
  const send = () => {
    const description = v.description.trim();
    if (!check({ booking: !v.booking ? 'Choose the connection for a complaint.' : '', description: description.length < 5 ? 'Describe the issue in a few words.' : '' })) return;
    guard(async () => {
      const ref = await API.raiseTicket({ type: 'complaint', booking_id: v.booking, category: prefill.category || 'Slow speed', description });
      overlay.close();
      overlay.toast(`Submitted. Ticket ${ref}.`);
    });
  };
  return (
    <View style={{ gap: 12 }}>
      <DialogTitle title={prefill.title || 'Report slow speed'} />
      <Select label="Connection" value={v.booking} onChange={(x) => set('booking', x)} error={e.booking} options={[{ value: '', label: 'Choose connection' }, ...options]} />
      <Input label="Details" multiline maxLength={1000} value={v.description} onChangeText={(x) => set('description', x)} error={e.description} />
      <Button label="Submit complaint" block busy={busy} onPress={send} />
    </View>
  );
}

export function useTicketDialog() {
  const overlay = useOverlay();
  const [loading, setLoading] = useState(false);
  return async (prefill: Prefill) => {
    if (loading) return;
    setLoading(true);
    try {
      const bookings = (await API.myBookings()).filter((b) => b.status !== 'cancelled');
      overlay.open(<TicketDialog prefill={prefill} options={bookings.map((b) => ({ value: b.id, label: `${b.ref_code} · ${b.plan ? b.plan.name : ''}` }))} />);
    } catch (e) {
      overlay.toast(errMsg(e), true);
    } finally {
      setLoading(false);
    }
  };
}
