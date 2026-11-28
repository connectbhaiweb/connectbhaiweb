/* The search card of the hero: city, product tabs, PIN search, SIM choice, or the waiting list for a city that is
   not live yet. */
import { RotateCcw } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { API } from '../../lib/api';
import { PRODUCT_NAME, isPhone, isPin } from '../../lib/api/base';
import type { City } from '../../lib/api/types';
import { normPhone, useForm } from '../../lib/forms';
import { whatsApp } from '../../lib/links';
import { currentPosition } from '../../lib/location';
import { useSession } from '../../lib/session';
import { Check, Input, Select } from '../../ui/forms';
import { BigTick, Button, Chip, LinkButton, LoadError, Row, Skeleton } from '../../ui/kit';
import { useGuard, useOverlay } from '../../ui/overlay';
import { PinInput } from '../../ui/pinInput';
import { T } from '../../ui/text';
import { colors, radius } from '../../ui/theme';
import { cityOptions } from './cities';

export const PRODUCTS: [string, string][] = [['broadband', 'Fiber'], ['air_fiber', 'Air Fiber'], ['sim', 'SIM'], ['tv', 'TV'], ['ott', 'OTT']];
const HEADS: Record<string, [string, string]> = {
  broadband: ['Check Fiber Plans At Your Pincode', 'Enter your 6-digit PIN code'],
  air_fiber: ['Book Air Fiber', 'Wireless home internet, no fiber cable needed. Check availability at your PIN code.'],
  tv: ['TV channel packs', `IPTV over your fiber line. Check what's available at your PIN code.`],
  ott: ['OTT packs', `Streaming app bundles you can add to any connection. Check what's available at your PIN code.`],
};

export type PopularPin = { pin: string; area: string; city_id: string };
export type Waited = { city: string; phone: string; waiting: number } | null;

type Props = {
  loading: boolean;
  error?: string;
  onRetry: () => void;
  cities: City[];
  city: string;
  setCity: (id: string) => void;
  product: string;
  setProduct: (p: string) => void;
  pins: PopularPin[];
  pin: string;
  setPin: (v: string) => void;
  /** runs the search; resolves when the results are in */
  onSearch: (pin: string) => Promise<unknown>;
  onShowSim: () => Promise<unknown>;
  simType: string;
  setSimType: (t: string) => void;
  onReset: () => void;
  /** the PIN field got the keyboard; y is its place inside the card */
  onPinFocus: (y: number) => void;
  waited: Waited;
  setWaited: (w: Waited) => void;
};

function ProductTabs({ product, setProduct }: { product: string; setProduct: (p: string) => void }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 2, backgroundColor: colors.blueSoft, borderRadius: radius.card, padding: 4 }}>
      {PRODUCTS.map(([k, label]) => {
        const on = product === k;
        return (
          <Pressable
            key={k}
            testID={'product-' + k}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => setProduct(k)}
            style={{ flexGrow: label.length > 5 ? 1.5 : 1, flexShrink: 1, flexBasis: 0, minHeight: 40, borderRadius: radius.input, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, backgroundColor: on ? colors.surface : 'transparent', boxShadow: on ? '0 1px 4px rgba(10,40,100,0.14)' : undefined }}>
            {/* the Hindi "Air Fiber" is wider than its tab on the website; here it shrinks to fit */}
            <T s={13} w={700} c={on ? colors.blue : colors.muted} numberOfLines={1} adjustsFontSizeToFit>{label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

function WaitingList({ cityId, cityName, product, waited, setWaited }: { cityId: string; cityName: string; product: string; waited: Waited; setWaited: (w: Waited) => void }) {
  const { user } = useSession();
  const overlay = useOverlay();
  const me = user?.role === 'customer' ? user : null;
  const { values: v, errors: e, set, check } = useForm({ name: me?.full_name || '', phone: me?.phone || '', pin: '', consent: false });
  const [busy, guard] = useGuard();

  if (waited && waited.city === cityId)
    return (
      <View style={{ gap: 10, alignItems: 'center', paddingVertical: 6 }}>
        <BigTick size={48} />
        <T f="display" s={19} w={700} center>{`You're on the list for ${cityName}`}</T>
        <T s={14} c={colors.muted} center>
          {"We'll WhatsApp "}
          <T s={14} w={700} c={colors.muted} raw>{`+91 ${waited.phone.slice(0, 5)} ${waited.phone.slice(5)}`}</T>
          {` the day Connect Bhai starts in ${cityName}. `}
          {waited.waiting > 1 ? `${waited.waiting} ` : ''}
          {waited.waiting > 1 ? `people in ${cityName} are waiting so far. ` : ''}
          {'More people from one city means we launch there sooner.'}
        </T>
        <Button label={`Share with friends in ${cityName} on WhatsApp`} variant="soft" small style={{ alignSelf: 'center' }} onPress={() => whatsApp(undefined, `Connect Bhai is coming to ${cityName}: compare broadband, SIM, TV and OTT plans and book online. Join the waiting list: https://www.connectbhai.com`)} />
        <LinkButton label="Add another number" style={{ alignSelf: 'center' }} onPress={() => setWaited(null)} />
      </View>
    );

  const join = () => {
    const d = { city_id: cityId, name: v.name.trim(), phone: normPhone(v.phone), consent: v.consent };
    const ok = check({
      name: d.name.length < 2 ? 'Enter your name.' : '',
      phone: !isPhone(d.phone) ? 'Enter a valid 10-digit WhatsApp number.' : '',
      pin: v.pin && !isPin(v.pin) ? 'Enter a valid 6-digit PIN code.' : '',
      consent: !d.consent ? 'Tick this so we can message you at launch.' : '',
    });
    if (!ok) return;
    guard(async () => {
      const r = await API.joinWaitlist(d);
      setWaited({ city: cityId, phone: d.phone, waiting: r.waiting });
      overlay.toast(`You're on the list for ${r.city}.`);
    });
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <T f="display" s={19} w={700}>{`Launching soon in ${cityName}`}</T>
        <T s={14} c={colors.muted}>{`Connect Bhai is live in Indore today and is coming to ${cityName} next. Leave your number and we'll message you on WhatsApp the day we start here.`}</T>
      </View>
      <Input label="Your name" value={v.name} onChangeText={(x) => set('name', x)} error={e.name} autoComplete="name" />
      <Input label="WhatsApp number" value={v.phone} onChangeText={(x) => set('phone', normPhone(x).slice(0, 12))} error={e.phone} keyboardType="phone-pad" maxLength={16} />
      <Input label="PIN code (optional)" placeholder="Enter your PIN code" hint="Helps us plan which areas to start with." value={v.pin} onChangeText={(x) => set('pin', x)} error={e.pin} keyboardType="number-pad" maxLength={6} />
      <Check label={`Message me on WhatsApp when Connect Bhai launches in ${cityName}.`} checked={v.consent} onChange={(x) => set('consent', x)} error={e.consent} />
      <Button label="Notify me at launch" block busy={busy} onPress={join} />
      <T s={14} c={colors.muted}>
        {'Interested in '}
        <T s={14} w={700} c={colors.muted}>{PRODUCT_NAME[product] || 'Fiber broadband'}</T>
        {'. Change it with the tabs above.'}
      </T>
    </View>
  );
}

export function SearchCard(p: Props) {
  const [error, setError] = useState('');
  const columnY = useRef(0);
  const pinY = useRef(0);
  const [busy, guard] = useGuard();
  const [locating, guardLocate] = useGuard();
  const { toast: overlayToast } = useOverlay();
  const current = p.cities.find((c) => c.id === p.city);
  const live = !current || current.status === 'live';
  const [title, sub] = HEADS[p.product] || HEADS.broadband;

  const search = (value: string) => {
    if (!isPin(value)) return setError('Enter a valid 6-digit PIN code.');
    setError('');
    guard(() => p.onSearch(value));
  };

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 14, gap: 14, boxShadow: '0 30px 60px -30px rgba(0,0,0,0.55)' }}>
      {p.loading ? (
        <View style={{ gap: 14 }}>
          <Skeleton height={42} />
          <Skeleton height={48} />
          <Skeleton height={22} width="70%" />
          <Skeleton height={60} />
        </View>
      ) : p.error ? (
        <LoadError title="Could not load this page." message={p.error} onRetry={p.onRetry} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <T s={13} w={800} c={colors.muted} caps={0.8}>Your city</T>
            <View style={{ flex: 1 }}>
              <Select label="Your city" noLabel compact value={p.city} onChange={p.setCity} options={cityOptions(p.cities)} />
            </View>
          </View>
          <ProductTabs product={p.product} setProduct={(k) => { setError(''); p.setProduct(k); }} />
          {!live ? (
            <WaitingList key={p.city} cityId={p.city} cityName={current!.name} product={p.product} waited={p.waited} setWaited={p.setWaited} />
          ) : p.product === 'sim' ? (
            <View style={{ gap: 12 }}>
              <View style={{ gap: 2 }}>
                <T f="display" s={19} w={700}>Book a SIM online</T>
                <T s={14} c={colors.muted}>Get a new number or keep your number and switch (port). Delivered to your door in Indore with e-KYC.</T>
              </View>
              <Row>
                <Chip label="Prepaid" selected={p.simType === 'prepaid'} onPress={() => p.setSimType('prepaid')} />
                <Chip label="Postpaid" selected={p.simType === 'postpaid'} onPress={() => p.setSimType('postpaid')} />
              </Row>
              <Button label="Show SIM plans" block busy={busy} onPress={() => guard(p.onShowSim)} />
            </View>
          ) : (
            <View style={{ gap: 10 }} onLayout={(e) => (columnY.current = e.nativeEvent.layout.y)}>
              <View style={{ gap: 2 }}>
                <T f="display" s={19} w={700} lh={22}>{title}</T>
                <T s={14} c={colors.muted}>{sub}</T>
              </View>
              <View onLayout={(e) => (pinY.current = e.nativeEvent.layout.y)}>
                <PinInput
                  testID="pin"
                  label="PIN code"
                  noLabel
                  big
                  placeholder="Enter your PIN code"
                  value={p.pin}
                  onChange={(x) => {
                    setError('');
                    p.setPin(x);
                  }}
                  onSubmitEditing={() => search(p.pin)}
                  returnKeyType="search"
                  // brings the field to the top, so the suggestions show above the keyboard
                  onFocus={() => p.onPinFocus(columnY.current + pinY.current)}
                  action={<Button testID="pin-search" label="Search" busy={busy} onPress={() => search(p.pin)} style={{ height: 60 }} />}
                />
              </View>
              <Row style={{ justifyContent: 'space-between' }}>
                <LinkButton
                  label={locating ? 'Please wait…' : 'Use my current location'}
                  onPress={() =>
                    guardLocate(
                      async () => {
                        const c = await currentPosition();
                        const r = await API.geoReverse(c.lat, c.lng);
                        p.setPin(r.pincode);
                        overlayToast(`Location found: ${r.pincode}${r.area ? ' · ' + r.area : ''}`);
                        await p.onSearch(r.pincode);
                      },
                      { onError: setError },
                    )
                  }
                />
                <Pressable accessibilityRole="button" onPress={() => { setError(''); p.onReset(); }} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.blueSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
                  <RotateCcw size={14} color={colors.blue} strokeWidth={2.2} />
                  <T s={13} w={700} c={colors.blue}>Reset</T>
                </Pressable>
              </Row>
              {error ? <T s={13} w={600} c={colors.bad} accessibilityLiveRegion="polite">{error}</T> : null}
              <Row>
                {p.pins.map((x) => (
                  <Chip key={x.pin} label={`${x.pin} · ${x.area}`} selected={p.pin === x.pin} onPress={() => { p.setPin(x.pin); search(x.pin); }} />
                ))}
              </Row>
            </View>
          )}
        </>
      )}
    </View>
  );
}
