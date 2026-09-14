import { Image, StyleSheet, Text, View } from 'react-native'
import type { Scene } from '@odyssey/shared'
import { colors, radius, spacing } from '../theme'

/**
 * Sits at the top of a conversation: the backdrop is the visual of this
 * setting, the caption is the setting line the persona reads. Placeholder
 * until the art exists.
 */
export function SceneCard({ scene }: { scene: Scene }) {
  return (
    <View style={styles.wrap}>
      {scene.backdropUrl ? (
        <Image source={{ uri: scene.backdropUrl }} style={styles.backdrop} resizeMode="cover" />
      ) : (
        <View style={[styles.backdrop, styles.placeholder]}>
          <Text style={styles.placeholderText}>{scene.title}</Text>
        </View>
      )}
      <Text style={styles.title}>{scene.title}</Text>
      <Text style={styles.setting}>{scene.setting}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.lg, gap: 2 },
  backdrop: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md, backgroundColor: '#0f0e12' },
  placeholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.hairline },
  placeholderText: { color: colors.faint, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: 15, fontWeight: '700', marginTop: spacing.sm },
  setting: { color: colors.muted, fontSize: 13, lineHeight: 19 },
})
