import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { EpisodeCard, ReportReason } from '@odyssey/shared'
import { Portrait } from '../../src/components/Portrait'
import { api } from '../../src/lib/api'
import { colors, radius, spacing } from '../../src/theme'

/** Character page: identity images, who he is, and the way into the conversation. */
export default function CharacterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const qc = useQueryClient()
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

      {episodes.data?.episodes.length ? (
        <View style={styles.episodes}>
          <Text style={styles.sectionLabel}>Tonight</Text>
          {episodes.data.episodes.map((e) => {
            const playable = e.status === 'AVAILABLE' || e.status === 'IN_PROGRESS'
            return (
              <Pressable
                key={e.id}
                style={[styles.episode, !playable && styles.episodeLocked]}
                disabled={!playable || play.isPending}
                onPress={() => play.mutate(e.id)}
              >
                <Text style={styles.episodeTitle}>{e.title}</Text>
                <Text style={styles.episodePremise}>{e.premise}</Text>
                <Text style={styles.episodeMeta}>
                  {e.status === 'IN_PROGRESS' ? `Continue · ${e.currentBeat}/${e.beatCount}` : e.status === 'DONE' ? 'Played' : e.status === 'LOCKED' ? e.lockReason : 'Play'}
                </Text>
              </Pressable>
            )
          })}
        </View>
      ) : null}

      {episodes.data?.community.length ? (
        <View style={styles.episodes}>
          <Text style={styles.sectionLabel}>Written for him</Text>
          {episodes.data.community.map((e) => (
            <CommunityEpisode
              key={e.id}
              episode={e}
              busy={play.isPending}
              onPlay={() => play.mutate(e.id)}
              onReport={(reason) => report.mutateAsync({ id: e.id, reason })}
            />
          ))}
        </View>
      ) : null}

      <Pressable
        style={[styles.primaryButton, start.isPending && styles.disabled]}
        disabled={start.isPending}
        onPress={() =>
          rel
            ? router.push({
                pathname: '/chat/[conversationId]',
                params: { conversationId: rel.conversationId, name: data.name, characterId: id },
              })
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

      {__DEV__ && rel && (
        <View style={styles.devBox}>
          <Text style={styles.devLabel}>Dev · jump to stage</Text>
          <View style={styles.devRow}>
            {(['STRANGER', 'ACQUAINTED', 'CLOSE', 'INTIMATE'] as const).map((s) => (
              <Pressable
                key={s}
                onPress={() => devStage.mutate(s)}
                style={[styles.devChip, rel.stage === s && styles.devChipActive]}
                disabled={devStage.isPending}
              >
                <Text style={[styles.devChipText, rel.stage === s && styles.devChipTextActive]}>{s.toLowerCase()}</Text>
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
 * A reader-written episode: the same card as ours with the author's name on it,
 * and a way to flag it. The reasons are the moderation table's hard blocks plus
 * "it does not play"; tapping one sends it and the row says so.
 */
function CommunityEpisode({
  episode: e,
  busy,
  onPlay,
  onReport,
}: {
  episode: EpisodeCard
  busy: boolean
  onPlay: () => void
  onReport: (reason: ReportReason) => Promise<{ counted: boolean; status: string }>
}) {
  const [reporting, setReporting] = useState(false)
  const [outcome, setOutcome] = useState<string | null>(null)
  const playable = e.status === 'AVAILABLE' || e.status === 'IN_PROGRESS'
  const send = async (reason: ReportReason) => {
    try {
      const { counted, status } = await onReport(reason)
      setOutcome(status === 'UNLISTED' ? 'Taken down for review.' : counted ? 'Thanks. Someone will read it.' : 'You already flagged this one.')
    } catch (err) {
      setOutcome(String(err instanceof Error ? err.message : err))
    }
    setReporting(false)
  }
  return (
    <View style={[styles.episode, !playable && styles.episodeLocked]}>
      <Pressable disabled={!playable || busy} onPress={onPlay}>
        <Text style={styles.episodeTitle}>{e.title}</Text>
        <Text style={styles.episodePremise}>{e.premise}</Text>
        <Text style={styles.episodeMeta}>
          {e.status === 'IN_PROGRESS' ? `Continue · ${e.currentBeat}/${e.beatCount}` : e.status === 'DONE' ? 'Played' : e.status === 'LOCKED' ? e.lockReason : 'Play'}
        </Text>
      </Pressable>
      <View style={styles.creditRow}>
        <Text style={styles.credit}>
          by {e.authorName ?? 'a reader'}
          {e.completions ? ` · finished ${e.completions} ${e.completions === 1 ? 'time' : 'times'}` : ''}
        </Text>
        {outcome ? (
          <Text style={styles.credit}>{outcome}</Text>
        ) : (
          <Pressable onPress={() => setReporting((v) => !v)} hitSlop={8}>
            <Text style={styles.reportLink}>{reporting ? 'Never mind' : 'Report'}</Text>
          </Pressable>
        )}
      </View>
      {reporting && (
        <View style={styles.reasons}>
          {REPORT_REASONS.map((r) => (
            <Pressable key={r.reason} style={styles.reason} onPress={() => void send(r.reason)}>
              <Text style={styles.reasonText}>{r.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  creditRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  credit: { color: colors.textFaint, fontSize: 12, flexShrink: 1 },
  reportLink: { color: colors.textFaint, fontSize: 12, textDecorationLine: 'underline' },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  reason: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  reasonText: { color: colors.textMuted, fontSize: 13 },
  episodes: { gap: spacing.sm, marginTop: spacing.lg },
  sectionLabel: { color: colors.textFaint, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  episode: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: 4, borderWidth: 1, borderColor: colors.accent },
  episodeLocked: { borderColor: colors.border, opacity: 0.7 },
  episodeTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  episodePremise: { color: colors.textMuted, fontSize: 14, lineHeight: 19 },
  episodeMeta: { color: colors.accent, fontSize: 13, fontWeight: '600', marginTop: 4 },
  devBox: { marginTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg, gap: spacing.sm },
  devLabel: { color: colors.textFaint, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  devRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  devChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  devChipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  devChipText: { color: colors.textMuted, fontSize: 13 },
  devChipTextActive: { color: colors.accent },
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
