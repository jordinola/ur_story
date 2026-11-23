import { useState } from 'react';
import { AccessibilityInfo, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MAX_AGE, MAX_NAME_LENGTH, MIN_AGE, validateProfileInput } from '../lib/profiles';
import { INTEREST_TAGS } from '../lib/tags';
import { avatarColorNames, avatarColors, colors, fonts, radius } from '../theme';
import type { Profile, ProfileInput } from '../types';
import { Avatar } from './Avatar';
import { TagChips } from './TagChips';

const DEFAULT_AGE = 5;
const LANGUAGE_OPTIONS = ['en', 'es'] as const;
const LANGUAGE_LABELS: Record<string, string> = { en: 'English', es: 'Español' };

type Props = {
  initial?: Profile;
  onSubmit: (input: ProfileInput) => void;
  onDelete?: () => void;
  submitLabel: string;
  /** Locks every control (used when profiles could not be loaded and nothing would be saved). */
  disabled?: boolean;
};

type Errors = { name?: string; age?: string; languages?: string };

export function ProfileForm({ initial, onSubmit, onDelete, submitLabel, disabled = false }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [age, setAge] = useState(initial?.age ?? DEFAULT_AGE);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [languages, setLanguages] = useState<string[]>(initial?.languages ?? ['en']);
  const [color, setColor] = useState(initial?.color ?? avatarColors[0] ?? colors.primary);
  const [errors, setErrors] = useState<Errors>({});

  const submit = () => {
    if (disabled) return;
    const result = validateProfileInput({ name, age, tags, languages });
    if (!result.ok) {
      setErrors(result.errors);
      // Errors render far from the submit button, so tell VoiceOver users what to fix (form order).
      const first = result.errors.name ?? result.errors.age ?? result.errors.languages;
      if (first) AccessibilityInfo.announceForAccessibility(first);
      return;
    }
    setErrors({});
    onSubmit({ ...result.value, color });
  };

  const confirmDelete = () => {
    const who = initial?.name ?? 'this profile';
    Alert.alert(`Delete ${who}?`, `Favorites and progress for ${who} will be removed. This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete?.() },
    ]);
  };

  return (
    <View style={styles.form}>
      <View style={styles.preview}>
        <Avatar name={name} color={color} size={72} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          accessibilityLabel="Name"
          value={name}
          onChangeText={setName}
          maxLength={MAX_NAME_LENGTH}
          autoCapitalize="words"
          autoCorrect={false}
          autoComplete="off"
          textContentType="none"
          editable={!disabled}
          returnKeyType="done"
          placeholder="Your child's name"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        {errors.name ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {errors.name}
          </Text>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Age</Text>
        <View style={styles.stepper}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease age"
            accessibilityState={{ disabled: disabled || age <= MIN_AGE }}
            disabled={disabled || age <= MIN_AGE}
            onPress={() => setAge((a) => Math.max(MIN_AGE, a - 1))}
            style={[styles.stepButton, (disabled || age <= MIN_AGE) && styles.stepDisabled]}
          >
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text accessibilityLiveRegion="polite" style={styles.ageValue}>
            {age}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase age"
            accessibilityState={{ disabled: disabled || age >= MAX_AGE }}
            disabled={disabled || age >= MAX_AGE}
            onPress={() => setAge((a) => Math.min(MAX_AGE, a + 1))}
            style={[styles.stepButton, (disabled || age >= MAX_AGE) && styles.stepDisabled]}
          >
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>
        {errors.age ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {errors.age}
          </Text>
        ) : null}
      </View>

      <View style={styles.field}>
        <TagChips
          label="Languages"
          options={LANGUAGE_OPTIONS}
          selected={languages}
          onChange={setLanguages}
          getLabel={(code) => LANGUAGE_LABELS[code] ?? code}
          disabled={disabled}
        />
        {errors.languages ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {errors.languages}
          </Text>
        ) : null}
      </View>

      <TagChips label="Interests" options={INTEREST_TAGS} selected={tags} onChange={setTags} disabled={disabled} />

      <View style={styles.field}>
        <Text style={styles.label}>Color</Text>
        <View style={styles.swatches}>
          {avatarColors.map((swatch, index) => {
            const selected = swatch === color;
            return (
              <Pressable
                key={swatch}
                accessibilityRole="button"
                accessibilityLabel={avatarColorNames[index] ?? `Color ${index + 1}`}
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                onPress={() => setColor(swatch)}
                style={[styles.swatchHit, selected && styles.swatchHitSelected]}
              >
                <View style={[styles.swatch, { backgroundColor: swatch }]} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={submitLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={submit}
        style={[styles.primary, disabled && styles.primaryDisabled]}
      >
        <Text style={styles.primaryText}>{submitLabel}</Text>
      </Pressable>

      {onDelete ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete profile"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={confirmDelete}
          style={[styles.delete, disabled && styles.primaryDisabled]}
        >
          <Text style={styles.deleteText}>Delete profile</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 24 },
  preview: { alignItems: 'center' },
  field: { gap: 8 },
  label: { color: colors.text, fontFamily: fonts.rounded, fontSize: 17, fontWeight: '700' },
  input: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    color: colors.text,
    fontSize: 17,
  },
  error: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: { opacity: 0.4 },
  stepText: { color: colors.text, fontSize: 24, fontWeight: '700' },
  ageValue: { minWidth: 32, textAlign: 'center', color: colors.text, fontFamily: fonts.rounded, fontSize: 22, fontWeight: '800' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatchHit: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchHitSelected: { borderColor: colors.text },
  swatch: { width: 30, height: 30, borderRadius: 15 },
  primary: {
    minHeight: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  primaryDisabled: { opacity: 0.4 },
  primaryText: { color: colors.primaryText, fontFamily: fonts.rounded, fontSize: 17, fontWeight: '800' },
  delete: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  deleteText: { color: colors.heart, fontSize: 17, fontWeight: '700' },
});
