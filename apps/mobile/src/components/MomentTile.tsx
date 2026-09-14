import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import type { MomentCard } from '@odyssey/shared'
import { Lock } from './Lock'
import { colors, radius, spacing } from '../theme'

function unlockHint(card: MomentCard): string {
  // The story gives everyday cards; a paid one is still bought, wherever it is offered.
  if (card.story && card.unlock.kind !== 'PURCHASE') return `He shows you this in "${card.story}"`
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

/**
 * A photo in the gallery, direction B: the picture with a line under it, no
 * frame. A locked one shows its blurred teaser under a dark veil and the drawn
 * lock; the asset itself never reaches the device until it is his to give.
 */
export function MomentTile({ card, onUnlock, unlocking }: Props) {
  const locked = card.status === 'LOCKED'
  const buyable = locked && card.unlock.kind === 'PURCHASE' && onUnlock !== undefined
  const sku = card.unlock.kind === 'PURCHASE' ? card.unlock.sku : null
  return (
    <View style={styles.tile}>
      {locked ? (
        <View style={[styles.image, styles.locked]}>
          {card.teaserUrl && <Image source={{ uri: card.teaserUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={18} />}
          <View style={styles.veil} />
          <Lock />
        </View>
      ) : (
        <Image source={{ uri: card.imageUrl ?? undefined }} style={styles.image} resizeMode="cover" />
      )}
      <Text style={styles.title} numberOfLines={1}>
        {card.title}
      </Text>
      {buyable && sku ? (
        <Pressable style={styles.unlock} onPress={() => onUnlock(sku)} disabled={unlocking}>
          {unlocking ? <ActivityIndicator size="small" color="#0b0a0c" /> : <Text style={styles.unlockText}>Unlock</Text>}
        </Pressable>
      ) : (
        <Text style={styles.sub} numberOfLines={2}>
          {locked ? unlockHint(card) : card.asked ? `For you${card.unlockedAt ? ` · ${new Date(card.unlockedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}` : card.caption}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  tile: { flex: 1, gap: 3 },
  image: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: '#0f0e12' },
  locked: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  veil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,5,7,0.55)' },
  title: { color: colors.ink, fontSize: 14, fontWeight: '600', marginTop: spacing.xs },
  sub: { color: colors.faint, fontSize: 12, lineHeight: 16 },
  unlock: { backgroundColor: colors.ink, paddingVertical: 8, borderRadius: radius.pill, alignItems: 'center', marginTop: 4 },
  unlockText: { color: '#0b0a0c', fontSize: 13, fontWeight: '700' },
})
