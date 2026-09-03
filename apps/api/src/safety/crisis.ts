/**
 * Crisis detection. A separate pipeline from moderation, tuned toward false
 * positives, run on user input before generation. See ARCHITECTURE.md section 12.
 *
 * Only the contract and the scripted response live here today. The detector that
 * ships must be a small, evaluated classifier — a keyword list is not one, and
 * "good enough for now" is exactly the wrong bar for this module.
 */

export interface CrisisVerdict {
  crisis: boolean
}

export interface CrisisDetector {
  screen(text: string, locale: string): Promise<CrisisVerdict>
}

/** Placeholder so the pipeline ordering is real even though detection is not. */
export class NoopCrisisDetector implements CrisisDetector {
  async screen(): Promise<CrisisVerdict> {
    return { crisis: false }
  }
}

export interface CrisisResource {
  label: string
  phone: string | null
  url: string | null
  region: string
}

/**
 * Region → resources. This mapping constrains which markets can launch; add a region
 * only with verified, current numbers.
 */
const RESOURCES: Record<string, CrisisResource[]> = {
  US: [
    {
      label: '988 Suicide & Crisis Lifeline (call or text 988)',
      phone: '988',
      url: 'https://988lifeline.org',
      region: 'US',
    },
  ],
  GB: [
    {
      label: 'Samaritans (free, 24 hours)',
      phone: '116 123',
      url: 'https://www.samaritans.org',
      region: 'GB',
    },
  ],
}

const FALLBACK: CrisisResource[] = [
  {
    label: 'Find a helpline in your country',
    phone: null,
    url: 'https://findahelpline.com',
    region: 'GLOBAL',
  },
]

export function resourcesFor(locale: string): CrisisResource[] {
  const region = locale.split(/[-_]/)[1]?.toUpperCase()
  return (region && RESOURCES[region]) || FALLBACK
}

/** Pre-scripted, never generated. Rendered outside the character's voice by the client. */
export const INTERVENTION_BODY =
  "It sounds like you're going through something really painful right now. " +
  "You deserve support from someone who can be there with you. " +
  'Please reach out to one of these — they are free, confidential, and available now.'
