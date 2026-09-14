import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, router } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Stack } from 'expo-router'
import * as AppleAuthentication from 'expo-apple-authentication'
import type { ProfileMan } from '@odyssey/shared'
import { api } from '../src/lib/api'
import { appleAvailable, googleConfigured, signInDev, signInWithApple, signOut, useGoogleSignIn } from '../src/lib/auth'
import { billing } from '../src/lib/billing'
import { colors, radius, spacing } from '../src/theme'

/**
 * The personal centre (2026-09-11). Who you are here and the name he calls
 * you; where you are with each of them, in words; what you have of his; what
 * you wrote and what it earned; your plan; the adult-stories declaration on
 * the web; sign-in, so it follows you to the next phone. Never a stage name,
 * never a number for affinity. The dogfood tools live under one fold at the end.
 */
export default function AccountScreen() {
  const qc = useQueryClient()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const profile = useQuery({ queryKey: ['profile'], queryFn: api.profile })
  const [error, setError] = useState<string | null>(null)
  const [apple, setApple] = useState(false)
  const [name, setName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [devName, setDevName] = useState('')
  const [bornOn, setBornOn] = useState('')
  const [devOpen, setDevOpen] = useState(false)

  useEffect(() => {
    void appleAvailable().then(setApple)
  }, [])
  const refresh = useCallback(() => {
    setError(null)
    void qc.invalidateQueries()
  }, [qc])
  const fail = useCallback((err: unknown) => setError(err instanceof Error ? err.message : String(err)), [])

  const appleSignIn = useMutation({ mutationFn: signInWithApple, onSuccess: refresh, onError: fail })
  const devSignIn = useMutation({ mutationFn: () => signInDev(devName.trim()), onSuccess: refresh, onError: fail })
  const out = useMutation({ mutationFn: signOut, onSuccess: refresh, onError: fail })
  const restore = useMutation({ mutationFn: () => billing.restore(), onSuccess: refresh, onError: fail })
  const age = useMutation({ mutationFn: () => api.declareAge({ bornOn: bornOn.trim() }), onSuccess: refresh, onError: fail })
  const rename = useMutation({ mutationFn: () => api.rename({ displayName: name.trim() }), onSuccess: () => { setEditingName(false); refresh() }, onError: fail })
  const grant = useMutation({ mutationFn: (tier: 'FREE' | 'PLUS' | 'PREMIUM') => api.devGrant({ tier, days: 30 }), onSuccess: refresh, onError: fail })

  if (profile.isLoading) return <View style={styles.centered}><ActivityIndicator color={colors.accent} /></View>
  if (profile.error || !profile.data) return <View style={styles.centered}><Text style={styles.error}>{String(profile.error ?? 'Not found')}</Text></View>
  const { user, billing: status, men, creator } = profile.data
  const known = men.filter((m) => m.since)
  const devTools = __DEV__ || !!process.env.EXPO_PUBLIC_BILLING_GRANT_SECRET
  const primary = men.find((m) => m.character.kind === 'PRIMARY') ?? men[0] ?? null
  const paid = status.tier !== 'FREE'

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* His art as the header, then who you are here. */}
      <View style={[styles.hero, { height: Math.round(width * 0.8) }]}>
        {primary?.character.portraitUrl ? <Image source={{ uri: primary.character.portraitUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        <LinearGradient pointerEvents="none" colors={['rgba(5,5,7,0.4)', 'rgba(5,5,7,0.1)', colors.ground]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
        <Pressable style={[styles.back, { top: insets.top + 12 }]} onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.backText}>‹</Text>
          <Text style={styles.backLabel}>You</Text>
        </Pressable>
      </View>
      <View style={styles.head}>
        {editingName ? (
          <View style={styles.row}>
            <TextInput style={[styles.input, styles.grow]} value={name} onChangeText={setName} placeholder="What he calls you" placeholderTextColor={colors.textFaint} autoFocus maxLength={40} onSubmitEditing={() => rename.mutate()} />
            <Pressable style={styles.chip} onPress={() => rename.mutate()} disabled={rename.isPending}><Text style={styles.chipText}>Save</Text></Pressable>
          </View>
        ) : (
          <Pressable onPress={() => { setName(user.displayName ?? ''); setEditingName(true) }} hitSlop={8}>
            <Text style={styles.title}>{user.displayName ?? 'No name yet'}</Text>
            <Text style={styles.link}>{user.displayName ? 'Change what he calls you' : 'Tell him what to call you'}</Text>
          </Pressable>
        )}
        <View style={styles.planRow}>
          <View style={[styles.planPill, paid && styles.planPillPaid]}>
            <Text style={[styles.planPillText, paid && styles.planPillTextPaid]}>{planLine(status.tier, status.expiresAt, status.willRenew)}</Text>
          </View>
          <Text style={styles.faint}>{user.signedIn ? `Signed in with ${user.providers.join(', ')}` : 'On this phone only'}</Text>
        </View>
        <Text style={styles.muted}>
          {paid ? 'His calls, long nights, and everything he remembers.' : 'Fifteen messages a night, the stories, the pictures he gives. Plus opens his calls, longer nights, and everything he remembers.'}
        </Text>
        {status.enabled && billing.available ? (
          <Pressable onPress={() => restore.mutate()} disabled={restore.isPending} hitSlop={8}>
            <Text style={styles.link}>{restore.isPending ? 'Restoring…' : 'Restore purchases'}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Where you are with each of them */}
      <View style={styles.section}><Text style={styles.label}>Them</Text></View>
      <View style={{ marginTop: -spacing.md }}>
        {men.map((m) => <ManRow key={m.character.id} man={m} />)}
        {known.length === 0 ? <Text style={[styles.muted, { paddingHorizontal: spacing.xl, paddingTop: spacing.sm }]}>Nobody yet. Go home and say hello.</Text> : null}
      </View>

      {/* What you wrote */}
      {Platform.OS === 'web' ? (
        <Link href="/write" asChild>
          <Pressable style={styles.section}>
            <Text style={styles.label}>What you wrote</Text>
            {creator.episodes ? (
              <Text style={styles.plan}>
                {creator.live} of {creator.episodes} on his page · finished {creator.completions} {creator.completions === 1 ? 'time' : 'times'}
                {creator.creditedDays ? ` · ${creator.creditedDays} ${creator.creditedDays === 1 ? 'day' : 'days'} of Plus earned` : ''}
              </Text>
            ) : (
              <Text style={styles.plan}>Nothing yet</Text>
            )}
            <Text style={styles.link}>Write one for him</Text>
          </Pressable>
        </Link>
      ) : null}

      {/* Adult stories: only the web build asks. */}
      {Platform.OS === 'web' ? (
        <View style={styles.box}>
          <Text style={styles.label}>Adult stories</Text>
          {user.ageVerified ? (
            <Text style={styles.muted}>Open to you. They are marked 18+ on the home screen.</Text>
          ) : (
            <>
              <Text style={styles.muted}>Some stories are for adults. Tell us when you were born and they show up.</Text>
              <TextInput style={styles.input} value={bornOn} onChangeText={setBornOn} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textFaint} autoCapitalize="none" />
              <Pressable style={styles.secondary} onPress={() => age.mutate()} disabled={!bornOn.trim() || age.isPending}>
                <Text style={styles.secondaryText}>Confirm</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : null}

      {/* Sign in, or out */}
      <View style={styles.box}>
        <Text style={styles.label}>{user.signedIn ? 'Account' : 'Keep him'}</Text>
        {user.signedIn ? (
          <Pressable style={styles.secondary} onPress={() => out.mutate()} disabled={out.isPending}>
            <Text style={styles.secondaryText}>Sign out</Text>
          </Pressable>
        ) : (
          <>
            <Text style={styles.muted}>Right now everything lives on this phone. Sign in and it follows you to the next one.</Text>
            {apple && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={radius.pill}
                style={styles.appleButton}
                onPress={() => appleSignIn.mutate()}
              />
            )}
            {googleConfigured && <GoogleButton onSignedIn={refresh} onError={fail} />}
            {!apple && !googleConfigured && !devTools ? <Text style={styles.muted}>Sign-in arrives with the app.</Text> : null}
          </>
        )}
      </View>

      {/* The dogfood fold */}
      {devTools ? (
        <View style={styles.box}>
          <Pressable onPress={() => setDevOpen((v) => !v)} hitSlop={8}>
            <Text style={styles.label}>{devOpen ? 'Developer ▾' : 'Developer ▸'}</Text>
          </Pressable>
          {devOpen ? (
            <>
              <Text style={styles.muted}>Grant a plan for testing.</Text>
              <View style={styles.row}>
                {(['FREE', 'PLUS', 'PREMIUM'] as const).map((t) => (
                  <Pressable key={t} style={[styles.chip, styles.grow]} onPress={() => grant.mutate(t)} disabled={grant.isPending}>
                    <Text style={styles.chipText}>{t}</Text>
                  </Pressable>
                ))}
              </View>
              {!user.signedIn ? (
                <>
                  <TextInput style={styles.input} value={devName} onChangeText={setDevName} placeholder="dev sign-in: any name" placeholderTextColor={colors.textFaint} autoCapitalize="none" />
                  <Pressable style={styles.secondary} onPress={() => devSignIn.mutate()} disabled={!devName.trim() || devSignIn.isPending}>
                    <Text style={styles.secondaryText}>Sign in as dev</Text>
                  </Pressable>
                </>
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}

      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  )
}

/** One of them: his face, the line, and the plain facts of where you are. */
function ManRow({ man }: { man: ProfileMan }) {
  const { character: c } = man
  const facts = man.since
    ? [
        `${man.nights} ${man.nights === 1 ? 'night' : 'nights'}`,
        `${man.momentsUnlocked} of ${man.momentsTotal} pictures`,
        `${man.episodesPlayed} of ${man.episodesTotal} stories`,
      ].join(' · ')
    : c.tagline
  return (
    <Pressable style={styles.man} onPress={() => router.push({ pathname: '/character/[id]', params: { id: c.id } })}>
      {c.portraitUrl ? <Image source={{ uri: c.portraitUrl }} style={styles.face} resizeMode="cover" /> : <View style={[styles.face, styles.faceEmpty]} />}
      <View style={styles.grow}>
        <Text style={styles.manName}>{c.name}</Text>
        <Text style={[styles.manLine, { color: c.accent }]}>{man.line}{man.inProgress ? ` · in "${man.inProgress}"` : ''}</Text>
        <Text style={styles.muted} numberOfLines={2}>{facts}</Text>
      </View>
    </Pressable>
  )
}

function planLine(tier: string, expiresAt: string | null, willRenew: boolean): string {
  if (tier === 'FREE') return 'Free'
  const name = tier === 'PLUS' ? 'Plus' : 'Premium'
  if (!expiresAt) return name
  const date = new Date(expiresAt).toLocaleDateString()
  return willRenew ? `${name} · renews ${date}` : `${name} · until ${date}`
}

/** Separate component so the Google hook only mounts when client ids exist; it throws otherwise. */
function GoogleButton({ onSignedIn, onError }: { onSignedIn: () => void; onError: (err: unknown) => void }) {
  const google = useGoogleSignIn(onSignedIn, onError)
  return (
    <Pressable style={styles.primary} onPress={google.prompt} disabled={!google.ready}>
      <Text style={styles.primaryText}>Continue with Google</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { paddingBottom: spacing.xxl, gap: spacing.xl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ground },
  hero: { width: '100%', backgroundColor: '#0f0e12' },
  back: { position: 'absolute', left: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: 8 },
  backText: { color: colors.ink, fontSize: 28, lineHeight: 28, marginTop: -4 },
  backLabel: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  head: { paddingHorizontal: spacing.xl, gap: 6, marginTop: -spacing.xl },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  sub: { color: colors.muted, fontSize: 13 },
  link: { color: colors.ink, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  planPill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(244,241,236,0.18)' },
  planPillPaid: { backgroundColor: 'rgba(217,179,106,0.16)', borderColor: 'rgba(217,179,106,0.5)' },
  planPillText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  planPillTextPaid: { color: '#d9b36a' },
  section: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  box: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  label: { color: colors.faint, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2 },
  plan: { color: colors.ink, fontSize: 15, lineHeight: 21 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  faint: { color: colors.faint, fontSize: 12 },
  man: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 10, marginHorizontal: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  face: { width: 52, height: 64, borderRadius: 8 },
  faceEmpty: { backgroundColor: '#0f0e12' },
  manName: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  manLine: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  grow: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: { color: colors.ink, fontSize: 16, backgroundColor: 'rgba(244,241,236,0.06)', borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10 },
  chip: { borderWidth: 1, borderColor: 'rgba(244,241,236,0.18)', paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.pill, alignItems: 'center' },
  chipText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  appleButton: { width: '100%', height: 48 },
  primary: { backgroundColor: colors.ink, paddingVertical: 14, borderRadius: radius.pill, alignItems: 'center' },
  primaryText: { color: '#0b0a0c', fontSize: 16, fontWeight: '700' },
  secondary: { borderWidth: 1, borderColor: 'rgba(244,241,236,0.18)', paddingVertical: 12, borderRadius: radius.pill, alignItems: 'center' },
  secondaryText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  error: { color: colors.danger, paddingHorizontal: spacing.xl },
})
