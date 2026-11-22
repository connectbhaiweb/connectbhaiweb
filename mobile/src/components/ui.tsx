import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { tr, useLang } from '@/lib/i18n';
import { colors, font, shadow } from '@/lib/theme';

/* ---------- Text ---------- */
type Variant = 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'label' | 'eyebrow';
const TEXT: Record<Variant, TextStyle> = {
  h1: { fontFamily: font.displayXBold, fontSize: 28, lineHeight: 32, color: colors.ink, letterSpacing: -0.4 },
  h2: { fontFamily: font.display, fontSize: 20, lineHeight: 26, color: colors.ink, letterSpacing: -0.2 },
  h3: { fontFamily: font.display, fontSize: 16, lineHeight: 21, color: colors.ink },
  body: { fontFamily: font.body, fontSize: 15, lineHeight: 22, color: colors.text },
  small: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: colors.muted },
  label: { fontFamily: font.bodyBold, fontSize: 12, lineHeight: 16, color: colors.muted, letterSpacing: 1, textTransform: 'uppercase' },
  eyebrow: { fontFamily: font.bodyXBold, fontSize: 12, lineHeight: 18, color: colors.blue, letterSpacing: 1.4, textTransform: 'uppercase' },
};
export function T({ v = 'body', style, children, ...rest }: { v?: Variant; style?: StyleProp<TextStyle>; children: ReactNode } & Omit<React.ComponentProps<typeof Text>, 'style'>) {
  const { lang } = useLang();
  return <Text {...rest} style={[TEXT[v], style]}>{typeof children === 'string' ? tr(children, lang) : children}</Text>;
}

/* ---------- Button ---------- */
type BtnKind = 'primary' | 'soft' | 'outline' | 'call' | 'wa' | 'danger' | 'ghost';
const BTN: Record<BtnKind, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.action, fg: '#fff', border: 'transparent' },
  soft: { bg: '#EEF4FF', fg: colors.actionInk, border: '#B5CCF7' },
  outline: { bg: '#fff', fg: colors.ink, border: colors.lineStrong },
  call: { bg: '#fff', fg: colors.actionInk, border: '#2F6EF2' },
  wa: { bg: '#fff', fg: colors.greenInk, border: colors.whatsapp },
  danger: { bg: colors.bad, fg: '#fff', border: 'transparent' },
  ghost: { bg: 'transparent', fg: colors.actionInk, border: 'transparent' },
};
export function Button({ label, onPress, kind = 'primary', icon: Icon, iconRight: IconR, loading, disabled, block, small, style }: {
  label: string; onPress?: () => void; kind?: BtnKind; icon?: LucideIcon; iconRight?: LucideIcon; loading?: boolean; disabled?: boolean; block?: boolean; small?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const c = BTN[kind];
  const { lang } = useLang(); label = tr(label, lang);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled || loading}
      style={({ pressed }) => [s.btn, small && s.btnSmall, { backgroundColor: c.bg, borderColor: c.border }, kind === 'primary' && !disabled && shadow.primary,
        block && { alignSelf: 'stretch' }, (disabled || loading) && { opacity: 0.5 }, pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] }, style]}>
      {loading ? <ActivityIndicator color={c.fg} /> : (
        <>
          {Icon && <Icon size={small ? 16 : 19} color={c.fg} strokeWidth={2.2} />}
          <Text style={[s.btnText, small && { fontSize: 14 }, { color: c.fg }]} numberOfLines={1}>{label}</Text>
          {IconR && <IconR size={small ? 16 : 19} color={c.fg} strokeWidth={2.4} />}
        </>
      )}
    </Pressable>
  );
}

/* ---------- Chip (status) ---------- */
type Tone = 'blue' | 'green' | 'red' | 'amber' | 'grey';
const TONE: Record<Tone, { bg: string; fg: string }> = {
  blue: { bg: colors.chipBlue, fg: colors.chipBlueInk }, green: { bg: colors.greenSoft, fg: colors.greenInk },
  red: { bg: colors.redSoft, fg: colors.red }, amber: { bg: colors.warnSoft, fg: colors.warn }, grey: { bg: '#EDF1F7', fg: colors.muted },
};
export function Chip({ label, tone = 'blue', icon: Icon, dot }: { label: string; tone?: Tone; icon?: LucideIcon; dot?: boolean }) {
  const { lang } = useLang(); label = tr(label, lang);
  const c = TONE[tone];
  return (
    <View style={[s.chip, { backgroundColor: c.bg }]}>
      {dot && <View style={[s.dot, { backgroundColor: c.fg }]} />}
      {Icon && <Icon size={15} color={c.fg} strokeWidth={2.4} />}
      <Text style={[s.chipText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

/* ---------- Card ---------- */
export const Card = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => <View style={[s.card, style]}>{children}</View>;

/* ---------- Segmented control (the website's .ptabs) ---------- */
export function Segmented<K extends string>({ items, value, onChange }: { items: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  const { lang } = useLang();
  return (
    <View style={s.seg}>
      {items.map((i) => {
        const on = i.key === value;
        return (
          <Pressable key={i.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(i.key)} style={[s.segItem, on && s.segOn]}>
            <Text style={[s.segText, on && { color: colors.blue }]} numberOfLines={1}>{tr(i.label, lang)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- Pill (filter / PIN suggestion) ---------- */
export function Pill({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) {
  const { lang } = useLang();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[s.pill, on && { backgroundColor: colors.blue, borderColor: colors.blue }]}>
      <Text style={[s.pillText, on && { color: '#fff' }]}>{tr(label, lang)}</Text>
    </Pressable>
  );
}

/* ---------- Text field ---------- */
export function Field({ label, mono, style, containerStyle, ...rest }: { label?: string; mono?: boolean; containerStyle?: StyleProp<ViewStyle> } & TextInputProps) {
  const { lang } = useLang();
  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label ? <T v="label">{label}</T> : null}
      <TextInput placeholderTextColor="#8C99B5" {...rest} placeholder={rest.placeholder ? tr(rest.placeholder, lang) : undefined} style={[s.input, mono && s.inputMono, mono && !rest.value && { letterSpacing: 0, fontSize: 17 }, rest.multiline && { height: 92, textAlignVertical: 'top' }, style]} />
    </View>
  );
}

const s = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, paddingHorizontal: 18, borderRadius: 11, borderWidth: 1.5 },
  btnSmall: { height: 38, paddingHorizontal: 12, borderRadius: 9 },
  btnText: { fontFamily: font.bodyBold, fontSize: 15 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 11, height: 30 },
  chipText: { fontFamily: font.bodyBold, fontSize: 12.5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.cardLine, padding: 14, ...shadow.card },
  seg: { flexDirection: 'row', backgroundColor: colors.blueSoft, borderRadius: 14, padding: 4 },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10 },
  segOn: { backgroundColor: '#fff', ...shadow.soft },
  segText: { fontFamily: font.bodyBold, fontSize: 13, color: colors.muted },
  pill: { borderWidth: 1.5, borderColor: colors.lineStrong, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: '#fff' },
  pillText: { fontFamily: font.bodyBold, fontSize: 13.5, color: colors.ink },
  input: { borderWidth: 1.5, borderColor: colors.lineStrong, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontFamily: font.bodyMd, fontSize: 16, color: colors.ink, backgroundColor: colors.bg },
  inputMono: { fontFamily: font.mono, fontSize: 22, letterSpacing: 4 },
});
