import type { ModelTier } from '../llm/types.js'
import type { ConversationContext } from '../repo/types.js'

export interface TurnSignals {
  /** The relationship advanced a stage on this message. */
  stageChanged: boolean
}

/**
 * Decide which model tier answers this turn.
 *
 * A stage transition is the first concrete "pivotal moment": the reply that
 * follows it is the one the user will remember, so it gets the stronger model.
 * Everything else is EVERYDAY until there is another measured signal worth paying
 * for (emotionally loaded input, anniversaries).
 */
export function chooseTier(_ctx: ConversationContext, _content: string, signals: TurnSignals): ModelTier {
  return signals.stageChanged ? 'PIVOTAL' : 'EVERYDAY'
}
