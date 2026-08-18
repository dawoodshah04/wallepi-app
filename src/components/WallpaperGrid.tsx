import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FlatList, View, ActivityIndicator, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Colors } from '@/constants/theme';
import WallpaperCard from './WallpaperCard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface WallpaperItem {
  id: string;
  filename: string;
  url_full: string;
  url_thumb: string;
  width: number;
  height: number;
  file_size: number;
  mime_type: string;
  blurhash: string | null;
}

interface WallpaperGridProps {
  category?: string;
  onWallpaperPress: (item: WallpaperItem) => void;
  onInitialLoadComplete?: () => void;
}

const API_BASE = "https://wallpaper-api.sudo-dawood.workers.dev";

export default function WallpaperGrid({ category, onWallpaperPress, onInitialLoadComplete }: WallpaperGridProps) {
  const [data, setData] = useState<WallpaperItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const columnWidth = Math.floor((width - 40 - 12) / 2);
  const cardHeight = Math.floor(columnWidth * (16 / 9));
  const rowHeight = cardHeight + 12;

  // Guard ref to prevent duplicate onEndReached pagination calls
  const loadingRef = useRef(false);
  const initialLoadFiredRef = useRef(false);

  const fetchWallpapers = async (pageNum: number, isRefresh = false) => {
    if (loadingRef.current || (!hasMore && !isRefresh)) return;
    loadingRef.current = true;
    setLoading(true);

    try {
      let url = `${API_BASE}/api/wallpapers?page=${pageNum}&limit=20`;
      if (category && category !== 'all') {
        url += `&category=${category}`;
      }

      const response = await fetch(url);
      const json = await response.json();

      if (json.data) {
        setData(prev => {
          const newData: WallpaperItem[] = isRefresh ? json.data : [...prev, ...json.data];
          const seen = new Set<string>();
          return newData.filter((item: WallpaperItem) => {
            if (!item || !item.id || seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });
        });
        setHasMore(json.meta?.has_more ?? json.data.length === 20);

        // Signal initial load complete for splash screen coordination
        if (pageNum === 1 && !initialLoadFiredRef.current) {
          initialLoadFiredRef.current = true;
          onInitialLoadComplete?.();
        }
      }
    } catch {
      // Silent error handling - no UI noise
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setData([]);
    setPage(1);
    setHasMore(true);
    initialLoadFiredRef.current = false;
    fetchWallpapers(1, true);
  }, [category]);

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    fetchWallpapers(1, true);
  };

  const handleLoadMore = () => {
    if (hasMore && !loadingRef.current) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchWallpapers(nextPage);
    }
  };

  const handlePress = useCallback((item: WallpaperItem) => {
    onWallpaperPress(item);
  }, [onWallpaperPress]);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: rowHeight,
    offset: 12 + rowHeight * Math.floor(index / 2),
    index,
  }), [rowHeight]);

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator color={Colors.dark.accent} />
      </View>
    );
  };

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.5}
      onRefresh={handleRefresh}
      refreshing={refreshing}
      ListFooterComponent={renderFooter}
      initialNumToRender={8}
      maxToRenderPerBatch={10}
      windowSize={11}
      removeClippedSubviews={Platform.OS === 'android'}
      getItemLayout={getItemLayout}
      renderItem={({ item }) => (
        <WallpaperCard
          item={item}
          onPress={handlePress}
          cardWidth={columnWidth}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100, // Margin to prevent floating tab bar blocking grid
  },
  row: {
    gap: 12,
    marginBottom: 12,
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
