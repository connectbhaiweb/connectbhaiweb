import { router, useFocusEffect } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { Card, T } from '@/components/ui';
import { loadThreads, type Thread } from '@/lib/support';
import { colors, font } from '@/lib/theme';

/* Website /my/chat: one thread per connection request, plus Connect Bhai support. */
export default function ChatList() {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => { try { setThreads(await loadThreads()); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return (
    <View style={s.screen}>
      <AppHeader />
      <ScrollView contentContainerStyle={s.wrap} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
        <Text style={s.h1}>Chat</Text>
        <T v="small" style={{ fontSize: 13.5 }}>Messages here are also sent to WhatsApp.</T>
        {threads === null && !error && <ActivityIndicator size="large" color={colors.blue} style={{ marginTop: 20 }} />}
        {!!error && <Card><T v="small">{error}</T></Card>}
        {threads?.length === 0 && <Card style={{ gap: 6 }}><T v="h3">No chats yet.</T><T v="small">Chats open for every connection request you are part of.</T></Card>}
        {threads?.map((t) => (
          <Pressable key={t.id} onPress={() => router.push({ pathname: '/chat/[thread]', params: { thread: t.id, title: t.title } })}>
            <Card style={s.item}>
              <View style={s.ico}><MessageCircle size={20} color={colors.blue} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.title} numberOfLines={1}>{t.title}</Text>
                <Text style={s.sub} numberOfLines={1}>{t.last ? `${t.last.sender ? t.last.sender + ': ' : ''}${t.last.body}` : t.sub}</Text>
              </View>
              {t.unread > 0 && <View style={s.badge}><Text style={s.badgeText}>{t.unread}</Text></View>}
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, wrap: { padding: 12, gap: 10, paddingBottom: 40 },
  h1: { fontFamily: font.displayXBold, fontSize: 23, color: colors.ink, marginTop: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  ico: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.bodyXBold, fontSize: 16, color: colors.ink }, sub: { fontFamily: font.body, fontSize: 14, color: colors.muted },
  badge: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontFamily: font.bodyBold, fontSize: 12 },
});
