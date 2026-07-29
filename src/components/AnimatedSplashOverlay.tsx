import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface AnimatedSplashOverlayProps {
  isReady: boolean;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');

/**
 * Animated splash overlay that matches the native splash screen.
 * Stays visible while the app loads initial data, then fades out smoothly.
 */
export default function AnimatedSplashOverlay({ isReady }: AnimatedSplashOverlayProps) {
  const [visible, setVisible] = useState(true);
  const [splashHidden, setSplashHidden] = useState(false);

  // Pulse animation for the icon
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    // Subtle breathing/pulse animation
    scale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Glow opacity animation
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.6, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  // Hide the native splash screen once this overlay is mounted
  useEffect(() => {
    if (!splashHidden) {
      SplashScreen.hideAsync().then(() => {
        setSplashHidden(true);
      });
    }
  }, [splashHidden]);

  // When data is ready, trigger exit
  useEffect(() => {
    if (isReady && splashHidden) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setVisible(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isReady, splashHidden]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      exiting={FadeOut.duration(400).easing(Easing.out(Easing.ease))}
      style={styles.container}
    >
      {/* Subtle radial glow behind the icon */}
      <Animated.View style={[styles.glowCircle, glowStyle]} />

      {/* Pulsing icon */}
      <Animated.View style={[styles.iconWrapper, pulseStyle]}>
        <Image
          source={require('@/assets/images/splash-icon.png')}
          style={styles.icon}
          contentFit="contain"
        />
      </Animated.View>

      {/* App name */}
      <Animated.Text style={styles.appName}>Wallepi</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  glowCircle: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 76,
    height: 71,
  },
  appName: {
    marginTop: 20,
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 1,
  },
});
