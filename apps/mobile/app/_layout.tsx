import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { api } from '../src/lib/api'
import { billing } from '../src/lib/billing'
import { colors } from '../src/theme'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

/** Keeps RevenueCat bound to whoever /me says we are. Renders nothing. */
function BillingIdentity() {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const userId = me.data?.user.id
  useEffect(() => {
    if (userId) void billing.identify(userId)
  }, [userId])
  return null
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <BillingIdentity />
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
        <Stack.Screen
          name="story/[conversationId]"
          options={{ title: '', headerTransparent: true, headerStyle: { backgroundColor: 'transparent' } }}
        />
        <Stack.Screen name="moments/[characterId]" options={{ title: 'Moments' }} />
        <Stack.Screen name="account" options={{ title: 'Account', presentation: 'modal' }} />
        <Stack.Screen name="review" options={{ title: 'Review' }} />
        <Stack.Screen name="write/index" options={{ title: 'Write for him' }} />
        <Stack.Screen name="write/[id]" options={{ title: '' }} />
      </Stack>
    </QueryClientProvider>
  )
}
