import { View } from 'react-native';
import { Text } from '@/components/text';

import { Button, Card, Chip, Empty, Muted, Screen, Strong, useBusy, useLoad } from '@/components/ui';
import { api } from '@/lib/api';
import { chargeLabel, chargeTone, fDate, inr, pretty } from '@/lib/format';
import { useTheme } from '@/lib/theme';

/* Customer: payments. Settles through the same /charges endpoints as the website. */
export default function Payments() {
  const t = useTheme();
  const load = useLoad(() => api.charges());
  const { busy, error, run } = useBusy();
  const pay = async (id: number) => { if (await run(() => api.payCharge(id))) load.reload(); };
  const due = (load.data || []).filter(c => ['pending', 'due', 'failed'].includes(c.status));

  return (
    <Screen title="Payments" subtitle={due.length ? `${due.length} due · ${inr(due.reduce((a, c) => a + Number(c.total_amount), 0))}` : 'All paid up'} load={load}>
      {error ? <Card style={{ borderColor: t.bad }}><Text style={{ color: t.bad }} accessibilityRole="alert">{error}</Text></Card> : null}
      {load.data && load.data.length === 0 ? <Empty icon="card-outline" title="No payments yet" hint="Invoices for your connection appear here." /> : null}
      {(load.data || []).map(c => (
        <Card key={c.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flex: 1 }}><Strong>{c.description || pretty(c.kind)}</Strong><Muted>{c.invoice_no || '#' + c.id} · {fDate(c.created_at)}</Muted></View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}><Strong>{inr(c.total_amount)}</Strong><Chip label={pretty(chargeLabel(c.status))} tone={chargeTone(c.status)} /></View>
          </View>
          {['pending', 'due', 'failed'].includes(c.status) ? <View style={{ marginTop: 10 }}><Button label={`Pay ${inr(c.total_amount)}`} icon="card" onPress={() => pay(c.id)} disabled={busy} /></View> : null}
          {c.paid_at ? <Muted style={{ marginTop: 6 }}>Paid on {fDate(c.paid_at)}</Muted> : null}
        </Card>
      ))}
    </Screen>
  );
}
