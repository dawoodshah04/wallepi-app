import React, { useCallback, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Colors } from '@/constants/theme';
import type { WallpaperItem } from './WallpaperGrid';

interface WallpaperCardProps {
  item: WallpaperItem;
  onPress: (item: WallpaperItem) => void;
  onFavouriteToggle?: (item: WallpaperItem, isFavourite: boolean) => void;
  isFavourite?: boolean;
  cardWidth?: number;
}

const WallpaperCard = React.memo(function WallpaperCard({
  item,
  onPress,
  onFavouriteToggle,
  isFavourite: isFavouriteProp = false,
  cardWidth,
}: WallpaperCardProps) {
  const { width } = useWindowDimensions();
  const widthVal = cardWidth ?? Math.floor((width - 40 - 12) / 2);

  // Local favourite state (falls back to prop)
  const [isFavourite, setIsFavourite] = useState(isFavouriteProp);

  // Animated value for the heart scale
  const heartScale = useRef(new Animated.Value(1)).current;

  const handleFavouritePress = useCallback(() => {
    const next = !isFavourite;
    setIsFavourite(next);
    onFavouriteToggle?.(item, next);

    // Spring pop animation: scale up then settle back to 1
    Animated.sequence([
      Animated.spring(heartScale, {
        toValue: 1.4,
        useNativeDriver: true,
        speed: 50,
        bounciness: 12,
      }),
      Animated.spring(heartScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 8,
      }),
    ]).start();
  }, [isFavourite, heartScale, item, onFavouriteToggle]);

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

      {/* Favourite button overlay */}
      <Pressable
        style={styles.favouriteButton}
        onPress={handleFavouritePress}
        hitSlop={8}
      >
        <Animated.View style={{ transform: [{ scale: heartScale }] }}>
          <SymbolView
            name={
              isFavourite
                ? { ios: 'heart.fill', android: 'favorite', web: 'favorite' }
                : { ios: 'heart', android: 'favorite_border', web: 'favorite_border' }
            }
            tintColor={isFavourite ? '#FF4D6D' : 'rgba(255,255,255,0.85)'}
            size={22}
          />
        </Animated.View>
      </Pressable>
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
  favouriteButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
