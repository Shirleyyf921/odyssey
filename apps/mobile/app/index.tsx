import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PROMPT_VERSION } from '@odyssey/prompts'

export default function Home() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>odyssey</Text>
        <Text style={styles.subtitle}>Scaffold is up.</Text>
        {/* Proves cross-package resolution works through Metro. */}
        <Text style={styles.meta}>prompts v{PROMPT_VERSION}</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d12' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { color: '#f5f5f7', fontSize: 34, fontWeight: '700' },
  subtitle: { color: '#9a9aa8', fontSize: 15 },
  meta: { color: '#5a5a68', fontSize: 12, marginTop: 12 },
})
