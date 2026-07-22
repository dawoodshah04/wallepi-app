import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { BlurView, BlurMethod } from 'expo-blur';
import { Colors } from '@/constants/theme';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FloatingNavBarProps {
  currentTab: 'index' | 'explore' | 'favorites';
  onTabSelect: (tab: 'index' | 'explore' | 'favorites') => void;
  blurTarget?: React.RefObject<View | null>;
}

export default function FloatingNavBar({ currentTab, onTabSelect, blurTarget }: FloatingNavBarProps) {
  const c = Colors.dark;
  const blurMethod: BlurMethod = 'dimezisBlurViewSdk31Plus';
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { bottom: Math.max(insets.bottom, 12) + 12 }]}>
      {/* Primary Capsule Menu */}
      <BlurView
        intensity={60}
        tint="dark"
        style={styles.capsule}
        blurMethod={blurMethod}
        blurTarget={blurTarget}
      >
        {([
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
        ] as const).map(({ tab, iconActive, iconInactive }) => (
          <Pressable
            key={tab}
            style={[styles.item, currentTab === tab && styles.activeItem]}
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
  item: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeItem: {
    backgroundColor: Colors.dark.accent,
  },
});
