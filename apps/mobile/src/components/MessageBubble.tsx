import { StyleSheet, Text, View } from 'react-native'
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
        <Text style={[styles.text, mine && styles.textMine]}>{text}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: 3, paddingHorizontal: spacing.lg },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.lg },
  mine: { backgroundColor: colors.bubbleUser, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.bubbleCharacter, borderBottomLeftRadius: 6 },
  pending: { opacity: 0.6 },
  text: { color: colors.text, fontSize: 16, lineHeight: 22 },
  textMine: { color: '#1a0a10' },
  systemWrap: { alignItems: 'center', paddingHorizontal: spacing.xl, marginVertical: spacing.sm },
  systemText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
})
