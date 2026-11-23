import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { MAX_PROFILES } from '../../lib/profiles';
import { useProfiles } from '../../lib/ProfilesProvider';
import { colors, fonts, MAX_CONTENT_WIDTH, radius } from '../../theme';

const ADD_ROUTE = '/profiles/edit' as Href;

const LOAD_FAILED_MESSAGE =
  "Profiles couldn't be loaded, so changes won't be saved right now. Please close the app and try again.";

export default function ProfilesScreen() {
  const { profiles, trusted } = useProfiles();
  const insets = useSafeAreaInsets();
  const atLimit = profiles.length >= MAX_PROFILES;
  const addDisabled = atLimit || !trusted;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
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

        {profiles.map((profile) => (
          <View key={profile.id} style={styles.row}>
            <Avatar name={profile.name} color={profile.color} size={44} />
            <View style={styles.info}>
              <Text style={styles.name}>{profile.name}</Text>
              <Text style={styles.meta}>Age {profile.age}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${profile.name}`}
              accessibilityState={{ disabled: !trusted }}
              disabled={!trusted}
              onPress={() => router.push({ pathname: '/profiles/edit', params: { id: profile.id } } as Href)}
              style={[styles.edit, !trusted && styles.disabled]}
            >
              <Text style={styles.editText}>Edit</Text>
            </Pressable>
          </View>
        ))}

        {profiles.length === 0 && trusted ? (
          <Text style={styles.meta}>No profiles yet. Add one to get stories picked for your child.</Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a profile"
          accessibilityState={{ disabled: addDisabled }}
          disabled={addDisabled}
          onPress={() => router.push(ADD_ROUTE)}
          style={[styles.add, addDisabled && styles.disabled]}
        >
          <Text style={styles.addText}>Add a profile</Text>
        </Pressable>
        {atLimit ? <Text style={styles.meta}>You can have up to {MAX_PROFILES} profiles. Delete one to add another.</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, alignItems: 'center' },
  column: { width: '100%', maxWidth: Math.min(MAX_CONTENT_WIDTH, 640), gap: 12 },
  notice: {
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    minHeight: 64,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  info: { flex: 1 },
  name: { color: colors.text, fontFamily: fonts.rounded, fontSize: 18, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 15 },
  edit: { minWidth: 44, minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  editText: { color: colors.primary, fontFamily: fonts.rounded, fontSize: 17, fontWeight: '700' },
  add: {
    minHeight: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  addText: { color: colors.primaryText, fontFamily: fonts.rounded, fontSize: 17, fontWeight: '800' },
  disabled: { opacity: 0.4 },
});
