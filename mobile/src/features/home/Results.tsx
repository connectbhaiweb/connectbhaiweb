/* Search results: heading, sort, filters, plan cards, empty states. */
import { View } from 'react-native';

import { CATS, inr } from '../../lib/api/base';
import type { Plan } from '../../lib/api/types';
import { ProviderLogo } from '../../ui/brand';
import { Check, Select } from '../../ui/forms';
import { Button, Card, Chip, Empty, Eyebrow, Facts, LinkButton, Row, Section } from '../../ui/kit';
import { Slider } from '../../ui/slider';
import { T } from '../../ui/text';
import { colors, radius } from '../../ui/theme';
import { budgetOf, ctaFor, filterPlans, isRecommended, isSpeedCat, planBig, planFacts, priceUnit, startFilters, type Filters } from './planText';

function PlanCard({ p, selected, onCompare, onRequest }: { p: Plan; selected: boolean; onCompare: () => void; onRequest: () => void }) {
  const [big, unit] = planBig(p);
  return (
    <Card pad={18} gap={12} style={selected ? { borderColor: colors.blue, boxShadow: `0 0 0 3px ${colors.blueSoft}` } : undefined}>
      {isRecommended(p) ? (
        <View style={{ alignSelf: 'flex-start', backgroundColor: colors.blue, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 }}>
          <T s={11} w={800} c={colors.white} caps={0.9}>Recommended</T>
        </View>
      ) : null}
      <Row wrap={false}>
        <ProviderLogo provider={p.provider} />
        <View style={{ flex: 1 }}>
          <T s={14} w={800}>{p.provider.name}</T>
          <T s={13} w={600} c={colors.muted}>{CATS[p.category] || ''}</T>
        </View>
      </Row>
      <T f="display" s={18} w={700} lh={26}>{p.name}</T>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        {p.category === 'tv' ? (
          <>
            <Row gap={4} style={{ alignItems: 'baseline' }}>
              <T f="display" s={30} w={800} raw>{inr(p.price_monthly)}</T>
              <T w={700} c={colors.muted}>{priceUnit(p)}</T>
            </Row>
            {p.tv_channels ? <T s={14} w={700} c={colors.blue}>{`${p.tv_channels} channels`}</T> : null}
          </>
        ) : (
          <>
            <Row gap={8} style={{ alignItems: 'baseline' }}>
              <T f="display" s={38} w={800} c={colors.blue} lh={44} raw>{big}</T>
              <T w={700} c={colors.muted}>{unit}</T>
            </Row>
            <Row gap={0} wrap={false} style={{ alignItems: 'baseline' }}>
              <T f="display" s={22} w={800} raw>{inr(p.price_monthly)}</T>
              <T s={13} w={600} c={colors.muted}>{priceUnit(p)}</T>
            </Row>
          </>
        )}
      </Row>
      <Facts rows={planFacts(p)} />
      <Row gap={6}>
        {p.ott_apps.length ? (
          p.ott_apps.map((o) => (
            <View key={o} style={{ backgroundColor: colors.blueSoft, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
              <T s={12} w={700} c={colors.blue} raw>{o}</T>
            </View>
          ))
        ) : (
          <T s={14} c={colors.muted}>No OTT apps included</T>
        )}
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <Check label="Compare" small checked={selected} onChange={onCompare} />
        <Button label={ctaFor(p)} small onPress={onRequest} />
      </Row>
    </Card>
  );
}

type Props = {
  results: Plan[];
  category: string;
  pin: string;
  areas: string[];
  cityName: string;
  filters: Filters;
  setFilters: (f: Filters) => void;
  compare: string[];
  onCompare: (id: string) => void;
  onRequest: (plan: Plan | null) => void;
  simType: string;
  onSimType: (t: string) => void;
  onChooseCity: () => void;
};

export function Results({ results, category, pin, areas, cityName, filters: f, setFilters, compare, onCompare, onRequest, simType, onSimType, onChooseCity }: Props) {
  const speedy = isSpeedCat(category);
  const sim = category.startsWith('sim');
  const where = pin ? `PIN ${pin}${areas.length ? ' · ' + areas.join(', ') : ''} · ${CATS[category]}` : CATS[category];

  if (!results.length)
    return (
      <Section bottom={24} top={24}>
        <Empty>
          <Eyebrow text={where} center />
          <T f="display" s={24} w={700} center>{pin ? `No ${CATS[category]} plans at this PIN code yet` : 'No plans listed yet'}</T>
          <T c={colors.muted} center>Leave your details and we will call you as soon as it is available at your address.</T>
          <Button label="Request a callback" onPress={() => onRequest(null)} style={{ alignSelf: 'center' }} />
          {pin ? <Button label={`Not in ${cityName}? Choose your city`} variant="ghost" onPress={onChooseCity} style={{ alignSelf: 'center' }} /> : null}
        </Empty>
      </Section>
    );

  const providers = [...new Map(results.map((p) => [p.provider_id, p.provider])).values()];
  const maxP = Math.ceil(Math.max(...results.map(budgetOf)) / 100) * 100;
  const list = filterPlans(results, f);
  const set = (patch: Partial<Filters>) => setFilters({ ...f, ...patch });
  const reset = () => setFilters(startFilters(results));
  const label = (text: string, value?: string) => <T s={13} w={800} c={colors.muted} caps={0.5}>{text}{value || ''}</T>;

  return (
    <Section top={24} bottom={24} style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
        <Eyebrow text={where} />
        <T f="display" s={20} w={700}>{`${list.length} of ${results.length} ${sim ? 'SIM plans' : category === 'ott' ? 'OTT packs' : 'plans'} match`}</T>
      </View>
      {sim ? (
        <Row>
          {(['prepaid', 'postpaid'] as const).map((k) => (
            <Chip key={k} label={k === 'prepaid' ? 'Prepaid' : 'Postpaid'} selected={simType === k} onPress={() => onSimType(k)} />
          ))}
        </Row>
      ) : null}
      <Row wrap={false}>
        <T s={14} w={700}>Sort by</T>
        <View style={{ flexShrink: 1, minWidth: 200 }}>
          <Select
            label="Sort by"
            noLabel
            compact
            value={f.sort}
            onChange={(v) => set({ sort: v as Filters['sort'] })}
            options={[{ value: 'price', label: 'Price: low to high' }, ...(speedy ? [{ value: 'speed', label: 'Speed: high to low' }, { value: 'value', label: 'Best value (₹ per Mbps)' }] : [])]}
          />
        </View>
      </Row>
      <Card pad={18} gap={18}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T s={15} w={800}>Filters</T>
          <LinkButton label="Reset" onPress={reset} />
        </Row>
        {speedy ? (
          <View style={{ gap: 8 }}>
            {label('Minimum speed')}
            <Row>
              {[0, 50, 100, 200, 300].map((s) => (
                <Chip key={s} label={s ? s + '+ Mbps' : 'Any'} selected={f.speed === s} onPress={() => set({ speed: s })} />
              ))}
            </Row>
          </View>
        ) : null}
        <View style={{ gap: 4 }}>
          {label('Max price (before GST): ', inr(f.price))}
          <Slider label="Max price" min={100} max={maxP} step={50} value={Math.min(f.price, maxP)} onChange={(price) => set({ price })} />
        </View>
        {category !== 'ott' ? (
          <View style={{ gap: 10 }}>
            {label('Benefits')}
            <Check label="Includes OTT apps" checked={f.ott} onChange={(ott) => set({ ott })} />
            {speedy ? <Check label="Includes TV channels" checked={f.tv} onChange={(tv) => set({ tv })} /> : null}
          </View>
        ) : null}
        <View style={{ gap: 10 }}>
          {label('Provider')}
          {providers.map((p) => (
            <Check key={p.id} label={p.name} checked={f.providers.includes(p.id)} onChange={(on) => set({ providers: on ? [...f.providers, p.id] : f.providers.filter((x) => x !== p.id) })} />
          ))}
        </View>
      </Card>
      {list.length ? (
        list.map((p) => <PlanCard key={p.id} p={p} selected={compare.includes(p.id)} onCompare={() => onCompare(p.id)} onRequest={() => onRequest(p)} />)
      ) : (
        <Empty>
          <T w={800} center>No plans match these filters.</T>
          <Button label="Reset filters" variant="ghost" small onPress={reset} style={{ alignSelf: 'center', borderRadius: radius.sm }} />
        </Empty>
      )}
      <Row gap={4}>
        <T s={14} c={colors.muted}>{`Can't decide?`}</T>
        <LinkButton label="Request a callback" onPress={() => onRequest(null)} />
        <T s={14} c={colors.muted}>and a TIP will help you choose.</T>
      </Row>
    </Section>
  );
}
