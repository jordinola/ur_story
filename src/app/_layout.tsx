import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { MiniPlayer } from '../components/MiniPlayer';
import { LibraryProvider } from '../lib/LibraryProvider';
import { PlayerProvider } from '../lib/PlayerProvider';
import { colors } from '../theme';

export default function RootLayout() {
  return (
    <LibraryProvider>
      <PlayerProvider>
        <StatusBar style="dark" />
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flex: 1 }}>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.bg },
                headerTintColor: colors.text,
                headerShadowVisible: false,
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="index" options={{ title: 'UR Story' }} />
              <Stack.Screen name="story/[id]" options={{ title: '', headerBackTitle: 'Stories' }} />
            </Stack>
          </View>
          <MiniPlayer />
        </View>
      </PlayerProvider>
    </LibraryProvider>
  );
}
