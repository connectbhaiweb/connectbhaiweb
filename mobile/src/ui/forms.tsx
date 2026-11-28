/* Form controls styled like the website's .field: label, control, hint and the inline error under it. */
import DateTimePicker from '@react-native-community/datetimepicker';
import { CalendarDays, Check as CheckIcon, ChevronDown } from 'lucide-react-native';
import { useRef, useState, type ReactNode, type Ref } from 'react';
import { Modal, Platform, Pressable, ScrollView, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLanguage } from '../i18n/LanguageProvider';
import { fdate } from '../lib/api/base';
import { T } from './text';
import { colors, fontFamily, radius } from './theme';

export function Field({ label, hint, error, children }: { label?: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <T s={14} w={700}>{label}</T> : null}
      {children}
      {hint ? <T s={12.5} c={colors.muted}>{hint}</T> : null}
      {error ? <T s={13} w={600} c={colors.bad} accessibilityLiveRegion="polite">{error}</T> : null}
    </View>
  );
}

export const inputStyle = (bad?: boolean, focused?: boolean) =>
  ({
    minHeight: 48, borderWidth: 1.5, borderRadius: radius.input, borderColor: bad ? colors.bad : focused ? colors.blue : colors.lineStrong, backgroundColor: colors.surface,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 15.5, color: colors.ink, fontFamily: fontFamily('body', 400),
  }) as const;

export type InputProps = TextInputProps & { label: string; hint?: string; error?: string; noLabel?: boolean; ref?: Ref<TextInputInstance>; below?: ReactNode };

export function Input({ label, hint, error, noLabel, placeholder, style, below, onFocus, onBlur, ...rest }: InputProps) {
  const { t } = useLanguage();
  const [focused, setFocused] = useState(false);
  return (
    <Field label={noLabel ? undefined : label} hint={hint} error={error}>
      <TextInput
        accessibilityLabel={t(label)}
        placeholder={placeholder ? t(placeholder) : undefined}
        placeholderTextColor="#7B87A3"
        style={[inputStyle(!!error, focused), rest.multiline && { minHeight: 90, textAlignVertical: 'top' }, style]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
      {below}
    </Field>
  );
}

export type Option = { value: string; label: string; group?: string };

/** The website's <select>: shows the choice, opens a list. */
export function Select({ label, value, options, onChange, hint, error, noLabel, compact }: { label: string; value: string; options: Option[]; onChange: (v: string) => void; hint?: string; error?: string; noLabel?: boolean; compact?: boolean }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <Field label={noLabel ? undefined : label} hint={hint} error={error}>
      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel={`${t(label)}: ${current ? t(current.label) : ''}`}
        onPress={() => setOpen(true)}
        style={[inputStyle(!!error), { flexDirection: 'row', alignItems: 'center', gap: 8 }, compact && { minHeight: 40, paddingHorizontal: 10 }]}>
        <T s={compact ? 14 : 15.5} w={compact ? 600 : 400} numberOfLines={1} style={{ flex: 1 }}>{current?.label || ''}</T>
        <ChevronDown size={18} color={colors.ink} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent navigationBarTranslucent>
        <Pressable accessibilityLabel={t('Close')} onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: colors.backdrop }} />
        <View style={{ maxHeight: '70%', backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingBottom: insets.bottom + 8 }}>
          <T s={15} w={800} style={{ paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.line }}>{label}</T>
          <ScrollView keyboardShouldPersistTaps="handled">
            {options.map((o, i) => (
              <View key={o.value || 'empty'}>
                {o.group && o.group !== options[i - 1]?.group ? <T s={12} w={800} c={colors.muted} caps={1} style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 }}>{o.group}</T> : null}
                <Pressable
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: o.value === value }}
                  onPress={() => {
                    setOpen(false);
                    onChange(o.value);
                  }}
                  style={{ minHeight: 48, paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: o.value === value ? colors.blueSoft : colors.surface }}>
                  <T s={15.5} w={o.value === value ? 700 : 400} style={{ flex: 1 }}>{o.label}</T>
                  {o.value === value ? <CheckIcon size={18} color={colors.blue} /> : null}
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </Field>
  );
}

export function Check({ label, checked, onChange, error, radio, small }: { label: string; checked: boolean; onChange: (v: boolean) => void; error?: string; radio?: boolean; small?: boolean }) {
  const { t } = useLanguage();
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        accessibilityRole={radio ? 'radio' : 'checkbox'}
        accessibilityState={{ checked }}
        accessibilityLabel={t(label)}
        onPress={() => onChange(radio ? true : !checked)}
        hitSlop={8}
        style={{ flexDirection: 'row', gap: 9, alignItems: 'center' }}>
        <View style={{ width: 18, height: 18, borderRadius: radio ? 9 : 4, borderWidth: 1.5, borderColor: error ? colors.bad : checked ? colors.blue : '#7B87A3', backgroundColor: checked && !radio ? colors.blue : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          {checked ? radio ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.blue }} /> : <CheckIcon size={13} color={colors.white} strokeWidth={3.5} /> : null}
        </View>
        <T s={small ? 13.5 : 14} w={700} style={{ flexShrink: 1 }}>{label}</T>
      </Pressable>
      {error ? <T s={13} w={600} c={colors.bad}>{error}</T> : null}
    </View>
  );
}

/** A date as "YYYY-MM-DD", picked in the phone's own calendar. */
export function DateInput({ label, value, onChange, min, error }: { label: string; value: string; onChange: (v: string) => void; min?: string; error?: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const toDate = (s: string) => new Date(s + 'T12:00:00');
  return (
    <Field label={label} error={error}>
      <Pressable accessibilityRole="button" accessibilityLabel={t(label)} onPress={() => setOpen(true)} style={[inputStyle(!!error), { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
        <T s={15.5} c={value ? colors.ink : '#7B87A3'} style={{ flex: 1 }} raw>{value ? fdate(value + 'T12:00:00') : 'dd/mm/yyyy'}</T>
        <CalendarDays size={18} color={colors.ink} />
      </Pressable>
      {open ? (
        <DateTimePicker
          mode="date"
          value={toDate(value || min || toISO(new Date()))}
          minimumDate={min ? toDate(min) : undefined}
          onValueChange={(_e: unknown, d?: Date) => {
            if (Platform.OS === 'android') setOpen(false);
            if (d) onChange(toISO(d));
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </Field>
  );
}

/** Six OTP boxes over one real input, so typing, Backspace, paste and autofill all just work. */
export function OtpBoxes({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const { t } = useLanguage();
  const input = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  return (
    <Field label="6-digit OTP" error={error}>
      <Pressable onPress={() => input.current?.focus()} accessible={false}>
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const here = focused && i === Math.min(value.length, 5);
            return (
              <View key={i} style={{ flex: 1, maxWidth: 44, height: 52, borderRadius: radius.input, borderWidth: here ? 2 : 1, borderColor: error ? colors.bad : here ? colors.blue : colors.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
                <T f="mono" s={22} w={600} raw>{value[i] || ''}</T>
              </View>
            );
          })}
        </View>
        <TextInput
          ref={input}
          testID="otp-input"
          accessibilityLabel={t('6-digit OTP')}
          value={value}
          onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 6))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus
          keyboardType="number-pad"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          caretHidden
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.01, color: 'transparent' }}
        />
      </Pressable>
    </Field>
  );
}
