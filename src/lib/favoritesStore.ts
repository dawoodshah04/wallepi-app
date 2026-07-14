import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WallpaperItem } from "@/components/WallpaperGrid";

const KEY = "wallepi_favorites";

export async function getFavorites(): Promise<WallpaperItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveFavorites(list: WallpaperItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

