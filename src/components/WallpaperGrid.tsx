import React, { useState, useEffect } from 'react';
import { FlatList, View, ActivityIndicator, StyleSheet, Text } from 'react-native';
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
}

interface WallpaperGridProps {
  category?: string;
  onWallpaperPress: (item: WallpaperItem) => void;
}

const API_BASE = "https://wallpaper-api.sudo-dawood.workers.dev";

export default function WallpaperGrid({ category, onWallpaperPress }: WallpaperGridProps) {
  const [data, setData] = useState<WallpaperItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const insets = useSafeAreaInsets();

  const fetchWallpapers = async (pageNum: number, isRefresh = false) => {
    if (loading || (!hasMore && !isRefresh)) return;
    setLoading(true);

    try {
      let url = `${API_BASE}/api/wallpapers?page=${pageNum}&limit=20`;
      if (category && category !== 'all') {
        url += `&category=${category}`;
      }

      const response = await fetch(url);
      const json = await response.json();

      if (json.data) {
        setData(prev => isRefresh ? json.data : [...prev, ...json.data]);
        setHasMore(json.data.length === 20 && pageNum < json.meta.total_pages);
      }
    } catch {
      // Sloped error handling - no UI noise
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setData([]);
    setPage(1);
    setHasMore(true);
    fetchWallpapers(1, true);
  }, [category]);

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    fetchWallpapers(1, true);
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchWallpapers(nextPage);
    }
  };

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
      renderItem={({ item }) => (
        <WallpaperCard
          id={item.id}
          url={item.url_thumb}
          onPress={() => onWallpaperPress(item)}
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
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
