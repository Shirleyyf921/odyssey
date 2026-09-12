import { create } from 'zustand'

/**
 * Why the paywall opened. The sheet says one true sentence per reason; the
 * reason is also what gets logged when purchases are wired, so we learn which
 * moment converts (ARCHITECTURE.md section 7).
 */
export type PaywallReason = 'CAP' | 'CALL' | 'EPISODE' | 'MEMORY' | 'GENERIC'

interface PaywallStore {
  reason: PaywallReason | null
  open(reason: PaywallReason): void
  close(): void
}

export const usePaywall = create<PaywallStore>((set) => ({
  reason: null,
  open: (reason) => set({ reason }),
  close: () => set({ reason: null }),
}))
