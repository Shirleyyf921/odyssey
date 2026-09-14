import { StyleSheet, View } from 'react-native'
import { colors } from '../theme'

/** The one lock in the app: a drawn glyph in ink, never an emoji (design canvas, direction B). */
export function Lock({ size = 16, color = colors.ink }: { size?: number; color?: string }) {
  const s = size / 16
  return (
    <View style={{ width: 16 * s, height: 18 * s, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View style={[styles.shackle, { width: 10 * s, height: 9 * s, borderColor: color, borderWidth: 1.6 * s }]} />
      <View style={[styles.body, { width: 16 * s, height: 10 * s, backgroundColor: color }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  shackle: { borderBottomWidth: 0, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  body: { borderRadius: 2 },
})
