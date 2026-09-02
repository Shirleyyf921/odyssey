import type { ModelTier } from '../llm/types.js'
import type { ConversationContext } from '../repo/types.js'

/**
 * Decide which model tier answers this turn.
 *
 * Everything is EVERYDAY until there is a signal worth paying for: stage
 * transitions, emotionally loaded input, anniversaries. Those detectors do not
 * exist yet, and guessing at them would just move cost around without evidence.
 */
export function chooseTier(_ctx: ConversationContext, _content: string): ModelTier {
  return 'EVERYDAY'
}
