import { useEffect, useRef, useState } from 'react'
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import type { Ringing } from '../store/chat'
import { usePaywall } from '../store/paywall'
import { colors, radius, spacing } from '../theme'

/**
 * He is calling (docs/story-pipeline.md, "Voice"). The whole screen becomes the
 * call: nothing has been written yet, and answering or letting it ring is the
 * choice. When a clip exists and the tier includes calls it plays on answer;
 * otherwise he says it in text, which is what FREE gets, and the screen says so
 * without naming a price.
 *
 * v1 has no microphone and no live audio: the user answers or does not.
 */
export function CallScreen({
  ringing,
  portraitUrl,
  onAnswer,
  onDecline,
}: {
  ringing: Ringing
  portraitUrl: string | null
  onAnswer: () => void
  onDecline: () => void
}) {
  const [seconds, setSeconds] = useState(0)
  const [answered, setAnswered] = useState(false)
  const audioRef = useRef<{ pause: () => void } | null>(null)

  // The ring counts up so the screen is alive while he waits.
  useEffect(() => {
    if (answered) return
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [answered])

  useEffect(() => () => audioRef.current?.pause(), [])

  const answer = () => {
    setAnswered(true)
    // Web can play the clip today; the native build gets it when expo-av lands.
    if (ringing.audioUrl && Platform.OS === 'web' && typeof Audio !== 'undefined') {
      try {
        const el = new Audio(ringing.audioUrl)
        audioRef.current = el
        void el.play()
      } catch {
        // A clip that will not play is not a reason to lose the turn.
      }
    }
    onAnswer()
  }
  const decline = () => {
    audioRef.current?.pause()
    onDecline()
  }

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        {portraitUrl ? <Image source={{ uri: portraitUrl }} style={styles.avatar} resizeMode="cover" /> : <View style={[styles.avatar, styles.avatarEmpty]} />}
        <Text style={styles.name}>{ringing.characterName}</Text>
        <Text style={styles.sub}>
          {answered ? 'Connected' : `Calling… ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`}
        </Text>
        {!answered && ringing.silent === 'NEEDS_PLUS' && (
          <Pressable onPress={() => usePaywall.getState().open('CALL')} hitSlop={8}>
            <Text style={styles.note}>You will read this one. <Text style={styles.noteLink}>Plus hears his voice.</Text></Text>
          </Pressable>
        )}
      </View>
      {!answered && (
        <View style={styles.actions}>
          <Pressable style={[styles.button, styles.decline]} onPress={decline}>
            <Text style={styles.declineText}>Let it ring</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.answer]} onPress={answer}>
            <Text style={styles.answerText}>Answer</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  // Opaque on purpose: a call takes the screen, it does not sit over the scene.
  screen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#06050a', alignItems: 'center', justifyContent: 'center', gap: 64, paddingHorizontal: spacing.xl },
  top: { alignItems: 'center', gap: spacing.sm },
  spacer: { height: 1 },
  avatar: { width: 132, height: 132, borderRadius: 66, backgroundColor: colors.surfaceRaised },
  avatarEmpty: { borderWidth: 1, borderColor: colors.border },
  name: { color: colors.text, fontSize: 26, fontWeight: '700', marginTop: spacing.lg },
  sub: { color: colors.textMuted, fontSize: 15 },
  note: { color: colors.textFaint, fontSize: 13, marginTop: spacing.sm, textAlign: 'center' },
  noteLink: { color: colors.accent, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: spacing.lg },
  button: { paddingVertical: 16, paddingHorizontal: 28, borderRadius: radius.pill, minWidth: 140, alignItems: 'center' },
  decline: { borderWidth: 1, borderColor: colors.border },
  declineText: { color: colors.textMuted, fontSize: 16 },
  answer: { backgroundColor: colors.accent },
  answerText: { color: '#1a0a10', fontSize: 16, fontWeight: '700' },
})
