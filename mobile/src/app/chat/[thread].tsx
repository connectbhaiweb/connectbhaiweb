import { useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { BackBar } from '@/components/BackBar';
import { T } from '@/components/ui';
import { loadMessages, sendMessage, type Msg } from '@/lib/support';
import { useSession } from '@/lib/session';
import { colors, font } from '@/lib/theme';

/* One conversation. New messages are fetched every 10 seconds, like the website. */
export default function Conversation() {
  const { thread, title } = useLocalSearchParams<{ thread: string; title?: string }>();
  const { user } = useSession();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const box = useRef<ComponentRef<typeof ScrollView>>(null);
  const load = useCallback(async () => { try { setMsgs(await loadMessages(String(thread))); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); } }, [thread]);
  useEffect(() => {
    let live = true;
    const pull = () => loadMessages(String(thread)).then((m) => { if (live) setMsgs(m); }).catch(() => {});
    pull(); const t = setInterval(pull, 10000);
    return () => { live = false; clearInterval(t); };
  }, [thread]);
  const send = async () => {
    if (!text.trim()) return;
    setSending(true); setError('');
    try { await sendMessage(String(thread), text); setText(''); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
    setSending(false);
  };
  return (
    <View style={s.screen}>
      <AppHeader />
      <BackBar />
      <T v="h2" style={{ paddingHorizontal: 14, paddingTop: 6 }}>{title || 'Chat'}</T>
      <ScrollView ref={box} contentContainerStyle={s.msgs} onContentSizeChange={() => box.current?.scrollToEnd({ animated: false })}>
        {msgs.length === 0 && <T v="small">No messages yet. Say hello.</T>}
        {msgs.map((m) => {
          const mine = m.senderId === user?.id;
          return (
            <View key={m.id} style={[s.bubble, mine ? s.mine : s.theirs]}>
              {!mine && <Text style={s.who}>{m.senderName}</Text>}
              <Text style={[s.body, mine && { color: '#fff' }]}>{m.body}</Text>
              <Text style={[s.time, mine && { color: '#D6E2FF' }]}>{new Date(m.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</Text>
            </View>
          );
        })}
      </ScrollView>
      {!!error && <T v="small" style={{ color: colors.bad, paddingHorizontal: 14 }}>{error}</T>}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.bar}>
          <TextInput style={s.input} placeholder="Type a message" placeholderTextColor="#8C99B5" value={text} onChangeText={setText} maxLength={1000} multiline />
          <Pressable accessibilityLabel="Send" onPress={send} disabled={sending || !text.trim()} style={[s.send, (sending || !text.trim()) && { opacity: 0.5 }]}><Send size={20} color="#fff" /></Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  msgs: { padding: 14, gap: 8 },
  bubble: { maxWidth: '82%', borderRadius: 16, padding: 10, gap: 2 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.blue, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 4 },
  who: { fontFamily: font.bodyXBold, fontSize: 12, color: colors.blue },
  body: { fontFamily: font.body, fontSize: 15.5, lineHeight: 21, color: colors.ink },
  time: { fontFamily: font.body, fontSize: 11, color: colors.muted, alignSelf: 'flex-end' },
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, paddingBottom: 28, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.line },
  input: { flex: 1, maxHeight: 110, minHeight: 44, borderWidth: 1.5, borderColor: colors.lineStrong, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, fontFamily: font.body, fontSize: 16, color: colors.ink },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
});
