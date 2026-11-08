import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/text';

import { Button, Card, Chip, Empty, Field, Muted, Screen, Segment, Sheet, Strong, callSupport, useBusy, useLoad } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fDate, pretty, ticketTone } from '@/lib/format';
import { useTheme } from '@/lib/theme';

const CATS = [
  { value: 'no_internet', label: 'No internet' }, { value: 'slow_speed', label: 'Slow speed' }, { value: 'billing', label: 'Billing' },
  { value: 'shifting', label: 'Shifting' }, { value: 'other', label: 'Other' },
];
const STATUSES = [{ value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In progress' }, { value: 'resolved', label: 'Resolved' }];

/* Customer: raise and track complaints. TIP: update their status. */
export default function Tickets() {
  const t = useTheme();
  const { user } = useAuth();
  const isCustomer = user?.role === 'customer';
  const load = useLoad(async () => ({ tickets: await api.tickets(), bookings: isCustomer ? await api.bookings() : [] }));
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState('no_internet');
  const [lead, setLead] = useState<number | undefined>();
  const [text, setText] = useState('');
  const { busy, error, setError, run } = useBusy();

  const connections = (load.data?.bookings || []).filter(b => b.status === 'completed');
  const chosen = lead ?? connections[0]?.lead_id;

  const submit = async () => {
    if (!chosen) { setError('You can raise a complaint once a connection is installed.'); return; }
    if (text.trim().length < 5) { setError('Describe the issue in a few words.'); return; }
    if (await run(() => api.raiseTicket({ leadId: chosen, category: cat, description: text }))) { setOpen(false); setText(''); load.reload(); }
  };
  const setStatus = (id: number, status: string) => run(async () => { await api.updateTicket(id, status); load.reload(); });

  return (
    <Screen title={isCustomer ? 'Complaints & requests' : 'Tickets'} load={load}
      right={isCustomer ? <Button small icon="add" label="New" onPress={() => { setError(''); setOpen(true); }} /> : undefined}>
      {isCustomer ? <Button small kind="secondary" icon="call" label="Call support" onPress={callSupport} /> : null}
      {load.data && load.data.tickets.length === 0 ? <Empty icon="headset-outline" title="No tickets" hint={isCustomer ? 'Raise a complaint if your internet has a problem.' : 'Customer complaints for your installations appear here.'} /> : null}
      {(load.data?.tickets || []).map(k => (
        <Card key={k.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flex: 1 }}><Strong>{k.subject}</Strong><Muted>{k.ticket_code} · {pretty(k.category)} · {fDate(k.created_at)}</Muted></View>
            <Chip label={pretty(k.status)} tone={ticketTone(k.status)} />
          </View>
          {k.lead ? <Muted style={{ marginTop: 6 }}>{k.lead.customer_name} · {k.lead.customer_phone}</Muted> : null}
          {user?.role === 'tip' && k.status !== 'resolved' && k.status !== 'closed' ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              {STATUSES.filter(s => s.value !== k.status).map(s => <Button key={s.value} small kind="secondary" label={s.label} onPress={() => setStatus(k.id, s.value)} disabled={busy} />)}
            </View>
          ) : null}
        </Card>
      ))}

      <Sheet visible={open} title="Raise a complaint" onClose={() => setOpen(false)}>
        <Text style={{ color: t.muted, fontWeight: '600', marginBottom: 8 }}>What is the problem?</Text>
        <Segment options={CATS} value={cat} onChange={setCat} />
        {connections.length > 1 ? (
          <>
            <Text style={{ color: t.muted, fontWeight: '600', marginBottom: 8 }}>Connection</Text>
            <Segment options={connections.map(b => ({ value: String(b.lead_id), label: b.lead?.ref_code || '#' + b.id }))} value={String(chosen)} onChange={v => setLead(Number(v))} />
          </>
        ) : null}
        <Field label="Describe the issue" value={text} onChangeText={setText} multiline />
        {error ? <Text style={{ color: t.bad, marginBottom: 10 }} accessibilityRole="alert">{error}</Text> : null}
        <Button label="Submit complaint" onPress={submit} loading={busy} />
      </Sheet>
    </Screen>
  );
}

export { ApiError };
