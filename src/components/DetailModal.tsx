import { Colors } from '@/constants/theme';
import { BlurView } from 'expo-blur';
import { File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, NativeModules, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { WallpaperItem } from './WallpaperGrid';

import { enforceCacheLimit } from '@/lib/cacheManager';

interface DetailModalProps {
  item: WallpaperItem | null;
  visible: boolean;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export default function DetailModal({ item, visible, onClose, isFavorite, onToggleFavorite }: DetailModalProps) {
  const [busy, setBusy] = useState(false);
  const c = Colors.dark;

  if (!item) return null;

  const downloadFile = async (): Promise<string | null> => {
    try {
      const filename = `${item.id}.${item.mime_type.split('/')[1] || 'jpg'}`;
      const destinationFile = new File(Paths.document, filename);

      const downloadedFile = await File.downloadFileAsync(item.url_full, destinationFile, { idempotent: true });

      // Enforce the 50MB download cache limit asynchronously
      enforceCacheLimit();

      return downloadedFile.uri;
    } catch {
      Alert.alert("Error", "Failed to download image from server.");
      return null;
    }
  };

  const handleDownload = async () => {
    setBusy(true);
    const { status } = await requestPermissionsAsync(true, ['photo']);
    if (status !== 'granted') {
      Alert.alert("Permission Required", "Please allow gallery access to save wallpapers.");
      setBusy(false);
      return;
    }

    const localUri = await downloadFile();
    if (localUri) {
      try {

        await Asset.create(localUri);
        Alert.alert("Success", "Wallpaper saved to gallery!");
      } catch {
        Alert.alert("Error", "Could not save image to gallery.");
      }
    }
    setBusy(false);
  };

  const applyWallpaper = async (target: 'home' | 'lock' | 'both') => {
    setBusy(true);
    try {
      const localUri = await downloadFile();
      if (!localUri) return;

      await NativeModules.WallepiWallpaper.setWallpaper(localUri, target);
      Alert.alert('Wallpaper set', `Applied to ${target === 'both' ? 'home and lock screens' : `${target} screen`}.`);
    } catch {
      Alert.alert('Error', 'Could not set wallpaper. Please try another image.');
    } finally {
      setBusy(false);
    }
  };

  const handleApply = () => {
    if (Platform.OS !== 'android') {
      Alert.alert('Not Supported', 'Setting wallpaper directly is available on Android only.');
      return;
    }

    if (!NativeModules.WallepiWallpaper) {
      Alert.alert('Update Required', 'Rebuild the Android app to enable setting wallpapers.');
      return;
    }

    Alert.alert('Set wallpaper', 'Choose where to apply this wallpaper.', [
      { text: 'Home screen', onPress: () => applyWallpaper('home') },
      { text: 'Lock screen', onPress: () => applyWallpaper('lock') },
      { text: 'Both', onPress: () => applyWallpaper('both') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const getMbSize = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Image
          source={{ uri: item.url_full }}
          placeholder={item.blurhash ? { blurhash: item.blurhash } : undefined}
          style={styles.image}
          contentFit="cover"
          transition={400}
          cachePolicy="memory-disk"
          priority="high"
        />

        {/* Top Controls Overlay */}
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [styles.circleBtn, pressed && styles.circleBtnPressed]}
            onPress={onClose}
          >
            <SymbolView
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
              tintColor="#fff"
              size={20}
            />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.circleBtn, pressed && styles.circleBtnPressed]}
            onPress={onToggleFavorite}
          >
            <SymbolView
              name={
                isFavorite
                  ? { ios: 'heart.fill', android: 'favorite', web: 'favorite' }
                  : { ios: 'heart', android: 'favorite_border', web: 'favorite_border' }
              }
              tintColor={isFavorite ? c.accent : "#fff"}
              size={20}
            />
          </Pressable>
        </View>

        {/* Loading Overlay */}
        {busy && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={c.accent} />
          </View>
        )}

        {/* Bottom Details panel */}
        <BlurView intensity={40} tint="dark" style={styles.bottomPanel}>
          <View style={styles.btnRow}>
            <Pressable
              style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.btnPressed]}
              onPress={handleDownload}
              disabled={busy}
            >
              <Text style={styles.btnTextSecondary}>Download</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.btnPressed]}
              onPress={handleApply}
              disabled={busy}
            >
              <Text style={styles.btnTextPrimary}>Apply</Text>
            </Pressable>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  topBar: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  circleBtnPressed: {
    transform: [{ scale: 0.90 }],
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  meta: {
    fontSize: 13,
    color: '#707070',
    marginTop: 4,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.85,
  },
  btnPrimary: {
    backgroundColor: Colors.dark.accent,
  },
  btnSecondary: {
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  btnTextPrimary: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000',
  },
  btnTextSecondary: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
});
