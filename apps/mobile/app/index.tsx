import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Stack, router, useFocusEffect } from 'expo-router'
import { useCallback } from 'react'
import { ActivityIndicator, FlatList, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import type { TonightItem } from '@odyssey/shared'
import { api } from '../src/lib/api'
import { colors, radius, spacing } from '../src/theme'

/**
 * Tonight (docs/story-pipeline.md, step 5). One card per man: him, and the one
 * story that is open for him right now. The relationship is not shown as a
 * stage or a number; it shows through which story is there and what a locked
 * card says. Tapping a playable card goes straight to the stage.
 */
export default function Home() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['tonight'], queryFn: api.tonight })
  useFocusEffect(useCallback(() => void refetch(), [refetch]))

  if (isLoading) return <Centered><ActivityIndicator color={colors.accent} /></Centered>
  if (error || !data) {
    return (
      <Centered>
        <Text style={styles.error}>Could not reach the server.</Text>
        <Text style={styles.hint}>{String(error)}</Text>
        <Pressable onPress={() => refetch()} style={styles.button}><Text style={styles.buttonText}>Retry</Text></Pressable>
      </Centered>
    )
  }

  const primary = data.items.filter((i) => i.character.kind === 'PRIMARY')
  const explore = data.items.filter((i) => i.character.kind === 'EXPLORE')

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerLinks}>
              {Platform.OS === 'web' && (
                <Link href="/write" asChild>
                  <Pressable hitSlop={8}><Text style={styles.headerLink}>Write</Text></Pressable>
                </Link>
              )}
              <Link href="/account" asChild>
                <Pressable hitSlop={8}><Text style={styles.headerLink}>Account</Text></Pressable>
              </Link>
            </View>
          ),
        }}
      />
      <FlatList
        data={[...primary, ...explore]}
        keyExtractor={(i) => i.character.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.lg }} />}
        ListHeaderComponent={<Text style={styles.tonight}>Tonight</Text>}
        renderItem={({ item, index }) => (
          <>
            {index === primary.length && explore.length > 0 && <Text style={styles.section}>Also here</Text>}
            <TonightCard item={item} />
          </>
        )}
      />
    </>
  )
}

function statusLine(item: TonightItem): string {
  const { episode, character } = item
  if (!episode) return character.relationship ? 'Nothing new tonight. He is still up.' : 'Say hello.'
  switch (episode.status) {
    case 'IN_PROGRESS':
      return `Where you left off · ${episode.currentBeat}/${episode.beatCount}`
    case 'AVAILABLE':
      return 'Open'
    case 'DONE':
      return 'Played. Nothing new tonight.'
    case 'LOCKED':
      return episode.lockReason ?? 'Not yet'
  }
}

function TonightCard({ item }: { item: TonightItem }) {
  const qc = useQueryClient()
  const { character, episode } = item
  const playable = episode?.status === 'AVAILABLE' || episode?.status === 'IN_PROGRESS'

  // Playable: start the relationship if it does not exist yet, then open the stage.
  const play = useMutation({
    mutationFn: () => api.start(character.id),
    onSuccess: ({ relationship }) => {
      void qc.invalidateQueries({ queryKey: ['tonight'] })
      router.push({
        pathname: '/story/[conversationId]',
        params: { conversationId: relationship.conversationId, name: character.name, characterId: character.id, episodeId: episode!.id },
      })
    },
  })
  const open = () => {
    if (playable) play.mutate()
    else router.push({ pathname: '/character/[id]', params: { id: character.id } })
  }

  return (
    <Pressable style={styles.card} onPress={open} disabled={play.isPending}>
      {character.portraitUrl ? (
        <Image source={{ uri: character.portraitUrl }} style={styles.art} resizeMode="cover" />
      ) : (
        <View style={[styles.art, styles.artEmpty]}><Text style={styles.initial}>{character.name.slice(0, 1)}</Text></View>
      )}
      <View style={styles.scrim} />
      <View style={styles.cardText}>
        <Text style={styles.name}>{character.name}</Text>
        {episode ? (
          <>
            <Text style={styles.title}>{episode.title}</Text>
            <Text style={styles.premise} numberOfLines={2}>{episode.premise}</Text>
          </>
        ) : (
          <Text style={styles.premise} numberOfLines={2}>{character.tagline}</Text>
        )}
        <Text style={[styles.status, !playable && styles.statusMuted]}>{statusLine(item)}</Text>
      </View>
    </Pressable>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg },
  tonight: { color: colors.text, fontSize: 28, fontWeight: '700', marginBottom: spacing.lg },
  headerLinks: { flexDirection: 'row', gap: 16 },
  headerLink: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  section: { color: colors.textFaint, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.md, marginTop: spacing.sm },
  card: { height: 320, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, justifyContent: 'flex-end' },
  art: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  artEmpty: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.textFaint, fontSize: 72, fontWeight: '700' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 200, backgroundColor: 'rgba(10, 8, 14, 0.72)' },
  cardText: { padding: spacing.lg, gap: 2 },
  name: { color: colors.textMuted, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  premise: { color: colors.textMuted, fontSize: 14, lineHeight: 19 },
  status: { color: colors.accent, fontSize: 13, fontWeight: '600', marginTop: spacing.sm },
  statusMuted: { color: colors.textFaint, fontWeight: '400' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  error: { color: colors.text, fontSize: 16 },
  hint: { color: colors.textFaint, fontSize: 12, textAlign: 'center' },
  button: { backgroundColor: colors.accent, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill },
  buttonText: { color: '#1a0a10', fontWeight: '700' },
})
