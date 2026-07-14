import React from 'react';
import { Pressable, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '@/constants/theme';

interface WallpaperCardProps {
  id: string;
  url: string;
  onPress: () => void;
}

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 40 - 12) / 2; // screen width - margins (20 * 2) - gap (12)

export default function WallpaperCard({ url, onPress }: WallpaperCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Image
        source={{ uri: url }}
        style={styles.image}
        contentFit="cover"
        transition={200}
      />
    </Pressable>
  );
}

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
