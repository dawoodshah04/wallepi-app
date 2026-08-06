import React, { useRef, useEffect } from 'react';
import { View, Platform } from 'react-native';
import { Tabs, router } from 'expo-router';
import FloatingNavBar from '@/components/FloatingNavBar';
import { BlurTargetView } from 'expo-blur';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';


export default function AppLayout() {
  const targetRef = useRef<View | null>(null);

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setStyle('light');
    }
  }, []);

  return (
    <SafeAreaProvider>
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
    </SafeAreaProvider>
  );
}
