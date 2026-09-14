import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { api } from '../lib/api'
import { billing } from '../lib/billing'
import { usePaywall, type PaywallReason } from '../store/paywall'
import { colors, radius, spacing } from '../theme'

/**
 * The paywall (ARCHITECTURE.md section 7): one sheet, opened at the moments
 * that matter and nowhere else. It says what just happened in his terms, what
 * Plus opens, and the price. On a native build with the store wired it buys
 * the package; on the web demo it grants through the dogfood route when that
 * build carries the secret; otherwise it says Plus arrives with the app.
 * Never a countdown, never a fake discount, never more than one sheet.
 */

/** Product copy per reason: the first line is what happened, the second is what Plus does about it. */
const COPY: Record<PaywallReason, { title: string; body: string }> = {
  CAP: { title: "That's fifteen for tonight.", body: 'He would keep talking. Plus takes the cap off the night.' },
  CALL: { title: "He's calling.", body: 'You will read this one. Plus hears his voice.' },
  EPISODE: { title: 'This one is Plus.', body: 'Some nights are his to give only to Plus.' },
  MEMORY: { title: 'He is starting to forget.', body: 'Plus keeps everything you have told him, for good.' },
  GENERIC: { title: 'Plus', body: 'The whole of him.' },
}

/** What Plus opens, in the order a person cares. Prices are the v1 list in ARCHITECTURE section 7. */
const OPENS = ['Unmetered nights, no fifteen-message cap', 'His calls, in his voice', 'Everything he remembers, kept for good', 'Three men, not one']
const PRICE_MONTH = '$9.99 / month'
const PRICE_YEAR = '$59.99 / year'

export function Paywall() {
  const reason = usePaywall((s) => s.reason)
  const close = usePaywall((s) => s.close)
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const me = useQuery({ queryKey: ['me'], queryFn: api.me, enabled: reason !== null })
  const packages = useQuery({ queryKey: ['packages'], queryFn: () => billing.packages(), enabled: reason !== null && billing.available })
  const demo = !billing.available && !!process.env.EXPO_PUBLIC_BILLING_GRANT_SECRET
  const monthly = packages.data?.find((p) => p.packageType === 'MONTHLY') ?? packages.data?.[0] ?? null
  const annual = packages.data?.find((p) => p.packageType === 'ANNUAL') ?? null

  const done = () => {
    setError(null)
    void qc.invalidateQueries()
    close()
  }
  const buy = useMutation({
    mutationFn: async (which: 'month' | 'year') => {
      if (billing.available) {
        const pkg = which === 'year' ? annual : monthly
        if (!pkg) throw new Error('Plus is not on sale yet')
        return billing.purchasePackage(pkg, 'plus')
      }
      if (demo) {
        await api.devGrant({ tier: 'PLUS', days: which === 'year' ? 365 : 30 })
        return true
      }
      throw new Error('Plus arrives with the app')
    },
    onSuccess: (bought) => { if (bought) done() },
    onError: (err) => setError(err instanceof Error ? err.message : String(err)),
  })
  const restore = useMutation({ mutationFn: () => billing.restore(), onSuccess: done, onError: (err) => setError(String(err)) })

  if (!reason) return null
  const copy = COPY[reason]
  const already = me.data?.billing.tier === 'PLUS' || me.data?.billing.tier === 'PREMIUM'
  const canBuy = billing.available || demo
  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <View style={styles.root}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={styles.sheet}>
        <Text style={styles.kicker}>Plus</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>
        <View style={styles.list}>
          {OPENS.map((line) => (
            <View key={line} style={styles.row}>
              <View style={styles.dot} />
              <Text style={styles.line}>{line}</Text>
            </View>
          ))}
        </View>
        {already ? (
          <Text style={styles.muted}>You already have Plus. If something is still shut, give it a moment or restore.</Text>
        ) : canBuy ? (
          <>
            <Pressable style={styles.primary} onPress={() => buy.mutate('month')} disabled={buy.isPending}>
              <Text style={styles.primaryText}>{buy.isPending ? '…' : `Get Plus · ${monthly?.product.priceString ?? PRICE_MONTH.split(' ')[0]} a month`}</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={() => buy.mutate('year')} disabled={buy.isPending}>
              <Text style={styles.secondaryText}>{`A year · ${annual?.product.priceString ?? PRICE_YEAR.split(' ')[0]}`}</Text>
            </Pressable>
            {demo ? <Text style={styles.muted}>Demo build: this grants Plus without a store.</Text> : null}
          </>
        ) : (
          <>
            <Text style={styles.price}>{PRICE_MONTH} · {PRICE_YEAR}</Text>
            <Text style={styles.muted}>{Platform.OS === 'web' ? 'Plus is bought in the app.' : 'Plus is not on sale in this build yet.'}</Text>
          </>
        )}
        <View style={styles.foot}>
          {billing.available ? (
            <Pressable onPress={() => restore.mutate()} hitSlop={8}><Text style={styles.link}>Restore purchases</Text></Pressable>
          ) : <View />}
          <Pressable onPress={close} hitSlop={8}><Text style={styles.link}>Not tonight</Text></Pressable>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5, 5, 7, 0.55)' },
  sheet: { backgroundColor: 'rgba(5, 5, 7, 0.96)', borderTopWidth: 1, borderTopColor: colors.hairline, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl, paddingBottom: spacing.xxl + 4, gap: spacing.md, maxWidth: 560, width: '100%' },
  kicker: { color: colors.muted, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, lineHeight: 30 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  list: { gap: 6, marginVertical: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.ink },
  line: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  primary: { backgroundColor: colors.ink, paddingVertical: 15, borderRadius: radius.pill, alignItems: 'center' },
  primaryText: { color: '#0b0a0c', fontSize: 15, fontWeight: '800' },
  secondary: { borderWidth: 1, borderColor: 'rgba(244,241,236,0.18)', paddingVertical: 13, borderRadius: radius.pill, alignItems: 'center' },
  secondaryText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  price: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  muted: { color: colors.faint, fontSize: 13, lineHeight: 18 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  link: { color: colors.faint, fontSize: 13 },
  error: { color: colors.danger, fontSize: 13 },
})
