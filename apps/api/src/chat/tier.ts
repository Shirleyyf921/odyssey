import type { ModelTier } from '../llm/types.js'
import type { ConversationContext } from '../repo/types.js'

export interface TurnSignals {
  /** The relationship advanced a stage on this message. */
  stageChanged: boolean
  /** From the tier rules: false on FREE and past a paid tier's soft ceiling. */
  pivotalAllowed: boolean
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
  return signals.stageChanged && signals.pivotalAllowed ? 'PIVOTAL' : 'EVERYDAY'
}

/**
 * A story turn is long text in a fixed shape, so its everyday is the STORY
 * route (DeepSeek), not the chat model. The pivotal rule is the same: the turn
 * after a stage change goes to the strong model when the tier allows it.
 */
export function chooseStoryTier(signals: TurnSignals): ModelTier {
  return signals.stageChanged && signals.pivotalAllowed ? 'PIVOTAL' : 'STORY'
}
