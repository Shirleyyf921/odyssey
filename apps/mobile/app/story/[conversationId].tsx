import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Stack, router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Animated,
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
import { parseReply, parseStoryOutput, type Hotspot, type HotspotRect, type MomentCard } from '@odyssey/shared'
import { CallScreen } from '../../src/components/CallScreen'
import { PhotoBubble } from '../../src/components/MessageBubble'
import { api } from '../../src/lib/api'
import { billing } from '../../src/lib/billing'
import { ChatSocket } from '../../src/lib/socket'
import { useChatStore } from '../../src/store/chat'
import { colors, radius, spacing } from '../../src/theme'

/**
 * The stage (docs/story-pipeline.md, "Stage"). His portrait in the scene, full
 * bleed; one sentence at a time in the lower third, typed out; a tap finishes
 * the sentence or brings the next; the options rise only when the last
 * sentence has landed. The transcript view is the chat screen, one tap away.
 *
 * Pacing, after the reference in docs/story-pipeline.md ("Stage"): nothing is
 * ever on screen at once. A turn is a queue of pages: the episode's setting
 * the first time, the user's own choice once, each sentence of narration
 * unnamed, his line under his name. A message that streams in feeds the queue
 * as sentences complete; a message from history queues whole. The user reads
 * at their own speed either way.
 */

type Page =
  | { kind: 'prologue'; text: string }
  | { kind: 'you'; text: string; name: string }
  | { kind: 'narration'; text: string }
  | { kind: 'line'; text: string }
  /** A photo the story gave: the stage becomes it, and his caption is the page. */
  | { kind: 'photo'; text: string; imageUrl: string }

/** Milliseconds per character. Narration reads a touch faster than speech. */
const TYPE_MS: Record<Page['kind'], number> = { prologue: 22, you: 18, narration: 24, line: 30, photo: 30 }

/** Sentences of a paragraph, terminal punctuation kept. Ellipses and closing quotes stay with their sentence. */
function sentencesOf(paragraph: string): string[] {
  const out: string[] = []
  const re = /[^.!?…]+(?:[.!?…]+["'”’)]*|$)/g
  for (const m of paragraph.matchAll(re)) {
    const t = m[0].trim()
    if (t) out.push(t)
  }
  return out.length ? out : [paragraph.trim()].filter(Boolean)
}

/** Whether the last sentence of streaming text has landed: it ends in terminal punctuation. */
const complete = (t: string) => /[.!?…]["'”’)]*\s*$/.test(t)

function pagesOf(content: string, opts: { streaming: boolean }): Page[] {
  const turn = parseStoryOutput(content)
  const pages: Page[] = []
  const paragraphs = turn.narration
  paragraphs.forEach((paragraph, pi) => {
    const sentences = sentencesOf(paragraph)
    sentences.forEach((text, si) => {
      const last = pi === paragraphs.length - 1 && si === sentences.length - 1
      // While streaming, hold back a sentence that is still being written.
      if (opts.streaming && last && !turn.line && !complete(text)) return
      pages.push({ kind: 'narration', text })
    })
  })
  // The line arrives last; while streaming it is shown only once the message has
  // ended. Each action beat and each stretch of speech is its own page, under his name.
  if (turn.line && !opts.streaming) {
    for (const seg of parseReply(turn.line)) {
      const text = seg.kind === 'action' ? `*${seg.text}*` : seg.text
      if (text.trim()) pages.push({ kind: 'line', text })
    }
  }
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
  const streaming = conv?.streaming ?? null
  const pending = conv?.pending.at(-1) ?? null
  const choices = conv?.choices ?? null
  const ringing = conv?.ringing ?? null
  const ended = !!conv?.notices.some((n) => n.key.startsWith('end-'))
  const [dismissedPhoto, setDismissedPhoto] = useState<string | null>(null)
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const myName = me.data?.user.displayName ?? 'You'
  const episodes = useQuery({ queryKey: ['episodes', characterId], queryFn: () => api.episodes(characterId!), enabled: !!characterId })
  const scene = character.data?.scenes.find((sc) => sc.id === character.data?.relationship?.sceneId) ?? character.data?.scenes[0] ?? null

  /**
   * The queue for the turn on stage. Keyed by the message it comes from so a
   * message that finishes streaming keeps its place: the id does not change
   * between message_start and message_end.
   */
  // The user's own words: sent and not yet acknowledged, or acknowledged and not yet answered.
  const lastUser = useMemo(() => [...messages].reverse().find((m) => m.role === 'USER') ?? null, [messages])
  const yours = useMemo<Page | null>(
    () =>
      pending
        ? { kind: 'you', text: pending.content, name: myName }
        : lastUser && (!lastCharacter || lastUser.createdAt > lastCharacter.createdAt)
          ? { kind: 'you', text: lastUser.content, name: myName }
          : null,
    [pending, lastUser, lastCharacter, myName]
  )
  const turnKey = streaming?.messageId ?? (yours ? `you:${pending?.clientMsgId ?? lastUser?.id}` : (lastCharacter?.id ?? 'none'))
  const pages = useMemo<Page[]>(() => {
    if (streaming) {
      const head: Page[] = yours ? [yours] : []
      return [...head, ...pagesOf(streaming.text, { streaming: true })]
    }
    // Sent, nothing back yet: the user's own words, once, while he thinks.
    if (yours) return [yours]
    if (!lastCharacter) return scene ? [{ kind: 'prologue', text: scene.setting }] : []
    const body = pagesOf(lastCharacter.content, { streaming: false })
    // A photo the story gave with this turn: the stage becomes it, his caption under his name.
    const given = lastPhoto && lastPhoto.createdAt >= lastCharacter.createdAt ? cardById.get(lastPhoto.momentId ?? '') : null
    if (given?.status === 'UNLOCKED' && given.imageUrl) body.push({ kind: 'photo', text: lastPhoto!.content, imageUrl: given.imageUrl })
    // His opener is the first thing of the night: the setting comes before it, once.
    // On the first beat with nothing said back yet, what is on stage is the opener.
    const isOpener = choices?.beat.position === 1 && messages.at(-1)?.id === lastCharacter.id
    if (isOpener && conv?.episodeTitle) {
      const card = episodes.data?.episodes.find((e) => e.id === episodeId) ?? null
      const text = [card?.premise, scene?.setting].filter(Boolean).join('\n\n')
      if (text) return [{ kind: 'prologue', text }, ...body]
    }
    return body
  }, [streaming, yours, lastCharacter, lastPhoto, cardById, messages, scene, episodes.data, episodeId, conv?.episodeTitle, choices?.beat.position]) // eslint-disable-line react-hooks/exhaustive-deps

  const [pageIndex, setPageIndex] = useState(0)
  const [shown, setShown] = useState(0)
  const keyRef = useRef(turnKey)
  useEffect(() => {
    if (keyRef.current === turnKey) return
    // The user's own words were typed while he thought; when his reply starts
    // streaming the queue grows under them, it does not start over.
    const carried = keyRef.current.startsWith('you:') && (turnKey.startsWith('you:') || !!streaming)
    keyRef.current = turnKey
    if (!carried) {
      setPageIndex(0)
      setShown(0)
    }
  }, [turnKey, streaming])
  const page = pages[Math.min(pageIndex, Math.max(0, pages.length - 1))] ?? null
  const pageText = page?.text ?? ''
  const revealing = page !== null && shown < pageText.length
  const atEnd = !streaming && pageIndex >= pages.length - 1
  /** Nothing more to read yet, and he is still writing (or has not started). */
  const waiting = !revealing && pageIndex >= pages.length - 1 && (!!streaming || (!!yours && page?.kind === 'you'))
  // Their own words, once typed, give way to his first sentence on their own: the reply is what they are waiting for.
  useEffect(() => {
    if (page?.kind !== 'you' || revealing || pages.length <= pageIndex + 1) return
    const id = setTimeout(() => advanceRef.current(), 450)
    return () => clearTimeout(id)
  }, [page, revealing, pages.length, pageIndex])

  // The typewriter: one character per tick for the page on stage.
  useEffect(() => {
    if (!page) return
    if (shown >= pageText.length) return
    const id = setInterval(() => setShown((n) => Math.min(pageText.length, n + 1)), TYPE_MS[page.kind])
    return () => clearInterval(id)
  }, [page, pageText, shown])
  // A new page fades in; the old one has already faded out in advance().
  const fade = useRef(new Animated.Value(1)).current
  const settled = atEnd && !revealing && !pending && page?.kind !== 'you'
  // A paid photo he offered with this turn waits, veiled, until the turn is read; a ringing phone outranks it.
  // One the story gave is a page instead, and the stage becomes it.
  const lastPhotoCard = lastPhoto ? (cardById.get(lastPhoto.momentId ?? '') ?? null) : null
  const showPhoto =
    !ringing &&
    !!lastPhoto &&
    lastPhotoCard?.status !== 'UNLOCKED' &&
    dismissedPhoto !== lastPhoto.id &&
    (!lastCharacter || lastPhoto.createdAt >= lastCharacter.createdAt) &&
    settled
  // Answering him puts the photo away; it is in Moments if they want it back.
  useEffect(() => {
    if (yours && lastPhoto) setDismissedPhoto(lastPhoto.id)
  }, [yours, lastPhoto])

  const heroPortrait = character.data?.portraits[0] ?? null
  /**
   * The scene cut: the stage is the last picture the story gave, from the page
   * that gave it onward. Before that page, and before any photo, it is him.
   */
  const stageImage = useMemo(() => {
    const reached = page?.kind === 'photo' || pages.every((p) => p.kind !== 'photo') || pageIndex >= pages.findIndex((p) => p.kind === 'photo')
    const given = [...messages]
      .filter((m) => !!m.momentId && (reached || m.id !== lastPhoto?.id))
      .map((m) => cardById.get(m.momentId!))
      .filter((c): c is MomentCard => !!c && c.status === 'UNLOCKED' && !!c.imageUrl)
    return given.at(-1)?.imageUrl ?? heroPortrait?.url ?? null
  }, [messages, cardById, heroPortrait, page, pages, pageIndex, lastPhoto?.id])
  const hero = stageImage
  /** Geometry from the portrait, live set from the beat: both must agree for a spot to exist. */
  const liveHotspots: HotspotRect[] = useMemo(() => {
    const live = new Set(choices?.beat.hotspots ?? [])
    return (heroPortrait?.hotspots ?? []).filter((h) => live.has(h.hotspot))
  }, [heroPortrait, choices])

  // ---------------------------------------------------------------- actions
  /** A tap finishes the sentence being typed; the next tap brings the next one. */
  const advanceRef = useRef<() => void>(() => {})
  const advance = useCallback(() => {
    if (!page) return
    if (revealing) {
      setShown(pageText.length)
      return
    }
    if (pageIndex >= pages.length - 1) return
    Animated.timing(fade, { toValue: 0, duration: 140, useNativeDriver: Platform.OS !== 'web' }).start(() => {
      setPageIndex((i) => i + 1)
      setShown(0)
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start()
    })
  }, [page, revealing, pageText.length, pageIndex, pages.length, fade])
  advanceRef.current = advance
  const choose = (index: number) => {
    const option = choices?.options[index]
    if (!option || !socketRef.current) return
    const clientMsgId = socketRef.current.sendMessage(option, index)
    addPending(conversationId, { clientMsgId, content: option })
  }
  const touch = (hotspot: Hotspot) => {
    if (!socketRef.current || streaming || pending) return
    const clientMsgId = socketRef.current.sendTouch(hotspot)
    // The beat does not move, so the standing options are left alone.
    addPending(conversationId, { clientMsgId, content: hotspot }, true)
  }
  const send = () => {
    const content = draft.trim()
    if (!content || !socketRef.current) return
    const clientMsgId = socketRef.current.sendMessage(content)
    addPending(conversationId, { clientMsgId, content })
    setDraft('')
    setTyping(false)
  }
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
  const visible = pageText.slice(0, shown)
  /** Where the tap cue drifts to, one of a few spots over him, changing with the page. */
  const cueSpot = CUE_SPOTS[pageIndex % CUE_SPOTS.length]!

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
        <View style={styles.portrait}>
          {hero ? <Image source={{ uri: hero }} style={styles.portraitImage} resizeMode="cover" /> : <View style={[styles.portraitImage, styles.portraitEmpty]} />}
          {/* Touch: invisible, and only where the beat and the relationship both allow it. */}
          {liveHotspots.map((h) => (
            <Pressable
              key={h.hotspot}
              accessibilityLabel={h.hotspot}
              onPress={() => touch(h.hotspot)}
              style={{
                position: 'absolute',
                left: `${h.x * 100}%`,
                top: `${h.y * 100}%`,
                width: `${h.w * 100}%`,
                height: `${h.h * 100}%`,
              }}
            />
          ))}
        </View>
        <View style={styles.portraitFade} />
      </View>

      {status !== 'open' && <Text style={[styles.banner, { top: insets.top + 44 }]}>{status === 'connecting' ? 'Connecting…' : 'Reconnecting…'}</Text>}

      {/* The tap cue, drifting over him while there is more to read. */}
      {page && !revealing && !atEnd && !ringing ? <TapRing left={cueSpot.x} top={cueSpot.y} /> : null}

      {/* The lower third: one sentence at a time. */}
      <Pressable style={styles.stageTap} onPress={advance} disabled={!page || (!revealing && atEnd)}>
        <View style={[styles.panelWrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          {/* The options rise only once the last sentence has landed. */}
      {ended ? (
        <Choices visible={settled}>
          <Pressable style={styles.choice} onPress={() => router.back()}>
            <Text style={styles.choiceText}>End of tonight. Back to him.</Text>
          </Pressable>
        </Choices>
      ) : (
        <Choices visible={settled && !ringing}>
          {(choices?.options ?? []).map((o, i) => (
            <Pressable key={i} style={styles.choice} onPress={() => choose(i)} disabled={status !== 'open'}>
              <Text style={styles.choiceText}>{`${String.fromCharCode(65 + i)}. ${o}`}</Text>
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
              <Text style={styles.choiceFreeText}>{`${String.fromCharCode(65 + (choices?.options.length ?? 0))}. Say something…`}</Text>
            </Pressable>
          )}
        </Choices>
      )}

          <Animated.View style={[styles.panel, { opacity: fade }]}>
            {page?.kind === 'prologue' && <Text style={styles.prologue}>{visible}</Text>}
            {page?.kind === 'you' && (
              <View style={styles.lineWrap}>
                <Text style={styles.speakerYou}>{page.name}</Text>
                <Text style={styles.you}>{visible}</Text>
              </View>
            )}
            {page?.kind === 'narration' && <Text style={styles.narration}>{visible}</Text>}
            {page?.kind === 'line' && <LineText text={visible} name={name ?? ''} />}
            {page?.kind === 'photo' && <LineText text={visible} name={name ?? ''} />}
            {!page && <Text style={styles.narration}>{scene?.setting ?? ''}</Text>}
            {waiting && <Text style={styles.tapHint}>…</Text>}
          </Animated.View>
          {conv?.error && <Text style={styles.error}>{conv.error}</Text>}
        </View>
      </Pressable>

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

      {/* He is calling: the whole screen is the call until it is answered or not. */}
      {ringing ? (
        <CallScreen
          ringing={ringing}
          portraitUrl={hero}
          onAnswer={() => choose(0)}
          onDecline={() => choose(1)}
        />
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

/** Spots over the portrait, as fractions of the screen, that the tap cue drifts between. */
const CUE_SPOTS = [
  { x: 0.78, y: 0.34 },
  { x: 0.22, y: 0.42 },
  { x: 0.7, y: 0.5 },
  { x: 0.3, y: 0.3 },
  { x: 0.8, y: 0.46 },
]

/** The pulsing ring that says "tap": a soft circle that breathes, nothing else. */
function TapRing({ left, top }: { left: number; top: number }) {
  const { width, height } = useWindowDimensions()
  const pulse = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] })
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] })
  return (
    <Animated.View pointerEvents="none" style={[styles.ring, { left: left * width - 22, top: top * height - 22, opacity, transform: [{ scale }] }]}>
      <View style={styles.ringInner} />
    </Animated.View>
  )
}

/** The options, rising from below once there is nothing left to read. */
function Choices({ visible, children }: { visible: boolean; children: ReactNode }) {
  const rise = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(rise, { toValue: visible ? 1 : 0, duration: visible ? 260 : 120, useNativeDriver: Platform.OS !== 'web' }).start()
  }, [visible, rise])
  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [16, 0] })
  return (
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={[styles.choices, { opacity: rise, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  )
}

/** His line on the stage: the action beat small and muted, the speech large. */
function LineText({ text, name }: { text: string; name: string }) {
  // A page is one segment; while it types, a beat is recognised by its opening asterisk.
  const action = text.startsWith('*')
  const body = action ? text.replace(/^\*|\*$/g, '') : text
  return (
    <View style={styles.lineWrap}>
      {name ? <Text style={styles.speaker}>{name}</Text> : null}
      <Text style={action ? styles.action : styles.speech}>{body}</Text>
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
  portrait: { width: '78%', height: '100%', borderRadius: radius.lg, overflow: 'hidden' },
  portraitImage: { width: '100%', height: '100%' },
  portraitEmpty: { backgroundColor: colors.surfaceRaised },
  portraitFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 120, backgroundColor: 'rgba(13, 13, 18, 0.55)' },
  stageTap: { flex: 1 },
  panelWrap: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: spacing.lg, gap: spacing.sm },
  panel: { minHeight: 132, backgroundColor: 'rgba(13, 13, 18, 0.86)', borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  prologue: { color: colors.textMuted, fontSize: 15, lineHeight: 23 },
  speakerYou: { color: colors.textFaint, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'right' },
  you: { color: colors.text, fontSize: 16, lineHeight: 24, textAlign: 'right' },
  ring: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center', shadowColor: '#fff', shadowOpacity: 0.6, shadowRadius: 10 },
  ringInner: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
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
