import { router } from 'expo-router';
import { ChevronRight, MapPin, Phone } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Chip } from '@/components/ui';
import { fDate, leadChip, planTitle, type Lead } from '@/lib/customer';
import { colors, font, shadow } from '@/lib/theme';

export function Kpi({ label, value, tone = colors.ink, onPress }: { label: string; value: number | string; tone?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[k.box, shadow.card]}>
      <Text style={[k.num, { color: tone }]}>{value}</Text>
      <Text style={k.label}>{label}</Text>
    </Pressable>
  );
}

export function LeadRow({ lead }: { lead: Lead }) {
  const [label, tone] = leadChip(lead.status);
  return (
    <Pressable onPress={() => router.push({ pathname: '/lead/[id]', params: { id: String(lead.id) } })}>
      <Card style={{ gap: 8, padding: 14 }}>
        <View style={r.top}>
          <View style={{ flex: 1 }}>
            <Text style={r.name} numberOfLines={1}>{lead.name || 'Customer'}</Text>
            <Text style={r.ref}>{lead.ref} · {fDate(lead.createdAt)}</Text>
          </View>
          <Chip label={label} tone={tone} />
        </View>
        <View style={r.line}><Phone size={14} color={colors.muted} /><Text style={r.meta}>{lead.phone}</Text><MapPin size={14} color={colors.muted} style={{ marginLeft: 10 }} /><Text style={r.meta} numberOfLines={1}>{lead.pincode}{lead.area ? `, ${lead.area}` : ''}</Text></View>
        {lead.plan && <Text style={r.plan} numberOfLines={1}>{planTitle(lead.plan)}</Text>}
        <View style={r.more}><Text style={r.moreText}>Open</Text><ChevronRight size={16} color={colors.blue} /></View>
      </Card>
    </Pressable>
  );
}

const k = StyleSheet.create({
  box: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.cardLine },
  num: { fontFamily: font.displayXBold, fontSize: 30 },
  label: { fontFamily: font.bodyBold, fontSize: 13, color: colors.muted, marginTop: 2 },
});
const r = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: font.display, fontSize: 17, color: colors.ink },
  ref: { fontFamily: font.body, fontSize: 12.5, color: colors.muted, marginTop: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { fontFamily: font.bodyMd, fontSize: 14, color: colors.text, flexShrink: 1 },
  plan: { fontFamily: font.bodyBold, fontSize: 14, color: colors.actionInk },
  more: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end' },
  moreText: { fontFamily: font.bodyBold, fontSize: 13.5, color: colors.blue },
});
