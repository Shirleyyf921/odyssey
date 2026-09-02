import * as AppleAuthentication from 'expo-apple-authentication'
import * as Google from 'expo-auth-session/providers/google'
import * as WebBrowser from 'expo-web-browser'
import { useEffect } from 'react'
import { Platform } from 'react-native'
import type { SignInResponse } from '@odyssey/shared'
import { api } from './api'
import { setSessionToken } from './session'

WebBrowser.maybeCompleteAuthSession()

async function complete(res: SignInResponse): Promise<SignInResponse> {
  await setSessionToken(res.token)
  return res
}

/** iOS only. Apple hands over the name exactly once, so it is forwarded on that call. */
export async function signInWithApple(): Promise<SignInResponse> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  })
  if (!credential.identityToken) throw new Error('Apple returned no identity token')
  const fullName = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ')
  return complete(
    await api.signIn({ provider: 'apple', identityToken: credential.identityToken, ...(fullName ? { fullName } : {}) })
  )
}

export async function appleAvailable(): Promise<boolean> {
  return Platform.OS === 'ios' && AppleAuthentication.isAvailableAsync()
}

export const GOOGLE_CLIENT_IDS = {
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
}

export const googleConfigured = Boolean(
  GOOGLE_CLIENT_IDS.iosClientId || GOOGLE_CLIENT_IDS.androidClientId || GOOGLE_CLIENT_IDS.webClientId
)

/**
 * Google Sign-In via expo-auth-session. Returns a prompt function and wires the
 * id_token it produces into our sign-in. Renders nothing itself.
 */
export function useGoogleSignIn(onSignedIn: (res: SignInResponse) => void, onError: (err: unknown) => void) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(GOOGLE_CLIENT_IDS)

  useEffect(() => {
    if (response?.type !== 'success') {
      if (response?.type === 'error') onError(response.error ?? new Error('Google sign-in failed'))
      return
    }
    const idToken = response.params['id_token']
    if (!idToken) return onError(new Error('Google returned no id_token'))
    api
      .signIn({ provider: 'google', identityToken: idToken })
      .then(complete)
      .then(onSignedIn, onError)
  }, [response, onSignedIn, onError])

  return { ready: Boolean(request), prompt: () => void promptAsync() }
}

/** Development only: the token is the account name. Refused by the server in production. */
export async function signInDev(subject: string): Promise<SignInResponse> {
  return complete(await api.signIn({ provider: 'dev', identityToken: subject }))
}

export async function signOut(): Promise<void> {
  try {
    await api.signOut()
  } finally {
    await setSessionToken(null)
  }
}
