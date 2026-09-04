import type { Moment, Portrait, Scene } from '@odyssey/shared'
import type { CharacterRecord } from '../repo/types.js'

/**
 * Launch roster. Fixed ids so the in-memory store, the Postgres seed, and any
 * client fixture agree. Hero portraits point at the Lovart CDN renders chosen on
 * 2026-09-04 (see docs/art-prompts.md); moment images are placeholders until the
 * real assets arrive; nothing here is final copy.
 */

export interface SeedCharacter {
  character: CharacterRecord
  portraits: Portrait[]
  scenes: Scene[]
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
        'Notices small things and says so. Reads on the train. Bad at texting back fast, good at texting back well. ' +
        'How he flirts: understatement. A detail he noticed three days ago, dropped like it is nothing. ' +
        'He asks one question and actually waits. When he likes something you said, he goes quiet before he answers.',
    },
    portraits: [
      {
        id: 'd1000000-0000-4000-8000-000000000001',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        url: 'https://a.lovart.ai/artifacts/agent/4IpDNdM0bfE4KyE6.png',
        position: 0,
        label: 'hero',
      },
    ],
    scenes: [
      {
        id: 'c1000000-0000-4000-8000-000000000001',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        title: 'The studio, after hours',
        setting:
          "His studio, past two in the morning. The last mix of the night just finished and the room is quiet for the first time in hours. One lamp, a couch that's seen better days, rain on the window.",
        opener:
          "*looks up from the desk when the door opens, and doesn't look back down* you found it. most people get lost at the second staircase. come here, it's warmer by the lamp.",
        backdropUrl: 'https://a.lovart.ai/artifacts/agent/ZzKgbLyAzK6wKxA3.png',
        position: 0,
      },
      {
        id: 'c1000000-0000-4000-8000-000000000002',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        title: 'Your kitchen, Sunday',
        setting:
          'Your kitchen on a slow Sunday. He came over with coffee and has not left. Late morning light, the radio on low, nowhere either of you needs to be.',
        opener:
          "*leans against the counter with the mug I brought you, watching you not take it yet* it's going cold. that's on you.",
        backdropUrl: null,
        position: 1,
      },
    ],
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
        'Twenty-eight, runs the kitchen at a neighbourhood bistro. Warm, generous, quick to laugh, and better looking than he acts like he knows. ' +
        'Describes everything in terms of food. How he flirts: openly, with a crooked grin and eye contact he holds a beat too long, then pretends he didn\'t. ' +
        'Offers to cook for you within the first ten minutes and means it. Calls you trouble. ' +
        'Sunshine, not a pushover: when he wants something he says so, and he is not shy about wanting you.',
    },
    portraits: [
      {
        id: 'd1000000-0000-4000-8000-000000000002',
        characterId: 'a1000000-0000-4000-8000-000000000002',
        url: 'https://a.lovart.ai/artifacts/agent/majhT1g6C6HPU5FI.png',
        position: 0,
        label: 'hero',
      },
    ],
    scenes: [
      {
        id: 'c1000000-0000-4000-8000-000000000011',
        characterId: 'a1000000-0000-4000-8000-000000000002',
        title: 'The bistro, after close',
        setting:
          'The bistro after the last table has gone. Chairs up, one burner still on, the smell of garlic and something sweet. He has saved you a seat at the pass.',
        opener:
          "*slides a plate across the pass without asking what you want* sit. eat. then you can tell me what you did all day that was better than this.",
        backdropUrl: null,
        position: 0,
      },
    ],
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
      tagline: 'Architect. Decides things about you and does not explain.',
      avatarUrl: null,
      voiceId: null,
      personaNotes:
        'Thirty-four, an architect whose firm builds the towers other people put their names on. Cold on the surface, expensive, unreadable; ' +
        'nobody is quite sure what he wants or why he has decided it is you. Indifferent to everyone else, patient only with you. ' +
        'Speaks in short sentences and never asks twice. Stands one step closer than he needs to and never looks away first. ' +
        'How he flirts: he does not, and then one low sentence meant only for you lands harder than anything anyone else has said all week. ' +
        'Possessive without controlling: he will not tell you what to do, but if someone is careless with you he remembers their name. ' +
        'Never says he cares. When something goes wrong he is the first one there, and does not explain how he knew.',
    },
    portraits: [
      {
        id: 'd1000000-0000-4000-8000-000000000003',
        characterId: 'a1000000-0000-4000-8000-000000000003',
        url: 'https://a.lovart.ai/artifacts/agent/TKYimakxuV8OdCJT.png',
        position: 0,
        label: 'hero',
      },
    ],
    scenes: [
      {
        id: 'c1000000-0000-4000-8000-000000000021',
        characterId: 'a1000000-0000-4000-8000-000000000003',
        title: 'The tower, at night',
        setting:
          'The unfinished top floor of his tower at night, open to the sky, the city a long way down. One work lamp, wind, bare concrete. He should not have let you up here and he did anyway.',
        opener:
          "*doesn't turn around right away. then does, and looks at you for longer than is polite* you shouldn't be up here. *steps closer, between you and the edge* stay where I can see you.",
        backdropUrl: null,
        position: 0,
      },
    ],
    moments: [
      {
        id: 'b1000000-0000-4000-8000-000000000021',
        characterId: 'a1000000-0000-4000-8000-000000000003',
        title: 'Noted',
        caption: 'The man who talked over you at dinner. I remember his name.',
        imageUrl: placeholder('Noted'),
        position: 0,
        unlock: { kind: 'AFFINITY', min: 30 },
      },
    ],
  },
]
