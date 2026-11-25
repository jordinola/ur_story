import { useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { makeGateQuestion } from '../lib/gateQuestion';
import { cardShadow, colors, fonts, radius } from '../theme';

const RETRY_MESSAGE = 'Not quite. Here is a new one!';

// `message` says what the gate protects (e.g. which download it removes), under the title.
type Props = { onPass: () => void; onCancel: () => void; hideCancel?: boolean; message?: string };

export function ParentalGate({ onPass, onCancel, hideCancel = false, message }: Props) {
  const insets = useSafeAreaInsets();
  const [question, setQuestion] = useState(() => makeGateQuestion());
  const [retry, setRetry] = useState(false);
  // A fast double tap can land twice before the parent re-renders; pass only once.
  const passed = useRef(false);

  const choose = (value: number) => {
    if (passed.current) return;
    if (value === question.answer) {
      passed.current = true;
      onPass();
      return;
    }
    const next = makeGateQuestion();
    setQuestion(next);
    setRetry(true);
    AccessibilityInfo.announceForAccessibility(`${RETRY_MESSAGE} ${next.prompt}`);
  };

  return (
    <ScrollView
      testID="parental-gate-scroll"
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingLeft: insets.left + 24, paddingRight: insets.right + 24 },
      ]}
    >
      <Text accessibilityRole="header" style={styles.title}>
        Grown-ups only
      </Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Text style={styles.prompt}>{question.prompt}</Text>
      {retry ? <Text style={styles.retry}>{RETRY_MESSAGE}</Text> : null}
      <View style={styles.options}>
        {question.options.map((n) => (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={String(n)}
            onPress={() => choose(n)}
            style={styles.option}
          >
            <Text style={styles.optionText}>{n}</Text>
          </Pressable>
        ))}
      </View>
      {hideCancel ? null : (
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={onCancel} style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { color: colors.text, fontFamily: fonts.rounded, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  message: { color: colors.text, fontSize: 17, lineHeight: 24, textAlign: 'center', maxWidth: 420 },
  prompt: { color: colors.text, fontFamily: fonts.rounded, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  retry: { color: colors.muted, fontSize: 16, textAlign: 'center' },
  options: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginVertical: 8 },
  option: {
    minWidth: 96,
    minHeight: 64,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  optionText: { color: colors.primaryText, fontFamily: fonts.rounded, fontSize: 26, fontWeight: '800' },
  cancel: { minWidth: 44, minHeight: 44, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.text, fontFamily: fonts.rounded, fontSize: 17, fontWeight: '700' },
});
