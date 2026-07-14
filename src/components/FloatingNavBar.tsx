import React from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
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
        intensity={30}
        tint="dark"
        style={styles.capsule}
        blurMethod={blurMethod}
        blurTarget={blurTarget}
      >
        <Pressable
          style={[styles.item, currentTab === 'index' && styles.activeItem]}
          onPress={() => onTabSelect('index')}
        >
          <SymbolView
            name="house"
            tintColor={currentTab === 'index' ? c.background : c.textSecondary}
            size={18}
          />
          {currentTab === 'index' && (
            <Text style={[styles.label, { color: c.background }]}>Home</Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.item, currentTab === 'explore' && styles.activeItem]}
          onPress={() => onTabSelect('explore')}
        >
          <SymbolView
            name="square.grid.2x2"
            tintColor={currentTab === 'explore' ? c.background : c.textSecondary}
            size={18}
          />
          {currentTab === 'explore' && (
            <Text style={[styles.label, { color: c.background }]}>Explore</Text>
          )}
        </Pressable>
      </BlurView>

      {/* Separate Floating Circular Action Button for Favorites */}
      <Pressable onPress={() => onTabSelect('favorites')}>
        <BlurView
          intensity={30}
          tint="dark"
          style={[styles.circle, currentTab === 'favorites' && styles.activeCircle]}
          blurMethod={blurMethod}
          blurTarget={blurTarget}
        >
          <SymbolView
            name="heart.fill"
            tintColor={currentTab === 'favorites' ? c.background : c.textSecondary}
            size={18}
          />
        </BlurView>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    height: 64,
    flexDirection: 'row',
    gap: 12,
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
    borderColor: Colors.dark.border,
    overflow: 'hidden',
  },
  item: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  activeItem: {
    backgroundColor: Colors.dark.accent,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: 'hidden',
  },
  activeCircle: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accent,
  },
});
