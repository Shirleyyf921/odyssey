import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { STORY_MARKERS, parseReply, parseStoryOutput, type MomentCard } from '@odyssey/shared'
import { Lock } from './Lock'
import { colors, radius, spacing } from '../theme'

interface Props {
  role: 'USER' | 'CHARACTER' | 'SYSTEM'
  text: string
  pending?: boolean
  /** Present on a photo message. Null while the card has not loaded yet. */
  moment?: MomentCard | null
  onUnlock?: (sku: string) => void
  unlocking?: boolean
}

export function MessageBubble({ role, text, pending, moment, onUnlock, unlocking }: Props) {
  if (moment !== undefined) {
    return (
      <View style={[styles.row, styles.rowTheirs]}>
        <PhotoBubble card={moment} caption={text} onUnlock={onUnlock} unlocking={unlocking} />
      </View>
    )
  }
  if (role === 'SYSTEM') {
    return (
      <View style={styles.systemWrap}>
        <Text style={styles.systemText}>{text}</Text>
      </View>
    )
  }
  const mine = role === 'USER'
  const story = !mine && (text.includes(STORY_MARKERS.narration) || text.includes(STORY_MARKERS.line))
  if (story) {
    const turn = parseStoryOutput(text)
    return (
      <View style={styles.storyWrap}>
        {turn.narration.map((p, i) => (
          <Text key={i} style={styles.narration}>{p}</Text>
        ))}
        {turn.line ? (
          <View style={[styles.row, styles.rowTheirs, styles.storyLine]}>
            <View style={[styles.bubble, styles.theirs]}>
              <CharacterText text={turn.line} />
            </View>
          </View>
        ) : null}
      </View>
    )
  }
  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs, pending && styles.pending]}>
        {mine ? <Text style={[styles.text, styles.textMine]}>{text}</Text> : <CharacterText text={text} />}
      </View>
    </View>
  )
}

/**
 * A photo he sent. Locked: the teaser (a 24×32 thumbnail) scaled up under a blur
 * and a dark layer, with the unlock control; the real asset is not on the device.
 * Unlocked: the image and his caption.
 */
export function PhotoBubble({
  card,
  caption,
  onUnlock,
  unlocking,
}: {
  card: MomentCard | null
  caption: string
  onUnlock?: (sku: string) => void
  unlocking?: boolean
}) {
  const locked = !card || card.status === 'LOCKED'
  const sku = card?.unlock.kind === 'PURCHASE' ? card.unlock.sku : null
  return (
    <View style={styles.photo}>
      <View style={styles.photoFrame}>
        {locked ? (
          <>
            {card?.teaserUrl ? (
              <Image source={{ uri: card.teaserUrl }} style={styles.photoImage} resizeMode="cover" blurRadius={18} />
            ) : (
              <View style={[styles.photoImage, styles.photoEmpty]} />
            )}
            <View style={styles.veil} />
            <View style={styles.veilContent}>
              <Lock />
              <Text style={styles.veilTitle}>{card?.title ?? 'A photo'}</Text>
              {sku && onUnlock ? (
                <Pressable style={styles.unlock} onPress={() => onUnlock(sku)} disabled={unlocking}>
                  {unlocking ? <ActivityIndicator size="small" color="#0b0a0c" /> : <Text style={styles.unlockText}>Unlock</Text>}
                </Pressable>
              ) : (
                <Text style={styles.veilHint}>Unlock it from his Moments</Text>
              )}
            </View>
          </>
        ) : (
          <Image source={{ uri: card.imageUrl ?? undefined }} style={styles.photoImage} resizeMode="cover" />
        )}
      </View>
      {!locked && <Text style={styles.caption}>{caption}</Text>}
    </View>
  )
}

/** Action beats in muted italics on their own line; speech as the message proper. */
function CharacterText({ text }: { text: string }) {
  const segments = parseReply(text)
  if (!segments.length) return <Text style={styles.text}>{text}</Text>
  return (
    <View style={styles.segments}>
      {segments.map((s, i) =>
        s.kind === 'action' ? (
          <Text key={i} style={styles.action}>{s.text}</Text>
        ) : (
          <Text key={i} style={styles.text}>{s.text}</Text>
        )
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: 3, paddingHorizontal: spacing.lg },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.lg },
  mine: { backgroundColor: colors.ink, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: 'rgba(244,241,236,0.07)', borderBottomLeftRadius: 6 },
  pending: { opacity: 0.6 },
  segments: { gap: 6 },
  text: { color: colors.ink, fontSize: 16, lineHeight: 22 },
  textMine: { color: '#0b0a0c' },
  action: { color: colors.muted, fontSize: 14, lineHeight: 19, fontStyle: 'italic' },
  photo: { maxWidth: '82%', gap: spacing.xs },
  photoFrame: { width: 240, aspectRatio: 3 / 4, borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#0f0e12' },
  photoImage: { width: '100%', height: '100%' },
  photoEmpty: { backgroundColor: '#0f0e12' },
  veil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,5,7,0.7)' },
  veilContent: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  veilTitle: { color: colors.ink, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  veilHint: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  unlock: { backgroundColor: colors.ink, paddingVertical: 10, paddingHorizontal: 22, borderRadius: radius.pill, marginTop: spacing.xs },
  unlockText: { color: '#0b0a0c', fontSize: 14, fontWeight: '700' },
  caption: { color: colors.muted, fontSize: 14, lineHeight: 19, paddingHorizontal: 4 },
  storyWrap: { gap: spacing.sm, marginVertical: spacing.sm },
  narration: { color: colors.muted, fontSize: 15, lineHeight: 22, fontStyle: 'italic', paddingHorizontal: spacing.xl },
  storyLine: { marginTop: spacing.xs },
  systemWrap: { alignItems: 'center', paddingHorizontal: spacing.xl, marginVertical: spacing.sm },
  systemText: { color: colors.faint, fontSize: 13, textAlign: 'center' },
})
