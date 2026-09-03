import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { colors } from '../src/theme'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'odyssey' }} />
        <Stack.Screen name="character/[id]" options={{ title: '' }} />
        <Stack.Screen name="chat/[conversationId]" options={{ title: '' }} />
        <Stack.Screen name="moments/[characterId]" options={{ title: 'Moments' }} />
        <Stack.Screen name="account" options={{ title: 'Account', presentation: 'modal' }} />
      </Stack>
    </QueryClientProvider>
  )
}
