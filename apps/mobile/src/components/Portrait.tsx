import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native'
import { colors, radius } from '../theme'

interface Props {
  url: string | null
  name: string
  style?: StyleProp<ImageStyle>
}

/** Identity image, or a placeholder until the assets arrive. */
export function Portrait({ url, name, style }: Props) {
  if (url) return <Image source={{ uri: url }} style={[styles.image, style]} resizeMode="cover" />
  return (
    <View style={[styles.image, styles.placeholder, style as StyleProp<ViewStyle>]}>
      <Text style={styles.initial}>{name.slice(0, 1)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  image: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: '#0f0e12' },
  placeholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.hairline },
  initial: { color: colors.faint, fontSize: 64, fontWeight: '700' },
})
