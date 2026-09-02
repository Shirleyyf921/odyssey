import { useQuery } from '@tanstack/react-query'
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native'
import { MomentTile } from '../../src/components/MomentTile'
import { api } from '../../src/lib/api'
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

  if (isLoading) return <View style={styles.centered}><ActivityIndicator color={colors.accent} /></View>
  if (error || !data) return <View style={styles.centered}><Text style={styles.error}>{String(error ?? 'Not found')}</Text></View>

  const unlocked = data.moments.filter((m) => m.status === 'UNLOCKED').length

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: name ? `${name} · Moments` : 'Moments' }} />
      <Text style={styles.count}>{unlocked} of {data.moments.length} unlocked</Text>
      {!data.relationship && <Text style={styles.hint}>Start talking to begin unlocking.</Text>}
      <FlatList
        data={data.moments}
        keyExtractor={(m) => m.id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => <MomentTile card={item} />}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  count: { color: colors.textMuted, fontSize: 13, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  hint: { color: colors.textFaint, fontSize: 13, paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  grid: { padding: spacing.lg, gap: spacing.lg },
  column: { gap: spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  error: { color: colors.danger, textAlign: 'center' },
})
