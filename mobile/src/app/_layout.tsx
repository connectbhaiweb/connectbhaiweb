import { Stack, router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold, IBMPlexMono_700Bold } from '@expo-google-fonts/ibm-plex-mono';
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { Sora_400Regular, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold } from '@expo-google-fonts/sora';
import { useFonts } from 'expo-font';

import { Loading } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

function Root() {
  const { user, ready } = useAuth();
  const [fonts] = useFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold, Sora_400Regular, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold, IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold, IBMPlexMono_700Bold });
  const t = useTheme();
  const prevUser = useRef<boolean | null>(null);
  useEffect(() => {   // right after a login, open the dashboard
    if (!ready) return;
    const has = !!user;
    if (prevUser.current === false && has) router.replace('/dashboard');
    prevUser.current = has;
  }, [user, ready]);
  if (!ready || !fonts) return <Loading />;
  const header = { headerShown: true, headerStyle: { backgroundColor: t.surface }, headerTintColor: t.ink, headerShadowVisible: false };
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
      <Stack.Screen name="(app)" />
      <Stack.Screen name="speed" options={{ ...header, title: 'Wi-Fi speed test', headerStyle: { backgroundColor: '#0A2A78' }, headerTintColor: '#fff' }} />
      <Stack.Screen name="partner" options={{ ...header, title: 'DSA / TIP application' }} />
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="lead/[id]" options={{ ...header, title: 'Request' }} />
        <Stack.Screen name="add-lead" options={{ ...header, title: 'Add a lead', presentation: 'modal' }} />
        <Stack.Screen name="chat/[type]/[id]" options={{ ...header, title: 'Chat' }} />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style={useColorScheme() === 'dark' ? 'light' : 'dark'} />
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
