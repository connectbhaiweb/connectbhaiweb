/* The floating compare bar and the Compare dialog (the website shows the table as one card per row on phones). */
import { View } from 'react-native';

import { inr } from '../../lib/api/base';
import type { Plan } from '../../lib/api/types';
import { Button, Row } from '../../ui/kit';
import { DialogTitle } from '../../ui/overlay';
import { T } from '../../ui/text';
import { colors, radius, shadow } from '../../ui/theme';
import { dataTxt, isRecommended, isSpeedCat, priceUnit } from './planText';

export function CompareBar({ count, onCompare, onClear }: { count: number; onCompare: () => void; onClear: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.ink, borderRadius: radius.card, paddingVertical: 10, paddingLeft: 16, paddingRight: 10, boxShadow: shadow.pop, maxWidth: '94%' }}>
      <T s={14.5} w={800} c={colors.bg} numberOfLines={1} adjustsFontSizeToFit style={{ flexShrink: 1 }}>
        {`${count}`} {'selected'}
        {count < 2 ? ' · pick 2–3' : ''}
      </T>
      <Button label="Compare" small onPress={onCompare} />
      <Button label="Clear" variant="plainDark" small onPress={onClear} />
    </View>
  );
}

export function CompareDialog({ plans, pin, onChoose }: { plans: Plan[]; pin: string; onChoose: (p: Plan) => void }) {
  // recommended first, the rest as picked
  const ps = [...plans].sort((a, b) => Number(isRecommended(b)) - Number(isRecommended(a)));
  const speedy = ps.some((p) => isSpeedCat(p.category));
  const sim = ps.some((p) => p.category.startsWith('sim'));
  const data: [string, (p: Plan) => string] = ['Data', dataTxt];
  const rows: [string, (p: Plan) => string][] = [
    ['Provider', (p) => p.provider.name],
    ...(speedy ? ([['Speed', (p: Plan) => `${p.speed_mbps || '—'} Mbps`]] as typeof rows) : []),
    ['Price', (p) => `${inr(p.price_monthly)}${priceUnit(p)}`],
    ...(speedy ? ([['₹ per Mbps', (p: Plan) => (p.speed_mbps ? '₹' + (p.price_monthly / p.speed_mbps).toFixed(1) : '—')]] as typeof rows) : []),
    ...(sim
      ? ([
          ['Data', (p: Plan) => (p.data_per_day_gb ? p.data_per_day_gb + ' GB/day' : dataTxt(p))],
          ['Validity', (p: Plan) => p.validity_days + ' days'],
          ['Calls', (p: Plan) => p.voice || '—'],
          ['SMS', (p: Plan) => (p.sms_per_day ? p.sms_per_day + '/day' : '—')],
        ] as typeof rows)
      : ([data, ['Installation', (p: Plan) => (Number(p.install_charge) ? inr(p.install_charge) : 'Free')]] as typeof rows)),
    ['OTT apps', (p) => (p.ott_apps.length ? p.ott_apps.join(', ') : '—')],
    ...(sim ? [] : ([['TV channels', (p: Plan) => (p.tv_channels ? p.tv_channels + '+' : '—')]] as typeof rows)),
  ];
  const card = { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 12, gap: 8 } as const;
  return (
    <View style={{ gap: 10 }}>
      <DialogTitle title="Compare plans" sub={pin ? `PIN ${pin}` : undefined} />
      {rows.map(([label, value]) => (
        <View key={label} style={card}>
          <T s={14} w={700} c={colors.muted}>{label}</T>
          {ps.map((p) => (
            <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <T s={13} c={colors.muted} style={{ flex: 1 }} raw>{p.name}</T>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <T s={14} w={700} style={{ textAlign: 'right' }}>{value(p)}</T>
                {label === 'Provider' && isRecommended(p) ? (
                  <View style={{ backgroundColor: colors.blueSoft, borderRadius: 4, paddingHorizontal: 6 }}>
                    <T s={11} w={800} c={colors.blue} caps={0.6}>Recommended</T>
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ))}
      <View style={card}>
        {ps.map((p) => (
          <Row key={p.id} wrap={false} style={{ justifyContent: 'space-between', gap: 12 }}>
            <T s={13} c={colors.muted} style={{ flex: 1 }} raw>{p.name}</T>
            <Button label="Choose" small onPress={() => onChoose(p)} />
          </Row>
        ))}
      </View>
    </View>
  );
}
