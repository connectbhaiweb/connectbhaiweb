import { View } from 'react-native';

import { Card, Chip, Empty, Muted, Row, Screen, Strong, useLoad } from '@/components/ui';
import { api } from '@/lib/api';
import { fDate, inr, pretty, type Tone } from '@/lib/format';

const tone = (s: string): Tone => (s === 'paid' ? 'green' : s === 'approved' ? 'blue' : s === 'cancelled' ? 'red' : 'amber');

/* DSA: payout per installed lead (paid per lead, no fee to Connect Bhai) */
export default function Commission() {
  const load = useLoad(() => api.commissions());
  const list = load.data || [];
  const sum = (...s: string[]) => list.filter(c => s.includes(c.status)).reduce((a, c) => a + Number(c.amount), 0);
  return (
    <Screen title="Commission" subtitle="Your payout for each installed lead" load={load}>
      <Card>
        <Row label="Paid" value={inr(sum('paid'))} />
        <Row label="Approved, waiting for payment" value={inr(sum('approved'))} />
        <Row label="Pending approval" value={inr(sum('pending'))} />
      </Card>
      {load.data && list.length === 0 ? <Empty icon="wallet-outline" title="No commission yet" hint="You earn a payout when a lead you brought is installed." /> : null}
      {list.map(c => (
        <Card key={c.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flex: 1 }}><Strong>{c.lead?.customer_name || 'Lead'}</Strong><Muted>{c.lead?.ref_code} · {fDate(c.created_at)}</Muted></View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}><Strong>{inr(c.amount)}</Strong><Chip label={pretty(c.status)} tone={tone(c.status)} /></View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
