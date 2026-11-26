import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type HostInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBedtime } from '../lib/BedtimeProvider';
import { useProfiles } from '../lib/ProfilesProvider';
import { useReduceMotion } from '../lib/useReduceMotion';
import { cardShadow, colors, fonts, radius } from '../theme';
import { Avatar } from './Avatar';
import { ParentalGate } from './ParentalGate';

// SDK 58 docs: @expo/ui ContextMenu is iOS-only SwiftUI and not a dependency here, so a themed Modal popover is used.
const FALLBACK_HEADER_HEIGHT = 44;
const GAP = 8;
const SCREEN_MARGIN = 12;
const MIN_MENU_HEIGHT = 120;
type TriggerBox = { x: number; y: number; width: number; height: number };
const PROFILES_ROUTE = '/profiles' as Href;
const ADD_PROFILE_ROUTE = '/profiles/edit' as Href;
const PRIVACY_ROUTE = '/privacy' as Href;

export function ProfileMenu() {
  const { ready, profiles, activeProfile, activeId, setActive } = useProfiles();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const { active: bedtimeActive, locked } = useBedtime();
  const [open, setOpen] = useState(false);
  // The profile a grown-up still has to approve switching to during a bedtime session.
  const [gateFor, setGateFor] = useState<string | null>(null);
  const [triggerBox, setTriggerBox] = useState<TriggerBox | null>(null);
  const triggerRef = useRef<HostInstance>(null);
  // A navigation waits here until the Modal has finished dismissing, or iOS can drop the push.
  const pendingHref = useRef<Href | null>(null);
  const pendingSwitch = useRef<string | null>(null);

  const flushPending = useCallback(() => {
    const href = pendingHref.current;
    const switchId = pendingSwitch.current;
    pendingHref.current = null;
    pendingSwitch.current = null;
    if (locked) return;
    if (href) router.push(href);
    if (switchId) setGateFor(switchId);
  }, [locked]);

  // The lock overlay must not end up under the menu or its gate, so close both when it appears.
  const [wasLocked, setWasLocked] = useState(locked);
  if (locked !== wasLocked) {
    setWasLocked(locked);
    if (locked) {
      setOpen(false);
      setGateFor(null);
    }
  }

  // Modal onDismiss only fires on iOS, so other platforms push as soon as the menu has closed.
  useEffect(() => {
    if (!open && Platform.OS !== 'ios') flushPending();
  }, [open, flushPending]);

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => setTriggerBox({ x, y, width, height }));
    setOpen(true);
  };
  const close = () => setOpen(false);
  const choose = (id: string) => {
    if (bedtimeActive && id !== activeId) pendingSwitch.current = id;
    else setActive(id);
    close();
  };
  const passGate = () => {
    if (gateFor) setActive(gateFor);
    setGateFor(null);
  };
  const go = (href: Href) => {
    pendingHref.current = href;
    close();
  };

  const top = triggerBox ? triggerBox.y + triggerBox.height + GAP : insets.top + FALLBACK_HEADER_HEIGHT + GAP;
  const right = triggerBox
    ? Math.max(windowWidth - (triggerBox.x + triggerBox.width), insets.right + GAP)
    : insets.right + SCREEN_MARGIN;
  const maxHeight = Math.max(windowHeight - top - insets.bottom - SCREEN_MARGIN, MIN_MENU_HEIGHT);

  const label = activeProfile ? `Profile menu for ${activeProfile.name}` : 'Profiles menu';

  return (
    <>
      <Pressable
        ref={triggerRef}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !ready }}
        disabled={!ready}
        onPress={openMenu}
        style={styles.trigger}
      >
        <Avatar name={activeProfile?.name} color={activeProfile?.color} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={close}
        onDismiss={flushPending}
        supportedOrientations={['portrait', 'landscape']}
      >
        <View accessibilityViewIsModal style={StyleSheet.absoluteFill}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close menu"
            onPress={close}
            style={StyleSheet.absoluteFill}
          />
          <View testID="profile-menu-anchor" pointerEvents="box-none" style={[styles.anchor, { top, right }]}>
            <ScrollView
              testID="profile-menu-list"
              style={[styles.menu, { maxHeight }]}
              contentContainerStyle={styles.menuContent}
              bounces={false}
            >
              {profiles.map((profile) => {
                const selected = profile.id === activeId;
                return (
                  <Pressable
                    key={profile.id}
                    accessibilityRole="button"
                    accessibilityLabel={profile.name}
                    accessibilityState={{ selected }}
                    onPress={() => choose(profile.id)}
                    style={[styles.row, selected && styles.rowSelected]}
                  >
                    <Avatar name={profile.name} color={profile.color} size={32} />
                    <Text style={styles.rowText} numberOfLines={1}>
                      {profile.name}
                    </Text>
                    {selected ? (
                      <Text
                        testID="active-check"
                        accessible={false}
                        importantForAccessibility="no-hide-descendants"
                        style={styles.check}
                      >
                        ✓
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
              {profiles.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Manage profiles"
                  onPress={() => go(PROFILES_ROUTE)}
                  style={styles.row}
                >
                  <Text style={styles.linkText}>Manage profiles</Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add a kid profile"
                  onPress={() => go(ADD_PROFILE_ROUTE)}
                  style={styles.row}
                >
                  <Text style={styles.linkText}>Add a kid profile</Text>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Privacy & Safety"
                onPress={() => go(PRIVACY_ROUTE)}
                style={styles.row}
              >
                <Text style={styles.linkText}>Privacy & Safety</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
      {gateFor ? (
        <Modal
          visible
          animationType={reduceMotion ? 'none' : 'slide'}
          onRequestClose={() => setGateFor(null)}
          supportedOrientations={['portrait', 'landscape']}
        >
          <ParentalGate onPass={passGate} onCancel={() => setGateFor(null)} />
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anchor: { position: 'absolute', maxWidth: 320, minWidth: 220 },
  menu: {
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  menuContent: { padding: 8 },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  check: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  rowSelected: { backgroundColor: colors.bg },
  rowText: {
    flexShrink: 1,
    color: colors.text,
    fontFamily: fonts.rounded,
    fontSize: 17,
    fontWeight: '700',
  },
  linkText: {
    color: colors.primary,
    fontFamily: fonts.rounded,
    fontSize: 17,
    fontWeight: '700',
  },
});
