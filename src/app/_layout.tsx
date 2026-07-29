import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { View, Platform } from 'react-native';
import { Tabs, router } from 'expo-router';
import FloatingNavBar from '@/components/FloatingNavBar';
import AnimatedSplashOverlay from '@/components/AnimatedSplashOverlay';
import { AppReadyContext } from '@/lib/appReadyContext';
import { BlurTargetView } from 'expo-blur';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the native splash from auto-hiding so we can hand off to AnimatedSplashOverlay
SplashScreen.preventAutoHideAsync();

export default function AppLayout() {
  const targetRef = useRef<View | null>(null);
  const [appReady, setAppReady] = useState(false);

  const signalReady = useCallback(() => {
    setAppReady(true);
  }, []);

  const contextValue = useMemo(() => ({ signalReady }), [signalReady]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setStyle('light');
    }
  }, []);

  // Safety timeout — never leave splash visible for more than 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppReady(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaProvider>
      <AppReadyContext.Provider value={contextValue}>
        <BlurTargetView ref={targetRef} style={{ flex: 1 }}>
          <Tabs
            screenOptions={{
              headerShown: false,
            }}
            tabBar={(props) => {
              // Find current route name
              const state = props.state;
              const currentTabName = state.routes[state.index]?.name as 'index' | 'explore' | 'favorites';

              return (
                <FloatingNavBar
                  currentTab={currentTabName}
                  blurTarget={targetRef}
                  onTabSelect={(name) => {
                    router.navigate(name === 'index' ? '/' : `/${name}`);
                  }}
                />
              );
            }}
          >
            <Tabs.Screen name="index" />
            <Tabs.Screen name="explore" />
            <Tabs.Screen name="favorites" />
          </Tabs>
        </BlurTargetView>

        {/* Animated splash overlay — stays on top until initial data is loaded */}
        <AnimatedSplashOverlay isReady={appReady} />
      </AppReadyContext.Provider>
    </SafeAreaProvider>
  );
}
