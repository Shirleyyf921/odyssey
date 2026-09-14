import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { PhotoKind } from '@odyssey/shared'
import { colors, radius, spacing } from '../theme'

/**
 * Ask him for a picture, as a menu (2026-09-14): where he is now, anywhere;
 * the morning and the one only she gets, when the level allows. The client
 * only decides what to show; the server decides what to give.
 */
const KINDS: Array<{ kind: PhotoKind; label: string; hot: boolean }> = [
  { kind: 'NOW', label: 'Where you are', hot: false },
  { kind: 'MORNING', label: 'The morning after', hot: true },
  { kind: 'ONLY_YOU', label: 'Only for me', hot: true },
]

interface Props {
  taking: boolean
  /** A line to show instead of the prompt: a refusal, or nothing. */
  line: string | null
  /** Whether the hotter kinds may be offered here (lib/levels.ts). */
  mature: boolean
  disabled?: boolean
  onAsk(kind: PhotoKind): void
  /** Text colour for the closed state; the chat is fainter than the stage. */
  tone?: 'muted' | 'faint'
}

export function PhotoMenu({ taking, line, mature, disabled, onAsk, tone = 'muted' }: Props) {
  const [open, setOpen] = useState(false)
  const kinds = KINDS.filter((k) => !k.hot || mature)
  if (taking) return <Text style={[styles.prompt, tone === 'faint' && styles.faint]}>He is taking one…</Text>
  if (!open) {
    return (
      <Pressable style={styles.promptWrap} onPress={() => setOpen(true)} disabled={disabled} hitSlop={6}>
        <Text style={[styles.prompt, tone === 'faint' && styles.faint]}>{line ?? 'Ask him for a picture'}</Text>
      </Pressable>
    )
  }
  return (
    <View style={styles.row}>
      {kinds.map((k) => (
        <Pressable
          key={k.kind}
          style={styles.chip}
          disabled={disabled}
          onPress={() => {
            setOpen(false)
            onAsk(k.kind)
          }}
        >
          <Text style={styles.chipText}>{k.label}</Text>
        </Pressable>
      ))}
      <Pressable style={styles.cancel} onPress={() => setOpen(false)} hitSlop={6}>
        <Text style={styles.cancelText}>Not now</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  promptWrap: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 14 },
  prompt: { color: colors.muted, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'center' },
  faint: { color: colors.faint, fontSize: 11 },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  chip: { borderWidth: 1, borderColor: 'rgba(244,241,236,0.22)', borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.glassSoft },
  chipText: { color: colors.ink, fontSize: 13 },
  cancel: { paddingHorizontal: 8, paddingVertical: 8 },
  cancelText: { color: colors.faint, fontSize: 12 },
})
