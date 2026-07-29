import DetailModal from '@/components/DetailModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import WallpaperGrid, { WallpaperItem } from '@/components/WallpaperGrid';
import { Colors } from '@/constants/theme';
import { getFavorites, saveFavorites } from '@/lib/favoritesStore';
import { useAppReady } from '@/lib/appReadyContext';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CATEGORIES = ['All', 'Minimal', 'Nature', 'Dark', 'Abstract'];

const API_BASE = "https://wallpaper-api.sudo-dawood.workers.dev";

export default function HomeScreen() {
  const searchParams = useLocalSearchParams<{ category?: string }>();
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedWallpaper, setSelectedWallpaper] = useState<WallpaperItem | null>(null);
  const [favoritesList, setFavoritesList] = useState<WallpaperItem[]>([]);
  const { signalReady } = useAppReady();

  // Sync route param category selection from ExploreScreen
  useEffect(() => {
    if (searchParams.category) {
      setActiveCategory(searchParams.category.toLowerCase());
    }
  }, [searchParams.category]);

  const loadFavorites = useCallback(() => {
    getFavorites().then(setFavoritesList);
  }, []);

  // Sync favorites state whenever screen mounts or gains active focus
  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [loadFavorites])
  );

  const toggleFavorite = async (item: WallpaperItem) => {
    let updated: WallpaperItem[];
    if (favoritesList.some(f => f.id === item.id)) {
      updated = favoritesList.filter(f => f.id !== item.id);
    } else {
      updated = [...favoritesList, item];
    }
    setFavoritesList(updated);
    await saveFavorites(updated);
  };

  const handleWallpaperPress = useCallback((item: WallpaperItem) => {
    setSelectedWallpaper(item);
  }, []);

  /**
   * Called when WallpaperGrid finishes loading page 1.
   * Prefetch the first batch of thumbnail URLs into expo-image's native cache,
   * then signal the splash overlay to fade out.
   */
  const handleInitialLoadComplete = useCallback(async () => {
    try {
      // Fetch first page data to get thumbnail URLs for prefetching
      const response = await fetch(`${API_BASE}/api/wallpapers?page=1&limit=20`);
      const json = await response.json();
      const thumbUrls: string[] = (json.data ?? [])
        .slice(0, 8) // Prefetch first 8 thumbnails (visible in initial viewport)
        .map((item: WallpaperItem) => item.url_thumb);

      if (thumbUrls.length > 0) {
        await Image.prefetch(thumbUrls);
      }
    } catch {
      // Prefetch failure is non-critical — splash will still dismiss
    }

    signalReady();
  }, [signalReady]);

  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safeArea}>
        <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top + 8 : 16 }]}>
          <ThemedText type="title">Wallepi</ThemedText>
        </View>

        {/* Scrollable Categories Tab Bar */}
        <View style={styles.tabsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContainer}
          >
            {CATEGORIES.map((cat) => {
              const catKey = cat.toLowerCase();
              const isActive = activeCategory === catKey;
              return (
                <Pressable
                  key={cat}
                  style={[styles.tab, isActive && styles.activeTab]}
                  onPress={() => setActiveCategory(catKey)}
                >
                  <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Paginated Wallpaper Feed Grid */}
        <WallpaperGrid
          category={activeCategory}
          onWallpaperPress={handleWallpaperPress}
          onInitialLoadComplete={handleInitialLoadComplete}
        />

        {/* Detail Screen Overlay Modal */}
        <DetailModal
          item={selectedWallpaper}
          visible={selectedWallpaper !== null}
          onClose={() => setSelectedWallpaper(null)}
          isFavorite={selectedWallpaper ? favoritesList.some(f => f.id === selectedWallpaper.id) : false}
          onToggleFavorite={() => selectedWallpaper && toggleFavorite(selectedWallpaper)}
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
  tabsWrapper: {
    height: 48,
    marginBottom: 8,
  },
  tabsContainer: {
    paddingHorizontal: 20,
    gap: 6,
    alignItems: 'center',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: Colors.dark.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  activeTab: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
  },
  activeTabText: {
    color: '#000',
  },
});
