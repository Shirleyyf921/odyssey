import { useQuery } from '@tanstack/react-query'
import { Link } from 'expo-router'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import type { CharacterListItem } from '@odyssey/shared'
import { Portrait } from '../src/components/Portrait'
import { api } from '../src/lib/api'
import { colors, radius, spacing } from '../src/theme'

/** Roster. The primary sits on top; exploration characters follow. */
export default function Home() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['characters'], queryFn: api.characters })

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

  const primary = data.characters.filter((c) => c.kind === 'PRIMARY')
  const explore = data.characters.filter((c) => c.kind === 'EXPLORE')

  return (
    <FlatList
      data={[...primary, ...explore]}
      keyExtractor={(c) => c.id}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      renderItem={({ item, index }) => (
        <>
          {index === primary.length && explore.length > 0 && <Text style={styles.section}>Explore</Text>}
          <CharacterRow item={item} />
        </>
      )}
    />
  )
}

function CharacterRow({ item }: { item: CharacterListItem }) {
  return (
    <Link href={{ pathname: '/character/[id]', params: { id: item.id } }} asChild>
      <Pressable style={styles.row}>
        <Portrait url={item.portraitUrl} name={item.name} style={styles.thumb} />
        <View style={styles.rowText}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.tagline} numberOfLines={2}>{item.tagline}</Text>
          <Text style={styles.status}>
            {item.relationship ? item.relationship.stage.toLowerCase() : item.kind === 'PRIMARY' ? 'your primary' : 'not yet met'}
          </Text>
        </View>
      </Pressable>
    </Link>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg },
  section: { color: colors.textMuted, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.md, marginTop: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md },
  thumb: { width: 72, aspectRatio: 3 / 4, borderRadius: radius.md },
  rowText: { flex: 1, justifyContent: 'center', gap: 2 },
  name: { color: colors.text, fontSize: 18, fontWeight: '700' },
  tagline: { color: colors.textMuted, fontSize: 14 },
  status: { color: colors.accent, fontSize: 12, marginTop: 4 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  error: { color: colors.text, fontSize: 16 },
  hint: { color: colors.textFaint, fontSize: 12, textAlign: 'center' },
  button: { backgroundColor: colors.accent, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill },
  buttonText: { color: '#1a0a10', fontWeight: '700' },
})
