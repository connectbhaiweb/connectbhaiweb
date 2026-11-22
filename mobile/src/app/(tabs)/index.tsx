import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Header } from '@/components/Header';
import { CATEGORIES, lookupPin, searchPlans, type Category, type PinInfo, type Plan } from '@/lib/catalog';
import { colors } from '@/lib/theme';

export default function Plans() {
  const [pin, setPin] = useState('');
  const [type, setType] = useState<Category>('fiber');
  const [info, setInfo] = useState<PinInfo | null>(null);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async (p: string, t: Category) => {
    setBusy(true); setError('');
    try {
      const [i, list] = await Promise.all([lookupPin(p), searchPlans(p, t)]);
      setInfo(i); setPlans(list);
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); setPlans(null); }
    setBusy(false);
  };
  const search = () => load(pin, type);
  const pick = (t: Category) => { setType(t); if (info) load(pin, t); };
  const ask = (plan?: Plan) =>
    router.push({ pathname: '/request', params: { pincode: pin, plan_id: plan ? String(plan.id) : '', plan_name: plan ? `${plan.category.name} ${plan.name}` : '' } });

  return (
    <View style={s.screen}>
      <Header />
      <FlatList
        data={plans ?? []}
        keyExtractor={(p) => String(p.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <View style={s.top}>
            <Text style={s.h1}>Compare. Choose. Connect. Care.</Text>
            <Text style={s.sub}>Enter your 6-digit PIN code to see broadband plans and partners that serve your address in Indore.</Text>
            <View style={s.row}>
              <TextInput style={s.input} placeholder="PIN code, e.g. 452010" keyboardType="number-pad" maxLength={6}
                value={pin} onChangeText={(t) => setPin(t.replace(/\D/g, ''))} onSubmitEditing={(e) => { const p = e.nativeEvent.text; if (p.length === 6) load(p, type); }} returnKeyType="search" />
              <Pressable style={[s.btn, pin.length !== 6 && s.dim]} disabled={pin.length !== 6 || busy} onPress={search}>
                <Text style={s.btnText}>Search</Text>
              </Pressable>
            </View>
            <View style={s.chips}>
              {CATEGORIES.map((c) => (
                <Pressable key={c.key} onPress={() => pick(c.key)} style={[s.chip, type === c.key && s.chipOn]}>
                  <Text style={[s.chipText, type === c.key && s.chipTextOn]}>{c.label}</Text>
                </Pressable>
              ))}
            </View>
            {busy && <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} />}
            {!!error && <Text style={s.error}>{error}</Text>}
            {info && !busy && (
              <Text style={s.found}>
                {info.serviceable ? `${plans?.length ?? 0} plans for ${info.pincode}${info.city ? ', ' + info.city.name : ''}` : `We do not serve ${info.pincode} yet.`}
              </Text>
            )}
            {info && !busy && info.serviceable && (plans?.length ?? 0) === 0 && (
              <Text style={s.sub}>No {CATEGORIES.find((c) => c.key === type)?.label} plans here yet. Try another type, or request a callback.</Text>
            )}
            {info && !busy && (
              <Pressable onPress={() => ask()}><Text style={s.link}>Request a callback instead</Text></Pressable>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardTop}>
              {item.category.logo_url ? <Image source={{ uri: item.category.logo_url }} style={s.logo} resizeMode="contain" /> : null}
              <View style={{ flex: 1 }}>
                <Text style={s.provider}>{item.category.name}</Text>
                <Text style={s.planName}>{item.name}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.price}>₹{item.price}</Text>
                <Text style={s.per}>per month, incl. GST</Text>
              </View>
            </View>
            <Text style={s.meta}>
              {[item.speed_mbps ? `${item.speed_mbps} Mbps` : null, item.data_limit, item.has_tv ? 'TV included' : null,
                item.install_charge ? `Install ₹${item.install_charge}` : 'Free install'].filter(Boolean).join('  ·  ')}
            </Text>
            <Pressable style={s.btn} onPress={() => ask(item)}><Text style={s.btnText}>Request connection</Text></Pressable>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 16, gap: 12 },
  top: { gap: 12 },
  h1: { fontSize: 24, fontWeight: '800', color: colors.navy },
  sub: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  row: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 17, backgroundColor: '#fff' },
  btn: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff' },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { color: colors.text, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  error: { color: colors.danger },
  found: { fontSize: 16, fontWeight: '700', color: colors.text },
  link: { color: colors.primary, fontWeight: '600', paddingVertical: 4 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 44, height: 44 },
  provider: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  planName: { fontSize: 17, fontWeight: '700', color: colors.text },
  price: { fontSize: 22, fontWeight: '800', color: colors.navy },
  per: { fontSize: 11, color: colors.muted },
  meta: { fontSize: 14, color: colors.muted },
});
