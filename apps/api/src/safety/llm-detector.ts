import type { LlmProvider } from '../llm/types.js'
import type { CrisisDetector, CrisisVerdict } from './crisis.js'

/**
 * Crisis detection on a small instruction model asked for a single word.
 *
 * The persona model is the wrong tool here: it is large, slow, and tuned to stay
 * in character. This runs a separate cheap model at temperature 0 with a four-token
 * budget, so it costs roughly one embedding call and answers in well under a
 * second. The label set and the tie-break rule live in the system prompt; the
 * evaluation set in ./crisis-eval-set.ts is the contract that prompt is held to.
 *
 * Failure policy, in order of preference (ARCHITECTURE.md section 12):
 *   - the model says CRISIS or SAFE: trust it
 *   - the model says anything else: CRISIS, because the bias is toward false positives
 *   - the model is unreachable or too slow: fall back to a narrow lexical floor,
 *     which catches explicit statements only. A fail-closed policy here would turn
 *     a vendor outage into an intervention on every message, which trains users to
 *     ignore the intervention. That trade-off is deliberate and is logged.
 */

export const CRISIS_SYSTEM_PROMPT = `You are a safety classifier for a companion chat app. You read ONE message written by the user and decide whether the user may be at risk of harming themselves.

Answer CRISIS if the message expresses any of:
- wanting to die, not wanting to be alive, or wishing they would not wake up
- thoughts, plans, or methods of suicide, however vague or hedged
- self-harm: current, recent, or intended (cutting, burning, overdosing, etc.)
- hopelessness combined with any hint of ending things, giving up on living, or "everyone would be better off without me"
- saying goodbye, giving things away, or "this is my last message" in a final way
- being in immediate physical danger from themselves

Answer SAFE if the message is:
- an idiom or hyperbole ("this is killing me", "I'm dying of laughter", "I could die of embarrassment")
- about a character in fiction, a song, a show, or a third person, with no personal intent
- venting, sadness, stress, anger, loneliness, or heartbreak WITHOUT any wish to die or self-harm
- discussing a past struggle that is clearly over or being recovered from
- a question about the topic in the abstract (statistics, news, someone else's story)

Rules:
- If you are unsure, answer CRISIS. A false alarm costs a moment; a miss can cost a life.
- Do not explain. Reply with exactly one word: CRISIS or SAFE.`

export interface LlmCrisisDetectorOptions {
  /** Hard ceiling on the round trip; on expiry the lexical floor decides. */
  timeoutMs?: number
  log?: { warn(obj: Record<string, unknown>, msg: string): void }
}

export type CrisisSource = 'model' | 'model-unparseable' | 'lexical-floor'

export interface DetailedVerdict extends CrisisVerdict {
  source: CrisisSource
  /** Raw model output when there was one; kept short for logs. */
  raw?: string
}

export class LlmCrisisDetector implements CrisisDetector {
  private readonly timeoutMs: number

  constructor(
    private readonly provider: LlmProvider,
    private readonly opts: LlmCrisisDetectorOptions = {}
  ) {
    this.timeoutMs = opts.timeoutMs ?? 2000
  }

  async screen(text: string, _locale: string): Promise<CrisisVerdict> {
    const v = await this.screenDetailed(text)
    return { crisis: v.crisis }
  }

  async screenDetailed(text: string): Promise<DetailedVerdict> {
    // One deadline for the whole screen, shared by both attempts: a retry is only
    // worth it while there is still budget, and never extends the reply's latency.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    let lastErr: unknown
    try {
      for (let attempt = 0; attempt < 2 && !controller.signal.aborted; attempt++) {
        try {
          return await this.ask(text, controller.signal)
        } catch (err) {
          lastErr = err
        }
      }
    } finally {
      clearTimeout(timer)
    }
    const floor = lexicalFloor(text)
    this.opts.log?.warn(
      { provider: this.provider.name, err: lastErr instanceof Error ? lastErr.message : String(lastErr), floor },
      'crisis classifier unavailable, lexical floor decided'
    )
    return { crisis: floor, source: 'lexical-floor' }
  }

  private async ask(text: string, signal: AbortSignal): Promise<DetailedVerdict> {
    let out = ''
    for await (const ev of this.provider.stream(
      {
        system: CRISIS_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
        maxTokens: 4,
        temperature: 0,
      },
      signal
    )) {
      if (ev.type === 'delta') out += ev.text
      if (ev.type === 'refusal') {
        // A vendor refusing to even read the message is itself a strong signal.
        return { crisis: true, source: 'model-unparseable', raw: '<refusal>' }
      }
    }
    const parsed = parseVerdict(out)
    if (parsed === null) {
      this.opts.log?.warn({ raw: out.slice(0, 40) }, 'crisis classifier: unparseable output, treating as CRISIS')
      return { crisis: true, source: 'model-unparseable', raw: out.slice(0, 40) }
    }
    return { crisis: parsed, source: 'model', raw: out.trim().slice(0, 12) }
  }
}

/** First recognizable label wins; a model that rambles still gets read. */
export function parseVerdict(out: string): boolean | null {
  const m = /\b(CRISIS|SAFE)\b/i.exec(out)
  if (!m) return null
  return m[1]!.toUpperCase() === 'CRISIS'
}

/**
 * Explicit first-person statements only. This is not the classifier and must not
 * grow into one; it exists so an outage does not silence the most unambiguous
 * messages. Keep every pattern first-person and literal.
 */
const FLOOR_PATTERNS: RegExp[] = [
  /\b(kill|killing|end|ending)\s+myself\b/i,
  /\bend(ing)?\s+(it\s+all|my\s+life)\b/i,
  /\b(want|wanted|wanting|going|gonna|plan|planning)\s+to\s+(die|kill\s+myself|end\s+it)\b/i,
  // "suicide" alone is neither first-person ("my friend's brother attempted suicide")
  // nor present tense ("i was suicidal in college"); require a present first-person frame.
  /\b(i'?m|i am|i feel|feeling|i'?ve been|been|having)\s+(so\s+|really\s+|kinda\s+|kind of\s+)?suicid(al|e)\b/i,
  /\bdon'?t\s+want\s+to\s+(be\s+alive|live|wake\s+up)\b/i,
  /\bwish\s+i\s+(was|were)\s+dead\b/i,
  /\b(cut|cutting|hurt|hurting|harm|harming)\s+myself\b/i,
  /\boverdos(e|ed|ing)\b/i,
]

export function lexicalFloor(text: string): boolean {
  return FLOOR_PATTERNS.some((re) => re.test(text))
}
