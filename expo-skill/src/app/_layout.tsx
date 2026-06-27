// import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
// import React from 'react';
// import { useColorScheme } from 'react-native';

// import { AnimatedSplashOverlay } from '@/components/animated-icon';
// import AppTabs from '@/components/app-tabs';

// export default function TabLayout() {
//   const colorScheme = useColorScheme();
//   return (
//     <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
//       <AnimatedSplashOverlay />
//       <AppTabs />
//     </ThemeProvider>
//   );
// }

//  setImmediate polyfill for React Native 
if (!globalThis.setImmediate) {
    globalThis.setImmediate = (cb: () => void) => setTimeout(cb, 0);
    globalThis.clearImmediate = (timerId: number) => clearTimeout(timerId);
}
import { Stack } from 'expo-router';
export default function LayoutView() {
    return (<Stack>
        <Stack.Screen name="index" options={{ headerTitle: "工具箱" }} />
    </Stack>);
}