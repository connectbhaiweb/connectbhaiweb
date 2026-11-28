/* One dialog at a time (the website's modal), toast messages, and the 30 s "please wait" guard around actions.
   Android Back closes an open dialog first. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLanguage } from '../i18n/LanguageProvider';
import { AppError } from '../lib/api/base';
import { errMsg } from '../lib/forms';
import { T } from './text';
import { colors, radius } from './theme';

type Toast = { message: string; bad?: boolean; id: number } | null;
type Overlay = {
  open: (content: ReactNode, key?: string) => void;
  close: () => void;
  isOpen: boolean;
  toast: (message: string, bad?: boolean) => void;
};
const Context = createContext<Overlay>({ open: () => {}, close: () => {}, isOpen: false, toast: () => {} });
export const useOverlay = () => useContext(Context);

function ToastView({ toast }: { toast: Toast }) {
  const insets = useSafeAreaInsets();
  if (!toast) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 84 + insets.bottom, alignItems: 'center', zIndex: 80 }}>
      <View style={{ backgroundColor: toast.bad ? colors.bad : colors.ink, borderRadius: radius.input, paddingHorizontal: 16, paddingVertical: 11, boxShadow: '0 8px 24px -12px rgba(10,27,61,0.5)' }}>
        <T s={14.5} w={700} c={colors.bg} center accessibilityLiveRegion="polite">{toast.message}</T>
      </View>
    </View>
  );
}

export function OverlayProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [dialog, setDialog] = useState<{ content: ReactNode; key: string } | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const count = useRef(0);

  const open = useCallback((content: ReactNode, key?: string) => setDialog({ content, key: key || 'd' + ++count.current }), []);
  const close = useCallback(() => setDialog(null), []);
  const say = useCallback((message: string, bad?: boolean) => {
    clearTimeout(timer.current);
    setToast({ message, bad, id: ++count.current });
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const value = useMemo(() => ({ open, close, isOpen: !!dialog, toast: say }), [open, close, dialog, say]);
  return (
    <Context.Provider value={value}>
      {children}
      <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.backdrop }}>
          <ScrollView
            style={{ marginTop: insets.top }} // a scrolled dialog never runs under the status bar
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 10, paddingBottom: insets.bottom + 10 }}>
            <Pressable accessibilityLabel={t('Close')} onPress={close} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} />
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, borderTopWidth: 4, borderTopColor: colors.blue, paddingHorizontal: 16, paddingVertical: 20 }}>
              <View key={dialog?.key}>{dialog?.content}</View>
              <Pressable
                testID="dialog-close"
                accessibilityRole="button"
                accessibilityLabel={t('Close')}
                onPress={close}
                style={{ position: 'absolute', top: 10, right: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
                <T s={20} lh={24} raw>×</T>
              </Pressable>
            </View>
          </ScrollView>
          <ToastView toast={toast} />
        </KeyboardAvoidingView>
      </Modal>
      {dialog ? null : <ToastView toast={toast} />}
    </Context.Provider>
  );
}

const GUARD_TIMEOUT_MS = 30000;
/** Runs one action: busy while it runs, gives up after 30 s, shows the error as a message (or hands it to onError). */
export function useGuard() {
  const { toast } = useOverlay();
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const running = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const run = useCallback(
    async (action: () => Promise<unknown>, options: { timeout?: number; onError?: (message: string) => void } = {}) => {
      if (running.current) return;
      Keyboard.dismiss(); // as on the website, pressing a button puts the keyboard away
      running.current = true;
      setBusy(true);
      let clock: ReturnType<typeof setTimeout> | undefined;
      try {
        const slow = new Promise((_, reject) => {
          clock = setTimeout(() => reject(new AppError('This is taking too long. Check your internet and try again.')), options.timeout ?? GUARD_TIMEOUT_MS);
        });
        await Promise.race([action(), slow]);
      } catch (e) {
        if (options.onError) options.onError(errMsg(e));
        else toast(errMsg(e), true);
      } finally {
        clearTimeout(clock);
        running.current = false;
        if (alive.current) setBusy(false);
      }
    },
    [toast],
  );
  return [busy, run] as const;
}

/** The heading of a dialog. */
export const DialogTitle = ({ title, sub }: { title: string; sub?: string }) => (
  <View style={{ gap: 4, marginBottom: 14 }}>
    <T f="display" s={20} w={700} style={{ paddingRight: 36 }} accessibilityRole="header">{title}</T>
    {sub ? <T s={14} c={colors.muted}>{sub}</T> : null}
  </View>
);
