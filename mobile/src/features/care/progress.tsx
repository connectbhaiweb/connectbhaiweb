/* Live step-by-step progress of a restart or Wi-Fi change: follows the saved command until it is done or failed. */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { API } from '../../lib/api';
import { useOverlay } from '../../ui/overlay';
import { T } from '../../ui/text';
import { colors, radius } from '../../ui/theme';

export type ActionKind = 'reboot' | 'wifi';
const STEPS: Record<ActionKind, string[]> = {
  reboot: ['Command sent', 'Waiting for your modem to pick it up (about a minute)', 'Modem is restarting (about 2 minutes)', 'Modem is back online'],
  wifi: ['Command sent', 'Waiting for your modem to pick it up (about a minute)', 'Applying the new Wi-Fi settings', 'Wi-Fi is updated'],
};
type State = 'queued' | 'sent' | 'done' | 'failed' | 'timeout';

export function Progress({ bookingId, kind, ssid, onFinished }: { bookingId: string; kind: ActionKind; ssid?: string; onFinished: () => void }) {
  const { toast } = useOverlay();
  const [state, setState] = useState<State>('queued');
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(0);
  const finished = useRef(onFinished);
  useEffect(() => {
    finished.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    let off = false;
    let ticks = 0;
    const started = Date.now();
    const timer = setInterval(async () => {
      ticks++;
      setSeconds(Math.round((Date.now() - started) / 1000));
      if (Date.now() - started > 25 * 60 * 1000) {
        clearInterval(timer);
        return setState('timeout');
      }
      if (ticks % 4) return;
      try {
        const a = (await API.deviceLog(bookingId)).find((x) => x.action === kind);
        if (off || !a) return;
        const next: State = a.status === 'done' ? 'done' : a.status === 'failed' ? 'failed' : a.status === 'sent' ? 'sent' : 'queued';
        setState(next);
        setError(a.error || '');
        if (next === 'done' || next === 'failed') {
          clearInterval(timer);
          finished.current();
          if (next === 'done') toast(kind === 'reboot' ? 'Restart finished. Your router is back.' : 'Wi-Fi changed.');
        }
      } catch {
        /* keep waiting; the next poll tries again */
      }
    }, 1000);
    return () => {
      off = true;
      clearInterval(timer);
    };
  }, [bookingId, kind, toast]);

  const step = state === 'done' ? 4 : state === 'sent' ? 2 : 1;
  const bad = state === 'failed' || state === 'timeout';
  const clock = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  const head = state === 'done' ? (kind === 'reboot' ? 'Restart finished' : 'Wi-Fi changed') : state === 'failed' ? 'Could not finish' : state === 'timeout' ? 'Still waiting for the modem' : kind === 'reboot' ? 'Restarting your router' : 'Changing your Wi-Fi';
  const note =
    state === 'done'
      ? kind === 'wifi' ? ['Join ', ssid || 'your Wi-Fi', ' ', `on your phone or laptop${ssid ? ' with the new password' : ''}.`] : 'Your internet is back.'
      : state === 'failed' ? error || 'The modem did not accept it. Please try again.'
      : state === 'timeout' ? 'The modem has not checked in. It will apply this when it is back online. Check that it is powered on.'
      : kind === 'wifi' ? 'Phones and laptops on this Wi-Fi will disconnect. Reconnect after about a minute.' : 'Internet and Wi-Fi are off for about 2 minutes. You do not need to do anything.';

  return (
    <View accessibilityLiveRegion="polite" style={{ borderWidth: 1, borderRadius: radius.card, paddingHorizontal: 16, paddingVertical: 14, gap: 8, borderColor: state === 'done' ? '#BFE6CC' : bad ? '#F3C6BE' : '#D6E0F5', backgroundColor: state === 'done' ? '#F0FBF4' : bad ? '#FFF4F2' : '#F4F7FF' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
        <T s={15} w={800} style={{ flex: 1 }}>{head}</T>
        {state === 'done' || bad ? null : <T s={13} c={colors.muted} raw>{clock}</T>}
      </View>
      {STEPS[kind].map((text, i) => {
        const ok = i < step;
        const current = !bad && state !== 'done' && i === step;
        const failed = bad && i === step;
        const tone = ok ? '#15803D' : failed ? '#B91C1C' : current ? colors.ink : colors.muted;
        return (
          <View key={text} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: current ? colors.blue : tone, backgroundColor: ok ? '#16A34A' : failed ? '#DC2626' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {current ? <ActivityIndicator size={12} color={colors.blue} /> : <T s={12} w={700} lh={16} c={ok || failed ? colors.white : tone} raw>{ok ? '✓' : failed ? '✕' : i + 1}</T>}
            </View>
            <T s={14} w={current || failed ? 700 : 400} c={tone} style={{ flex: 1 }}>{text}</T>
          </View>
        );
      })}
      <T s={13} c="#4A5876">{note}</T>
    </View>
  );
}
