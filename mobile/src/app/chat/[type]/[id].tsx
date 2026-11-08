import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Text } from '@/components/text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ErrorBox, Loading, Muted } from '@/components/ui';
import { api, type Message } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fDayTime } from '@/lib/format';
import { useTheme } from '@/lib/theme';

export default function Thread() {
  const t = useTheme();
  const { user } = useAuth();
  const { type, id, title } = useLocalSearchParams<{ type: 'lead' | 'support'; id: string; title?: string }>();
  const [msgs, setMsgs] = useState<Message[] | null>(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scroller = useRef<any>(null);

  const load = useCallback(async () => {
    try { setMsgs(await api.messages(type, Number(id))); setError(''); } catch (e) { setError((e as Error).message); }
  }, [type, id]);
  useEffect(() => { load(); const i = setInterval(load, 8000); return () => clearInterval(i); }, [load]);
  useEffect(() => { scroller.current?.scrollToEnd({ animated: true }); }, [msgs?.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try { const m = await api.sendMessage(type, Number(id), body); setMsgs(x => [...(x || []), m]); setText(''); } catch (e) { setError((e as Error).message); }
    setSending(false);
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ title: title || 'Chat' }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        {msgs === null && !error ? <Loading /> : (
          <ScrollView ref={scroller} contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            {error && !msgs ? <ErrorBox message={error} onRetry={load} /> : null}
            {msgs && msgs.length === 0 ? <Muted style={{ textAlign: 'center', marginTop: 24 }}>No messages yet. Say hello.</Muted> : null}
            {(msgs || []).map(m => {
              const mine = m.sender_user_id === user?.id;
              return (
                <View key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
                  {!mine && m.sender ? <Text style={{ color: t.muted, fontSize: 11, marginBottom: 2 }}>{m.sender.name}</Text> : null}
                  <View style={{ backgroundColor: mine ? t.blue : t.surface, borderColor: t.line, borderWidth: mine ? 0 : 1, borderRadius: 14, padding: 10 }}>
                    <Text style={{ color: mine ? t.blueInk : t.ink, fontSize: 15 }}>{m.body}</Text>
                  </View>
                  <Text style={{ color: t.muted, fontSize: 10, marginTop: 2, alignSelf: mine ? 'flex-end' : 'flex-start' }}>{fDayTime(m.created_at)}</Text>
                </View>
              );
            })}
          </ScrollView>
        )}
        {error && msgs ? <Text style={{ color: t.bad, paddingHorizontal: 16 }} accessibilityRole="alert">{error}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: t.line, backgroundColor: t.surface, alignItems: 'flex-end' }}>
          <TextInput value={text} onChangeText={setText} placeholder="Type a message" placeholderTextColor={t.muted} multiline maxLength={1000} accessibilityLabel="Message"
            style={{ flex: 1, maxHeight: 110, borderWidth: 1, borderColor: t.lineStrong, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: t.ink, fontSize: 16 }} />
          <Pressable onPress={send} disabled={sending || !text.trim()} accessibilityRole="button" accessibilityLabel="Send"
            style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: t.blue, alignItems: 'center', justifyContent: 'center', opacity: sending || !text.trim() ? 0.5 : 1 }}>
            <Ionicons name="send" size={20} color={t.blueInk} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
