/* The website's building blocks: buttons, chips, cards, notices, pills, headings, empty states and skeletons. */
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useLanguage } from '../i18n/LanguageProvider';
import { T } from './text';
import { colors, radius, shadow, space } from './theme';

export type Variant = 'primary' | 'ghost' | 'soft' | 'danger' | 'hero' | 'gold' | 'plainDark';
const look: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.blue, fg: colors.white, border: colors.blue },
  ghost: { bg: colors.surface, fg: colors.ink, border: colors.lineStrong },
  soft: { bg: colors.blueSoft, fg: colors.blue, border: colors.blueSoft },
  danger: { bg: colors.badSoft, fg: colors.bad, border: colors.badSoft },
  hero: { bg: 'transparent', fg: colors.white, border: 'rgba(141,180,255,0.6)' },
  gold: { bg: '#F7AE18', fg: '#3B2300', border: '#F7AE18' },
  plainDark: { bg: colors.surface, fg: colors.ink, border: colors.surface },
};

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: Variant;
  small?: boolean;
  block?: boolean;
  busy?: boolean;
  icon?: ReactNode;
  after?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, variant = 'primary', small, block, busy, icon, after, style, disabled, ...rest }: ButtonProps) {
  const v = look[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      hitSlop={small ? 8 : 4}
      style={({ pressed }) => [
        {
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: v.border, backgroundColor: v.bg,
          borderRadius: small ? radius.sm : radius.input, paddingHorizontal: small ? 12 : 18, paddingVertical: small ? 6 : 10, minHeight: small ? 32 : 42,
          opacity: disabled || busy ? 0.55 : pressed ? 0.85 : 1, alignSelf: block ? 'stretch' : 'flex-start', maxWidth: '100%',
        },
        style,
      ]}
      {...rest}>
      {busy ? <ActivityIndicator size="small" color={v.fg} /> : icon}
      <T s={small ? 13.5 : 15} w={700} c={v.fg} lh={small ? 18 : 20} center style={{ flexShrink: 1 }}>
        {busy ? 'Please wait…' : label}
      </T>
      {after}
    </Pressable>
  );
}

export function LinkButton({ label, onPress, s = 14, c = colors.blue, style }: { label: string; onPress: () => void; s?: number; c?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8} style={[{ alignSelf: 'flex-start' }, style]}>
      <T s={s} w={700} c={c} style={{ textDecorationLine: 'underline' }}>{label}</T>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, tab }: { label: string; selected?: boolean; onPress?: () => void; tab?: boolean }) {
  return (
    <Pressable
      accessibilityRole={tab ? 'tab' : 'button'}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      hitSlop={4}
      style={{ borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5, borderColor: selected ? colors.blue : colors.lineStrong, backgroundColor: selected ? colors.blue : colors.surface, maxWidth: '100%' }}>
      <T s={13.5} w={700} c={selected ? colors.white : colors.ink}>{label}</T>
    </Pressable>
  );
}

export const Row = ({ children, gap = 8, style, wrap = true }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', flexWrap: wrap ? 'wrap' : 'nowrap', gap }, style]}>{children}</View>
);

export const Card = ({ children, style, pad = 20, gap = 10 }: { children: ReactNode; style?: StyleProp<ViewStyle>; pad?: number; gap?: number }) => (
  <View style={[{ backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radius.card, padding: pad, gap }, style]}>{children}</View>
);

/** A page section: 16 px gutter and the website's 56 px of air above and below. */
export const Section = ({ children, top = space.section, bottom = space.section, style }: { children: ReactNode; top?: number; bottom?: number; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ paddingHorizontal: space.gutter, paddingTop: top, paddingBottom: bottom }, style]}>{children}</View>
);

export const Eyebrow = ({ text, c = colors.blue, center }: { text: string; c?: string; center?: boolean }) => (
  <T s={12} w={800} c={c} caps={1.7} center={center}>{text}</T>
);

export function SecHead({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <View style={{ gap: 8, marginBottom: 24 }}>
      {eyebrow ? <Eyebrow text={eyebrow} /> : null}
      <T f="display" s={26} w={700} lh={30} accessibilityRole="header">{title}</T>
      {sub ? <T c={colors.muted}>{sub}</T> : null}
    </View>
  );
}

export function Notice({ text, info, children }: { text?: string; info?: boolean; children?: ReactNode }) {
  return (
    <View style={{ backgroundColor: info ? colors.blueSoft : colors.warnSoft, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12 }}>
      {text ? <T s={14} w={600} c={info ? colors.blue : colors.warn}>{text}</T> : children}
    </View>
  );
}

export type Tone = 'blue' | 'ok' | 'warn' | 'bad' | 'grey';
const tones: Record<Tone, [string, string]> = { blue: [colors.blueSoft, colors.blue], ok: [colors.okSoft, colors.ok], warn: [colors.warnSoft, colors.warn], bad: [colors.badSoft, colors.bad], grey: [colors.grey, colors.muted] };
export function Pill({ label, tone = 'blue' }: { label: string; tone?: Tone }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: tones[tone][0], borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 2, alignSelf: 'flex-start', maxWidth: '100%' }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tones[tone][1] }} />
      <T s={12} w={800} c={tones[tone][1]}>{label}</T>
    </View>
  );
}

export const Empty = ({ children }: { children: ReactNode }) => (
  <View style={{ backgroundColor: colors.surface, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.lineStrong, borderRadius: radius.card, padding: 24, gap: 10, alignItems: 'center' }}>{children}</View>
);

/** "Label ........ value" rows with a dashed rule, used on plan cards and receipts. */
export function Facts({ rows }: { rows: [string, string, boolean?][] }) {
  return (
    <View style={{ gap: 6 }}>
      {rows.map(([label, value, raw]) => (
        <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.line, paddingTop: 6 }}>
          <T s={14} c={colors.muted}>{label}</T>
          <T s={14} w={700} raw={raw} style={{ flexShrink: 1, textAlign: 'right' }}>{value}</T>
        </View>
      ))}
    </View>
  );
}

export function Skeleton({ height = 16, width = '100%', round = 8 }: { height?: number; width?: number | `${number}%`; round?: number }) {
  const calm = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (!calm) o.value = withRepeat(withTiming(0.45, { duration: 750 }), -1, true);
  }, [calm, o]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ height, width, borderRadius: round, backgroundColor: '#E1E9F8' }, anim]} />;
}

/** "Could not load… Try again", as on the website. */
export function LoadError({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <Empty>
      <T w={800} center>{title}</T>
      <T c={colors.muted} center>{message}</T>
      <Button label="Try again" onPress={onRetry} style={{ alignSelf: 'center' }} />
    </Empty>
  );
}

/** The green tick on the "done" screens. */
export function BigTick({ size = 56 }: { size?: number }) {
  const { t } = useLanguage();
  return (
    <View accessibilityLabel={t('Done')} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.ok, alignItems: 'center', justifyContent: 'center', boxShadow: shadow.card }}>
      <T s={size * 0.43} w={800} c={colors.white} raw>✓</T>
    </View>
  );
}
