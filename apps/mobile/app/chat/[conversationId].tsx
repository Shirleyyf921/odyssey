import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { MomentCard } from '@odyssey/shared'
import { MessageBubble } from '../../src/components/MessageBubble'
import { SceneCard } from '../../src/components/SceneCard'
import { api } from '../../src/lib/api'
import { useAskPhoto } from '../../src/lib/askPhoto'
import { billing } from '../../src/lib/billing'
import { ChatSocket } from '../../src/lib/socket'
import { useChatStore } from '../../src/store/chat'
import { colors, radius, spacing } from '../../src/theme'

type Row = { key: string; role: 'USER' | 'CHARACTER' | 'SYSTEM'; text: string; pending?: boolean; at: string; momentId?: string | null }

export default function ChatScreen() {
  const { conversationId, name, characterId, episodeId } = useLocalSearchParams<{ conversationId: string; name?: string; characterId?: string; episodeId?: string }>()
  const character = useQuery({
    queryKey: ['character', characterId],
    queryFn: () => api.character(characterId!),
    enabled: !!characterId,
  })
  const scene = character.data?.scenes.find((sc) => sc.id === character.data?.relationship?.sceneId) ?? null
  const qc = useQueryClient()
  // Photo messages read their card from here; the socket refetches it when he sends one.
  const moments = useQuery({
    queryKey: ['moments', characterId],
    queryFn: () => api.moments(characterId!),
    enabled: !!characterId,
  })
  const cardById = useMemo(() => new Map((moments.data?.moments ?? []).map((m) => [m.id, m])), [moments.data])
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const [unlockingSku, setUnlockingSku] = useState<string | null>(null)
  const unlock = useMutation({
    // Store purchase when the SDK is here; in a dev build without it, the dogfood route.
    mutationFn: (sku: string) => (billing.available ? billing.purchaseSku(sku) : api.devPurchase({ sku }).then(() => true)),
    onMutate: (sku) => setUnlockingSku(sku),
    onSettled: () => {
      setUnlockingSku(null)
      void qc.invalidateQueries({ queryKey: ['moments', characterId] })
      void qc.invalidateQueries({ queryKey: ['me'] })
    },
  })
  const canUnlock = (billing.available && me.data?.billing.enabled === true) || __DEV__
  const skuOf = (card: MomentCard | null | undefined) => (card?.unlock.kind === 'PURCHASE' ? card.unlock.sku : null)
  const insets = useSafeAreaInsets()
  const [draft, setDraft] = useState('')
  const photo = useAskPhoto(conversationId, characterId)
  const socketRef = useRef<ChatSocket | null>(null)

  const status = useChatStore((s) => s.status)
  const conv = useChatStore((s) => s.conversations[conversationId])
  const { setStatus, apply, addPending, dismissIntervention, lastMessageId } = useChatStore.getState()

  useEffect(() => {
    if (!conversationId) return
    const socket = new ChatSocket(
      conversationId,
      {
        onStatus: (st) => {
          setStatus(st)
          // Opening an episode is idempotent on the server: a reconnect just resumes it.
          if (st === 'open' && episodeId) socket.startEpisode(episodeId)
        },
        onEvent: (e) => {
          apply(conversationId, e)
          if (e.type === 'moment_offer' || e.type === 'moment_unlocked') void qc.invalidateQueries({ queryKey: ['moments', characterId] })
          if (e.type === 'episode_ended') void qc.invalidateQueries({ queryKey: ['episodes', characterId] })
        },
      },
      () => lastMessageId(conversationId)
    )
    socketRef.current = socket
    void socket.connect()
    return () => socket.close()
  }, [conversationId, characterId, episodeId, qc, setStatus, apply, lastMessageId])

  // Inverted list: newest first in data, rendered bottom-up.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    for (const m of conv?.messages ?? []) out.push({ key: m.id, role: m.role, text: m.content, at: m.createdAt, momentId: m.momentId })
    for (const n of conv?.notices ?? []) out.push({ key: n.key, role: 'SYSTEM', text: n.text, at: n.at })
    out.sort((a, b) => a.at.localeCompare(b.at))
    const far = '9999'
    for (const p of conv?.pending ?? []) out.push({ key: p.clientMsgId, role: 'USER', text: p.content, pending: true, at: far })
    if (conv?.streaming) out.push({ key: conv.streaming.messageId, role: 'CHARACTER', text: conv.streaming.text || '…', at: far })
    return out.reverse()
  }, [conv])

  const send = () => {
    const content = draft.trim()
    if (!content || !socketRef.current) return
    const clientMsgId = socketRef.current.sendMessage(content)
    addPending(conversationId, { clientMsgId, content })
    setDraft('')
  }
  const choose = (index: number) => {
    const option = conv?.choices?.options[index]
    if (!option || !socketRef.current) return
    const clientMsgId = socketRef.current.sendMessage(option, index)
    addPending(conversationId, { clientMsgId, content: option })
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: conv?.episodeTitle ?? name ?? 'Chat' }} />
      {status !== 'open' && <Text style={styles.banner}>{status === 'connecting' ? 'Connecting…' : 'Reconnecting…'}</Text>}

      <FlatList
        inverted
        data={rows}
        keyExtractor={(r) => r.key}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <MessageBubble
            role={item.role}
            text={item.text}
            pending={item.pending}
            moment={item.momentId ? (cardById.get(item.momentId) ?? null) : undefined}
            onUnlock={canUnlock ? (sku) => unlock.mutate(sku) : undefined}
            unlocking={unlockingSku !== null && !!item.momentId && skuOf(cardById.get(item.momentId)) === unlockingSku}
          />
        )}
        // Inverted list: the footer renders at the visual top, above the oldest message.
        ListFooterComponent={scene ? <SceneCard scene={scene} /> : null}
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

      {conv?.choices && conv.choices.options.length > 0 && !conv.streaming && (
        <View style={styles.choices}>
          {conv.choices.options.map((o, i) => (
            <Pressable key={i} style={styles.choice} onPress={() => choose(i)} disabled={status !== 'open'}>
              <Text style={styles.choiceText}>{o}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Pressable style={[styles.ask, photo.taking && styles.disabled]} onPress={photo.ask} disabled={photo.taking || status !== 'open'} hitSlop={6}>
        <Text style={styles.askText}>{photo.taking ? 'He is taking one…' : photo.line ?? 'Ask him for a picture'}</Text>
      </Pressable>
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Say something"
          placeholderTextColor={colors.faint}
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
  screen: { flex: 1, backgroundColor: colors.ground },
  banner: { color: colors.faint, fontSize: 12, textAlign: 'center', paddingVertical: 4 },
  list: { paddingVertical: spacing.md },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.hairline, backgroundColor: colors.ground },
  input: { flex: 1, minHeight: 44, maxHeight: 120, color: colors.ink, fontSize: 16, backgroundColor: 'rgba(244,241,236,0.06)', borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 12 },
  sendButton: { backgroundColor: colors.ink, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.pill },
  sendText: { color: '#0b0a0c', fontWeight: '700' },
  disabled: { opacity: 0.4 },
  ask: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 14 },
  askText: { color: colors.faint, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' },
  intervention: { margin: spacing.lg, padding: spacing.lg, backgroundColor: colors.glass, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(244,241,236,0.18)', gap: spacing.sm },
  interventionBody: { color: colors.ink, fontSize: 15, lineHeight: 21 },
  resource: { color: colors.ink, fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
  dismiss: { color: colors.muted, fontSize: 13, marginTop: spacing.xs },
  error: { color: colors.ink, fontSize: 13, textAlign: 'center', paddingVertical: 4 },
  choices: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  choice: { borderWidth: 1, borderColor: 'rgba(244,241,236,0.18)', borderRadius: radius.pill, paddingVertical: 12, paddingHorizontal: 18 },
  choiceText: { color: colors.ink, fontSize: 15 },
})
