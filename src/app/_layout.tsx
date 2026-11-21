import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { HeaderLogo } from '../components/HeaderLogo';
import { MiniPlayer } from '../components/MiniPlayer';
import { SplashGate } from '../components/SplashGate';
import { LibraryProvider } from '../lib/LibraryProvider';
import { PlayerProvider } from '../lib/PlayerProvider';
import { colors, fonts } from '../theme';

// Keep the native splash up (called at module scope so it runs before first render) until SplashGate hides it.
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: true, duration: 300 });

export default function RootLayout() {
  return (
    <LibraryProvider>
      <PlayerProvider>
        <SplashGate />
        <StatusBar style="dark" />
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flex: 1 }}>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.bg },
                headerTintColor: colors.text,
                headerTitleStyle: { fontFamily: fonts.rounded, fontWeight: '700' },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="index" options={{ title: 'UR Story', headerTitle: () => <HeaderLogo /> }} />
              <Stack.Screen name="story/[id]" options={{ title: '', headerBackTitle: 'Stories' }} />
            </Stack>
          </View>
          <MiniPlayer />
        </View>
      </PlayerProvider>
    </LibraryProvider>
  );
}
