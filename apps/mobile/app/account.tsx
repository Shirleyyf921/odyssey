import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import { api } from '../src/lib/api'
import { appleAvailable, googleConfigured, signInDev, signInWithApple, signOut, useGoogleSignIn } from '../src/lib/auth'
import { colors, radius, spacing } from '../src/theme'

/**
 * Sign-in and sign-out. A guest keeps everything they did on this phone when
 * they sign in; the server folds it into the account.
 */
export default function AccountScreen() {
  const qc = useQueryClient()
  const me = useQuery({ queryKey: ['me'], queryFn: api.me })
  const [error, setError] = useState<string | null>(null)
  const [apple, setApple] = useState(false)
  const [devName, setDevName] = useState('')

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

  if (me.isLoading) return <View style={styles.centered}><ActivityIndicator color={colors.accent} /></View>
  const user = me.data?.user

  return (
    <View style={styles.screen}>
      {user?.signedIn ? (
        <>
          <Text style={styles.title}>{user.displayName ?? 'Signed in'}</Text>
          <Text style={styles.sub}>via {user.providers.join(', ')}</Text>
          <Pressable style={styles.secondary} onPress={() => out.mutate()} disabled={out.isPending}>
            <Text style={styles.secondaryText}>Sign out</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.title}>Keep him</Text>
          <Text style={styles.sub}>
            Right now everything lives on this phone. Sign in and it follows you to the next one.
          </Text>
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
          {__DEV__ && (
            <View style={styles.devBox}>
              <Text style={styles.devLabel}>Development sign-in</Text>
              <TextInput
                style={styles.input}
                value={devName}
                onChangeText={setDevName}
                placeholder="any name"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
              />
              <Pressable style={styles.secondary} onPress={() => devSignIn.mutate()} disabled={!devName.trim() || devSignIn.isPending}>
                <Text style={styles.secondaryText}>Sign in as dev</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
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
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl, gap: spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 26, fontWeight: '700' },
  sub: { color: colors.textMuted, fontSize: 15, lineHeight: 21, marginBottom: spacing.md },
  appleButton: { width: '100%', height: 48 },
  primary: { backgroundColor: colors.accent, paddingVertical: 14, borderRadius: radius.pill, alignItems: 'center' },
  primaryText: { color: '#1a0a10', fontSize: 16, fontWeight: '700' },
  secondary: { borderWidth: 1, borderColor: colors.border, paddingVertical: 14, borderRadius: radius.pill, alignItems: 'center' },
  secondaryText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  devBox: { marginTop: spacing.xl, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg },
  devLabel: { color: colors.textFaint, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  input: { color: colors.text, fontSize: 16, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10 },
  error: { color: colors.danger, marginTop: spacing.md },
})
