import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Portrait } from '../../src/components/Portrait'
import { api } from '../../src/lib/api'
import { colors, radius, spacing } from '../../src/theme'

/** Character page: identity images, who he is, and the way into the conversation. */
export default function CharacterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const qc = useQueryClient()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['character', id], queryFn: () => api.character(id), enabled: !!id })
  // Stage and moments move while chatting; pick that up when the user comes back.
  useFocusEffect(useCallback(() => void refetch(), [refetch]))

  const start = useMutation({
    mutationFn: () => api.start(id),
    onSuccess: ({ relationship }) => {
      qc.invalidateQueries({ queryKey: ['characters'] })
      qc.invalidateQueries({ queryKey: ['character', id] })
      router.push({ pathname: '/chat/[conversationId]', params: { conversationId: relationship.conversationId, name: data?.name ?? '' } })
    },
  })

  if (isLoading) return <View style={styles.centered}><ActivityIndicator color={colors.accent} /></View>
  if (error || !data) return <View style={styles.centered}><Text style={styles.error}>{String(error ?? 'Not found')}</Text></View>

  const [hero, ...rest] = data.portraits
  const rel = data.relationship

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: data.name }} />
      <Portrait url={hero?.url ?? null} name={data.name} />
      {rest.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {rest.map((p) => <Portrait key={p.id} url={p.url} name={data.name} style={styles.stripItem} />)}
        </ScrollView>
      )}

      <Text style={styles.name}>{data.name}</Text>
      <Text style={styles.tagline}>{data.tagline}</Text>
      {rel && <Text style={styles.stage}>{rel.stage.toLowerCase()} · since {new Date(rel.startedAt).toLocaleDateString()}</Text>}

      <Pressable
        style={[styles.primaryButton, start.isPending && styles.disabled]}
        disabled={start.isPending}
        onPress={() =>
          rel
            ? router.push({ pathname: '/chat/[conversationId]', params: { conversationId: rel.conversationId, name: data.name } })
            : start.mutate()
        }
      >
        <Text style={styles.primaryText}>{rel ? 'Continue talking' : 'Start talking'}</Text>
      </Pressable>
      {start.error && <Text style={styles.error}>{String(start.error)}</Text>}

      <Pressable
        style={styles.secondaryButton}
        onPress={() => router.push({ pathname: '/moments/[characterId]', params: { characterId: id, name: data.name } })}
      >
        <Text style={styles.secondaryText}>Moments · {data.momentCount}</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  strip: { gap: spacing.sm },
  stripItem: { width: 96 },
  name: { color: colors.text, fontSize: 28, fontWeight: '700', marginTop: spacing.sm },
  tagline: { color: colors.textMuted, fontSize: 16 },
  stage: { color: colors.accent, fontSize: 13 },
  primaryButton: { backgroundColor: colors.accent, paddingVertical: 14, borderRadius: radius.pill, alignItems: 'center', marginTop: spacing.lg },
  primaryText: { color: '#1a0a10', fontSize: 16, fontWeight: '700' },
  secondaryButton: { borderWidth: 1, borderColor: colors.border, paddingVertical: 14, borderRadius: radius.pill, alignItems: 'center' },
  secondaryText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  error: { color: colors.danger, textAlign: 'center' },
})
