import { Platform } from 'react-native'
import type Purchases from 'react-native-purchases'
import type { PurchasesPackage } from 'react-native-purchases'
import type { EntitlementId } from '@odyssey/shared'
import { api } from './api'

/**
 * RevenueCat on the client. The SDK talks to the store; the server learns about
 * it through RevenueCat's webhook and through `api.restore()`, which we call
 * after anything that could have changed the account. The client never decides
 * what the user is entitled to: it shows what /me says.
 *
 * The RevenueCat app user id is our user id, set before any purchase can happen,
 * so RevenueCat never mints an anonymous id of its own. When a guest signs in and
 * the id changes, restore moves the guest's receipts onto the account.
 *
 * Unavailable on web and in Expo Go (no native module): every call is a no-op
 * and `available` is false, so screens hide their purchase buttons.
 */

const API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  default: undefined,
})

let sdk: typeof Purchases | null = null
if (API_KEY && Platform.OS !== 'web') {
  try {
    // Loaded lazily so the web preview and Expo Go, which lack the native module, still boot.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sdk = (require('react-native-purchases') as { default: typeof Purchases }).default
  } catch {
    sdk = null
  }
}

let configuredFor: string | null = null

export const billing = {
  /** True when the SDK loaded and a key exists for this platform. */
  available: sdk !== null,

  /**
   * Bind the SDK to our user id. Called whenever /me resolves. The first call
   * configures; a later call with a different id (guest → account) logs in and
   * restores so the store receipts follow the person.
   */
  async identify(userId: string): Promise<void> {
    if (!sdk || !API_KEY) return
    if (configuredFor === userId) return
    if (configuredFor === null) {
      sdk.configure({ apiKey: API_KEY, appUserID: userId })
      configuredFor = userId
      return
    }
    await sdk.logIn(userId)
    configuredFor = userId
    try {
      await sdk.restorePurchases()
      await api.restore()
    } catch {
      // Best effort; the webhook covers it.
    }
  },

  /** Buy a one-time product (a moment SKU). Resolves false when the user backed out of the sheet. */
  async purchaseSku(sku: string): Promise<boolean> {
    if (!sdk) throw new Error('purchases are not available in this build')
    const [product] = await sdk.getProducts([sku])
    if (!product) throw new Error(`product ${sku} is not on sale`)
    try {
      await sdk.purchaseStoreProduct(product)
    } catch (err) {
      if (isCancelled(err)) return false
      throw err
    }
    await api.restore()
    return true
  },

  /** Packages in the current offering, for the paywall. Empty when nothing is configured. */
  async packages(): Promise<PurchasesPackage[]> {
    if (!sdk) return []
    const offerings = await sdk.getOfferings()
    return offerings.current?.availablePackages ?? []
  },

  /** Subscribe through an offering package. Resolves false on user cancel. */
  async purchasePackage(pkg: PurchasesPackage, _entitlement: EntitlementId): Promise<boolean> {
    if (!sdk) throw new Error('purchases are not available in this build')
    try {
      await sdk.purchasePackage(pkg)
    } catch (err) {
      if (isCancelled(err)) return false
      throw err
    }
    await api.restore()
    return true
  },

  /** "Restore purchases": re-read the store, then have the server re-read RevenueCat. */
  async restore(): Promise<void> {
    if (sdk) await sdk.restorePurchases()
    await api.restore()
  },
}

function isCancelled(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'userCancelled' in err && Boolean((err as { userCancelled: unknown }).userCancelled)
}
