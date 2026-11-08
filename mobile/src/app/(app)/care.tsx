import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Text } from '@/components/text';

import { Button, Card, Chip, Empty, Field, Muted, Row, Screen, Sheet, Strong, useBusy, useLoad } from '@/components/ui';
import { api, type Device } from '@/lib/api';
import { fDayTime } from '@/lib/format';
import { useTheme } from '@/lib/theme';

/* Customer: Care plan = view and control the home modem (GenieACS through the same API as the website) */
export default function Care() {
  const t = useTheme();
  const load = useLoad(() => api.devices());
  const [wifi, setWifi] = useState<Device | null>(null);
  const [ssid, setSsid] = useState('');
  const [pass, setPass] = useState('');
  const { busy, error, setError, run } = useBusy();
  const [note, setNote] = useState('');

  const reboot = (d: Device) => Alert.alert('Restart modem?', 'Your internet will drop for about 2 minutes.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Restart', style: 'destructive', onPress: async () => { if (await run(() => api.deviceAction(d.id, 'reboot'))) { setNote('Restart sent to your modem.'); load.reload(); } } },
  ]);
  const refresh = async (d: Device) => { if (await run(() => api.refreshDevice(d.id))) load.reload(); };
  const saveWifi = async () => {
    if (!ssid.trim() && !pass) { setError('Enter a new Wi-Fi name, a new password, or both.'); return; }
    if (pass && pass.length < 8) { setError('The Wi-Fi password needs at least 8 characters.'); return; }
    if (await run(() => api.deviceAction(wifi!.id, 'change_wifi', { ssid: ssid.trim() || undefined, password: pass || undefined }))) {
      setWifi(null); setSsid(''); setPass(''); setNote('Wi-Fi settings sent to your modem.'); load.reload();
    }
  };

  return (
    <Screen title="Care plan" subtitle="Your modem" load={load}>
      {note ? <Card style={{ borderColor: t.ok }}><Text style={{ color: t.ok, fontWeight: '700' }}>{note}</Text></Card> : null}
      {load.data && load.data.length === 0 ? (
        <Empty icon="shield-checkmark-outline" title="No modem on the Care plan yet" hint="Ask your installer to enable Care Plan for your connection." />
      ) : null}
      {(load.data || []).map(d => (
        <Card key={d.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Strong style={{ fontSize: 17 }}>{d.model || 'Home modem'}</Strong>
            <Chip label={d.online == null ? 'Unknown' : d.online ? 'Online' : 'Offline'} tone={d.online == null ? 'grey' : d.online ? 'green' : 'red'} />
          </View>
          <View style={{ marginVertical: 8 }}>
            <Row label="Wi-Fi name" value={d.wifi_ssid || undefined} />
            <Row label="Signal (Rx)" value={d.rx_power_dbm != null ? `${d.rx_power_dbm} dBm` : undefined} />
            <Row label="Devices connected" value={d.connected_clients != null ? String(d.connected_clients) : undefined} />
            <Row label="Last seen" value={d.last_seen_at ? fDayTime(d.last_seen_at) : undefined} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button small kind="secondary" icon="refresh" label="Refresh" onPress={() => refresh(d)} disabled={busy} />
            <Button small kind="secondary" icon="wifi" label="Change Wi-Fi" onPress={() => { setError(''); setWifi(d); }} />
            <Button small kind="danger" icon="power" label="Restart" onPress={() => reboot(d)} disabled={busy} />
          </View>
        </Card>
      ))}
      {error && !wifi ? <Text style={{ color: t.bad }} accessibilityRole="alert">{error}</Text> : null}
      <Muted>Changes can take a minute to reach your modem.</Muted>

      <Sheet visible={!!wifi} title="Change Wi-Fi" onClose={() => setWifi(null)}>
        <Field label="New Wi-Fi name (optional)" value={ssid} onChangeText={setSsid} autoCapitalize="none" />
        <Field label="New password (optional, 8+ characters)" value={pass} onChangeText={setPass} secureTextEntry autoCapitalize="none" />
        {error ? <Text style={{ color: t.bad, marginBottom: 10 }}>{error}</Text> : null}
        <Button label="Save to modem" onPress={saveWifi} loading={busy} />
      </Sheet>
    </Screen>
  );
}
