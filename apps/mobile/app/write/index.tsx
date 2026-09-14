import { useQuery } from '@tanstack/react-query'
import { Link } from 'expo-router'
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { api } from '../../src/lib/api'
import { colors, radius, spacing } from '../../src/theme'

const STATUS_COPY: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Waiting for a reader',
  LIVE: 'On his page',
  REJECTED: 'Sent back',
  UNLISTED: 'Taken down for review',
  REMOVED: 'Removed',
}

/**
 * The author's shelf (docs/ugc-pipeline.md, section 2): what they have
 * written, where each one is, and a way to start another. Web only.
 */
export default function WriteIndex() {
  const mine = useQuery({ queryKey: ['my-episodes'], queryFn: api.myEpisodes, enabled: Platform.OS === 'web' })
  const roster = useQuery({ queryKey: ['characters'], queryFn: api.characters, enabled: Platform.OS === 'web' })
  if (Platform.OS !== 'web') return <View style={styles.centered}><Text style={styles.muted}>Writing happens on the web.</Text></View>
  if (mine.isLoading || roster.isLoading) return <View style={styles.centered}><ActivityIndicator color={colors.ink} /></View>
  const open = (roster.data?.characters ?? []).filter((c) => c.kind === 'EXPLORE')
  const byId = new Map((roster.data?.characters ?? []).map((c) => [c.id, c.name]))
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Write for him</Text>
      <Text style={styles.body}>
        You write the episode: where it opens, what he wants, what the reader can do. He stays himself. Nothing you write
        goes on his page until a person has read it. Every time someone else finishes one of yours, you get a day of Plus.
      </Text>
      <View style={styles.row}>
        {open.map((c) => (
          <Link key={c.id} href={{ pathname: '/write/[id]', params: { id: 'new', characterId: c.id } }} asChild>
            <Pressable style={styles.newButton}>
              <Text style={styles.newText}>New episode for {c.name}</Text>
            </Pressable>
          </Link>
        ))}
      </View>
      {mine.data?.episodes.length ? <Text style={styles.sectionLabel}>Yours</Text> : null}
      {mine.data?.episodes.map((e) => (
        <Link key={e.id} href={{ pathname: '/write/[id]', params: { id: e.id } }} asChild>
          <Pressable style={styles.card}>
            <Text style={styles.kicker}>
              {STATUS_COPY[e.status] ?? e.status} · {e.rating} · for {byId.get(e.characterId) ?? '?'}
            </Text>
            <Text style={styles.cardTitle}>{e.title}</Text>
            <Text style={styles.muted}>{e.premise}</Text>
            {e.status === 'LIVE' ? (
              <Text style={styles.credit}>
                {e.completions === 0 ? 'Nobody has finished it yet' : `Finished ${e.completions} ${e.completions === 1 ? 'time' : 'times'}`}
                {e.creditedDays ? ` · ${e.creditedDays} ${e.creditedDays === 1 ? 'day' : 'days'} of Plus earned` : ''}
              </Text>
            ) : null}
            {e.reviewNote ? <Text style={styles.warn}>{e.reviewNote}</Text> : null}
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxl, maxWidth: 760, width: '100%', alignSelf: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.ground },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  newButton: { backgroundColor: colors.ink, paddingVertical: 12, paddingHorizontal: 20, borderRadius: radius.pill },
  newText: { color: '#0b0a0c', fontSize: 15, fontWeight: '700' },
  sectionLabel: { color: colors.faint, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, marginTop: spacing.md },
  card: { paddingVertical: 14, gap: 4, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  kicker: { color: colors.faint, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2 },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 19 },
  warn: { color: colors.danger, fontSize: 14, lineHeight: 19 },
  credit: { color: colors.ink, fontSize: 13, marginTop: 4 },
})
