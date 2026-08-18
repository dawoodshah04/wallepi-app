import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '@/constants/theme';
import type { WallpaperItem } from './WallpaperGrid';

interface WallpaperCardProps {
  item: WallpaperItem;
  onPress: (item: WallpaperItem) => void;
  cardWidth?: number;
}

const WallpaperCard = React.memo(function WallpaperCard({ item, onPress, cardWidth }: WallpaperCardProps) {
  const { width } = useWindowDimensions();
  const widthVal = cardWidth ?? Math.floor((width - 40 - 12) / 2);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, { width: widthVal }, pressed && styles.cardPressed]}
      onPress={() => onPress(item)}
    >
      <Image
        source={{ uri: item.url_thumb }}
        placeholder={item.blurhash ? { blurhash: item.blurhash } : undefined}
        style={styles.image}
        contentFit="cover"
        transition={0}
        cachePolicy="memory-disk"
        recyclingKey={item.id}
      />
    </Pressable>
  );
});

export default WallpaperCard;

const styles = StyleSheet.create({
  card: {
    aspectRatio: 9 / 16,
    borderRadius: 20,
    backgroundColor: Colors.dark.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: 'hidden',
  },
  cardPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
