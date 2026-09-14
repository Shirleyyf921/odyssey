import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MomentTile } from '../../src/components/MomentTile'
import { api } from '../../src/lib/api'
import { billing } from '../../src/lib/billing'
import { colors, spacing } from '../../src/theme'

/**
 * What you have of his, direction B: a title, a count in words, and a grid of
 * pictures with lines under them. Locked and unlocked share one layout so the
 * user sees what there is to earn.
 */
export default function MomentsScreen() {
  const { characterId, name } = useLocalSearchParams<{ characterId: string; name?: string }>()
  const insets = useSafeAreaInsets()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['moments', characterId],
    queryFn: () => api.moments(characterId),
    enabled: !!characterId,
  })
  useFocusEffect(useCallback(() => void refetch(), [refetch]))
  const qc = useQueryClient()
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const [pendingSku, setPendingSku] = useState<string | null>(null)
  const purchase = useMutation({
    mutationFn: (sku: string) => billing.purchaseSku(sku),
    onMutate: (sku) => {
      setPurchaseError(null)
      setPendingSku(sku)
    },
    onError: (err) => setPurchaseError(err instanceof Error ? err.message : String(err)),
    onSettled: () => {
      setPendingSku(null)
      void qc.invalidateQueries({ queryKey: ['moments', characterId] })
      void qc.invalidateQueries({ queryKey: ['me'] })
    },
  })
  // Purchase UI needs both the store SDK in this build and RevenueCat configured on the server.
  const canBuy = billing.available && me.data?.billing.enabled === true && !!data?.relationship

  if (isLoading) return <View style={styles.centered}><ActivityIndicator color={colors.ink} /></View>
  if (error || !data) return <View style={styles.centered}><Text style={styles.error}>{String(error ?? 'Not found')}</Text></View>

  const unlocked = data.moments.filter((m) => m.status === 'UNLOCKED').length
  const line = !data.relationship
    ? 'Say hello and he starts giving you these.'
    : unlocked === 0
      ? `Nothing yet. He has ${data.moments.length} to give.`
      : unlocked === data.moments.length
        ? 'All of them. Every one.'
        : `${unlocked} of ${data.moments.length} are yours.`

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <FlatList
        data={data.moments}
        keyExtractor={(m) => m.id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={[styles.grid, { paddingTop: insets.top + 12 }]}
        ListHeaderComponent={
          <View style={styles.head}>
            <Pressable style={styles.back} onPress={() => router.back()} hitSlop={10}>
              <Text style={styles.backText}>‹</Text>
              <Text style={styles.backLabel}>{name ?? 'Him'}</Text>
            </Pressable>
            <Text style={styles.title}>Photos</Text>
            <Text style={styles.muted}>{line}</Text>
            {purchaseError && <Text style={styles.purchaseError}>{purchaseError}</Text>}
          </View>
        }
        renderItem={({ item }) => (
          <MomentTile
            card={item}
            onUnlock={canBuy ? (sku) => purchase.mutate(sku) : undefined}
            unlocking={item.unlock.kind === 'PURCHASE' && pendingSku === item.unlock.sku}
          />
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  head: { gap: 6, marginBottom: spacing.sm },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  backText: { color: colors.ink, fontSize: 28, lineHeight: 28, marginTop: -4 },
  backLabel: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  purchaseError: { color: colors.ink, fontSize: 13 },
  grid: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.lg },
  column: { gap: spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.ground },
  error: { color: colors.ink, textAlign: 'center' },
})
