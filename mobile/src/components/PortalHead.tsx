import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Field, T } from '@/components/ui';
import { api } from '@/lib/api';
import { PHONE_E164, WA_URL } from '@/lib/site';
import { useSession } from '@/lib/session';
import { colors, font } from '@/lib/theme';

const NAME = { dsa: 'DSA PORTAL', tip: 'TIP PORTAL', admin: 'ADMIN PORTAL' } as const;

/* The head every DSA / TIP / admin page has on the website: portal name, user, "Add lead" (DSA), and the You / Connect Bhai admin contact cards. */
export function PortalHead({ contacts = true }: { contacts?: boolean }) {
  const { user, reload } = useSession();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  if (!user || user.role === 'customer') return null;
  const save = async () => {
    setError('');
    try { await api('PATCH', '/users/me', { name: name.trim(), email: email.trim() || undefined }); await reload(); setEditing(false); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); }
  };
  return (
    <View style={{ gap: 12 }}>
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>{NAME[user.role]} ·</Text>
          <Text style={s.name} numberOfLines={1}>{user.name}</Text>
        </View>
        {user.role === 'dsa' && <Button small label="Add lead" onPress={() => router.push('/lead/new')} />}
      </View>
      {contacts && (
        <>
          <Card style={{ gap: 6 }}>
            <T v="eyebrow">{`You (${user.role.toUpperCase()})`}</T>
            <T v="h3">{user.name}</T>
            <T v="small">{`Mobile +91 ${user.phone}`}</T>
            <T v="small">{`Email ${String(user.email ?? '') || 'not added'}`}</T>
            {!editing ? <Button small kind="outline" label="Edit name / email" onPress={() => { setName(user.name); setEmail(String(user.email ?? '')); setEditing(true); }} style={{ alignSelf: 'flex-start' }} /> : (
              <View style={{ gap: 10 }}>
                <Field label="Full name" value={name} onChangeText={setName} />
                <Field label="Email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
                {!!error && <T v="small" style={{ color: colors.bad }}>{error}</T>}
                <View style={{ flexDirection: 'row', gap: 8 }}><Button small label="Save" disabled={name.trim().length < 2} onPress={save} /><Button small kind="ghost" label="Cancel" onPress={() => setEditing(false)} /></View>
              </View>
            )}
          </Card>
          <Card style={{ gap: 6 }}>
            <T v="eyebrow">Connect Bhai admin</T>
            <T v="h3">Connect Bhai Admin</T>
            <T v="small">Mobile +91 94799 35365</T>
            <T v="small">Email support@connectbhai.in</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button small kind="outline" label="Call" onPress={() => Linking.openURL(`tel:${PHONE_E164}`)} />
              <Button small kind="wa" label="WhatsApp" onPress={() => Linking.openURL(WA_URL)} />
              <Button small kind="outline" label="Email" onPress={() => Linking.openURL('mailto:support@connectbhai.in')} />
              <Button small kind="soft" label="Chat" onPress={() => router.push('/chats')} />
            </View>
          </Card>
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  eyebrow: { fontFamily: font.bodyXBold, fontSize: 12, letterSpacing: 1.4, color: colors.blue },
  name: { fontFamily: font.displayXBold, fontSize: 26, color: colors.ink },
});
