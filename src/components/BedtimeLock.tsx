import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useBedtime } from '../lib/BedtimeProvider';
import { colors } from '../theme';
import { ParentalGate } from './ParentalGate';

const noop = () => {};

// Sits above every route, so back swipes and links underneath can't reach past it.
export function BedtimeLock() {
  const { ready, locked, endBedtime } = useBedtime();

  // A presented modal route (like /profiles) would draw over this overlay, so close it first.
  useEffect(() => {
    if (locked && router.canDismiss()) router.dismissAll();
  }, [locked]);

  // Until the saved session is read, a session that already ran out can't be told from none, so keep the app covered.
  if (!ready) return <View testID="bedtime-loading" style={[StyleSheet.absoluteFill, styles.overlay]} />;
  if (!locked) return null;

  return (
    <View accessibilityViewIsModal style={[StyleSheet.absoluteFill, styles.overlay]}>
      <ParentalGate onPass={endBedtime} onCancel={noop} hideCancel />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: colors.bg },
});
