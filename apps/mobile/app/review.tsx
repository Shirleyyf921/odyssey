import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { ReviewItem } from '@odyssey/shared'
import { api } from '../src/lib/api'
import { colors, radius, spacing } from '../src/theme'

/**
 * The human step of moderation (docs/ugc-pipeline.md): what a person still
 * has to read, whole, and the decision. Web only, behind the review secret;
 * the store build never renders it.
 */
export default function ReviewScreen() {
  const qc = useQueryClient()
  const queue = useQuery({ queryKey: ['review'], queryFn: api.reviewQueue, enabled: Platform.OS === 'web' })
  if (Platform.OS !== 'web') return <View style={styles.centered}><Text style={styles.muted}>Review happens on the web.</Text></View>
  if (queue.isLoading) return <View style={styles.centered}><ActivityIndicator color={colors.accent} /></View>
  if (queue.error) return <View style={styles.centered}><Text style={styles.error}>{String(queue.error)}</Text></View>
  const items = queue.data?.items ?? []
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{items.length ? `${items.length} to read` : 'Nothing waiting'}</Text>
      {items.map((item) => (
        <ReviewCard key={item.id} item={item} onDone={() => qc.invalidateQueries({ queryKey: ['review'] })} />
      ))}
    </ScrollView>
  )
}

function ReviewCard({ item, onDone }: { item: ReviewItem; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [open, setOpen] = useState(false)
  const decide = useMutation({
    mutationFn: (decision: 'LIVE' | 'REJECTED' | 'REMOVED') => api.reviewDecide(item.id, { decision, note: note.trim() || undefined }),
    onSuccess: onDone,
  })
  const flagged = item.status === 'UNLISTED'
  const byBeat = new Map(item.dryRun?.beats.map((b) => [b.beatId, b]) ?? [])
  return (
    <View style={[styles.card, flagged && styles.cardFlagged]}>
      <Text style={styles.kicker}>
        {item.status} · {item.rating} · for {item.characterName} · by {item.authorName ?? 'a reader'} · {item.authorLiveCount} live
      </Text>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.body}>{item.premise}</Text>
      <Text style={styles.muted}>{item.setting}</Text>
      <Text style={styles.body}>{item.opener}</Text>

      {item.reviewNote ? <Text style={styles.warn}>{item.reviewNote}</Text> : null}
      {item.reports.length ? (
        <Text style={styles.warn}>Reported: {item.reports.map((r) => r.reason.toLowerCase().replace('_', ' ')).join(', ')}</Text>
      ) : null}
      {item.dryRun ? (
        <Text style={item.dryRun.passed ? styles.muted : styles.warn}>
          Dry-run {item.dryRun.passed ? 'passed' : 'failed'} · {item.dryRun.beats[0]?.model ?? ''} · {new Date(item.dryRun.ranAt).toLocaleString()}
        </Text>
      ) : (
        <Text style={styles.warn}>No dry-run on file.</Text>
      )}

      <Pressable onPress={() => setOpen((v) => !v)} hitSlop={8}>
        <Text style={styles.link}>{open ? 'Hide the beats' : `Read the ${item.beats.length} beats`}</Text>
      </Pressable>
      {open &&
        item.beats.map((b, i) => {
          const played = byBeat.get(b.id)
          return (
            <View key={b.id} style={styles.beat}>
              <Text style={styles.kicker}>
                beat {i + 1} · {b.kind}
                {b.photoMomentId ? ' · photo' : ''}
                {b.hotspots.length ? ` · touch: ${b.hotspots.join(', ')}` : ''}
              </Text>
              <Text style={styles.brief}>{b.brief}</Text>
              {b.setting ? <Text style={styles.muted}>{b.setting}</Text> : null}
              {b.options.map((o, j) => (
                <Text key={j} style={styles.muted}>
                  {String.fromCharCode(65 + j)}. {o.intent}
                </Text>
              ))}
              {played ? (
                <View style={styles.played}>
                  <Text style={styles.muted}>you: {played.userAction}</Text>
                  {played.narration.map((p, k) => (
                    <Text key={k} style={styles.narration}>{p}</Text>
                  ))}
                  <Text style={styles.line}>{played.line}</Text>
                  {played.problem ? <Text style={styles.warn}>{played.problem}</Text> : null}
                </View>
              ) : null}
            </View>
          )
        })}

      <TextInput
        style={styles.input}
        value={note}
        onChangeText={setNote}
        placeholder="A note the author will read. Required for a no."
        placeholderTextColor={colors.textFaint}
        multiline
      />
      <View style={styles.row}>
        <Pressable style={[styles.button, styles.approve]} disabled={decide.isPending} onPress={() => decide.mutate('LIVE')}>
          <Text style={styles.approveText}>{flagged ? 'Put it back' : 'Approve'}</Text>
        </Pressable>
        <Pressable
          style={styles.button}
          disabled={decide.isPending || !note.trim()}
          onPress={() => decide.mutate(flagged ? 'REMOVED' : 'REJECTED')}
        >
          <Text style={styles.buttonText}>{flagged ? 'Remove' : 'Reject'}</Text>
        </Pressable>
      </View>
      {decide.error ? <Text style={styles.error}>{String(decide.error)}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl, maxWidth: 760, width: '100%', alignSelf: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardFlagged: { borderColor: colors.danger },
  kicker: { color: colors.textFaint, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  muted: { color: colors.textMuted, fontSize: 14, lineHeight: 19 },
  warn: { color: colors.danger, fontSize: 14, lineHeight: 19 },
  link: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  beat: { borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: spacing.md, gap: 4, marginTop: spacing.sm },
  brief: { color: colors.text, fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  played: { backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.sm, gap: 4, marginTop: 4 },
  narration: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  line: { color: colors.text, fontSize: 14, lineHeight: 20 },
  input: { color: colors.text, fontSize: 14, backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, minHeight: 60, marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  button: { flex: 1, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, borderRadius: radius.pill, alignItems: 'center' },
  buttonText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  approve: { backgroundColor: colors.accent, borderColor: colors.accent },
  approveText: { color: '#1a0a10', fontSize: 15, fontWeight: '700' },
  error: { color: colors.danger },
})
