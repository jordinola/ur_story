import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileForm } from '../../components/ProfileForm';
import { leave } from '../../lib/navigation';
import { MAX_PROFILES } from '../../lib/profiles';
import { useProfiles } from '../../lib/ProfilesProvider';
import { colors, fonts, MAX_CONTENT_WIDTH, radius } from '../../theme';
import type { ProfileInput } from '../../types';

const LOAD_FAILED_MESSAGE =
  "Profiles couldn't be loaded, so changes won't be saved right now. Please close the app and try again.";

export default function EditProfileScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { profiles, trusted, createProfile, updateProfile, deleteProfile } = useProfiles();
  const insets = useSafeAreaInsets();
  // Set before deleting so the screen does not flash "not found" while it navigates away.
  const [leaving, setLeaving] = useState(false);

  const editing = id !== undefined;
  const existing = editing ? profiles.find((p) => p.id === id) : undefined;
  const atLimit = !editing && profiles.length >= MAX_PROFILES;

  if (leaving) return null;

  if (editing && !existing) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Edit profile' }} />
        <Text accessibilityRole="header" style={styles.title}>
          Profile not found
        </Text>
        <Text style={styles.body}>This profile may have been deleted.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={leave} style={styles.back}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const submit = (input: ProfileInput) => {
    if (existing) {
      updateProfile(existing.id, input);
    } else if (!createProfile(input)) {
      return;
    }
    setLeaving(true);
    leave();
  };

  const remove = () => {
    if (!existing) return;
    setLeaving(true);
    deleteProfile(existing.id);
    leave();
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: existing ? 'Edit profile' : 'New profile' }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 },
        ]}
      >
        <View style={styles.column}>
          {!trusted ? (
            <Text accessibilityRole="alert" style={styles.notice}>
              {LOAD_FAILED_MESSAGE}
            </Text>
          ) : null}
          {atLimit ? (
            <Text accessibilityRole="alert" style={styles.notice}>
              You can have up to {MAX_PROFILES} profiles. Delete one to add another.
            </Text>
          ) : null}
          <ProfileForm
            initial={existing}
            submitLabel={existing ? 'Save changes' : 'Add profile'}
            onSubmit={submit}
            onDelete={existing ? remove : undefined}
            disabled={!trusted || atLimit}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingTop: 16, alignItems: 'center' },
  column: { width: '100%', maxWidth: Math.min(MAX_CONTENT_WIDTH, 640), gap: 16 },
  notice: {
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 16,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  title: { color: colors.text, fontFamily: fonts.rounded, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  body: { color: colors.muted, fontSize: 16, textAlign: 'center' },
  back: {
    minHeight: 48,
    minWidth: 120,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  backText: { color: colors.primaryText, fontFamily: fonts.rounded, fontSize: 17, fontWeight: '800' },
});
