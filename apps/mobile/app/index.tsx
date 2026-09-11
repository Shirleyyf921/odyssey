import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Stack, router, useFocusEffect } from 'expo-router'
import { useCallback, type ReactNode } from 'react'
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { HomeEpisode, MomentCard, TonightItem } from '@odyssey/shared'
import { api } from '../src/lib/api'
import { colors, radius, spacing } from '../src/theme'

/**
 * Home (docs/story-pipeline.md, step 5; widened 2026-09-11). Tonight at the
 * head: one card per man and the one story open for him. Under it, so the
 * screen does not end when that card is played: the run to pick up, every
 * episode across the roster, what readers wrote, and his pictures. The
 * relationship is never a stage or a number; it shows through what is open
 * and what a shut card says.
 */
export default function Home() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['home'], queryFn: api.home })
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

  const primary = data.tonight.filter((i) => i.character.kind === 'PRIMARY')
  const explore = data.tonight.filter((i) => i.character.kind === 'EXPLORE')
  const played = data.episodes.filter((e) => e.status === 'DONE').length

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
      <ScrollView contentContainerStyle={styles.list}>
        {data.resume ? (
          <>
            <Text style={styles.section}>Where you left off</Text>
            <ResumeCard episode={data.resume} />
          </>
        ) : null}

        <Text style={styles.tonight}>Tonight</Text>
        {primary.map((item) => <TonightCard key={item.character.id} item={item} />)}
        {explore.length ? <Text style={styles.section}>Also here</Text> : null}
        {explore.map((item) => <TonightCard key={item.character.id} item={item} />)}

        <Text style={styles.section}>Every night there is</Text>
        <Text style={styles.sectionSub}>{played ? `${played} of ${data.episodes.length} played` : `${data.episodes.length} stories across three men`}</Text>
        <Rail>
          {data.episodes.map((e) => <EpisodeTile key={e.id} episode={e} />)}
        </Rail>

        {data.community.length ? (
          <>
            <Text style={styles.section}>Written for them</Text>
            <Rail>
              {data.community.map((e) => <EpisodeTile key={e.id} episode={e} community />)}
            </Rail>
          </>
        ) : null}

        {data.moments.unlocked.length || data.moments.next.length ? (
          <>
            <Text style={styles.section}>His pictures</Text>
            <Rail>
              {data.moments.unlocked.map((m) => <MomentThumb key={m.id} card={m} />)}
              {data.moments.next.map((m) => <MomentThumb key={m.id} card={m} />)}
            </Rail>
          </>
        ) : null}

        {Platform.OS === 'web' ? (
          <Link href="/write" asChild>
            <Pressable style={styles.writeCard}>
              <Text style={styles.writeTitle}>Write one for him</Text>
              <Text style={styles.writeSub}>Where it opens, what he wants, what you can do. He stays himself. A day of Plus every time someone finishes it.</Text>
            </Pressable>
          </Link>
        ) : null}
      </ScrollView>
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

/** Start the relationship if it does not exist yet, then open the stage on an episode. */
function usePlay(characterId: string, characterName: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (episodeId: string) => api.start(characterId).then((r) => ({ ...r, episodeId })),
    onSuccess: ({ relationship, episodeId }) => {
      void qc.invalidateQueries({ queryKey: ['home'] })
      router.push({
        pathname: '/story/[conversationId]',
        params: { conversationId: relationship.conversationId, name: characterName, characterId, episodeId },
      })
    },
  })
}

function TonightCard({ item }: { item: TonightItem }) {
  const { character, episode } = item
  const playable = episode?.status === 'AVAILABLE' || episode?.status === 'IN_PROGRESS'
  const play = usePlay(character.id, character.name)
  const open = () => {
    if (playable && episode) play.mutate(episode.id)
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

/** The one run in progress: a short wide card, straight back onto the stage. */
function ResumeCard({ episode }: { episode: HomeEpisode }) {
  const play = usePlay(episode.characterId, episode.characterName)
  return (
    <Pressable style={styles.resume} onPress={() => play.mutate(episode.id)} disabled={play.isPending}>
      {episode.coverUrl ?? episode.portraitUrl ? <Image source={{ uri: (episode.coverUrl ?? episode.portraitUrl)! }} style={styles.resumeArt} resizeMode="cover" /> : <View style={[styles.resumeArt, styles.artEmpty]} />}
      <View style={styles.resumeText}>
        <Text style={styles.name}>{episode.characterName}</Text>
        <Text style={styles.resumeTitle} numberOfLines={1}>{episode.title}</Text>
        <Text style={styles.status}>Continue · {episode.currentBeat}/{episode.beatCount}</Text>
      </View>
    </Pressable>
  )
}

function tags(e: HomeEpisode): string {
  const parts = [`${e.beatCount} beats`]
  if (e.hasCall) parts.push('he calls')
  if (e.photoCount) parts.push(`${e.photoCount} ${e.photoCount === 1 ? 'picture' : 'pictures'}`)
  if (e.rating === 'MATURE') parts.push('18+')
  return parts.join(' · ')
}

/** One episode in a rail: his portrait (or the picture the ending gave), the title, what is in it, where you are. */
function EpisodeTile({ episode, community }: { episode: HomeEpisode; community?: boolean }) {
  const playable = episode.status === 'AVAILABLE' || episode.status === 'IN_PROGRESS'
  const play = usePlay(episode.characterId, episode.characterName)
  const open = () => {
    if (playable) play.mutate(episode.id)
    else router.push({ pathname: '/character/[id]', params: { id: episode.characterId } })
  }
  const art = episode.coverUrl ?? episode.portraitUrl
  const foot =
    episode.status === 'IN_PROGRESS' ? `Continue · ${episode.currentBeat}/${episode.beatCount}` : episode.status === 'DONE' ? 'Played' : episode.status === 'LOCKED' ? (episode.lockReason ?? 'Not yet') : 'Open'
  return (
    <Pressable style={[styles.tile, !playable && episode.status !== 'DONE' && styles.tileShut]} onPress={open} disabled={play.isPending}>
      {art ? <Image source={{ uri: art }} style={styles.tileArt} resizeMode="cover" /> : <View style={[styles.tileArt, styles.artEmpty]} />}
      <View style={styles.tileScrim} />
      <View style={styles.tileText}>
        <Text style={styles.name}>{community ? `for ${episode.characterName}${episode.authorName ? ` · by ${episode.authorName}` : ''}` : episode.characterName}</Text>
        <Text style={styles.tileTitle} numberOfLines={2}>{episode.title}</Text>
        <Text style={styles.tileTags} numberOfLines={1}>{tags(episode)}</Text>
        <Text style={[styles.tileFoot, !playable && styles.statusMuted]} numberOfLines={1}>{foot}</Text>
      </View>
    </Pressable>
  )
}

/** A picture he gave, or the next one the story will: a small square with a line under it. */
function MomentThumb({ card }: { card: MomentCard }) {
  const locked = card.status === 'LOCKED'
  return (
    <Pressable style={styles.thumbWrap} onPress={() => router.push({ pathname: '/moments/[characterId]', params: { characterId: card.characterId } })}>
      {!locked && card.imageUrl ? (
        <Image source={{ uri: card.imageUrl }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbLocked]}><Text style={styles.lock}>🔒</Text></View>
      )}
      <Text style={styles.thumbTitle} numberOfLines={1}>{card.title}</Text>
      <Text style={styles.thumbSub} numberOfLines={2}>{locked ? (card.story ? `In "${card.story}"` : '') : (card.caption ?? '')}</Text>
    </Pressable>
  )
}

function Rail({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {children}
    </ScrollView>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  tonight: { color: colors.text, fontSize: 28, fontWeight: '700' },
  headerLinks: { flexDirection: 'row', gap: 16 },
  headerLink: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  section: { color: colors.textFaint, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginTop: spacing.sm },
  sectionSub: { color: colors.textMuted, fontSize: 14, marginTop: -spacing.md },
  card: { height: 320, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, justifyContent: 'flex-end' },
  art: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  artEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
  initial: { color: colors.textFaint, fontSize: 72, fontWeight: '700' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 200, backgroundColor: 'rgba(10, 8, 14, 0.72)' },
  cardText: { padding: spacing.lg, gap: 2 },
  name: { color: colors.textMuted, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  premise: { color: colors.textMuted, fontSize: 14, lineHeight: 19 },
  status: { color: colors.accent, fontSize: 13, fontWeight: '600', marginTop: spacing.sm },
  statusMuted: { color: colors.textFaint, fontWeight: '400' },
  resume: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.accent },
  resumeArt: { width: 96, height: 112 },
  resumeText: { flex: 1, padding: spacing.md, justifyContent: 'center', gap: 2 },
  resumeTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  rail: { gap: spacing.md, paddingRight: spacing.lg },
  tile: { width: 150, height: 210, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, justifyContent: 'flex-end' },
  tileShut: { opacity: 0.75 },
  tileArt: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  tileScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 130, backgroundColor: 'rgba(10, 8, 14, 0.78)' },
  tileText: { padding: spacing.sm, gap: 2 },
  tileTitle: { color: colors.text, fontSize: 14, fontWeight: '700', lineHeight: 18 },
  tileTags: { color: colors.textFaint, fontSize: 11 },
  tileFoot: { color: colors.accent, fontSize: 12, fontWeight: '600', marginTop: 2 },
  thumbWrap: { width: 120, gap: 4 },
  thumb: { width: 120, height: 120, borderRadius: radius.md, backgroundColor: colors.surface },
  thumbLocked: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  lock: { fontSize: 22 },
  thumbTitle: { color: colors.text, fontSize: 13, fontWeight: '600' },
  thumbSub: { color: colors.textFaint, fontSize: 11, lineHeight: 14 },
  writeCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: 4, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
  writeTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  writeSub: { color: colors.textMuted, fontSize: 14, lineHeight: 19 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  error: { color: colors.text, fontSize: 16 },
  hint: { color: colors.textFaint, fontSize: 12, textAlign: 'center' },
  button: { backgroundColor: colors.accent, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill },
  buttonText: { color: '#1a0a10', fontWeight: '700' },
})
