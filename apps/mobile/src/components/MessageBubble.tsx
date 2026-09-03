import { StyleSheet, Text, View } from 'react-native'
import { parseReply } from '@odyssey/shared'
import { colors, radius, spacing } from '../theme'

interface Props {
  role: 'USER' | 'CHARACTER' | 'SYSTEM'
  text: string
  pending?: boolean
}

export function MessageBubble({ role, text, pending }: Props) {
  if (role === 'SYSTEM') {
    return (
      <View style={styles.systemWrap}>
        <Text style={styles.systemText}>{text}</Text>
      </View>
    )
  }
  const mine = role === 'USER'
  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs, pending && styles.pending]}>
        {mine ? <Text style={[styles.text, styles.textMine]}>{text}</Text> : <CharacterText text={text} />}
      </View>
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
  mine: { backgroundColor: colors.bubbleUser, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.bubbleCharacter, borderBottomLeftRadius: 6 },
  pending: { opacity: 0.6 },
  segments: { gap: 6 },
  text: { color: colors.text, fontSize: 16, lineHeight: 22 },
  textMine: { color: '#1a0a10' },
  action: { color: colors.textMuted, fontSize: 14, lineHeight: 19, fontStyle: 'italic' },
  systemWrap: { alignItems: 'center', paddingHorizontal: spacing.xl, marginVertical: spacing.sm },
  systemText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
})
