import { useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PRIVACY_CONTACT_EMAIL, PRIVACY_POLICY, PRIVACY_SUMMARY } from '../data/privacyPolicy';
import { useDataReset } from '../lib/DataResetProvider';
import { parsePolicyBlocks, type PolicyBlock } from '../lib/policyBlocks';
import { colors, fonts, MAX_CONTENT_WIDTH, radius } from '../theme';

const CONFIRM_ANNOUNCEMENT = 'Are you sure? Delete everything cannot be undone.';
const COLUMN_MAX_WIDTH = Math.min(MAX_CONTENT_WIDTH, 640);

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text accessible={false} importantForAccessibility="no" style={styles.bulletGlyph}>
        •
      </Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function Block({ block }: { block: PolicyBlock }) {
  switch (block.type) {
    case 'title':
      return (
        <Text accessibilityRole="header" style={styles.title}>
          {block.text}
        </Text>
      );
    case 'heading':
      return (
        <Text accessibilityRole="header" style={styles.heading}>
          {block.text}
        </Text>
      );
    case 'bullet':
      return <Bullet text={block.text} />;
    case 'paragraph':
      return <Text style={styles.body}>{block.text}</Text>;
  }
}

export function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const { eraseEverything } = useDataReset();
  const blocks = useMemo(() => parsePolicyBlocks(PRIVACY_POLICY), []);
  const [confirming, setConfirming] = useState(false);
  // A fast double tap can land twice before the tree unmounts; erase only once.
  const started = useRef(false);

  const askToConfirm = () => {
    setConfirming(true);
    AccessibilityInfo.announceForAccessibility(CONFIRM_ANNOUNCEMENT);
  };

  const confirmErase = () => {
    if (started.current) return;
    started.current = true;
    void eraseEverything();
  };

  return (
    <ScrollView
      testID="privacy-scroll"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 32, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 },
      ]}
    >
      <View style={styles.column}>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.heading}>
            At a glance
          </Text>
          {PRIVACY_SUMMARY.map((line) => (
            <Bullet key={line} text={line} />
          ))}
        </View>

        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.heading}>
            Erase everything
          </Text>
          {confirming ? (
            <>
              <Text style={styles.body}>
                This removes every profile, favorite, history entry, setting and downloaded story from this device. It
                cannot be undone.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete everything"
                accessibilityHint="This cannot be undone"
                onPress={confirmErase}
                style={styles.danger}
              >
                <Text style={styles.dangerText}>Delete everything</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Keep my data"
                onPress={() => setConfirming(false)}
                style={styles.outline}
              >
                <Text style={styles.outlineText}>Keep my data</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete all data"
              onPress={askToConfirm}
              style={styles.outline}
            >
              <Text style={styles.outlineText}>Delete all data</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.body}>
          Questions about privacy? Email <Text selectable>{PRIVACY_CONTACT_EMAIL}</Text>
        </Text>

        {blocks.map((block, index) => (
          <Block key={index} block={block} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, alignItems: 'center' },
  column: { width: '100%', maxWidth: COLUMN_MAX_WIDTH, gap: 12 },
  card: {
    gap: 10,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontFamily: fonts.rounded, fontSize: 26, fontWeight: '800', marginTop: 8 },
  heading: { color: colors.text, fontFamily: fonts.rounded, fontSize: 19, fontWeight: '800', marginTop: 4 },
  body: { color: colors.text, fontSize: 16, lineHeight: 23 },
  bulletRow: { flexDirection: 'row', gap: 10, paddingLeft: 4 },
  bulletGlyph: { color: colors.primary, fontSize: 16, lineHeight: 23, fontWeight: '800' },
  bulletText: { flex: 1, color: colors.text, fontSize: 16, lineHeight: 23 },
  outline: {
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  outlineText: { color: colors.primary, fontFamily: fonts.rounded, fontSize: 17, fontWeight: '800' },
  danger: {
    minHeight: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dangerText: { color: colors.primaryText, fontFamily: fonts.rounded, fontSize: 17, fontWeight: '800' },
});
