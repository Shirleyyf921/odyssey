import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native'
import { MomentTile } from '../../src/components/MomentTile'
import { api } from '../../src/lib/api'
import { billing } from '../../src/lib/billing'
import { colors, spacing } from '../../src/theme'

/** Collectibles grid. Locked and unlocked share one layout so the user sees what is there to earn. */
export default function MomentsScreen() {
  const { characterId, name } = useLocalSearchParams<{ characterId: string; name?: string }>()
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

  if (isLoading) return <View style={styles.centered}><ActivityIndicator color={colors.accent} /></View>
  if (error || !data) return <View style={styles.centered}><Text style={styles.error}>{String(error ?? 'Not found')}</Text></View>

  const unlocked = data.moments.filter((m) => m.status === 'UNLOCKED').length

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: name ? `${name} · Moments` : 'Moments' }} />
      <Text style={styles.count}>{unlocked} of {data.moments.length} unlocked</Text>
      {!data.relationship && <Text style={styles.hint}>Start talking to begin unlocking.</Text>}
      {purchaseError && <Text style={styles.purchaseError}>{purchaseError}</Text>}
      <FlatList
        data={data.moments}
        keyExtractor={(m) => m.id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.grid}
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
  screen: { flex: 1, backgroundColor: colors.bg },
  count: { color: colors.textMuted, fontSize: 13, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  hint: { color: colors.textFaint, fontSize: 13, paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  purchaseError: { color: colors.danger, fontSize: 13, paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  grid: { padding: spacing.lg, gap: spacing.lg },
  column: { gap: spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  error: { color: colors.danger, textAlign: 'center' },
})
