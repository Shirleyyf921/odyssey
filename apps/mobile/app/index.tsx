import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LinearGradient } from 'expo-linear-gradient'
import { Link, Stack, router, useFocusEffect } from 'expo-router'
import { useCallback, type ReactNode } from 'react'
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { HomeEpisode, MomentCard, TonightItem } from '@odyssey/shared'
import { api } from '../src/lib/api'
import { usePaywall } from '../src/store/paywall'
import { colors, radius, spacing } from '../src/theme'

/**
 * Home, in direction B (the design canvas, 2026-09-12). Tonight is one
 * full-bleed hero: the primary, his story, one ink pill to open it. The
 * other men are landscape tiles under it; the run to pick up sits above the
 * hero when there is one; every episode across the roster, what readers
 * wrote, and his pictures are rails. No boxes, no global pink: the only colour
 * on the screen is each man's own accent, on his name.
 */
export default function Home() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['home'], queryFn: api.home })
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  useFocusEffect(useCallback(() => void refetch(), [refetch]))

  if (isLoading) return <Centered><ActivityIndicator color={colors.ink} /></Centered>
  if (error || !data) {
    return (
      <Centered>
        <Text style={styles.error}>Could not reach the server.</Text>
        <Text style={styles.hint}>{String(error)}</Text>
        <Pressable onPress={() => refetch()} style={styles.pill}><Text style={styles.pillText}>Retry</Text></Pressable>
      </Centered>
    )
  }

  const primary = data.tonight.find((i) => i.character.kind === 'PRIMARY') ?? data.tonight[0] ?? null
  const others = data.tonight.filter((i) => i !== primary)
  const played = data.episodes.filter((e) => e.status === 'DONE').length
  const heroHeight = Math.round(Math.min(width * 1.3, 560))

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {/* Tonight: him, full-bleed, and the one story open for him. */}
        {primary ? <Hero item={primary} height={heroHeight} top={insets.top} full={data.episodes.find((e) => e.id === primary.episode?.id) ?? null} /> : null}

        {data.resume ? (
          <Section label="Where you left off">
            <ResumeRow episode={data.resume} />
          </Section>
        ) : null}

        {others.length ? (
          <Section label="Also here">
            <View style={styles.tiles}>
              {others.map((item) => <ManTile key={item.character.id} item={item} />)}
            </View>
          </Section>
        ) : null}

        <Section label="Every night there is" aside={played ? `${played} of ${data.episodes.length} played` : `${data.episodes.length} stories`}>
          <Rail>
            {data.episodes.map((e) => <EpisodeTile key={e.id} episode={e} />)}
          </Rail>
        </Section>

        {data.community.length ? (
          <Section label="Written for them">
            <Rail>
              {data.community.map((e) => <EpisodeTile key={e.id} episode={e} community />)}
            </Rail>
          </Section>
        ) : null}

        {data.moments.unlocked.length || data.moments.next.length ? (
          <Section label="His pictures" aside={`${data.moments.unlocked.length} given`}>
            <Rail>
              {data.moments.unlocked.map((m) => <MomentThumb key={m.id} card={m} />)}
              {data.moments.next.map((m) => <MomentThumb key={m.id} card={m} />)}
            </Rail>
          </Section>
        ) : null}

        {Platform.OS === 'web' ? (
          <Link href="/write" asChild>
            <Pressable style={styles.writeRow}>
              <View style={styles.grow}>
                <Text style={styles.writeTitle}>Write one for him</Text>
                <Text style={styles.muted}>Where it opens, what he wants, what you can do. A day of Plus every time someone finishes it.</Text>
              </View>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          </Link>
        ) : null}
      </ScrollView>
    </>
  )
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

function tags(e: HomeEpisode): string {
  const parts = [`${e.beatCount} beats`]
  if (e.hasCall) parts.push('he calls')
  if (e.photoCount) parts.push(`${e.photoCount} ${e.photoCount === 1 ? 'picture' : 'pictures'}`)
  if (e.rating === 'MATURE') parts.push('18+')
  return parts.join(' · ')
}

/** Where the card leads: the paywall for a Plus lock, the chat when he wrote first, the stage when open, else his page. */
function useOpen(item: TonightItem) {
  const { character, episode, reachOut } = item
  const play = usePlay(character.id, character.name)
  const playable = episode?.status === 'AVAILABLE' || episode?.status === 'IN_PROGRESS'
  const open = () => {
    if (episode?.status === 'LOCKED' && episode.unlock.kind === 'PLUS') return usePaywall.getState().open('EPISODE')
    if (reachOut && character.relationship) {
      return router.push({ pathname: '/chat/[conversationId]', params: { conversationId: character.relationship.conversationId, name: character.name, characterId: character.id } })
    }
    if (playable && episode) play.mutate(episode.id)
    else router.push({ pathname: '/character/[id]', params: { id: character.id } })
  }
  return { open, playable, pending: play.isPending }
}

/** His message without the leading action beat, for a card; the chat shows the beat. */
function stripBeat(text: string): string {
  return text.replace(/^\*[^*]*\*\s*/, '').trim() || text
}

function statusLine(item: TonightItem): string {
  const { episode, character } = item
  if (!episode) return character.relationship ? 'Nothing new tonight. He is still up.' : 'Say hello'
  switch (episode.status) {
    case 'IN_PROGRESS':
      return `Continue · ${episode.currentBeat}/${episode.beatCount}`
    case 'AVAILABLE':
      return 'Open'
    case 'DONE':
      return 'Played'
    case 'LOCKED':
      return episode.lockReason ?? 'Not yet'
  }
}

/** Tonight: the primary, full-bleed, the story under his name, one ink pill. */
function Hero({ item, height, top, full }: { item: TonightItem; height: number; top: number; full: HomeEpisode | null }) {
  const { character, episode, reachOut } = item
  const { open, playable, pending } = useOpen(item)
  const tagLine = full ? tags(full) : episode ? `${episode.beatCount} beats` : ''
  return (
    <View style={[styles.hero, { height }]}>
      {character.portraitUrl ? <Image source={{ uri: character.portraitUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <View style={[StyleSheet.absoluteFill, styles.artEmpty]} />}
      <LinearGradient pointerEvents="none" colors={['rgba(5,5,7,0.5)', 'rgba(5,5,7,0)']} style={[styles.heroTop, { height: top + 90 }]} />
      <LinearGradient pointerEvents="none" colors={['rgba(5,5,7,0)', 'rgba(5,5,7,0.86)', colors.ground]} locations={[0, 0.62, 1]} style={styles.heroBottom} />
      <View style={[styles.header, { top: top + 12 }]}>
        <Text style={styles.brand}>odyssey</Text>
        <View style={styles.headerLinks}>
          {Platform.OS === 'web' ? (
            <Link href="/write" asChild><Pressable hitSlop={8}><Text style={styles.headerLink}>Write</Text></Pressable></Link>
          ) : null}
          <Link href="/account" asChild><Pressable hitSlop={8}><Text style={styles.headerLink}>Account</Text></Pressable></Link>
        </View>
      </View>
      <Pressable style={styles.heroText} onPress={open} disabled={pending}>
        <Text style={[styles.kicker, { color: character.accent }]}>Tonight · {character.name}</Text>
        {reachOut ? (
          <>
            <Text style={styles.heroTitle}>He wrote while you were gone</Text>
            <Text style={styles.heroPremise} numberOfLines={3}>{stripBeat(reachOut.content)}</Text>
            <View style={styles.heroActions}><View style={styles.pill}><Text style={styles.pillText}>Answer him</Text></View></View>
          </>
        ) : episode ? (
          <>
            <Text style={styles.heroTitle}>{episode.title}</Text>
            <Text style={styles.heroPremise} numberOfLines={2}>{episode.premise}</Text>
            <View style={styles.heroActions}>
              <View style={[styles.pill, !playable && styles.pillShut]}><Text style={[styles.pillText, !playable && styles.pillShutText]}>{statusLine(item)}</Text></View>
              <Text style={styles.faint}>{tagLine}</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.heroTitle}>{character.name}</Text>
            <Text style={styles.heroPremise} numberOfLines={2}>{character.tagline}</Text>
            <View style={styles.heroActions}><View style={styles.pill}><Text style={styles.pillText}>{statusLine(item)}</Text></View></View>
          </>
        )}
      </Pressable>
    </View>
  )
}

/** Another man: a landscape tile, his portrait behind, his name in his colour. */
function ManTile({ item }: { item: TonightItem }) {
  const { character, episode, reachOut } = item
  const { open, pending } = useOpen(item)
  return (
    <Pressable style={styles.tile} onPress={open} disabled={pending}>
      {character.portraitUrl ? <Image source={{ uri: character.portraitUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <View style={[StyleSheet.absoluteFill, styles.artEmpty]} />}
      <LinearGradient pointerEvents="none" colors={['rgba(5,5,7,0)', 'rgba(5,5,7,0.92)']} locations={[0.3, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.tileText}>
        <Text style={[styles.kickerSmall, { color: character.accent }]}>{character.name}</Text>
        <Text style={styles.tileTitle} numberOfLines={2}>{reachOut ? 'He wrote while you were gone' : (episode?.title ?? character.tagline)}</Text>
        <Text style={styles.tileFoot} numberOfLines={1}>{reachOut ? 'Answer him' : episode ? `${statusLine(item)} · ${episode.beatCount} beats${episode.rating === 'MATURE' ? ' · 18+' : ''}` : statusLine(item)}</Text>
      </View>
    </Pressable>
  )
}

/** The one run in progress: a short row, straight back onto the stage. */
function ResumeRow({ episode }: { episode: HomeEpisode }) {
  const play = usePlay(episode.characterId, episode.characterName)
  const art = episode.coverUrl ?? episode.portraitUrl
  return (
    <Pressable style={styles.resume} onPress={() => play.mutate(episode.id)} disabled={play.isPending}>
      {art ? <Image source={{ uri: art }} style={styles.resumeArt} resizeMode="cover" /> : <View style={[styles.resumeArt, styles.artEmpty]} />}
      <View style={styles.grow}>
        <Text style={[styles.kickerSmall, { color: episode.accent }]}>{episode.characterName}</Text>
        <Text style={styles.resumeTitle} numberOfLines={1}>{episode.title}</Text>
        <Text style={styles.muted}>Continue · {episode.currentBeat}/{episode.beatCount}</Text>
      </View>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  )
}

/** One episode in a rail: his portrait or the picture the ending gave, the title, what is in it, where you are. */
function EpisodeTile({ episode, community }: { episode: HomeEpisode; community?: boolean }) {
  const playable = episode.status === 'AVAILABLE' || episode.status === 'IN_PROGRESS'
  const play = usePlay(episode.characterId, episode.characterName)
  const open = () => {
    if (episode.status === 'LOCKED' && episode.unlock.kind === 'PLUS') return usePaywall.getState().open('EPISODE')
    if (playable) play.mutate(episode.id)
    else router.push({ pathname: '/character/[id]', params: { id: episode.characterId } })
  }
  const art = episode.coverUrl ?? episode.portraitUrl
  const foot = episode.status === 'IN_PROGRESS' ? `Continue · ${episode.currentBeat}/${episode.beatCount}` : episode.status === 'DONE' ? 'Played' : episode.status === 'LOCKED' ? (episode.lockReason ?? 'Not yet') : 'Open'
  return (
    <Pressable style={[styles.card, !playable && episode.status !== 'DONE' && styles.cardShut]} onPress={open} disabled={play.isPending}>
      {art ? <Image source={{ uri: art }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <View style={[StyleSheet.absoluteFill, styles.artEmpty]} />}
      <LinearGradient pointerEvents="none" colors={['rgba(5,5,7,0)', 'rgba(5,5,7,0.94)']} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.cardText}>
        <Text style={[styles.kickerSmall, { color: episode.accent }]} numberOfLines={1}>{community ? `for ${episode.characterName}${episode.authorName ? ` · ${episode.authorName}` : ''}` : episode.characterName}</Text>
        <Text style={styles.cardTitle} numberOfLines={2}>{episode.title}</Text>
        <Text style={styles.faint} numberOfLines={1}>{tags(episode)}</Text>
        <Text style={styles.cardFoot} numberOfLines={1}>{foot}</Text>
      </View>
    </Pressable>
  )
}

/** A picture he gave, or the next one the story will: a square with a line under it. Locked ones are dim, no glyph. */
function MomentThumb({ card }: { card: MomentCard }) {
  const locked = card.status === 'LOCKED'
  return (
    <Pressable style={styles.thumbWrap} onPress={() => router.push({ pathname: '/moments/[characterId]', params: { characterId: card.characterId } })}>
      <View style={styles.thumb}>
        {!locked && card.imageUrl ? (
          <Image source={{ uri: card.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : card.teaserUrl ? (
          <Image source={{ uri: card.teaserUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={16} />
        ) : null}
        {locked ? <View style={styles.thumbLock}><Lock /></View> : null}
      </View>
      <Text style={styles.thumbTitle} numberOfLines={1}>{card.title}</Text>
      <Text style={styles.thumbSub} numberOfLines={2}>{locked ? (card.story ? `In "${card.story}"` : '') : (card.caption ?? '')}</Text>
    </Pressable>
  )
}

/** A lock drawn with two views, so no emoji ever ships. */
function Lock() {
  return (
    <View style={styles.lock}>
      <View style={styles.lockShackle} />
      <View style={styles.lockBody} />
    </View>
  )
}

function Section({ label, aside, children }: { label: string; aside?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.label}>{label}</Text>
        {aside ? <Text style={styles.faint}>{aside}</Text> : null}
      </View>
      {children}
    </View>
  )
}

function Rail({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail} style={styles.railWrap}>
      {children}
    </ScrollView>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  artEmpty: { backgroundColor: '#0f0e12' },
  content: { paddingBottom: spacing.xxl, gap: spacing.xl },
  hero: { width: '100%', backgroundColor: colors.ground, justifyContent: 'flex-end' },
  heroTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  heroBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },
  header: { position: 'absolute', left: spacing.xl, right: spacing.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: colors.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  headerLinks: { flexDirection: 'row', gap: 16 },
  headerLink: { color: colors.muted, fontSize: 13 },
  heroText: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, gap: 6 },
  kicker: { fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  kickerSmall: { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  heroTitle: { color: colors.ink, fontSize: 30, fontWeight: '800', letterSpacing: -0.6, lineHeight: 34 },
  heroPremise: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  pill: { paddingVertical: 12, paddingHorizontal: 22, borderRadius: radius.pill, backgroundColor: colors.ink },
  pillText: { color: '#0b0a0c', fontSize: 14, fontWeight: '700' },
  pillShut: { backgroundColor: colors.glass },
  pillShutText: { color: colors.muted, fontWeight: '600' },
  section: { gap: spacing.md, paddingHorizontal: spacing.xl },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { color: colors.faint, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, height: 120, borderRadius: 12, overflow: 'hidden', backgroundColor: '#0f0e12', justifyContent: 'flex-end' },
  tileText: { padding: 12, gap: 1 },
  tileTitle: { color: colors.ink, fontSize: 14, fontWeight: '700', lineHeight: 17 },
  tileFoot: { color: colors.muted, fontSize: 11 },
  resume: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  resumeArt: { width: 52, height: 64, borderRadius: 8 },
  resumeTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  railWrap: { marginHorizontal: -spacing.xl },
  rail: { gap: 10, paddingHorizontal: spacing.xl },
  card: { width: 150, height: 210, borderRadius: 12, overflow: 'hidden', backgroundColor: '#0f0e12', justifyContent: 'flex-end' },
  cardShut: { opacity: 0.72 },
  cardText: { padding: 10, gap: 2 },
  cardTitle: { color: colors.ink, fontSize: 14, fontWeight: '700', lineHeight: 17 },
  cardFoot: { color: colors.ink, fontSize: 12, fontWeight: '600', marginTop: 2 },
  thumbWrap: { width: 96, gap: 5 },
  thumb: { width: 96, height: 88, borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(244,241,236,0.06)' },
  thumbLock: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  thumbTitle: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  thumbSub: { color: colors.faint, fontSize: 10, lineHeight: 13 },
  lock: { width: 16, height: 18, alignItems: 'center', justifyContent: 'flex-end' },
  lockShackle: { width: 10, height: 9, borderWidth: 1.6, borderColor: colors.ink, borderBottomWidth: 0, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  lockBody: { width: 16, height: 10, borderRadius: 2, backgroundColor: colors.ink },
  writeRow: { marginHorizontal: spacing.xl, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.hairline, borderBottomWidth: 1, borderBottomColor: colors.hairline, flexDirection: 'row', alignItems: 'center', gap: 12 },
  writeTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  faint: { color: colors.faint, fontSize: 11 },
  grow: { flex: 1 },
  chev: { color: colors.faint, fontSize: 22 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.ground },
  error: { color: colors.ink, fontSize: 16 },
  hint: { color: colors.faint, fontSize: 12, textAlign: 'center' },
})
