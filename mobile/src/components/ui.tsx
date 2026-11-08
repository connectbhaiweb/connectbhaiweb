import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Text, fontFor } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SUPPORT } from '@/lib/config';
import { phoneDigits, type Tone } from '@/lib/format';
import { radius, useTheme, type Theme } from '@/lib/theme';

/* ---------- data loading ---------- */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const depKey = JSON.stringify(deps);
  const run = useCallback(async (soft = false) => {
    soft ? setRefreshing(true) : setLoading(true);
    try { const d = await fn(); if (alive.current) { setData(d); setError(''); } } catch (e) { if (alive.current) setError((e as Error).message); }
    if (alive.current) { setLoading(false); setRefreshing(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);
  useEffect(() => { run(); }, [run]);
  return { data, error, loading, refreshing, reload: () => run(true), retry: () => run() };
}

/* ---------- layout ---------- */
export function Screen({ title, subtitle, right, children, load, scroll = true, tabBar = true }: {
  title?: string; subtitle?: string; right?: ReactNode; children?: ReactNode; scroll?: boolean; tabBar?: boolean;
  load?: { loading: boolean; error: string; refreshing: boolean; reload: () => void; retry: () => void; data: unknown };
}) {
  const t = useTheme();
  const body = load && load.loading && !load.data ? <Loading /> : load && load.error && !load.data ? <ErrorBox message={load.error} onRetry={load.retry} /> : children;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={tabBar ? ['top'] : ['top', 'bottom']}>
      {title ? (
        <View style={s.head}>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: t.ink, fontFamily: 'display' }]}>{title}</Text>
            {subtitle ? <Text style={[s.sub, { color: t.muted }]}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      ) : null}
      {scroll ? (
        <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled"
          refreshControl={load ? <RefreshControl refreshing={load.refreshing} onRefresh={load.reload} tintColor={t.blue} /> : undefined}>
          {body}
        </ScrollView>
      ) : <View style={{ flex: 1 }}>{body}</View>}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  const t = useTheme();
  return <View style={[s.card, { backgroundColor: t.surface, borderColor: t.line }, style]}>{children}</View>;
}

export function H2({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[s.h2, { color: t.ink, fontFamily: 'display' }]}>{children}</Text>;
}
export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  const t = useTheme();
  return <Text style={[{ color: t.muted, fontSize: 13, lineHeight: 19 }, style]}>{children}</Text>;
}
export function Strong({ children, style }: { children: ReactNode; style?: object }) {
  const t = useTheme();
  return <Text style={[{ color: t.ink, fontSize: 15, fontWeight: '700' }, style]}>{children}</Text>;
}

/* ---------- controls ---------- */
const toneColors = (t: Theme, tone: Tone) => ({
  blue: [t.blueSoft, t.blue], green: [t.okSoft, t.ok], amber: [t.warnSoft, t.warn], red: [t.badSoft, t.bad], grey: [t.line, t.muted],
}[tone]);
export function Chip({ label, tone = 'blue' }: { label: string; tone?: Tone }) {
  const t = useTheme(); const [bg, fg] = toneColors(t, tone);
  return <View style={[s.chip, { backgroundColor: bg }]}><Text style={[s.chipText, { color: fg }]}>{label}</Text></View>;
}

export function Button({ label, onPress, kind = 'primary', loading, disabled, icon, small }: {
  label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'danger'; loading?: boolean; disabled?: boolean; icon?: keyof typeof Ionicons.glyphMap; small?: boolean;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.blue : kind === 'danger' ? t.badSoft : t.blueSoft;
  const fg = kind === 'primary' ? t.blueInk : kind === 'danger' ? t.bad : t.blue;
  const off = disabled || loading;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={off}
      style={({ pressed }) => [s.btn, small && s.btnSmall, { backgroundColor: bg, opacity: off ? 0.55 : pressed ? 0.85 : 1 }]}>
      {loading ? <ActivityIndicator color={fg} /> : (<>
        {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={fg} /> : null}
        <Text style={[s.btnText, { color: fg }, small && { fontSize: 13 }]}>{label}</Text>
      </>)}
    </Pressable>
  );
}

export function Field({ label, error, ...p }: TextInputProps & { label: string; error?: string }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[s.label, { color: t.muted }]}>{label}</Text>
      <TextInput placeholderTextColor={t.muted} accessibilityLabel={label} {...p}
        style={[s.input, { fontFamily: fontFor(undefined, '600'), color: t.ink, backgroundColor: t.surface, borderColor: error ? t.bad : t.lineStrong }, p.multiline && { minHeight: 90, textAlignVertical: 'top' }]} />
      {error ? <Text style={{ color: t.bad, fontSize: 12, marginTop: 4 }}>{error}</Text> : null}
    </View>
  );
}

export function Loading() {
  const t = useTheme();
  return <View style={s.center}><ActivityIndicator size="large" color={t.blue} /></View>;
}
export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useTheme();
  return (
    <Card style={{ borderColor: t.bad }}>
      <Strong style={{ color: t.bad }}>Something went wrong</Strong>
      <Muted style={{ marginVertical: 8 }}>{message}</Muted>
      {onRetry ? <Button label="Try again" onPress={onRetry} kind="secondary" small /> : null}
    </Card>
  );
}
export function Empty({ icon = 'file-tray-outline', title, hint }: { icon?: keyof typeof Ionicons.glyphMap; title: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={s.center}>
      <Ionicons name={icon} size={40} color={t.sky} />
      <Strong style={{ marginTop: 10 }}>{title}</Strong>
      {hint ? <Muted style={{ textAlign: 'center', marginTop: 4 }}>{hint}</Muted> : null}
    </View>
  );
}

export function Row({ label, value }: { label: string; value?: string | null }) {
  const t = useTheme();
  if (!value) return null;
  return (
    <View style={s.rowKV}>
      <Text style={{ color: t.muted, fontSize: 13, flex: 1 }}>{label}</Text>
      <Text style={{ color: t.ink, fontSize: 14, fontWeight: '600', flex: 2, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

/* call / WhatsApp for a person (opens the phone's own apps) */
export function ContactButtons({ phone, text }: { phone?: string | null; text?: string }) {
  if (!phone) return null;
  const d = phoneDigits(phone);
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Button small kind="secondary" icon="call" label="Call" onPress={() => Linking.openURL('tel:+91' + d)} />
      <Button small kind="secondary" icon="logo-whatsapp" label="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/91${d}${text ? '?text=' + encodeURIComponent(text) : ''}`)} />
    </View>
  );
}
export const callSupport = () => Linking.openURL('tel:+91' + SUPPORT.phone);

/* bottom sheet used for short forms */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const t = useTheme();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <SafeAreaView edges={['bottom']} style={[s.sheet, { backgroundColor: t.surface }]}>
        <View style={s.sheetHead}>
          <Text style={[s.h2, { color: t.ink, flex: 1, marginTop: 0 }]}>{title}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}><Ionicons name="close" size={24} color={t.muted} /></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: 4 }}>{children}</ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export function Segment<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
      {options.map(o => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="button" accessibilityState={{ selected: o.value === value }}
          style={[s.seg, { backgroundColor: o.value === value ? t.blue : t.surface, borderColor: o.value === value ? t.blue : t.lineStrong }]}>
          <Text style={{ color: o.value === value ? t.blueInk : t.ink, fontWeight: '600', fontSize: 13 }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function useBusy() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); setError(''); try { await fn(); return true; } catch (e) { setError((e as Error).message); return false; } finally { setBusy(false); } };
  return { busy, error, setError, run };
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800' },
  sub: { fontSize: 13, marginTop: 2 },
  pad: { padding: 16, paddingBottom: 32, gap: 12, flexGrow: 1 },
  card: { borderWidth: 1, borderRadius: radius, padding: 14 },
  h2: { fontSize: 17, fontWeight: '800', marginTop: 4, marginBottom: 6 },
  chip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: '700' },
  btn: { minHeight: 46, borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { minHeight: 38, paddingHorizontal: 12 },
  btnText: { fontSize: 15, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32, flex: 1 },
  rowKV: { flexDirection: 'row', paddingVertical: 6, gap: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(5,12,30,0.5)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  seg: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
});
