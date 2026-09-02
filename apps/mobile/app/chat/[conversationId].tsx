import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MessageBubble } from '../../src/components/MessageBubble'
import { ChatSocket } from '../../src/lib/socket'
import { useChatStore } from '../../src/store/chat'
import { colors, radius, spacing } from '../../src/theme'

type Row =
  | { key: string; role: 'USER' | 'CHARACTER' | 'SYSTEM'; text: string; pending?: boolean }

export default function ChatScreen() {
  const { conversationId, name } = useLocalSearchParams<{ conversationId: string; name?: string }>()
  const insets = useSafeAreaInsets()
  const [draft, setDraft] = useState('')
  const socketRef = useRef<ChatSocket | null>(null)

  const status = useChatStore((s) => s.status)
  const conv = useChatStore((s) => s.conversations[conversationId])
  const { setStatus, apply, addPending, dismissIntervention, lastMessageId } = useChatStore.getState()

  useEffect(() => {
    if (!conversationId) return
    const socket = new ChatSocket(
      conversationId,
      { onStatus: setStatus, onEvent: (e) => apply(conversationId, e) },
      () => lastMessageId(conversationId)
    )
    socketRef.current = socket
    void socket.connect()
    return () => socket.close()
  }, [conversationId, setStatus, apply, lastMessageId])

  // Inverted list: newest first in data, rendered bottom-up.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    for (const m of conv?.messages ?? []) out.push({ key: m.id, role: m.role, text: m.content })
    for (const p of conv?.pending ?? []) out.push({ key: p.clientMsgId, role: 'USER', text: p.content, pending: true })
    if (conv?.streaming) out.push({ key: conv.streaming.messageId, role: 'CHARACTER', text: conv.streaming.text || '…' })
    return out.reverse()
  }, [conv])

  const send = () => {
    const content = draft.trim()
    if (!content || !socketRef.current) return
    const clientMsgId = socketRef.current.sendMessage(content)
    addPending(conversationId, { clientMsgId, content })
    setDraft('')
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: name || 'Chat' }} />
      {status !== 'open' && <Text style={styles.banner}>{status === 'connecting' ? 'Connecting…' : 'Reconnecting…'}</Text>}

      <FlatList
        inverted
        data={rows}
        keyExtractor={(r) => r.key}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <MessageBubble role={item.role} text={item.text} pending={item.pending} />}
      />

      {conv?.intervention && (
        <View style={styles.intervention}>
          <Text style={styles.interventionBody}>{conv.intervention.body}</Text>
          {conv.intervention.resources.map((r) => (
            <Pressable key={r.label} onPress={() => void Linking.openURL(r.url ?? `tel:${r.phone ?? ''}`)}>
              <Text style={styles.resource}>{r.label}{r.phone ? ` · ${r.phone}` : ''}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => dismissIntervention(conversationId)}><Text style={styles.dismiss}>Close</Text></Pressable>
        </View>
      )}
      {conv?.error && <Text style={styles.error}>{conv.error}</Text>}

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Say something"
          placeholderTextColor={colors.textFaint}
          multiline
          onSubmitEditing={send}
          blurOnSubmit
        />
        <Pressable onPress={send} disabled={!draft.trim() || status !== 'open'} style={[styles.sendButton, (!draft.trim() || status !== 'open') && styles.disabled]}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  banner: { color: colors.textMuted, fontSize: 12, textAlign: 'center', paddingVertical: 4, backgroundColor: colors.surface },
  list: { paddingVertical: spacing.md },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  input: { flex: 1, minHeight: 42, maxHeight: 120, color: colors.text, fontSize: 16, backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10 },
  sendButton: { backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.pill },
  sendText: { color: '#1a0a10', fontWeight: '700' },
  disabled: { opacity: 0.4 },
  intervention: { margin: spacing.md, padding: spacing.lg, backgroundColor: colors.surfaceRaised, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.accent, gap: spacing.sm },
  interventionBody: { color: colors.text, fontSize: 15, lineHeight: 21 },
  resource: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  dismiss: { color: colors.textMuted, fontSize: 13, marginTop: spacing.xs },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center', paddingVertical: 4 },
})
