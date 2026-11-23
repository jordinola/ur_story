import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { HeaderLogo } from '../components/HeaderLogo';
import { MiniPlayer } from '../components/MiniPlayer';
import { ProfileMenu } from '../components/ProfileMenu';
import { SplashGate } from '../components/SplashGate';
import { LibraryProvider } from '../lib/LibraryProvider';
import { PlayerProvider } from '../lib/PlayerProvider';
import { ProfilesProvider } from '../lib/ProfilesProvider';
import { colors, fonts } from '../theme';

// Keep the native splash up (called at module scope so it runs before first render) until SplashGate hides it.
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: true, duration: 300 });

// Keeps home under any deep-linked screen (e.g. urstory://profiles) so back and dismiss have somewhere to go.
export const unstable_settings = { anchor: 'index' };

export default function RootLayout() {
  return (
    <ProfilesProvider>
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
                <Stack.Screen name="index" options={{ title: 'UR Story', headerTitle: () => <HeaderLogo />, headerRight: () => <ProfileMenu /> }} />
                <Stack.Screen name="story/[id]" options={{ title: '', headerBackTitle: 'Stories' }} />
                <Stack.Screen name="profiles" options={{ presentation: 'modal', headerShown: false }} />
              </Stack>
            </View>
            <MiniPlayer />
          </View>
        </PlayerProvider>
      </LibraryProvider>
    </ProfilesProvider>
  );
}
