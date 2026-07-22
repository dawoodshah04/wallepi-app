import React from 'react';
import { Pressable, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '@/constants/theme';
import type { WallpaperItem } from './WallpaperGrid';

interface WallpaperCardProps {
  item: WallpaperItem;
  onPress: (item: WallpaperItem) => void;
}

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 40 - 12) / 2; // screen width - margins (20 * 2) - gap (12)

const WallpaperCard = React.memo(function WallpaperCard({ item, onPress }: WallpaperCardProps) {
  return (
    <Pressable style={styles.card} onPress={() => onPress(item)}>
      <Image
        source={{ uri: item.url_thumb }}
        style={styles.image}
        contentFit="cover"
        transition={200}
      />
    </Pressable>
  );
});

export default WallpaperCard;

const styles = StyleSheet.create({
  card: {
    width: COLUMN_WIDTH,
    aspectRatio: 9 / 16,
    borderRadius: 20,
    backgroundColor: Colors.dark.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
