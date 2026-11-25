import { useEffect } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBedtime } from '../lib/BedtimeProvider';
import { useDownloads } from '../lib/DownloadsProvider';
import { formatTime } from '../lib/format';
import { PLAYBACK_RATES } from '../lib/playbackRates';
import { usePlayer } from '../lib/PlayerProvider';
import { cardShadow, colors, fonts, radius } from '../theme';
import type { Story } from '../types';

const SLEEP_OPTIONS = [10, 20, 30];
const SHEET_MAX_WIDTH = 560;

// The playing story cannot be removed (its file is in use), so the row never offers Remove download.
function DownloadRow({ story }: { story: Story }) {
  const { downloaded, progress, errors, download, cancel } = useDownloads();
  const fraction = progress[story.id];
  const error = errors[story.id];

  const control = (() => {
    if (fraction != null) {
      const percent = Math.round(fraction * 100);
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Cancel download, ${percent} percent`}
          onPress={() => cancel(story.id)}
          style={styles.chip}
        >
          <Text style={styles.chipText}>Cancel download · {percent}%</Text>
        </Pressable>
      );
    }
    if (downloaded[story.id]) return <Text style={styles.status}>Downloaded</Text>;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Download"
        onPress={() => download(story)}
        style={styles.chip}
      >
        <Text style={styles.chipText}>Download</Text>
      </Pressable>
    );
  })();

  return (
    <View style={styles.rowGroup}>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Listen offline</Text>
        {control}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

type MoreSheetProps = {
  visible: boolean;
  onClose: () => void;
};

// A transparent bottom-aligned sheet with a tappable backdrop: it behaves the same on iPhone,
// iPhone landscape and iPad (capped width), unlike pageSheet, which is iOS-only.
export function MoreSheet({ visible, onClose }: MoreSheetProps) {
  const p = usePlayer();
  const bedtime = useBedtime();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible && bedtime.locked) onClose();
  }, [visible, bedtime.locked, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable accessible={false} testID="more-sheet-backdrop" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) + 8, paddingLeft: insets.left + 20, paddingRight: insets.right + 20 },
          ]}
        >
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              More
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView testID="more-sheet-rows" contentContainerStyle={styles.rows}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Speed</Text>
              <View style={styles.chips}>
                {PLAYBACK_RATES.map((rate) => (
                  <Pressable
                    key={rate}
                    accessibilityRole="button"
                    accessibilityLabel={`${rate}x speed`}
                    accessibilityState={{ selected: p.playbackRate === rate }}
                    onPress={() => p.setPlaybackRate(rate)}
                    style={[styles.chip, p.playbackRate === rate && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, p.playbackRate === rate && styles.chipTextActive]}>{rate}x</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {p.current ? <DownloadRow story={p.current} /> : null}

            {bedtime.active ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Bedtime ends in {formatTime(bedtime.remainingSec ?? 0)}</Text>
              </View>
            ) : (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>
                  {p.sleepRemainingSec != null ? `Sleep in ${formatTime(p.sleepRemainingSec)}` : 'Sleep timer'}
                </Text>
                <View style={styles.chips}>
                  {SLEEP_OPTIONS.map((m) => (
                    <Pressable
                      key={m}
                      accessibilityRole="button"
                      accessibilityState={{ selected: p.sleepMinutes === m }}
                      onPress={() => p.setSleepTimer(p.sleepMinutes === m ? null : m)}
                      style={[styles.chip, p.sleepMinutes === m && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, p.sleepMinutes === m && styles.chipTextActive]}>{m}m</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(58, 46, 57, 0.4)' },
  sheet: {
    width: '100%',
    maxWidth: SHEET_MAX_WIDTH,
    maxHeight: '90%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: 12,
    gap: 16,
    ...cardShadow,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontFamily: fonts.rounded, fontSize: 20, fontWeight: '800' },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: colors.text, fontSize: 18, fontWeight: '700' },
  rows: { gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  rowGroup: { gap: 6 },
  status: { color: colors.muted, fontFamily: fonts.rounded, fontSize: 15, fontWeight: '700', paddingVertical: 12 },
  error: { color: colors.primary, fontSize: 13 },
  rowLabel: { color: colors.text, fontFamily: fonts.rounded, fontSize: 15, fontWeight: '700' },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontFamily: fonts.rounded, fontWeight: '700' },
  chipTextActive: { color: colors.primaryText },
});
