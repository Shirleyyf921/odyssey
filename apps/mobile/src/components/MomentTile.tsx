import { Image, StyleSheet, Text, View } from 'react-native'
import type { MomentCard } from '@odyssey/shared'
import { colors, radius, spacing } from '../theme'

function unlockHint(card: MomentCard): string {
  switch (card.unlock.kind) {
    case 'FREE':
      return 'Free'
    case 'STAGE':
      return `Unlocks when you're ${card.unlock.stage.toLowerCase()}`
    case 'AFFINITY':
      return 'Unlocks as you grow closer'
    case 'PURCHASE':
      return 'Unlock'
  }
}

/** Locked tiles never receive the asset URL, so there is nothing to blur or hide here. */
export function MomentTile({ card }: { card: MomentCard }) {
  const locked = card.status === 'LOCKED'
  return (
    <View style={styles.tile}>
      {locked ? (
        <View style={[styles.image, styles.locked]}>
          <Text style={styles.lockGlyph}>🔒</Text>
        </View>
      ) : (
        <Image source={{ uri: card.imageUrl ?? undefined }} style={styles.image} resizeMode="cover" />
      )}
      <Text style={styles.title} numberOfLines={1}>
        {card.title}
      </Text>
      <Text style={styles.sub} numberOfLines={2}>
        {locked ? unlockHint(card) : card.caption}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  tile: { flex: 1, gap: spacing.xs },
  image: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  locked: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  lockGlyph: { fontSize: 22, opacity: 0.6 },
  title: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: spacing.xs },
  sub: { color: colors.textMuted, fontSize: 12 },
})
