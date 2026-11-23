import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ParentalGate } from '../../components/ParentalGate';
import { leave } from '../../lib/navigation';
import { useProfiles } from '../../lib/ProfilesProvider';
import { colors, fonts } from '../../theme';

const DoneButton = () => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel="Done"
    onPress={leave}
    style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
  >
    <Text style={{ color: colors.primary, fontFamily: fonts.rounded, fontSize: 17, fontWeight: '700' }}>Done</Text>
  </Pressable>
);

// Gate state lives here, so leaving the group unmounts it and the next visit asks again.
export default function ProfilesLayout() {
  const { ready } = useProfiles();
  const [passed, setPassed] = useState(false);

  if (!passed) return <ParentalGate onPass={() => setPassed(true)} onCancel={leave} />;

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator accessibilityLabel="Loading profiles" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.rounded, fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Profiles', headerRight: DoneButton }} />
      <Stack.Screen name="edit" options={{ title: 'Profile', headerBackTitle: 'Profiles' }} />
    </Stack>
  );
}
