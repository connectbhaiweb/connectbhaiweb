import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold } from '@expo-google-fonts/sora';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { LangProvider } from '@/lib/i18n';
import { SessionProvider, useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync();

function Routes() {
  const { ready } = useSession();
  const [fonts, fontError] = useFonts({
    Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold,
    Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold, IBMPlexMono_500Medium,
  });
  const go = ready && (fonts || !!fontError);
  useEffect(() => { if (go) SplashScreen.hideAsync(); }, [go]);
  if (!go) return null;
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ presentation: 'modal' }} />
        <Stack.Screen name="request" options={{ presentation: 'modal' }} />
        <Stack.Screen name="compare" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <LangProvider>
      <SessionProvider>
        <Routes />
      </SessionProvider>
    </LangProvider>
  );
}
