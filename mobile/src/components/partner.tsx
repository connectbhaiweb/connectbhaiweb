import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip } from '@/components/ui';
import { useSession } from '@/lib/session';
import { fDate, leadChip, planTitle, type Lead } from '@/lib/customer';
import { colors, font, shadow } from '@/lib/theme';

export function Kpi({ label, value, hint, tone = colors.ink, onPress }: { label: string; value: number | string; hint?: string; tone?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[k.box, shadow.card]}>
      <Text style={k.label}>{label}</Text>
      <Text style={[k.num, { color: tone }]}>{value}</Text>
      {!!hint && <Text style={k.hint}>{hint}</Text>}
    </Pressable>
  );
}

const KV = ({ k, v, mono }: { k: string; v?: string | null; mono?: boolean }) => (
  <View style={r.kv}><Text style={r.k}>{k}</Text><Text style={[r.v, mono && { fontFamily: font.mono }]} numberOfLines={2}>{v || '—'}</Text></View>
);

/* One lead, laid out like the website's phone card: key / value rows and Update / Change TIP. */
export function LeadRow({ lead }: { lead: Lead }) {
  const { user } = useSession();
  const [label, tone] = leadChip(lead.status);
  const open = () => router.push({ pathname: '/lead/[id]', params: { id: String(lead.id) } });
  return (
    <Card style={{ gap: 6, padding: 14 }}>
      <Text style={[r.ref, { fontFamily: font.mono }]}>{lead.ref}</Text>
      <Text style={[r.ref, { fontFamily: font.mono }]}>{fDate(lead.createdAt)}</Text>
      <View style={r.kv}>
        <Text style={r.k}>Customer</Text>
        <View style={{ alignItems: 'flex-end', gap: 6, flex: 1 }}>
          <Text style={r.name}>{lead.name || 'Customer'}</Text>
          <Text style={r.k}>+91 {lead.phone}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Button small kind="outline" label="Call" onPress={() => Linking.openURL(`tel:+91${lead.phone}`)} />
            <Button small kind="wa" label="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/91${lead.phone}`)} />
            <Button small kind="soft" label="Chat" onPress={() => router.push({ pathname: '/chat/[thread]', params: { thread: `lead:${lead.id}`, title: lead.name || 'Chat' } })} />
          </View>
        </View>
      </View>
      <KV k="PIN" v={lead.pincode} mono />
      <KV k="Area" v={lead.area} />
      <KV k="Plan" v={lead.plan ? planTitle(lead.plan) : 'Callback'} />
      <View style={r.kv}><Text style={r.k}>Status</Text><Chip label={label} tone={tone} /></View>
      <KV k="Next follow-up" v={lead.followUp ? fDate(lead.followUp) : null} />
      {user?.role !== 'tip' && <KV k="TIP" v={lead.tip?.name} />}
      {user?.role !== 'dsa' && <KV k="DSA" v={lead.dsa?.name} />}
      {!!lead.telephoneNo && <KV k="Telephone no." v={lead.telephoneNo} mono />}
      {!!lead.orderNo && <KV k="Order no." v={lead.orderNo} mono />}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        <Button small kind="soft" label="Update" onPress={open} />
        {lead.status === 'booked' && user?.role !== 'tip' && <Button small label={lead.tip ? 'Change TIP' : 'Assign TIP'} onPress={open} />}
        {lead.status === 'booked' && user?.role === 'tip' && <Button small label="Install" onPress={open} />}
      </View>
    </Card>
  );
}

const k = StyleSheet.create({
  box: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.cardLine },
  num: { fontFamily: font.displayXBold, fontSize: 30 },
  label: { fontFamily: font.bodyBold, fontSize: 14, color: colors.ink, marginBottom: 6 },
  hint: { fontFamily: font.body, fontSize: 13, color: colors.muted, marginTop: 2 },
});
const r = StyleSheet.create({
  ref: { fontFamily: font.bodyBold, fontSize: 13.5, color: colors.ink },
  name: { fontFamily: font.display, fontSize: 16.5, color: colors.ink },
  kv: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 5 },
  k: { fontFamily: font.body, fontSize: 14.5, color: colors.muted },
  v: { fontFamily: font.bodyBold, fontSize: 14.5, color: colors.ink, flex: 1, textAlign: 'right' },
});
