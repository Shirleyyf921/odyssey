import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Stack, router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { parseReply, parseStoryOutput } from '@odyssey/shared'
import { PhotoBubble } from '../../src/components/MessageBubble'
import { api } from '../../src/lib/api'
import { billing } from '../../src/lib/billing'
import { ChatSocket } from '../../src/lib/socket'
import { useChatStore } from '../../src/store/chat'
import { colors, radius, spacing } from '../../src/theme'

/**
 * The stage (docs/story-pipeline.md, "Stage"). His portrait in the scene, full
 * bleed; narration and his line in the lower third; tap to advance; two option
 * chips and a free-text line under his last line. The transcript view is the
 * chat screen, one tap away.
 *
 * Pages: the latest CHARACTER message is split into narration paragraphs plus
 * his line. A message that arrived live is already read (it streamed in); a
 * message found in history, including his opener, starts at page one so the
 * user taps through it.
 */

type Page = { kind: 'narration'; text: string } | { kind: 'line'; text: string }

function pagesOf(content: string): Page[] {
  const turn = parseStoryOutput(content)
  const pages: Page[] = turn.narration.map((text) => ({ kind: 'narration' as const, text }))
  if (turn.line) pages.push({ kind: 'line', text: turn.line })
  return pages
}

export default function StoryScreen() {
  const { conversationId, name, characterId, episodeId } = useLocalSearchParams<{
    conversationId: string
    name?: string
    characterId?: string
    episodeId?: string
  }>()
  const qc = useQueryClient()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const character = useQuery({ queryKey: ['character', characterId], queryFn: () => api.character(characterId!), enabled: !!characterId })
  const moments = useQuery({ queryKey: ['moments', characterId], queryFn: () => api.moments(characterId!), enabled: !!characterId })
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const cardById = useMemo(() => new Map((moments.data?.moments ?? []).map((m) => [m.id, m])), [moments.data])

  const status = useChatStore((s) => s.status)
  const conv = useChatStore((s) => s.conversations[conversationId])
  const { setStatus, apply, addPending, dismissIntervention, lastMessageId } = useChatStore.getState()
  const socketRef = useRef<ChatSocket | null>(null)

  useEffect(() => {
    if (!conversationId) return
    const socket = new ChatSocket(
      conversationId,
      {
        onStatus: (st) => {
          setStatus(st)
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

  // ---------------------------------------------------------------- what is on stage
  const messages = conv?.messages ?? []
  const lastCharacter = useMemo(() => [...messages].reverse().find((m) => m.role === 'CHARACTER' && !m.momentId) ?? null, [messages])
  const lastPhoto = useMemo(() => [...messages].reverse().find((m) => !!m.momentId) ?? null, [messages])
  const pages = useMemo(() => (lastCharacter ? pagesOf(lastCharacter.content) : []), [lastCharacter])
  const [pageIndex, setPageIndex] = useState(0)
  const [dismissedPhoto, setDismissedPhoto] = useState<string | null>(null)
  const liveIds = useRef(new Set<string>())
  const streaming = conv?.streaming ?? null
  useEffect(() => {
    if (streaming) liveIds.current.add(streaming.messageId)
  }, [streaming])
  useEffect(() => {
    // A message that streamed in has been read as it arrived; one from history starts at the top.
    if (!lastCharacter) return
    setPageIndex(liveIds.current.has(lastCharacter.id) ? Math.max(0, pages.length - 1) : 0)
  }, [lastCharacter?.id, pages.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const atEnd = pageIndex >= pages.length - 1
  const showPhoto = lastPhoto && dismissedPhoto !== lastPhoto.id && (!lastCharacter || lastPhoto.createdAt >= lastCharacter.createdAt || atEnd)
  const choices = conv?.choices ?? null
  const ended = !!conv?.notices.some((n) => n.key.startsWith('end-'))
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')

  const hero = character.data?.portraits[0]?.url ?? null
  const scene = character.data?.scenes.find((sc) => sc.id === character.data?.relationship?.sceneId) ?? character.data?.scenes[0] ?? null

  // ---------------------------------------------------------------- actions
  const advance = () => {
    if (streaming) return
    if (!atEnd) setPageIndex((i) => i + 1)
  }
  const choose = (index: number) => {
    const option = choices?.options[index]
    if (!option || !socketRef.current) return
    const clientMsgId = socketRef.current.sendMessage(option, index)
    addPending(conversationId, { clientMsgId, content: option })
  }
  const send = () => {
    const content = draft.trim()
    if (!content || !socketRef.current) return
    const clientMsgId = socketRef.current.sendMessage(content)
    addPending(conversationId, { clientMsgId, content })
    setDraft('')
    setTyping(false)
  }
  const pending = conv?.pending.at(-1) ?? null
  const canUnlock = (billing.available && me.data?.billing.enabled === true) || __DEV__
  const unlock = async (sku: string) => {
    try {
      if (billing.available) await billing.purchaseSku(sku)
      else await api.devPurchase({ sku })
    } finally {
      void qc.invalidateQueries({ queryKey: ['moments', characterId] })
    }
  }

  // ---------------------------------------------------------------- render
  const live: Page | null = streaming
    ? streaming.line
      ? { kind: 'line', text: streaming.line }
      : streaming.narration
        ? { kind: 'narration', text: streaming.narration }
        : { kind: 'narration', text: streaming.text || '…' }
    : null
  const page = live ?? pages[pageIndex] ?? null

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: conv?.episodeTitle ?? name ?? '',
          headerRight: () => (
            <Link href={{ pathname: '/chat/[conversationId]', params: { conversationId, name: name ?? '', characterId: characterId ?? '' } }} asChild>
              <Pressable hitSlop={8}><Text style={styles.headerLink}>Transcript</Text></Pressable>
            </Link>
          ),
        }}
      />

      {/* The scene, then him in it. */}
      {scene?.backdropUrl ? <Image source={{ uri: scene.backdropUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={6} /> : null}
      <View style={[StyleSheet.absoluteFill, styles.dim]} />
      <View style={[styles.portraitWrap, { height: height * 0.62, paddingTop: insets.top + 44 }]}>
        {hero ? <Image source={{ uri: hero }} style={styles.portrait} resizeMode="cover" /> : <View style={[styles.portrait, styles.portraitEmpty]} />}
        <View style={styles.portraitFade} />
      </View>

      {status !== 'open' && <Text style={[styles.banner, { top: insets.top + 44 }]}>{status === 'connecting' ? 'Connecting…' : 'Reconnecting…'}</Text>}

      {/* The lower third. */}
      <View style={[styles.panelWrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Pressable style={styles.panel} onPress={advance} disabled={!!streaming || atEnd}>
          {pending && !streaming && !page ? <Text style={styles.you}>{pending.content}</Text> : null}
          {page?.kind === 'narration' && <Text style={styles.narration}>{page.text}</Text>}
          {page?.kind === 'line' && <LineText text={page.text} name={name ?? ''} />}
          {!page && !pending && <Text style={styles.narration}>{scene?.setting ?? ''}</Text>}
          {!streaming && !atEnd && pages.length > 0 && <Text style={styles.tapHint}>tap</Text>}
          {streaming && <Text style={styles.tapHint}>…</Text>}
        </Pressable>

        {conv?.error && <Text style={styles.error}>{conv.error}</Text>}

        {ended ? (
          <Pressable style={styles.choice} onPress={() => router.back()}>
            <Text style={styles.choiceText}>End of tonight. Back to him.</Text>
          </Pressable>
        ) : atEnd && !streaming && !pending ? (
          <View style={styles.choices}>
            {(choices?.options ?? []).map((o, i) => (
              <Pressable key={i} style={styles.choice} onPress={() => choose(i)} disabled={status !== 'open'}>
                <Text style={styles.choiceText}>{o}</Text>
              </Pressable>
            ))}
            {typing ? (
              <View style={styles.composer}>
                <TextInput
                  style={styles.input}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Say something"
                  placeholderTextColor={colors.textFaint}
                  autoFocus
                  multiline
                  onSubmitEditing={send}
                  blurOnSubmit
                />
                <Pressable onPress={send} disabled={!draft.trim() || status !== 'open'} style={[styles.sendButton, (!draft.trim() || status !== 'open') && styles.disabled]}>
                  <Text style={styles.sendText}>Send</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={[styles.choice, styles.choiceFree]} onPress={() => setTyping(true)} disabled={status !== 'open'}>
                <Text style={styles.choiceFreeText}>Say something…</Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </View>

      {/* He sent a photo: it takes the stage until dismissed. */}
      {showPhoto && lastPhoto ? (
        <View style={styles.photoVeil}>
          <PhotoBubble
            card={lastPhoto.momentId ? (cardById.get(lastPhoto.momentId) ?? null) : null}
            caption={lastPhoto.content}
            onUnlock={canUnlock ? (sku) => void unlock(sku) : undefined}
          />
          <Pressable onPress={() => setDismissedPhoto(lastPhoto.id)} hitSlop={12}>
            <Text style={styles.dismiss}>Later</Text>
          </Pressable>
        </View>
      ) : null}

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
    </KeyboardAvoidingView>
  )
}

/** His line on the stage: the action beat small and muted, the speech large. */
function LineText({ text, name }: { text: string; name: string }) {
  const segments = parseReply(text)
  return (
    <View style={styles.lineWrap}>
      {name ? <Text style={styles.speaker}>{name}</Text> : null}
      {segments.map((s, i) =>
        s.kind === 'action' ? (
          <Text key={i} style={styles.action}>{s.text}</Text>
        ) : (
          <Text key={i} style={styles.speech}>{s.text}</Text>
        )
      )}
    </View>
  )
}

const FILL = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  dim: { backgroundColor: 'rgba(8, 6, 12, 0.45)' },
  headerLink: { color: colors.textMuted, fontSize: 15 },
  banner: { position: 'absolute', alignSelf: 'center', color: colors.textMuted, fontSize: 12, paddingVertical: 4, paddingHorizontal: 12, backgroundColor: 'rgba(22,22,31,0.8)', borderRadius: radius.pill },
  portraitWrap: { alignItems: 'center', justifyContent: 'flex-start' },
  portrait: { width: '78%', height: '100%', borderRadius: radius.lg },
  portraitEmpty: { backgroundColor: colors.surfaceRaised },
  portraitFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 120, backgroundColor: 'rgba(13, 13, 18, 0.55)' },
  panelWrap: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: spacing.lg, gap: spacing.sm },
  panel: { minHeight: 132, backgroundColor: 'rgba(13, 13, 18, 0.86)', borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  you: { color: colors.accent, fontSize: 14, fontStyle: 'italic' },
  narration: { color: colors.textMuted, fontSize: 16, lineHeight: 24, fontStyle: 'italic' },
  lineWrap: { gap: 4 },
  speaker: { color: colors.accent, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  action: { color: colors.textMuted, fontSize: 14, lineHeight: 19, fontStyle: 'italic' },
  speech: { color: colors.text, fontSize: 18, lineHeight: 26 },
  tapHint: { color: colors.textFaint, fontSize: 11, alignSelf: 'flex-end', letterSpacing: 1, textTransform: 'uppercase' },
  choices: { gap: spacing.sm },
  choice: { borderWidth: 1, borderColor: colors.accent, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: 'rgba(13, 13, 18, 0.86)' },
  choiceText: { color: colors.text, fontSize: 15 },
  choiceFree: { borderColor: colors.border },
  choiceFreeText: { color: colors.textMuted, fontSize: 15 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: { flex: 1, minHeight: 44, maxHeight: 120, color: colors.text, fontSize: 16, backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10 },
  sendButton: { backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.pill },
  sendText: { color: '#1a0a10', fontWeight: '700' },
  disabled: { opacity: 0.4 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  photoVeil: { ...FILL, backgroundColor: 'rgba(8, 6, 12, 0.92)', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  dismiss: { color: colors.textMuted, fontSize: 14 },
  intervention: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.xl, padding: spacing.lg, backgroundColor: colors.surfaceRaised, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.accent, gap: spacing.sm },
  interventionBody: { color: colors.text, fontSize: 15, lineHeight: 21 },
  resource: { color: colors.accent, fontSize: 15, fontWeight: '600' },
})
