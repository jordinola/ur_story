import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BEDTIME_DURATIONS, BEDTIME_TIP_KEY } from '../lib/bedtime';
import { useBedtime } from '../lib/BedtimeProvider';
import { formatTime } from '../lib/format';
import { useReduceMotion } from '../lib/useReduceMotion';
import { cardShadow, colors, fonts, radius } from '../theme';
import { ParentalGate } from './ParentalGate';

const TIP = 'To keep the phone on this app, turn on Guided Access in Settings > Accessibility.';

type Step = 'closed' | 'gate' | 'sheet' | 'tip';

const spokenTimeLeft = (totalSeconds: number) =>
  `${Math.floor(totalSeconds / 60)} minutes ${totalSeconds % 60} seconds left`;

export function BedtimeEntry() {
  const { active, locked, remainingSec, startBedtime, endBedtime } = useBedtime();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  // One Modal for every step, so two modals never stack (iOS can drop the second one).
  const [step, setStep] = useState<Step>('closed');
  const close = () => setStep('closed');

  // Our modal would draw over the lock overlay, so close it the moment the lock appears.
  const [wasLocked, setWasLocked] = useState(locked);
  if (locked !== wasLocked) {
    setWasLocked(locked);
    if (locked) close();
  }

  const pick = (minutes: number) => {
    startBedtime(minutes);
    AsyncStorage.getItem(BEDTIME_TIP_KEY)
      .catch(() => null)
      .then((seen) => setStep(seen ? 'closed' : 'tip'));
  };

  const dismissTip = () => {
    AsyncStorage.setItem(BEDTIME_TIP_KEY, '1').catch(() => {});
    close();
  };

  const end = () => {
    endBedtime();
    close();
  };

  const showCountdown = active && remainingSec != null;
  const chipLabel = showCountdown ? `Bedtime, ${spokenTimeLeft(remainingSec)}` : 'Bedtime';

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={chipLabel}
        onPress={() => setStep('gate')}
        style={[styles.chip, active && styles.chipActive]}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>
          {showCountdown ? `Bedtime · ${formatTime(remainingSec)}` : 'Bedtime'}
        </Text>
      </Pressable>
      <Modal
        visible={step !== 'closed'}
        animationType={reduceMotion ? 'none' : 'slide'}
        onRequestClose={close}
        supportedOrientations={['portrait', 'landscape']}
      >
        {step === 'gate' ? <ParentalGate onPass={() => setStep('sheet')} onCancel={close} /> : null}
        {step === 'sheet' || step === 'tip' ? (
          <View
            style={[
              styles.sheet,
              { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingLeft: insets.left + 24, paddingRight: insets.right + 24 },
            ]}
          >
            {step === 'tip' ? (
              <>
                <Text accessibilityRole="header" style={styles.title}>
                  Bedtime started
                </Text>
                <Text style={styles.body}>{TIP}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Got it" onPress={dismissTip} style={styles.primary}>
                  <Text style={styles.primaryText}>Got it</Text>
                </Pressable>
              </>
            ) : active ? (
              <>
                <Text accessibilityRole="header" style={styles.title}>
                  Bedtime is on
                </Text>
                <Pressable accessibilityRole="button" accessibilityLabel="End bedtime" onPress={end} style={styles.primary}>
                  <Text style={styles.primaryText}>End bedtime</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={styles.secondary}>
                  <Text style={styles.secondaryText}>Close</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text accessibilityRole="header" style={styles.title}>
                  How long until bedtime ends?
                </Text>
                <View style={styles.options}>
                  {BEDTIME_DURATIONS.map((minutes) => (
                    <Pressable
                      key={minutes}
                      accessibilityRole="button"
                      accessibilityLabel={`${minutes} minutes`}
                      onPress={() => pick(minutes)}
                      style={styles.option}
                    >
                      <Text style={styles.optionText}>{minutes} min</Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={styles.secondary}>
                  <Text style={styles.secondaryText}>Close</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    marginLeft: 'auto',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontFamily: fonts.rounded, fontWeight: '700' },
  chipTextActive: { color: colors.primaryText },
  sheet: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 20 },
  title: { color: colors.text, fontFamily: fonts.rounded, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  body: { color: colors.text, fontSize: 17, lineHeight: 24, textAlign: 'center', maxWidth: 420 },
  options: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 },
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
  optionText: { color: colors.primaryText, fontFamily: fonts.rounded, fontSize: 22, fontWeight: '800' },
  primary: {
    minHeight: 56,
    minWidth: 160,
    paddingHorizontal: 24,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  primaryText: { color: colors.primaryText, fontFamily: fonts.rounded, fontSize: 20, fontWeight: '800' },
  secondary: { minWidth: 44, minHeight: 44, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.text, fontFamily: fonts.rounded, fontSize: 17, fontWeight: '700' },
});
