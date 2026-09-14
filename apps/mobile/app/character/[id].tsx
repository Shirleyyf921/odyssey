import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { STAGE_LINE, type EpisodeCard, type ReportReason } from '@odyssey/shared'
import { Lock } from '../../src/components/Lock'
import { api } from '../../src/lib/api'
import { usePaywall } from '../../src/store/paywall'
import { colors, radius, spacing } from '../../src/theme'

/**
 * His page, in direction B (design canvas, 2026-09-12): his first portrait
 * full-bleed with the words on a gradient, where you are with him in words,
 * then his stories as rows on hairlines. His accent sits on the stage line
 * and nowhere else; the buttons are ink.
 */
export default function CharacterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const qc = useQueryClient()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['character', id], queryFn: () => api.character(id), enabled: !!id })
  const episodes = useQuery({ queryKey: ['episodes', id], queryFn: () => api.episodes(id), enabled: !!id })
  // Stage and moments move while chatting; pick that up when the user comes back.
  useFocusEffect(
    useCallback(() => {
      void refetch()
      void episodes.refetch()
    }, [refetch, episodes.refetch])
  )

  const devStage = useMutation({
    mutationFn: (stage: 'STRANGER' | 'ACQUAINTED' | 'CLOSE' | 'INTIMATE') => api.devSetStage(id, { stage }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['character', id] })
      qc.invalidateQueries({ queryKey: ['characters'] })
      qc.invalidateQueries({ queryKey: ['moments', id] })
    },
  })

  const start = useMutation({
    mutationFn: () => api.start(id),
    onSuccess: ({ relationship }) => {
      qc.invalidateQueries({ queryKey: ['characters'] })
      qc.invalidateQueries({ queryKey: ['character', id] })
      router.push({
        pathname: '/chat/[conversationId]',
        params: { conversationId: relationship.conversationId, name: data?.name ?? '', characterId: id },
      })
    },
  })
  const report = useMutation({
    mutationFn: ({ id: episodeId, reason }: { id: string; reason: ReportReason }) => api.reportEpisode(episodeId, { reason }),
    // Enough reports and it is gone from the shelf; refetch so this reader sees that too.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['episodes', id] }),
  })
  /** Story mode: start the relationship if needed, then open the chat with the episode. */
  const play = useMutation({
    mutationFn: async (episodeId: string) => ({ episodeId, ...(await api.start(id)) }),
    onSuccess: ({ relationship, episodeId }) => {
      qc.invalidateQueries({ queryKey: ['characters'] })
      qc.invalidateQueries({ queryKey: ['character', id] })
      router.push({
        pathname: '/story/[conversationId]',
        params: { conversationId: relationship.conversationId, name: data?.name ?? '', characterId: id, episodeId },
      })
    },
  })

  if (isLoading) return <View style={styles.centered}><ActivityIndicator color={colors.ink} /></View>
  if (error || !data) return <View style={styles.centered}><Text style={styles.error}>{String(error ?? 'Not found')}</Text></View>

  const [hero, ...rest] = data.portraits
  const rel = data.relationship
  const openEpisode = (e: EpisodeCard) => {
    if (e.status === 'LOCKED' && e.unlock.kind === 'PLUS') return usePaywall.getState().open('EPISODE')
    if (e.status === 'DONE' && e.lockReason) return usePaywall.getState().open('REPLAY')
    play.mutate(e.id)
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.hero, { height: Math.round(width * 1.15) }]}>
        {hero ? <Image source={{ uri: hero.url }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <View style={[StyleSheet.absoluteFill, styles.artEmpty]} />}
        <LinearGradient pointerEvents="none" colors={['rgba(5,5,7,0.55)', 'rgba(5,5,7,0)']} style={styles.heroTop} />
        <LinearGradient pointerEvents="none" colors={['rgba(5,5,7,0)', 'rgba(5,5,7,0.75)', colors.ground]} locations={[0, 0.55, 1]} style={styles.heroBottom} />
        <Pressable style={[styles.back, { top: insets.top + 12 }]} onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.backText}>‹</Text>
          <Text style={styles.backLabel}>Tonight</Text>
        </Pressable>
        <View style={styles.heroText}>
          <Text style={[styles.kicker, { color: data.accent }]}>{rel ? STAGE_LINE[rel.stage] : 'He doesn’t know you yet'}</Text>
          <Text style={styles.name}>{data.name}</Text>
          <Text style={styles.tagline}>{data.tagline}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.primary, start.isPending && styles.disabled]}
          disabled={start.isPending}
          onPress={() =>
            rel
              ? router.push({ pathname: '/chat/[conversationId]', params: { conversationId: rel.conversationId, name: data.name, characterId: id } })
              : start.mutate()
          }
        >
          <Text style={styles.primaryText}>{rel ? 'Talk to him' : 'Say hello'}</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => router.push({ pathname: '/moments/[characterId]', params: { characterId: id, name: data.name } })}>
          <Text style={styles.secondaryText}>Photos · {data.momentCount}</Text>
        </Pressable>
        {start.error ? <Text style={styles.error}>{String(start.error)}</Text> : null}
        {rel ? <Text style={styles.faint}>Since {new Date(rel.startedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</Text> : null}
      </View>

      {rest.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} style={styles.stripWrap}>
          {rest.map((p) => <Image key={p.id} source={{ uri: p.url }} style={styles.stripItem} resizeMode="cover" />)}
        </ScrollView>
      )}

      {episodes.data?.episodes.length ? (
        <View style={styles.section}>
          <Text style={styles.label}>His stories</Text>
          {episodes.data.episodes.map((e) => (
            <EpisodeRow key={e.id} episode={e} busy={play.isPending} onPlay={() => openEpisode(e)} />
          ))}
        </View>
      ) : null}

      {episodes.data?.community.length ? (
        <View style={styles.section}>
          <Text style={styles.label}>Written for him</Text>
          {episodes.data.community.map((e) => (
            <EpisodeRow key={e.id} episode={e} busy={play.isPending} onPlay={() => openEpisode(e)} onReport={(reason) => report.mutateAsync({ id: e.id, reason })} />
          ))}
        </View>
      ) : null}

      {__DEV__ && rel && (
        <View style={styles.devBox}>
          <Text style={styles.label}>Dev · jump to stage</Text>
          <View style={styles.devRow}>
            {(['STRANGER', 'ACQUAINTED', 'CLOSE', 'INTIMATE'] as const).map((s) => (
              <Pressable
                key={s}
                style={[styles.chip, rel.stage === s && styles.chipActive]}
                disabled={devStage.isPending}
                onPress={() => devStage.mutate(s)}
              >
                <Text style={[styles.chipText, rel.stage === s && styles.chipTextActive]}>{s.toLowerCase()}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  )
}

const REPORT_REASONS: Array<{ reason: ReportReason; label: string }> = [
  { reason: 'BROKEN', label: 'Does not play' },
  { reason: 'MINOR', label: 'Minors' },
  { reason: 'NON_CONSENT', label: 'Non-consent' },
  { reason: 'SELF_HARM', label: 'Self-harm' },
  { reason: 'REAL_PERSON', label: 'A real person' },
  { reason: 'HATE', label: 'Hate' },
  { reason: 'OTHER', label: 'Something else' },
]

/**
 * One story as a row on a hairline: title, premise, and what tapping does on
 * the right. A reader's story also carries its credit and a way to report it;
 * the row says what happened when one sends a report.
 */
function EpisodeRow({
  episode: e,
  busy,
  onPlay,
  onReport,
}: {
  episode: EpisodeCard
  busy: boolean
  onPlay: () => void
  onReport?: (reason: ReportReason) => Promise<{ counted: boolean; status: string }>
}) {
  const [reporting, setReporting] = useState(false)
  const [outcome, setOutcome] = useState<string | null>(null)
  const playable = e.status === 'AVAILABLE' || e.status === 'IN_PROGRESS' || e.status === 'DONE'
  // Rows that open the paywall stay live; only what nothing can open tonight is dim.
  const plusLocked = (e.status === 'LOCKED' && e.unlock.kind === 'PLUS') || (e.status === 'DONE' && !!e.lockReason)
  const shut = !playable && !plusLocked
  const meta =
    e.status === 'IN_PROGRESS' ? `Continue · ${e.currentBeat}/${e.beatCount}` : e.status === 'DONE' ? 'Again' : e.status === 'LOCKED' ? e.lockReason : 'Play'
  const send = async (reason: ReportReason) => {
    if (!onReport) return
    try {
      const { counted, status } = await onReport(reason)
      setOutcome(status === 'UNLISTED' ? 'Taken down for review.' : counted ? 'Thanks. Someone will read it.' : 'You already flagged this one.')
    } catch (err) {
      setOutcome(String(err instanceof Error ? err.message : err))
    }
    setReporting(false)
  }
  return (
    <View style={[styles.row, shut && styles.rowShut]}>
      <Pressable style={styles.rowMain} disabled={shut || busy} onPress={onPlay}>
        <View style={styles.grow}>
          <Text style={styles.rowTitle}>{e.title}</Text>
          <Text style={styles.rowPremise} numberOfLines={2}>{e.premise}</Text>
          {onReport ? (
            <Text style={styles.faint}>
              by {e.authorName ?? 'a reader'}
              {e.completions ? ` · finished ${e.completions} ${e.completions === 1 ? 'time' : 'times'}` : ''}
            </Text>
          ) : null}
        </View>
        <View style={styles.rowMeta}>
          {e.status === 'LOCKED' || (e.status === 'DONE' && e.lockReason) ? <Lock size={12} color={plusLocked ? colors.ink : colors.faint} /> : null}
          <Text style={[styles.rowMetaText, e.status === 'LOCKED' && !plusLocked && styles.rowMetaShut]}>{meta}</Text>
        </View>
      </Pressable>
      {onReport ? (
        <View style={styles.reportRow}>
          {outcome ? (
            <Text style={styles.faint}>{outcome}</Text>
          ) : (
            <Pressable onPress={() => setReporting((v) => !v)} hitSlop={8}>
              <Text style={styles.reportLink}>{reporting ? 'Never mind' : 'Report'}</Text>
            </Pressable>
          )}
        </View>
      ) : null}
      {reporting && (
        <View style={styles.devRow}>
          {REPORT_REASONS.map((r) => (
            <Pressable key={r.reason} style={styles.chip} onPress={() => void send(r.reason)}>
              <Text style={styles.chipText}>{r.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { paddingBottom: spacing.xxl, gap: spacing.xl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.ground },
  error: { color: colors.ink, textAlign: 'center' },
  hero: { width: '100%', backgroundColor: colors.ground, justifyContent: 'flex-end' },
  artEmpty: { backgroundColor: '#0f0e12' },
  heroTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  heroBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  back: { position: 'absolute', left: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: 8 },
  backText: { color: colors.ink, fontSize: 28, lineHeight: 28, marginTop: -4 },
  backLabel: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  heroText: { paddingHorizontal: spacing.xl, gap: 6 },
  kicker: { fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  name: { color: colors.ink, fontSize: 34, fontWeight: '800', letterSpacing: -0.8, lineHeight: 38 },
  tagline: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  actions: { paddingHorizontal: spacing.xl, gap: spacing.sm, marginTop: -spacing.sm },
  primary: { backgroundColor: colors.ink, paddingVertical: 14, borderRadius: radius.pill, alignItems: 'center' },
  primaryText: { color: '#0b0a0c', fontSize: 16, fontWeight: '700' },
  secondary: { borderWidth: 1, borderColor: 'rgba(244,241,236,0.18)', paddingVertical: 12, borderRadius: radius.pill, alignItems: 'center' },
  secondaryText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  stripWrap: { marginHorizontal: 0 },
  strip: { gap: 8, paddingHorizontal: spacing.xl },
  stripItem: { width: 84, height: 112, borderRadius: 10, backgroundColor: '#0f0e12' },
  section: { paddingHorizontal: spacing.xl, gap: 2 },
  label: { color: colors.faint, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.sm },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.hairline, gap: 6 },
  rowShut: { opacity: 0.55 },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  grow: { flex: 1, gap: 2 },
  rowTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  rowPremise: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 110 },
  rowMetaText: { color: colors.ink, fontSize: 12, fontWeight: '600', textAlign: 'right' },
  rowMetaShut: { color: colors.faint, fontWeight: '400' },
  reportRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  reportLink: { color: colors.faint, fontSize: 12, textDecorationLine: 'underline' },
  faint: { color: colors.faint, fontSize: 12, lineHeight: 16 },
  devBox: { marginHorizontal: spacing.xl, borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: spacing.lg, gap: spacing.sm },
  devRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: 'rgba(244,241,236,0.18)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.muted, fontSize: 13 },
  chipTextActive: { color: '#0b0a0c', fontWeight: '600' },
})
