/* PIN fields: suggestions from the 3rd digit, chips for a list of PINs, and the India Post check under the field. */
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useLanguage } from '../i18n/LanguageProvider';
import { API } from '../lib/api';
import { pickPin, pinList, pinMatches, pinRows, pinToken, type PinRow } from '../lib/pins';
import { Input, type InputProps } from './forms';
import { T } from './text';
import { colors, fontFamily, radius } from './theme';

let directory: Promise<PinRow[]> | null = null;
const loadDirectory = () =>
  (directory ||= API.pinDirectory()
    .then(pinRows)
    .catch(() => {
      directory = null;
      return [];
    }));

type Check = { text: string; tone: 'ok' | 'bad' | 'plain' };
type Props = Omit<InputProps, 'onChange' | 'value' | 'onChangeText'> & {
  value: string;
  onChange: (v: string) => void;
  many?: boolean;
  /** single field: say whether we serve the PIN, and hand over its area names */
  assist?: boolean;
  onAreas?: (areas: string[]) => void;
  /** list field: told whether any PIN was not found */
  onBad?: (bad: boolean) => void;
  big?: boolean;
  /** a button beside the field; the suggestion list stays as wide as both */
  action?: ReactNode;
};

export function PinInput({ value, onChange, many, assist, onAreas, onBad, big, action, onFocus, ...rest }: Props) {
  const { t } = useLanguage();
  const [focused, setFocused] = useState(false);
  const [picked, setPicked] = useState(false);
  const [found, setFound] = useState<{ value: string; rows: PinRow[] } | null>(null);
  const [check, setCheck] = useState<{ pin: string; lines: Check[] } | null>(null);
  const token = pinToken(value, many);
  const wanted = focused && !picked && /^\d{3,6}$/.test(token);

  useEffect(() => {
    if (!wanted) return;
    let off = false;
    loadDirectory().then((all) => {
      if (!off) setFound({ value, rows: pinMatches(all, value, many) || [] });
    });
    return () => {
      off = true;
    };
  }, [wanted, value, many]);

  /* the hint under a single PIN */
  useEffect(() => {
    if (!assist || !/^\d{6}$/.test(value.trim())) return;
    const pin = value.trim();
    let off = false;
    const timer = setTimeout(() => {
      setCheck({ pin, lines: [{ text: 'Checking PIN code…', tone: 'plain' }] });
      API.pinLookup(pin)
        .then((r) => {
          if (off) return;
          if (!r.valid) return setCheck({ pin, lines: [{ text: 'This PIN code was not found. Please check it.', tone: 'bad' }] });
          const place = `${r.district || r.city || ''}${r.state ? ', ' + r.state : ''}`;
          setCheck({ pin, lines: [{ text: `${place}${r.serviceable ? ' · we serve this area' : ' · we are not live here yet'}`, tone: r.serviceable ? 'ok' : 'plain' }] });
          if (r.areas?.length) onAreas?.(r.areas);
        })
        .catch(() => !off && setCheck(null)); // the lookup is a convenience; the form works without it
    }, 350);
    return () => {
      off = true;
      clearTimeout(timer);
    };
    // onAreas is a fresh function on every render; the lookup depends only on the PIN
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assist, value]);

  /* a list of PINs: every one is checked against India Post; bad ones are flagged and block the form */
  const key = many ? [...new Set(pinList(value))].join(',') : '';
  useEffect(() => {
    if (!many || !onBad) return;
    const pins = key ? key.split(',') : [];
    let off = false;
    const timer = setTimeout(() => {
      if (!pins.length) {
        onBad(false);
        return setCheck(null);
      }
      if (pins.length > 10) {
        onBad(true);
        return setCheck({ pin: key, lines: [{ text: 'Enter at most 10 PIN codes.', tone: 'bad' }] });
      }
      API.pinLookupMany(pins)
        .then((rows: any[]) => {
          if (off) return;
          onBad(rows.some((r) => !r.valid));
          setCheck({
            pin: key,
            lines: rows.map((r) =>
              r.valid
                ? { tone: 'ok' as const, text: `✓ ${r.pincode} · ${r.district || r.city || ''}, ${r.state || ''} · ${r.areas.slice(0, 3).join(', ')}${r.areas.length > 3 ? ' +' + (r.areas.length - 3) : ''}` }
                : { tone: 'bad' as const, text: `✗ ${r.pincode} · ${r.error || 'not found in the India Post directory'}` },
            ),
          });
        })
        .catch(() => !off && setCheck(null));
    }, 450);
    return () => {
      off = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [many, key]);

  const rows = wanted && found?.value === value ? found.rows : null;
  const showCheck = check && (many ? check.pin === key : check.pin === value.trim());
  const chips = many ? pinList(value).filter((p) => /^\d{6}$/.test(p)) : [];

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
      <Input
        {...rest}
        value={value}
        keyboardType={many ? 'numbers-and-punctuation' : 'number-pad'}
        maxLength={many ? undefined : 6}
        autoComplete={many ? 'off' : 'postal-code'}
        style={big ? [{ minHeight: 60, backgroundColor: colors.bg }, value ? { fontFamily: fontFamily('mono', 500), fontSize: 22, letterSpacing: 3.5 } : { fontSize: 15 }] : undefined}
        onChangeText={(v) => {
          setPicked(false);
          onChange(v);
        }}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={() => {
          // a moment later, so a tap on a suggestion lands first
          setTimeout(() => setFocused(false), 200);
          if (many) {
            const clean = value.replace(/[\s,]+$/, '');
            if (clean !== value) onChange(clean);
          }
        }}
      />
        </View>
        {action}
      </View>
      {rows ? (
        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="always" style={{ maxHeight: 240, borderWidth: 1, borderColor: '#CBD6EA', borderRadius: radius.md, backgroundColor: colors.surface }} contentContainerStyle={{ padding: 4 }}>
          {rows.length ? (
            rows.map((r, i) => (
              <Pressable
                key={r.pin + r.label + i}
                accessibilityRole="menuitem"
                onPress={() => {
                  setPicked(!many);
                  onChange(pickPin(value, r.pin, many));
                }}
                style={({ pressed }) => ({ flexDirection: 'row', gap: 10, minHeight: 44, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, backgroundColor: pressed || i === 0 ? '#EAF1FF' : colors.surface })}>
                <T s={15} w={700} raw>{r.pin}</T>
                <T s={13.5} c={colors.muted} style={{ flex: 1 }} raw>{r.label}</T>
              </Pressable>
            ))
          ) : (
            <T s={13.5} c={colors.muted} style={{ padding: 12 }}>{`No served PIN starts with ${token}. You can still type the full PIN.`}</T>
          )}
        </ScrollView>
      ) : null}
      {chips.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {chips.map((p) => (
            <Pressable
              key={p}
              accessibilityRole="button"
              accessibilityLabel={t(`Remove ${p}`)}
              onPress={() => onChange(pinList(value).filter((x) => x !== p).join(', '))}
              hitSlop={6}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EAF1FF', borderRadius: radius.pill, paddingLeft: 10, paddingRight: 10, paddingVertical: 3 }}>
              <T s={13.5} w={600} raw>{p}</T>
              <T s={16} c={colors.blue} raw>×</T>
            </Pressable>
          ))}
        </View>
      ) : null}
      {showCheck
        ? check.lines.map((l) => (
            <T key={l.text} s={12.5} c={l.tone === 'ok' ? colors.ok : l.tone === 'bad' ? colors.bad : colors.muted}>{l.text}</T>
          ))
        : null}
    </View>
  );
}
