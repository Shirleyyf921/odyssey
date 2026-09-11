import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { episodeIssues, type ContentRating, type DraftBeat, type DryRun, type EpisodeDraft, type Hotspot, type SkeletonBeat } from '@odyssey/shared'
import { api, ApiError } from '../../src/lib/api'
import { colors, radius, spacing } from '../../src/theme'

const HOTSPOTS: Hotspot[] = ['hand', 'shoulder', 'hair', 'face']
const uuid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`.replace(/\./g, ''))

/** A blank beat. Options point nowhere until the author wires them. */
function blankBeat(position: number, kind: DraftBeat['kind'] = 'STORY'): DraftBeat {
  return {
    id: uuid(),
    position,
    kind,
    brief: '',
    setting: null,
    options: kind === 'STORY' ? [{ intent: '', next: null, affinity: 0 }, { intent: '', next: null, affinity: 0 }] : kind === 'CALL' ? [{ intent: 'Answer', next: null, affinity: 0 }, { intent: 'Let it ring', next: null, affinity: 0 }] : [],
    next: null,
    photoMomentId: null,
    callUrl: null,
    callSeconds: null,
    hotspots: [],
  }
}

/** Beats from a skeleton: the wiring is ours, the words are blank. */
function beatsFromSkeleton(shape: SkeletonBeat[]): DraftBeat[] {
  const ids = shape.map(() => uuid())
  const at = (p: number | null) => (p === null ? null : (ids[p] ?? null))
  return shape.map((b, i) => ({
    ...blankBeat(b.position, b.kind),
    id: ids[i]!,
    options: b.kind === 'CALL' ? [{ intent: 'Answer', next: at(b.optionsTo[0] ?? null), affinity: 0 }, { intent: 'Let it ring', next: at(b.optionsTo[1] ?? null), affinity: 0 }] : b.optionsTo.map((to) => ({ intent: '', next: at(to), affinity: 0 })),
    next: at(b.nextTo),
    hotspots: b.hotspots,
  }))
}

function blankDraft(characterId: string): EpisodeDraft {
  const beats = beatsFromSkeleton([
    { position: 0, kind: 'STORY', optionsTo: [1, 1], nextTo: 1, hasPhoto: false, hotspots: [] },
    { position: 1, kind: 'STORY', optionsTo: [2, 2], nextTo: 2, hasPhoto: false, hotspots: [] },
    { position: 2, kind: 'END', optionsTo: [], nextTo: null, hasPhoto: false, hotspots: [] },
  ])
  return { characterId, title: '', premise: '', setting: '', opener: '', sceneId: null, rating: 'SFW', firstBeatId: beats[0]!.id, beats }
}

/**
 * The editor (docs/ugc-pipeline.md, section 2): premise, setting, his opener,
 * then one card per beat. The integrity rule runs as they type; the dry-run
 * plays it against the real model; submit sends it to the screen and the
 * queue. Web only, and only for the explore men.
 */
export default function WriteEpisode() {
  const { id, characterId: newFor } = useLocalSearchParams<{ id: string; characterId?: string }>()
  const isNew = id === 'new'
  const qc = useQueryClient()
  const existing = useQuery({ queryKey: ['my-episode', id], queryFn: () => api.myEpisode(id), enabled: !isNew && Platform.OS === 'web' })
  const [draft, setDraft] = useState<EpisodeDraft | null>(isNew && newFor ? blankDraft(newFor) : null)
  const [status, setStatus] = useState<string>('DRAFT')
  const [run, setRun] = useState<DryRun | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [attest, setAttest] = useState(false)
  useEffect(() => {
    if (existing.data) {
      const { episode } = existing.data
      setDraft({ characterId: episode.characterId, title: episode.title, premise: episode.premise, setting: episode.setting, opener: episode.opener, sceneId: episode.sceneId, rating: episode.rating, firstBeatId: episode.firstBeatId, beats: episode.beats.map(({ episodeId: _e, ...b }) => b) })
      setStatus(episode.status)
      setRun(episode.dryRun)
      setNote(episode.reviewNote)
    }
  }, [existing.data])

  const characterId = draft?.characterId ?? newFor ?? ''
  const character = useQuery({ queryKey: ['character', characterId], queryFn: () => api.character(characterId), enabled: !!characterId })
  const moments = useQuery({ queryKey: ['moments', characterId], queryFn: () => api.moments(characterId), enabled: !!characterId })
  const skeletons = useQuery({ queryKey: ['skeletons', characterId], queryFn: () => api.skeletons(characterId), enabled: !!characterId && isNew })

  const fail = (err: unknown) => setMessage(err instanceof ApiError ? err.message : String(err))
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['my-episodes'] })
    qc.invalidateQueries({ queryKey: ['my-episode', id] })
  }
  const save = useMutation({
    mutationFn: (d: EpisodeDraft) => (isNew ? api.createEpisode(d) : api.updateEpisode(id, d)),
    onSuccess: ({ episode }) => {
      setMessage('Saved.')
      setStatus(episode.status)
      setRun(episode.dryRun)
      setNote(episode.reviewNote)
      invalidate()
      if (isNew) router.replace({ pathname: '/write/[id]', params: { id: episode.id } })
    },
    onError: fail,
  })
  const play = useMutation({
    mutationFn: () => api.dryRunEpisode(id),
    onSuccess: ({ episode }) => { setRun(episode.dryRun); setMessage(episode.dryRun?.passed ? 'He played every beat.' : 'He could not play every beat; read the transcript.') },
    onError: fail,
  })
  const submit = useMutation({
    mutationFn: () => api.submitEpisode(id),
    onSuccess: ({ episode, outcome, notes }) => {
      setStatus(episode.status)
      setRun(episode.dryRun)
      setNote(episode.reviewNote)
      setMessage(episode.status === 'LIVE' ? 'It is on his page.' : outcome === 'SUBMITTED' ? 'Sent. A person will read it.' : notes.join('\n'))
      invalidate()
    },
    onError: fail,
  })
  const remove = useMutation({ mutationFn: () => api.deleteEpisode(id), onSuccess: () => { invalidate(); router.replace('/write') }, onError: fail })
  const ai = useMutation({
    mutationFn: (d: EpisodeDraft) => api.aiDraft({ characterId: d.characterId, premise: d.premise, setting: d.setting || undefined, rating: d.rating, skeleton: toSkeleton(d.beats) }),
    onSuccess: ({ draft: filled }) => { setDraft(filled); setMessage('Drafted. Read it; it is yours now, and it is screened like anything you type.') },
    onError: fail,
  })

  const issues = useMemo(() => (draft ? [...episodeIssues(draft), ...wordsMissing(draft)] : []), [draft])
  const editable = status === 'DRAFT' || status === 'REJECTED'

  if (Platform.OS !== 'web') return <View style={styles.centered}><Text style={styles.muted}>Writing happens on the web.</Text></View>
  if (!draft) return <View style={styles.centered}>{existing.error ? <Text style={styles.error}>{String(existing.error)}</Text> : <ActivityIndicator color={colors.accent} />}</View>
  const him = character.data?.name ?? 'him'
  const update = (patch: Partial<EpisodeDraft>) => setDraft({ ...draft, ...patch })
  const updateBeat = (i: number, patch: Partial<DraftBeat>) => update({ beats: draft.beats.map((b, k) => (k === i ? { ...b, ...patch } : b)) })
  const positionOf = (beatId: string | null) => (beatId ? (draft.beats.find((b) => b.id === beatId)?.position ?? null) : null)
  const idAt = (p: number | null) => (p === null ? null : (draft.beats.find((b) => b.position === p)?.id ?? null))

  return (
    <>
      <Stack.Screen options={{ title: isNew ? `New episode for ${him}` : draft.title || 'Untitled' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {character.data ? <Text style={styles.muted}>{him}. {character.data.tagline}</Text> : null}
        {!editable ? <Text style={styles.warn}>This one is {status.toLowerCase()}; it cannot be edited now.</Text> : null}
        {note ? <Text style={styles.warn}>{note}</Text> : null}

        {isNew && skeletons.data?.skeletons.length ? (
          <View style={styles.box}>
            <Text style={styles.label}>Start from the shape of one of ours</Text>
            <View style={styles.row}>
              {skeletons.data.skeletons.map((s) => (
                <Chip key={s.id} label={`${s.title} · ${s.beats.length} beats`} onPress={() => { const beats = beatsFromSkeleton(s.beats); update({ beats, firstBeatId: beats[0]!.id }) }} />
              ))}
            </View>
          </View>
        ) : null}

        <Field label="Title" value={draft.title} onChange={(title) => update({ title })} editable={editable} />
        <Field label="Premise · one or two sentences on the card" value={draft.premise} onChange={(premise) => update({ premise })} editable={editable} multiline />
        <Field label="Where it opens" value={draft.setting} onChange={(setting) => update({ setting })} editable={editable} multiline />
        <Field label="His first line · one action beat in *asterisks*, then his words" value={draft.opener} onChange={(opener) => update({ opener })} editable={editable} multiline />
        <View style={styles.box}>
          <Text style={styles.label}>Rating</Text>
          <View style={styles.row}>
            {(['SFW', 'MATURE'] as ContentRating[]).map((r) => (
              <Chip key={r} label={r} active={draft.rating === r} onPress={() => editable && update({ rating: r })} />
            ))}
          </View>
          <Text style={styles.muted}>MATURE needs your date of birth on the account page, and a person always reads it first.</Text>
        </View>
        {character.data?.scenes.length ? (
          <View style={styles.box}>
            <Text style={styles.label}>His scene for the backdrop</Text>
            <View style={styles.row}>
              <Chip label="none" active={draft.sceneId === null} onPress={() => editable && update({ sceneId: null })} />
              {character.data.scenes.map((s) => (
                <Chip key={s.id} label={s.title} active={draft.sceneId === s.id} onPress={() => editable && update({ sceneId: s.id })} />
              ))}
            </View>
          </View>
        ) : null}

        {editable ? (
          <Pressable style={[styles.secondary, (!draft.premise.trim() || ai.isPending) && styles.disabled]} disabled={!draft.premise.trim() || ai.isPending} onPress={() => ai.mutate(draft)}>
            <Text style={styles.secondaryText}>{ai.isPending ? 'He is writing…' : 'Draft the beats from the premise'}</Text>
          </Pressable>
        ) : null}

        <Text style={styles.label}>Beats</Text>
        {draft.beats.map((b, i) => (
          <View key={b.id} style={styles.beat}>
            <View style={styles.rowBetween}>
              <Text style={styles.kicker}>beat {b.position}{b.id === draft.firstBeatId ? ' · first' : ''}</Text>
              <View style={styles.row}>
                {(['STORY', 'CALL', 'END'] as const).map((k) => (
                  <Chip key={k} label={k} active={b.kind === k} small onPress={() => editable && updateBeat(i, { ...blankBeat(b.position, k), id: b.id, brief: b.brief, setting: b.setting, next: k === 'END' ? null : b.next, photoMomentId: b.photoMomentId, hotspots: b.hotspots })} />
                ))}
              </View>
            </View>
            <TextInput style={[styles.input, styles.multiline]} value={b.brief} editable={editable} multiline placeholder="To the actor, not the reader: what happens here, what he wants, what he must not do yet." placeholderTextColor={colors.textFaint} onChangeText={(brief) => updateBeat(i, { brief })} />
            <TextInput style={styles.input} value={b.setting ?? ''} editable={editable} placeholder="Setting, only if the scene moves" placeholderTextColor={colors.textFaint} onChangeText={(v) => updateBeat(i, { setting: v.trim() ? v : null })} />
            {b.options.map((o, k) => (
              <View key={k} style={styles.option}>
                <TextInput style={[styles.input, styles.grow]} value={o.intent} editable={editable && b.kind !== 'CALL'} placeholder={`Option ${k + 1}: what the reader does`} placeholderTextColor={colors.textFaint} onChangeText={(intent) => updateBeat(i, { options: b.options.map((x, j) => (j === k ? { ...x, intent } : x)) })} />
                <Goes to={positionOf(o.next)} beats={draft.beats} editable={editable} onChange={(p) => updateBeat(i, { options: b.options.map((x, j) => (j === k ? { ...x, next: idAt(p) } : x)) })} />
              </View>
            ))}
            {b.kind !== 'END' ? (
              <View style={styles.option}>
                <Text style={[styles.muted, styles.grow]}>If they type instead of choosing</Text>
                <Goes to={positionOf(b.next)} beats={draft.beats} editable={editable} onChange={(p) => updateBeat(i, { next: idAt(p) })} />
              </View>
            ) : null}
            <View style={styles.row}>
              <Text style={styles.muted}>Touch:</Text>
              {HOTSPOTS.map((h) => (
                <Chip key={h} label={h} small active={b.hotspots.includes(h)} onPress={() => editable && updateBeat(i, { hotspots: b.hotspots.includes(h) ? b.hotspots.filter((x) => x !== h) : [...b.hotspots, h] })} />
              ))}
            </View>
            {moments.data?.moments.length ? (
              <View style={styles.row}>
                <Text style={styles.muted}>He sends a photo:</Text>
                <Chip label="none" small active={b.photoMomentId === null} onPress={() => editable && updateBeat(i, { photoMomentId: null })} />
                {moments.data.moments.map((m) => (
                  <Chip key={m.id} label={m.title} small active={b.photoMomentId === m.id} onPress={() => editable && updateBeat(i, { photoMomentId: m.id })} />
                ))}
              </View>
            ) : null}
            {run?.beats.find((p) => p.beatId === b.id) ? <Played beat={run.beats.find((p) => p.beatId === b.id)!} /> : null}
            {editable && draft.beats.length > 1 ? (
              <Pressable hitSlop={8} onPress={() => { const beats = draft.beats.filter((_, k) => k !== i).map((x, k) => ({ ...x, position: k })); update({ beats, firstBeatId: beats.some((x) => x.id === draft.firstBeatId) ? draft.firstBeatId : beats[0]!.id }) }}>
                <Text style={styles.link}>Remove this beat</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        {editable ? (
          <Pressable style={styles.secondary} onPress={() => update({ beats: [...draft.beats, blankBeat(draft.beats.length)] })}>
            <Text style={styles.secondaryText}>Add a beat</Text>
          </Pressable>
        ) : null}

        {issues.length ? (
          <View style={styles.box}>
            <Text style={styles.label}>Before it can be played</Text>
            {issues.map((s, k) => <Text key={k} style={styles.warn}>· {s}</Text>)}
          </View>
        ) : null}

        {editable ? (
          <View style={styles.row}>
            <Pressable style={[styles.primary, (issues.length > 0 || save.isPending) && styles.disabled]} disabled={issues.length > 0 || save.isPending} onPress={() => save.mutate(draft)}>
              <Text style={styles.primaryText}>{isNew ? 'Save draft' : 'Save'}</Text>
            </Pressable>
            {!isNew ? (
              <Pressable style={[styles.secondary, play.isPending && styles.disabled]} disabled={play.isPending} onPress={() => play.mutate()}>
                <Text style={styles.secondaryText}>{play.isPending ? 'He is playing it…' : 'Play it as him'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {!isNew && editable ? (
          <View style={styles.box}>
            <Pressable style={styles.rowStart} onPress={() => setAttest((v) => !v)}>
              <View style={[styles.checkbox, attest && styles.checkboxOn]} />
              <Text style={[styles.muted, styles.grow]}>
                I am an adult. This is my own writing, and the rating I chose is the rating it is. Odyssey removes what breaks its rules without discussion.
                {' '}(Terms in draft; counsel reviews them before launch.)
              </Text>
            </Pressable>
            <Pressable style={[styles.primary, (!attest || submit.isPending) && styles.disabled]} disabled={!attest || submit.isPending} onPress={() => submit.mutate()}>
              <Text style={styles.primaryText}>{submit.isPending ? 'Sending…' : 'Submit'}</Text>
            </Pressable>
            <Text style={styles.muted}>Save first. Submitting screens every beat, then plays the whole episode once as him; you get the transcript either way.</Text>
            <Pressable hitSlop={8} onPress={() => remove.mutate()}><Text style={styles.link}>Delete this draft</Text></Pressable>
          </View>
        ) : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </ScrollView>
    </>
  )
}

/** What the integrity rule does not check: that the words are there. */
function wordsMissing(d: EpisodeDraft): string[] {
  const out: string[] = []
  if (!d.title.trim()) out.push('a title')
  if (!d.premise.trim()) out.push('a premise')
  if (!d.setting.trim()) out.push('where it opens')
  if (!d.opener.trim()) out.push('his first line')
  for (const b of d.beats) {
    if (!b.brief.trim()) out.push(`beat ${b.position}: a brief`)
    for (const [k, o] of b.options.entries()) if (!o.intent.trim()) out.push(`beat ${b.position}: option ${k + 1} says what the reader does`)
  }
  return out
}

function toSkeleton(beats: DraftBeat[]): SkeletonBeat[] {
  const at = new Map(beats.map((b) => [b.id, b.position] as const))
  const pos = (id: string | null) => (id ? (at.get(id) ?? null) : null)
  return beats.map((b) => ({ position: b.position, kind: b.kind, optionsTo: b.options.map((o) => pos(o.next)), nextTo: pos(b.next), hasPhoto: b.photoMomentId !== null, hotspots: b.hotspots }))
}

function Field({ label, value, onChange, editable, multiline }: { label: string; value: string; onChange: (v: string) => void; editable: boolean; multiline?: boolean }) {
  return (
    <View style={styles.box}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={[styles.input, multiline && styles.multiline]} value={value} onChangeText={onChange} editable={editable} multiline={multiline} placeholderTextColor={colors.textFaint} />
    </View>
  )
}

function Chip({ label, active, onPress, small }: { label: string; active?: boolean; onPress: () => void; small?: boolean }) {
  return (
    <Pressable style={[styles.chip, small && styles.chipSmall, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  )
}

/** Where an option or a fall-through leads: a beat by position, or the end. */
function Goes({ to, beats, editable, onChange }: { to: number | null; beats: DraftBeat[]; editable: boolean; onChange: (p: number | null) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.muted}>→</Text>
      {beats.map((b) => (
        <Chip key={b.id} label={String(b.position)} small active={to === b.position} onPress={() => editable && onChange(b.position)} />
      ))}
      <Chip label="end" small active={to === null} onPress={() => editable && onChange(null)} />
    </View>
  )
}

function Played({ beat }: { beat: DryRun['beats'][number] }) {
  return (
    <View style={styles.played}>
      <Text style={styles.kicker}>when it was played</Text>
      <Text style={styles.muted}>you: {beat.userAction}</Text>
      {beat.narration.map((p, k) => <Text key={k} style={styles.narration}>{p}</Text>)}
      <Text style={styles.line}>{beat.line}</Text>
      {beat.options.length ? <Text style={styles.muted}>{beat.options.map((o, k) => `${String.fromCharCode(65 + k)}. ${o}`).join('   ')}</Text> : null}
      {beat.problem ? <Text style={styles.warn}>{beat.problem}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl, maxWidth: 760, width: '100%', alignSelf: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  box: { gap: spacing.sm },
  label: { color: colors.textFaint, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  kicker: { color: colors.textFaint, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  input: { color: colors.text, fontSize: 15, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  multiline: { minHeight: 72 },
  grow: { flex: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  rowStart: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  beat: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  option: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  chipSmall: { paddingHorizontal: 9, paddingVertical: 3 },
  chipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontSize: 13 },
  chipTextActive: { color: colors.accent },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: colors.border, marginTop: 2 },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  primary: { flex: 1, backgroundColor: colors.accent, paddingVertical: 12, borderRadius: radius.pill, alignItems: 'center' },
  primaryText: { color: '#1a0a10', fontSize: 15, fontWeight: '700' },
  secondary: { flex: 1, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, borderRadius: radius.pill, alignItems: 'center' },
  secondaryText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  link: { color: colors.textFaint, fontSize: 13, textDecorationLine: 'underline' },
  muted: { color: colors.textMuted, fontSize: 14, lineHeight: 19 },
  warn: { color: colors.danger, fontSize: 14, lineHeight: 19 },
  message: { color: colors.accent, fontSize: 14, lineHeight: 19 },
  error: { color: colors.danger },
  played: { backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.sm, gap: 4 },
  narration: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  line: { color: colors.text, fontSize: 14, lineHeight: 20 },
})
