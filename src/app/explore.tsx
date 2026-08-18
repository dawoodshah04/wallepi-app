import React from 'react';
import { View, StyleSheet, FlatList, Pressable, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';

interface CategoryItem {
  name: string;
  countKey: string;
  image: string;
}

const CATEGORIES: CategoryItem[] = [
  { name: 'Nature', countKey: 'nature', image: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&auto=format&fit=crop&q=80' },
  { name: 'Space', countKey: 'space', image: 'https://images.unsplash.com/photo-1451186859696-371d9477be93?w=400&auto=format&fit=crop&q=80' },
  { name: 'Dark', countKey: 'dark', image: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=400&auto=format&fit=crop&q=80' },
  { name: 'Art', countKey: 'art', image: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400&auto=format&fit=crop&q=80' },
  { name: 'City', countKey: 'city', image: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&auto=format&fit=crop&q=80' },
  { name: 'Water', countKey: 'water', image: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=400&auto=format&fit=crop&q=80' },
  { name: 'Mountain', countKey: 'mountain', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&auto=format&fit=crop&q=80' },
  { name: 'Architecture', countKey: 'architecture', image: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400&auto=format&fit=crop&q=80' },
  { name: 'Minimal', countKey: 'minimal', image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80' },
];

export default function ExploreScreen() {
  const handleCategoryPress = (category: string) => {
    router.navigate({
      pathname: '/',
      params: { category: category.toLowerCase() },
    });
  };

  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safeArea}>
        <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top + 8 : 16 }]}>
          <ThemedText type="title">Categories</ThemedText>
        </View>

        <FlatList
          data={CATEGORIES}
          keyExtractor={(item) => item.name}
          contentContainerStyle={[styles.listContainer, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => handleCategoryPress(item.countKey)}>
              <Image source={{ uri: item.image }} style={styles.image} contentFit="cover" transition={0} cachePolicy="memory-disk" />
              <View style={styles.overlay}>
                <ThemedText type="subtitle" style={styles.titleText}>{item.name}</ThemedText>
                <ThemedText style={styles.countText}>View Wallpapers</ThemedText>
              </View>
            </Pressable>
          )}
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
  card: {
    width: '100%',
    height: 120,
    borderRadius: 24,
    backgroundColor: Colors.dark.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: 'hidden',
    marginBottom: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    paddingLeft: 24,
  },
  titleText: {
    color: '#fff',
    fontWeight: '800',
  },
  countText: {
    fontSize: 12,
    color: Colors.dark.accent,
    marginTop: 4,
    fontWeight: '700',
  },
});
