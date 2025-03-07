import { Stack } from 'expo-router';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import '@/global.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <GluestackUIProvider mode={'light'}>
      <QueryClientProvider client={queryClient}>
        <Stack>
          <Stack.Screen
            name={'index'}
            options={{ title: 'Home', headerShown: false }}
          />
          <Stack.Screen name={'chat'} options={{ title: 'ReView' }} />
        </Stack>
      </QueryClientProvider>
    </GluestackUIProvider>
  );
}
