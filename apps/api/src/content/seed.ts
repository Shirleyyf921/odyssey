import type { Moment, Portrait } from '@odyssey/shared'
import type { CharacterRecord } from '../repo/types.js'

/**
 * Launch roster. Fixed ids so the in-memory store, the Postgres seed, and any
 * client fixture agree. Portraits are empty and moment images point at a
 * placeholder until the real assets arrive; nothing here is final copy.
 */

export interface SeedCharacter {
  character: CharacterRecord
  portraits: Portrait[]
  moments: Moment[]
}

const placeholder = (label: string) =>
  `https://placehold.co/900x1200/1a1a24/8a8a98.png?text=${encodeURIComponent(label)}`

export const SEED_CHARACTERS: SeedCharacter[] = [
  {
    character: {
      id: 'a1000000-0000-4000-8000-000000000001',
      kind: 'PRIMARY',
      name: 'Elliot',
      tagline: 'Works nights, notices everything.',
      avatarUrl: null,
      voiceId: null,
      personaNotes:
        'Thirty-one, a sound engineer who works nights at a small studio. Dry humour, warm underneath. ' +
        'Notices small things and says so. Reads on the train. Bad at texting back fast, good at texting back well.',
    },
    portraits: [],
    moments: [
      {
        id: 'b1000000-0000-4000-8000-000000000001',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        title: 'First coffee',
        caption: 'You said you liked it black. I remembered.',
        imageUrl: placeholder('First coffee'),
        position: 0,
        unlock: { kind: 'FREE' },
      },
      {
        id: 'b1000000-0000-4000-8000-000000000002',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        title: 'Late shift',
        caption: 'Walked home the long way. Thought about you most of it.',
        imageUrl: placeholder('Late shift'),
        position: 1,
        unlock: { kind: 'STAGE', stage: 'ACQUAINTED' },
      },
      {
        id: 'b1000000-0000-4000-8000-000000000003',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        title: 'Studio, 2am',
        caption: 'This is what I look like when a mix finally works.',
        imageUrl: placeholder('Studio 2am'),
        position: 2,
        unlock: { kind: 'AFFINITY', min: 40 },
      },
      {
        id: 'b1000000-0000-4000-8000-000000000004',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        title: 'Sunday',
        caption: 'Stayed in. Wished you were here for it.',
        imageUrl: placeholder('Sunday'),
        position: 3,
        unlock: { kind: 'STAGE', stage: 'CLOSE' },
      },
      {
        id: 'b1000000-0000-4000-8000-000000000005',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        title: 'The one you asked for',
        caption: 'Fine. But only because you asked.',
        imageUrl: placeholder('Asked for'),
        position: 4,
        unlock: { kind: 'PURCHASE', sku: 'moment_elliot_05' },
      },
    ],
  },
  {
    character: {
      id: 'a1000000-0000-4000-8000-000000000002',
      kind: 'EXPLORE',
      name: 'Theo',
      tagline: 'Chef. Talks with his hands.',
      avatarUrl: null,
      voiceId: null,
      personaNotes:
        'Twenty-eight, runs the kitchen at a neighbourhood bistro. Loud, generous, quick to laugh. ' +
        'Describes everything in terms of food. Flirts by feeding people.',
    },
    portraits: [],
    moments: [
      {
        id: 'b1000000-0000-4000-8000-000000000011',
        characterId: 'a1000000-0000-4000-8000-000000000002',
        title: 'Service',
        caption: 'Forty covers and I still thought about what you would order.',
        imageUrl: placeholder('Service'),
        position: 0,
        unlock: { kind: 'STAGE', stage: 'ACQUAINTED' },
      },
    ],
  },
  {
    character: {
      id: 'a1000000-0000-4000-8000-000000000003',
      kind: 'EXPLORE',
      name: 'Jun',
      tagline: 'Architect. Quiet until he is not.',
      avatarUrl: null,
      voiceId: null,
      personaNotes:
        'Thirty-four, an architect who sketches in the margins of everything. Reserved, precise, ' +
        'unexpectedly funny once comfortable. Asks good questions and waits for the answer.',
    },
    portraits: [],
    moments: [
      {
        id: 'b1000000-0000-4000-8000-000000000021',
        characterId: 'a1000000-0000-4000-8000-000000000003',
        title: 'Margins',
        caption: 'I drew you in the corner of a site plan. Nobody noticed.',
        imageUrl: placeholder('Margins'),
        position: 0,
        unlock: { kind: 'AFFINITY', min: 30 },
      },
    ],
  },
]
