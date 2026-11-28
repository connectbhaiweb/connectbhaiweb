import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LanguageProvider } from '../i18n/LanguageProvider';
import { SessionProvider, useSession } from '../lib/session';
import { OfflineScreen } from '../ui/chrome';
import { OverlayProvider } from '../ui/overlay';
import { colors, fontFiles } from '../ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

/* laid over the screens, so nothing typed is lost while the network is away */
function OfflineCover() {
  const { offline } = useSession();
  return offline ? (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <OfflineScreen />
    </View>
  ) : null;
}

export default function Layout() {
  const [loaded, error] = useFonts(fontFiles);
  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);
  if (!loaded && !error) return null;
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <SessionProvider>
          <OverlayProvider>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
            <OfflineCover />
          </OverlayProvider>
        </SessionProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
