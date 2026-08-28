import { AuthProvider } from '@/features/auth';
import { useTheme } from '@/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      // The app is read-mostly and content changes weekly; refetching on every
      // focus would burn a reader's data for nothing.
      refetchOnWindowFocus: false,
      staleTime: 60 * 1000,
    },
  },
});

export default function RootLayout() {
  const { colors, scheme } = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
                // Spring-driven rather than a fixed curve, so an interrupted
                // gesture keeps its momentum instead of restarting.
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="article/[slug]" />
              <Stack.Screen
                name="sign-in"
                options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
              />
              <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
            </Stack>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
