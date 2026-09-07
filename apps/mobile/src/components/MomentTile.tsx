import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native'
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

interface Props {
  card: MomentCard
  /** Present when the store is available; called with the SKU of a locked PURCHASE card. */
  onUnlock?: (sku: string) => void
  unlocking?: boolean
}

/** Locked tiles never receive the asset URL, so there is nothing to blur or hide here. */
export function MomentTile({ card, onUnlock, unlocking }: Props) {
  const locked = card.status === 'LOCKED'
  const buyable = locked && card.unlock.kind === 'PURCHASE' && onUnlock !== undefined
  const sku = card.unlock.kind === 'PURCHASE' ? card.unlock.sku : null
  return (
    <View style={styles.tile}>
      {locked ? (
        <View style={[styles.image, styles.locked]}>
          {card.teaserUrl && <Image source={{ uri: card.teaserUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={18} />}
          {card.teaserUrl && <View style={styles.veil} />}
          <Text style={styles.lockGlyph}>🔒</Text>
        </View>
      ) : (
        <Image source={{ uri: card.imageUrl ?? undefined }} style={styles.image} resizeMode="cover" />
      )}
      <Text style={styles.title} numberOfLines={1}>
        {card.title}
      </Text>
      {buyable && sku ? (
        <Pressable style={styles.unlock} onPress={() => onUnlock(sku)} disabled={unlocking}>
          {unlocking ? <ActivityIndicator size="small" color="#1a0a10" /> : <Text style={styles.unlockText}>Unlock</Text>}
        </Pressable>
      ) : (
        <Text style={styles.sub} numberOfLines={2}>
          {locked ? unlockHint(card) : card.caption}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  tile: { flex: 1, gap: spacing.xs },
  image: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  locked: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  veil: { ...{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, backgroundColor: 'rgba(10, 6, 12, 0.6)' },
  lockGlyph: { fontSize: 22, opacity: 0.6 },
  title: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: spacing.xs },
  sub: { color: colors.textMuted, fontSize: 12 },
  unlock: { backgroundColor: colors.accent, paddingVertical: 8, borderRadius: radius.pill, alignItems: 'center', marginTop: 2 },
  unlockText: { color: '#1a0a10', fontSize: 13, fontWeight: '700' },
})
