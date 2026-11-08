import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/text';

import { Button, Card, Chip, ContactButtons, Empty, Field, Muted, Row, Screen, Segment, Sheet, Strong, useBusy, useLoad } from '@/components/ui';
import { api, type Booking } from '@/lib/api';
import { fDate, planTitle, pretty, type Tone } from '@/lib/format';
import { useTheme } from '@/lib/theme';

const tone = (s: string): Tone => (s === 'completed' ? 'green' : s === 'cancelled' ? 'red' : 'amber');
const label = (s: string) => (s === 'completed' ? 'Installed' : s === 'rescheduled' ? 'Rescheduled' : pretty(s));

/* TIP: installations. Mark installed (connection reference) or cancel. */
export default function Bookings() {
  const t = useTheme();
  const load = useLoad(() => api.bookings());
  const [f, setF] = useState<'open' | 'done' | 'cancelled'>('open');
  const [sel, setSel] = useState<Booking | null>(null);
  const [conn, setConn] = useState('');
  const [serial, setSerial] = useState('');
  const { busy, error, setError, run } = useBusy();

  const list = (load.data || []).filter(b => (f === 'open' ? ['scheduled', 'rescheduled'].includes(b.status) : f === 'done' ? b.status === 'completed' : b.status === 'cancelled'));
  const close = () => { setSel(null); setConn(''); setSerial(''); setError(''); };

  const complete = async () => {
    if (!conn.trim()) { setError('Enter the connection reference to mark as installed.'); return; }
    if (await run(() => api.completeBooking(sel!.id, conn, serial))) { close(); load.reload(); }
  };
  const cancel = async () => { if (await run(() => api.cancelBooking(sel!.id))) { close(); load.reload(); } };

  return (
    <Screen title="Installs" subtitle="Scheduled and completed installations" load={load}>
      <Segment options={[{ value: 'open', label: 'Scheduled' }, { value: 'done', label: 'Installed' }, { value: 'cancelled', label: 'Cancelled' }]} value={f} onChange={setF} />
      {list.length === 0 ? <Empty icon="construct-outline" title="No installations here" hint="Book an installation from a lead after you have contacted the customer." /> : null}
      {list.map(b => (
        <Pressable key={b.id} onPress={() => setSel(b)} accessibilityRole="button" accessibilityLabel={`Installation ${b.lead?.customer_name}`}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Strong>{b.lead?.customer_name || 'Customer'}</Strong>
                <Text style={{ color: t.muted, marginTop: 2 }}>{b.lead?.address || b.lead?.pincode}</Text>
              </View>
              <Chip label={label(b.status)} tone={tone(b.status)} />
            </View>
            <Muted style={{ marginTop: 6 }}>{planTitle(b.lead?.plan)} · {b.scheduled_at ? fDate(b.scheduled_at) : 'Date not set'}</Muted>
          </Card>
        </Pressable>
      ))}

      <Sheet visible={!!sel} title={sel?.lead?.customer_name || 'Installation'} onClose={close}>
        {sel ? (
          <>
            <Row label="Phone" value={sel.lead?.customer_phone} />
            <Row label="Address" value={sel.lead?.address} />
            <Row label="Date" value={sel.scheduled_at ? fDate(sel.scheduled_at) : undefined} />
            <Row label="Connection ref" value={sel.connection_id || undefined} />
            <View style={{ marginVertical: 10 }}><ContactButtons phone={sel.lead?.customer_phone} /></View>
            {sel.status === 'scheduled' || sel.status === 'rescheduled' ? (
              <>
                <Field label="Connection reference" value={conn} onChangeText={setConn} autoCapitalize="characters" />
                <Field label="Router serial (optional)" value={serial} onChangeText={setSerial} autoCapitalize="characters" />
                {error ? <Text style={{ color: t.bad, marginBottom: 10 }}>{error}</Text> : null}
                <View style={{ gap: 8 }}>
                  <Button label="Mark installed" icon="checkmark-circle" onPress={complete} loading={busy} />
                  <Button label="Cancel installation" kind="danger" onPress={cancel} disabled={busy} />
                  <Button label="Open lead" kind="secondary" onPress={() => { const id = sel.lead_id; close(); router.push({ pathname: '/lead/[id]', params: { id: String(id) } }); }} />
                </View>
              </>
            ) : null}
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
