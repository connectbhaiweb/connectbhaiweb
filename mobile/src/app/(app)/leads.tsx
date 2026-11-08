import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/text';

import { Button, Card, Chip, Empty, Muted, Screen, Segment, Strong, useLoad } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fDate, leadChip, planTitle } from '@/lib/format';
import { useTheme } from '@/lib/theme';

const FILTERS = [
  { value: 'all', label: 'All' }, { value: 'new', label: 'New' }, { value: 'open', label: 'In progress' },
  { value: 'installed', label: 'Installed' }, { value: 'closed', label: 'Closed' },
];
const GROUP: Record<string, string[]> = { new: ['new'], open: ['contacted', 'followup', 'scheduled'], installed: ['installed'], closed: ['lost', 'cancelled'] };

export default function Leads() {
  const t = useTheme();
  const { user } = useAuth();
  const load = useLoad(() => api.leads());
  const [f, setF] = useState('all');
  const list = useMemo(() => (load.data || []).filter(l => f === 'all' || GROUP[f].includes(l.status)), [load.data, f]);

  return (
    <Screen title="Leads" subtitle={load.data ? `${load.data.length} total` : undefined} load={load}
      right={user?.role === 'dsa' ? <Button small icon="add" label="Add" onPress={() => router.push('/add-lead')} /> : undefined}>
      <Segment options={FILTERS} value={f} onChange={setF} />
      {list.length === 0 ? <Empty icon="people-outline" title="No leads here" hint={user?.role === 'dsa' ? 'Add a lead for a customer who wants a connection.' : 'New requests in your area appear here.'} /> : null}
      {list.map(l => {
        const [chip, tone] = leadChip(l.status);
        return (
          <Pressable key={l.id} onPress={() => router.push({ pathname: '/lead/[id]', params: { id: String(l.id) } })} accessibilityRole="button" accessibilityLabel={`Lead ${l.customer_name}`}>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Strong>{l.customer_name}</Strong>
                  <Text style={{ color: t.muted, marginTop: 2 }}>{l.customer_phone} · {l.pincode}</Text>
                </View>
                <Chip label={chip} tone={tone} />
              </View>
              <Muted style={{ marginTop: 6 }}>{planTitle(l.plan)} · #{l.ref_code} · {fDate(l.created_at)}</Muted>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
