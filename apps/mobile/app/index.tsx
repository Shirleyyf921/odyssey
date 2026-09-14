import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LinearGradient } from 'expo-linear-gradient'
import { Link, Stack, router, useFocusEffect } from 'expo-router'
import { useCallback, type ReactNode } from 'react'
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { HomeResponse, MomentCard, TonightItem } from '@odyssey/shared'
import { Lock } from '../src/components/Lock'
import { api } from '../src/lib/api'
import { usePaywall } from '../src/store/paywall'
import { colors, radius, spacing } from '../src/theme'

/**
 * Home, "three doors" (the design canvas, 2026-09-14; chosen over "one
 * night" and "he wrote to you"). The home answers one question: who do you
 * have. All three men are on the screen at once, each behind his own door,
 * tonight's one larger; what is open, what you are in the middle of, and
 * what Plus would open is said on the door in a word. How to play and what
 * you have earned live on his page, one tap in. Under the doors, one line
 * about the pictures; under that, the bar: home, write (web), you.
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

  const { big, small } = doors(data)
  const inner = Math.min(width, 520) - spacing.md * 2
  const gap = 6
  const bigW = Math.round(inner * 0.56)
  const doorsH = Math.round(Math.min(width * 1.64, 640))
  const smallH = Math.round((doorsH - gap) / 2)
  const barH = 56 + Math.max(insets.bottom, 10)

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: barH + spacing.xl }]}>
        <View style={styles.header}>
          <Text style={styles.brand}>odyssey</Text>
          <Text style={styles.kicker}>Tonight</Text>
        </View>

        {big ? (
          <View style={[styles.doors, { height: doorsH, gap }]}>
            <Door item={big} width={bigW} height={doorsH} big />
            <View style={[styles.column, { gap }]}>
              {small.map((item) => <Door key={item.character.id} item={item} width={inner - bigW - gap} height={smallH} />)}
            </View>
          </View>
        ) : null}

        <Pictures moments={data.moments} primaryId={big?.character.id ?? null} />

        {Platform.OS === 'web' ? (
          <Link href="/write" asChild>
            <Pressable style={styles.writeRow}>
              <View style={styles.grow}>
                <Text style={styles.writeTitle}>Write one for him</Text>
                <Text style={styles.muted}>A day of Plus every time someone finishes it.</Text>
              </View>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          </Link>
        ) : null}
      </ScrollView>
      <Bar bottom={Math.max(insets.bottom, 10)} />
    </>
  )
}

/**
 * Which door is the big one: the man you are in the middle of a night with,
 * else the one who wrote to you, else the primary. The other two keep the
 * roster's order.
 */
function doors(data: HomeResponse): { big: TonightItem | null; small: TonightItem[] } {
  const items = data.tonight
  const big =
    items.find((i) => i.episode?.status === 'IN_PROGRESS') ??
    items.find((i) => i.reachOut) ??
    items.find((i) => i.character.kind === 'PRIMARY') ??
    items[0] ??
    null
  return { big, small: items.filter((i) => i !== big).slice(0, 2) }
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

/** Where the door leads: the paywall for a Plus lock, the chat when he wrote first, the stage when open, else his page. */
function useOpen(item: TonightItem) {
  const { character, episode, reachOut } = item
  const play = usePlay(character.id, character.name)
  const playable = episode?.status === 'AVAILABLE' || episode?.status === 'IN_PROGRESS' || (episode?.status === 'DONE' && !episode.lockReason)
  const open = () => {
    if (episode?.status === 'LOCKED' && episode.unlock.kind === 'PLUS') return usePaywall.getState().open('EPISODE')
    if (episode?.status === 'DONE' && episode.lockReason) return usePaywall.getState().open('REPLAY')
    if (reachOut && character.relationship) {
      return router.push({ pathname: '/chat/[conversationId]', params: { conversationId: character.relationship.conversationId, name: character.name, characterId: character.id } })
    }
    if (playable && episode) play.mutate(episode.id)
    else router.push({ pathname: '/character/[id]', params: { id: character.id } })
  }
  return { open, playable, pending: play.isPending }
}

/** His message without the leading action beat, for a door; the chat shows the beat. */
function stripBeat(text: string): string {
  return text.replace(/^\*[^*]*\*\s*/, '').trim() || text
}

/** The one word on the door after his name. */
function state(item: TonightItem): string {
  const { episode, character } = item
  if (item.reachOut) return 'he wrote'
  if (!episode) return character.relationship ? 'he is up' : 'say hello'
  switch (episode.status) {
    case 'IN_PROGRESS':
      // The pill says continue; the kicker keeps only the place, so it fits after his name.
      return `${episode.currentBeat}/${episode.beatCount}`
    case 'AVAILABLE':
      return 'open'
    case 'DONE':
      return 'again'
    case 'LOCKED':
      return episode.unlock.kind === 'PLUS' ? 'plus' : 'not yet'
  }
}

/** The second line on a small door: what he said, or what the night is. */
function hook(item: TonightItem): string {
  if (item.reachOut) return stripBeat(item.reachOut.content)
  if (item.episode) return item.episode.status === 'LOCKED' ? (item.episode.lockReason ?? item.episode.title) : item.episode.title
  return item.character.tagline
}

/** One man behind one door: his art full-bleed, his name in his colour, the state in a word. */
function Door({ item, width, height, big }: { item: TonightItem; width: number; height: number; big?: boolean }) {
  const { character, episode } = item
  const { open, playable, pending } = useOpen(item)
  const shut = episode?.status === 'LOCKED' && episode.unlock.kind !== 'PLUS'
  const locked = (episode?.status === 'LOCKED' && episode.unlock.kind === 'PLUS') || (episode?.status === 'DONE' && !!episode.lockReason)
  const toHim = () => router.push({ pathname: '/character/[id]', params: { id: character.id } })
  return (
    <Pressable style={[styles.door, { width, height }, shut && styles.doorShut]} onPress={big ? toHim : open} disabled={pending}>
      {character.portraitUrl ? <Image source={{ uri: character.portraitUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <View style={[StyleSheet.absoluteFill, styles.artEmpty]} />}
      <LinearGradient pointerEvents="none" colors={['rgba(5,5,7,0)', 'rgba(5,5,7,0.92)']} locations={[big ? 0.4 : 0.38, 1]} style={StyleSheet.absoluteFill} />
      <View style={[styles.doorText, big ? styles.doorTextBig : null]}>
        <View style={styles.nameRow}>
          <Text style={[big ? styles.kickerBig : styles.kickerSmall, { color: character.accent }]} numberOfLines={1}>
            {character.name} · {state(item)}
          </Text>
          {locked ? <Lock size={11} /> : null}
        </View>
        {big ? (
          <>
            <Text style={styles.doorTitle} numberOfLines={2}>{episode?.title ?? (character.relationship ? 'Nothing new tonight' : character.tagline)}</Text>
            <Text style={styles.doorLine} numberOfLines={2}>{item.reachOut ? stripBeat(item.reachOut.content) : (episode?.premise ?? '')}</Text>
            <View style={styles.doorActions}>
              <Pressable style={[styles.pill, pending && styles.disabled]} onPress={open} disabled={pending} hitSlop={6}>
                <Text style={styles.pillText}>{item.reachOut ? 'Read it' : playable ? (episode?.status === 'IN_PROGRESS' ? 'Continue' : 'Go up') : locked ? 'Plus' : 'His page'}</Text>
              </Pressable>
              {episode ? <Text style={styles.faint}>{episode.beatCount} beats</Text> : null}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.doorSmallTitle} numberOfLines={2}>{hook(item)}</Text>
          </>
        )}
      </View>
    </Pressable>
  )
}

/** One line under the doors about the pictures, and the last one given or the next one to earn. */
function Pictures({ moments, primaryId }: { moments: HomeResponse['moments']; primaryId: string | null }) {
  const given = moments.unlocked
  const next = moments.next[0] ?? null
  const shown: MomentCard | null = given[given.length - 1] ?? next
  if (!shown) return null
  const line =
    given.length === 0
      ? next?.story ? `The first one is in "${next.story}".` : 'He has not given you one yet.'
      : next?.story
        ? `${given.length} ${given.length === 1 ? 'picture' : 'pictures'} · the next one is in "${next.story}"`
        : `${given.length} ${given.length === 1 ? 'picture' : 'pictures'}`
  const locked = shown.status === 'LOCKED'
  return (
    <Pressable style={styles.pictures} onPress={() => router.push({ pathname: '/moments/[characterId]', params: { characterId: shown.characterId ?? primaryId ?? '' } })}>
      <View style={styles.grow}>
        <Text style={styles.label}>Given to you</Text>
        <Text style={styles.muted} numberOfLines={2}>{line}</Text>
      </View>
      <View style={styles.thumb}>
        {!locked && shown.imageUrl ? (
          <Image source={{ uri: shown.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : shown.teaserUrl ? (
          <Image source={{ uri: shown.teaserUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={16} />
        ) : null}
        {locked ? <View style={styles.thumbLock}><Lock size={14} /></View> : null}
      </View>
    </Pressable>
  )
}

/** The bar: home, write on the web, you. Icons drawn with views so no library and no emoji ship. */
function Bar({ bottom }: { bottom: number }) {
  return (
    <View style={[styles.bar, { paddingBottom: bottom }]}>
      <View style={styles.barItem}>
        <DoorGlyph active />
        <Text style={styles.barLabelActive}>Tonight</Text>
      </View>
      {Platform.OS === 'web' ? (
        <Link href="/write" asChild>
          <Pressable style={styles.barItem}>
            <PenGlyph />
            <Text style={styles.barLabel}>Write</Text>
          </Pressable>
        </Link>
      ) : null}
      <Link href="/account" asChild>
        <Pressable style={styles.barItem}>
          <YouGlyph />
          <Text style={styles.barLabel}>You</Text>
        </Pressable>
      </Link>
    </View>
  )
}

function DoorGlyph({ active }: { active?: boolean }) {
  const c = active ? colors.ink : colors.faint
  return (
    <View style={[styles.glyphDoor, { borderColor: c }]}>
      <View style={[styles.glyphKnob, { backgroundColor: c }]} />
    </View>
  )
}

function PenGlyph() {
  return (
    <View style={styles.glyphBox}>
      <View style={[styles.glyphPen, { backgroundColor: colors.faint }]} />
      <View style={[styles.glyphPenTip, { borderTopColor: colors.faint }]} />
    </View>
  )
}

function YouGlyph() {
  return (
    <View style={styles.glyphBox}>
      <View style={[styles.glyphHead, { borderColor: colors.faint }]} />
      <View style={[styles.glyphShoulders, { borderColor: colors.faint }]} />
    </View>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  artEmpty: { backgroundColor: '#0f0e12' },
  content: { paddingHorizontal: spacing.md, gap: spacing.lg, maxWidth: 520, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: spacing.md },
  brand: { color: colors.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  kicker: { color: colors.faint, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase' },
  doors: { flexDirection: 'row' },
  column: { flex: 1, flexDirection: 'column' },
  door: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#0f0e12', justifyContent: 'flex-end' },
  doorShut: { opacity: 0.7 },
  doorText: { padding: 14, gap: 3 },
  doorTextBig: { padding: 16, gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kickerBig: { fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', flexShrink: 1 },
  kickerSmall: { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', flexShrink: 1 },
  doorTitle: { color: colors.ink, fontSize: 26, fontWeight: '800', letterSpacing: -0.7, lineHeight: 28 },
  doorLine: { color: 'rgba(244,241,236,0.68)', fontSize: 13, lineHeight: 18 },
  doorActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  doorSmallTitle: { color: colors.ink, fontSize: 15, fontWeight: '700', lineHeight: 18 },
  pill: { paddingVertical: 11, paddingHorizontal: 20, borderRadius: radius.pill, backgroundColor: colors.ink, alignSelf: 'flex-start' },
  pillText: { color: '#0b0a0c', fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  pictures: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: spacing.md, paddingVertical: 6 },
  label: { color: colors.faint, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 },
  thumb: { width: 56, height: 56, borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(244,241,236,0.06)' },
  thumbLock: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  writeRow: { marginHorizontal: spacing.md, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.hairline, flexDirection: 'row', alignItems: 'center', gap: 12 },
  writeTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  faint: { color: colors.faint, fontSize: 11 },
  grow: { flex: 1 },
  chev: { color: colors.faint, fontSize: 22 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start', paddingTop: 10, backgroundColor: colors.ground, borderTopWidth: 1, borderTopColor: colors.hairline },
  barItem: { alignItems: 'center', gap: 4, minWidth: 72, paddingVertical: 2 },
  barLabel: { color: colors.faint, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  barLabelActive: { color: colors.ink, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  glyphBox: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  glyphDoor: { width: 14, height: 20, borderWidth: 1.6, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderRadius: 2, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 3 },
  glyphKnob: { width: 2.5, height: 2.5, borderRadius: 2 },
  glyphPen: { width: 3, height: 14, borderRadius: 1.5, transform: [{ rotate: '40deg' }, { translateY: -1 }] },
  glyphPenTip: { position: 'absolute', bottom: 2, left: 4, width: 0, height: 0, borderLeftWidth: 3, borderRightWidth: 3, borderTopWidth: 5, borderLeftColor: 'transparent', borderRightColor: 'transparent', transform: [{ rotate: '40deg' }] },
  glyphHead: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.6, marginBottom: 1 },
  glyphShoulders: { width: 18, height: 8, borderWidth: 1.6, borderBottomWidth: 0, borderTopLeftRadius: 9, borderTopRightRadius: 9 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.ground },
  error: { color: colors.ink, fontSize: 16 },
  hint: { color: colors.faint, fontSize: 12, textAlign: 'center' },
})
