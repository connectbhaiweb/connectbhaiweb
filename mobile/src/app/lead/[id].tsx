import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/text';

import { Button, Card, Chip, ContactButtons, Field, H2, Muted, Row, Screen, Sheet, Strong, useBusy, useLoad } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fDayTime, leadChip, planPrice, planTitle, pretty } from '@/lib/format';
import { useTheme } from '@/lib/theme';

/* what a TIP can do next from each status (same rules as the website) */
const NEXT: Record<string, { status: string; label: string }[]> = {
  new: [{ status: 'contacted', label: 'Mark contacted' }, { status: 'followup', label: 'Follow-up' }, { status: 'lost', label: 'Close lead' }],
  contacted: [{ status: 'followup', label: 'Follow-up' }, { status: 'lost', label: 'Close lead' }],
  followup: [{ status: 'contacted', label: 'Mark contacted' }, { status: 'lost', label: 'Close lead' }],
  scheduled: [{ status: 'lost', label: 'Close lead' }],
};

export default function LeadDetail() {
  const t = useTheme();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const leadId = Number(id);
  const load = useLoad(async () => {
    const [lead, events, bookings] = await Promise.all([api.lead(leadId), api.leadEvents(leadId), user?.role === 'tip' ? api.bookings() : Promise.resolve([])]);
    return { lead, events, booking: bookings.find(b => b.lead_id === leadId && b.status !== 'cancelled') };
  }, [leadId]);
  const [sheet, setSheet] = useState<null | { status: string; label: string } | 'book'>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const { busy, error, setError, run } = useBusy();

  const d = load.data;
  const isTip = user?.role === 'tip';
  const close = () => { setSheet(null); setNote(''); setDate(''); setError(''); };

  const submitStatus = async (status: string) => {
    if (status === 'followup' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError('Enter the follow-up date as YYYY-MM-DD.'); return; }
    if (status === 'lost' && !note.trim()) { setError('Add a short reason for closing this lead.'); return; }
    if (await run(() => api.updateLeadStatus(leadId, status, note, date))) { close(); load.reload(); }
  };
  const submitBook = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError('Enter the installation date as YYYY-MM-DD.'); return; }
    if (new Date(date + 'T18:00:00').getTime() < Date.now()) { setError('Choose today or a future date.'); return; }
    if (await run(() => api.createBooking(leadId, date))) { close(); load.reload(); }
  };

  return (
    <Screen load={load} tabBar={false}>
      {d ? (() => {
        const l = d.lead, [chip, tone] = leadChip(l.status), actions = NEXT[l.status] || [];
        return (
          <>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Strong style={{ fontSize: 18 }}>{l.customer_name}</Strong>
                  <Muted>#{l.ref_code}</Muted>
                </View>
                <Chip label={chip} tone={tone} />
              </View>
              <View style={{ marginTop: 10 }}>
                <Row label="Phone" value={l.customer_phone} />
                <Row label="PIN code" value={l.pincode} />
                <Row label="Area" value={l.area?.name} />
                <Row label="Address" value={l.address} />
                <Row label="Plan" value={l.plan ? `${planTitle(l.plan)} · ${planPrice(l.plan)}` : undefined} />
                <Row label="Brought by" value={l.dsa?.name} />
                <Row label="Installer" value={l.tip ? l.tip.business_name || l.tip.name : undefined} />
                <Row label="Follow-up on" value={l.followup_at ? fDayTime(l.followup_at) : undefined} />
                <Row label="Notes" value={l.notes} />
              </View>
              <View style={{ marginTop: 10 }}><ContactButtons phone={l.customer_phone} text={`Namaste ${l.customer_name}, this is about your Connect Bhai request ${l.ref_code}`} /></View>
            </Card>

            {isTip && (actions.length || l.status === 'contacted' || l.status === 'followup') ? (
              <Card>
                <H2>Next step</H2>
                <View style={{ gap: 8 }}>
                  {(l.status === 'contacted' || l.status === 'followup') && !d.booking ? <Button label="Book installation" icon="calendar" onPress={() => setSheet('book')} /> : null}
                  {actions.map(a => <Button key={a.status} kind={a.status === 'lost' ? 'danger' : 'secondary'} label={a.label} onPress={() => setSheet(a)} />)}
                </View>
              </Card>
            ) : null}

            <Card>
              <H2>History</H2>
              {d.events.length === 0 ? <Muted>No updates yet.</Muted> : d.events.map(e => (
                <View key={e.id} style={{ paddingVertical: 6, borderTopWidth: 1, borderTopColor: t.line }}>
                  <Text style={{ color: t.ink, fontWeight: '600' }}>{e.note || pretty(e.event_type || 'update')}</Text>
                  <Muted>{fDayTime(e.created_at)}{e.actor ? ' · ' + e.actor.name : ''}</Muted>
                </View>
              ))}
            </Card>

            <Sheet visible={sheet !== null} title={sheet === 'book' ? 'Book installation' : sheet ? sheet.label : ''} onClose={close}>
              {sheet === 'book' ? (
                <>
                  <Field label="Installation date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-11-20" keyboardType="numbers-and-punctuation" />
                  {error ? <Text style={{ color: t.bad, marginBottom: 10 }}>{error}</Text> : null}
                  <Button label="Confirm booking" onPress={submitBook} loading={busy} />
                </>
              ) : sheet ? (
                <>
                  {sheet.status === 'followup' ? <Field label="Follow-up date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-11-12" keyboardType="numbers-and-punctuation" /> : null}
                  <Field label={sheet.status === 'lost' ? 'Reason' : 'Note (optional)'} value={note} onChangeText={setNote} multiline />
                  {error ? <Text style={{ color: t.bad, marginBottom: 10 }}>{error}</Text> : null}
                  <Button label="Save" onPress={() => submitStatus(sheet.status)} loading={busy} kind={sheet.status === 'lost' ? 'danger' : 'primary'} />
                </>
              ) : null}
            </Sheet>
          </>
        );
      })() : null}
    </Screen>
  );
}
