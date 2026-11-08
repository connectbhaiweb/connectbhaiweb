import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/text';

import { Card, Empty, Muted, Screen, Strong, useLoad } from '@/components/ui';
import { api } from '@/lib/api';
import { fDayTime } from '@/lib/format';
import { useTheme } from '@/lib/theme';

export default function Chat() {
  const t = useTheme();
  const load = useLoad(() => api.threads());
  return (
    <Screen title="Chat" subtitle="Conversations about your requests" load={load}>
      {load.data && load.data.length === 0 ? <Empty icon="chatbubbles-outline" title="No conversations yet" hint="Chats with your agent, installer and Connect Bhai support appear here." /> : null}
      {(load.data || []).map(th => (
        <Pressable key={`${th.type}:${th.id}`} accessibilityRole="button" accessibilityLabel={`Open chat ${th.title}`}
          onPress={() => router.push({ pathname: '/chat/[type]/[id]', params: { type: th.type, id: String(th.id), title: th.title } })}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Strong>{th.title}</Strong>
                {th.sub ? <Muted>{th.sub}</Muted> : null}
                {th.last ? <Text numberOfLines={1} style={{ color: t.ink, marginTop: 4 }}>{th.last.body}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                {th.last ? <Muted>{fDayTime(th.last.created_at)}</Muted> : null}
                {th.unread ? <View style={{ backgroundColor: t.blue, borderRadius: 10, minWidth: 20, paddingHorizontal: 6, alignItems: 'center' }}><Text style={{ color: t.blueInk, fontWeight: '800', fontSize: 12 }}>{th.unread}</Text></View> : null}
              </View>
            </View>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
