import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { PhotoKind } from '@odyssey/shared'
import { api, ApiError } from './api'
import { useChatStore } from '../store/chat'
import { usePaywall } from '../store/paywall'

/**
 * Ask him for a picture (docs/story-pipeline.md). The server answers with his
 * caption as a message and the card; both go into the conversation the way a
 * photo he sends on his own does, so the stage and the chat show it unchanged.
 * A 402 is the paywall (NEEDS_PLUS) or a line (USED_TODAY); anything else is a line.
 */
export function useAskPhoto(conversationId: string, characterId: string | undefined) {
  const qc = useQueryClient()
  const [line, setLine] = useState<string | null>(null)
  const ask = useMutation({
    mutationFn: (kind: PhotoKind) => api.askPhoto(conversationId, { kind }),
    onMutate: () => setLine(null),
    onSuccess: ({ moment, message }) => {
      // The card must be in the moments cache before the message that carries it renders.
      qc.setQueryData(['moments', characterId], (prev: { moments: unknown[] } | undefined) =>
        prev ? { ...prev, moments: [...prev.moments.filter((m) => (m as { id: string }).id !== moment.id), moment] } : prev
      )
      useChatStore.getState().apply(conversationId, { type: 'moment_offer', message, moment })
      void qc.invalidateQueries({ queryKey: ['moments', characterId] })
      void qc.invalidateQueries({ queryKey: ['home'] })
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'NEEDS_PLUS') return usePaywall.getState().open('PHOTO')
      setLine(err instanceof Error ? err.message : String(err))
    },
  })
  return { ask: (kind: PhotoKind) => ask.mutate(kind), taking: ask.isPending, line }
}
