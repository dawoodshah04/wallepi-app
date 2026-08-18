import React, { useEffect } from 'react';
import { View, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import { BlurView, BlurMethod } from 'expo-blur';
import { Colors } from '@/constants/theme';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const TABS = [
  {
    tab: 'index',
    iconActive:   { ios: 'house.fill',          android: 'home',           web: 'home' },
    iconInactive: { ios: 'house',               android: 'home',           web: 'home' },
  },
  {
    tab: 'explore',
    iconActive:   { ios: 'square.grid.2x2.fill', android: 'explore',       web: 'explore' },
    iconInactive: { ios: 'square.grid.2x2',      android: 'explore',       web: 'explore' },
  },
  {
    tab: 'favorites',
    iconActive:   { ios: 'heart.fill',          android: 'favorite',       web: 'favorite' },
    iconInactive: { ios: 'heart',               android: 'favorite_border', web: 'favorite_border' },
  },
] as const;

interface FloatingNavBarProps {
  currentTab: 'index' | 'explore' | 'favorites';
  onTabSelect: (tab: 'index' | 'explore' | 'favorites') => void;
  blurTarget?: React.RefObject<View | null>;
}

export default function FloatingNavBar({ currentTab, onTabSelect, blurTarget }: FloatingNavBarProps) {
  const c = Colors.dark;
  const blurMethod: BlurMethod = 'dimezisBlurViewSdk31Plus';
  const insets = useSafeAreaInsets();

  const tabIndex = TABS.findIndex(t => t.tab === currentTab);
  const itemWidth = useSharedValue(0);
  const translateX = useSharedValue(0);

  // Measure each item width from container layout
  const onCapsuleLayout = (e: LayoutChangeEvent) => {
    const capsuleWidth = e.nativeEvent.layout.width;
    // Account for paddingHorizontal (8 each side)
    const innerWidth = capsuleWidth - 16;
    const w = innerWidth / TABS.length;
    itemWidth.value = w;
    translateX.value = tabIndex * w;
  };

  useEffect(() => {
    if (itemWidth.value > 0) {
      translateX.value = withSpring(tabIndex * itemWidth.value, {
        damping: 24,
        stiffness: 280,
        mass: 0.6,
      });
    }
  }, [tabIndex]);

  const pillStyle = useAnimatedStyle(() => ({
    width: itemWidth.value,
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={[styles.container, { bottom: Math.max(insets.bottom, 12) + 12 }]}>
      <BlurView
        intensity={60}
        tint="dark"
        style={styles.capsule}
        blurMethod={blurMethod}
        blurTarget={blurTarget}
        onLayout={onCapsuleLayout}
      >
        {/* Animated pill indicator */}
        <Animated.View style={[styles.pill, pillStyle]} />

        {/* Tab items */}
        {TABS.map(({ tab, iconActive, iconInactive }) => (
          <Pressable
            key={tab}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            onPress={() => onTabSelect(tab)}
          >
            <SymbolView
              name={currentTab === tab ? iconActive : iconInactive}
              tintColor={currentTab === tab ? c.background : c.textSecondary}
              size={22}
            />
          </Pressable>
        ))}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 64,
    flexDirection: 'row',
    zIndex: 999,
  },
  capsule: {
    flex: 1,
    height: 64,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(28, 28, 30, 0.65)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  pill: {
    position: 'absolute',
    left: 8,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.accent,
  },
  item: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemPressed: {
    transform: [{ scale: 0.90 }],
    opacity: 0.8,
  },
});
