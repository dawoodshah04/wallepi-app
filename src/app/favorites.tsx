import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { getFavorites, saveFavorites } from '@/lib/favoritesStore';
import type { WallpaperItem } from '@/components/WallpaperGrid';
import WallpaperCard from '@/components/WallpaperCard';
import DetailModal from '@/components/DetailModal';

export default function FavoritesScreen() {
  const [favoritesList, setFavoritesList] = useState<WallpaperItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<WallpaperItem | null>(null);
  const { width } = useWindowDimensions();
  const columnWidth = Math.floor((width - 40 - 12) / 2);

  // Reload favorites list whenever screen gains active navigation focus
  useFocusEffect(
    useCallback(() => {
      getFavorites().then(setFavoritesList);
    }, [])
  );

  const toggleFavorite = async (item: WallpaperItem) => {
    const list = favoritesList.filter(f => f.id !== item.id);
    setFavoritesList(list);
    await saveFavorites(list);
    setSelectedItem(null);
  };

  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safeArea}>
        <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top + 8 : 16 }]}>
          <ThemedText type="title">Favorites</ThemedText>
        </View>

        <FlatList
          data={favoritesList}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <ThemedText type="small" themeColor="textSecondary">
                No bookmarked wallpapers yet
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <WallpaperCard
              item={item}
              onPress={setSelectedItem}
              cardWidth={columnWidth}
            />
          )}
        />

        <DetailModal
          item={selectedItem}
          visible={selectedItem !== null}
          onClose={() => setSelectedItem(null)}
          isFavorite={selectedItem ? favoritesList.some(f => f.id === selectedItem.id) : false}
          onToggleFavorite={() => selectedItem && toggleFavorite(selectedItem)}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  row: {
    gap: 12,
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
});
