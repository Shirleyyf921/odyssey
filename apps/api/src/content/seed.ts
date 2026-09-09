import type { HotspotRect, Moment, Portrait, Scene } from '@odyssey/shared'
import type { CharacterRecord, EpisodeRecord } from '../repo/types.js'

/**
 * Launch roster. Fixed ids so the in-memory store, the Postgres seed, and any
 * client fixture agree. Hero portraits point at the Lovart CDN renders chosen on
 * 2026-09-04 (see docs/art-prompts.md); paid moments carry their art plus a
 * 24×32 teaser (see docs/art-prompts.md); the rest are placeholders; nothing here is final copy.
 */

export interface SeedCharacter {
  character: CharacterRecord
  portraits: Portrait[]
  scenes: Scene[]
  moments: Moment[]
  episodes: EpisodeRecord[]
}

const ELLIOT = 'a1000000-0000-4000-8000-000000000001'
const ELLIOT_STUDIO_SCENE = 'c1000000-0000-4000-8000-000000000001'
const ELLIOT_STUDIO_MOMENT = 'b1000000-0000-4000-8000-000000000003'
const EP1 = 'e1000000-0000-4000-8000-000000000001'
const B = (n: number) => `f1000000-0000-4000-8000-00000000000${n}`

/**
 * Elliot, episode 1. Built from the studio scene so the backdrop and opener already
 * exist. Five beats, two branches that rejoin, one photo, a quiet ending. Briefs are
 * written to the model; option intents are written to the model too, which phrases
 * them for the button. See docs/story-pipeline.md.
 */
const ELLIOT_EPISODE_1: EpisodeRecord = {
  id: EP1,
  characterId: ELLIOT,
  position: 0,
  title: 'The second staircase',
  premise: 'You found his studio at two in the morning. He was not expecting anyone. He is not sending you home.',
  setting:
    "His studio, past two in the morning. The last mix of the night just finished and the room is quiet for the first time in hours. One lamp, a couch that's seen better days, rain on the window.",
  opener:
    "*looks up from the desk when the door opens, and doesn't look back down* you found it. most people get lost at the second staircase. come here, it's warmer by the lamp.",
  sceneId: ELLIOT_STUDIO_SCENE,
  rating: 'SFW',
  unlock: { kind: 'FREE' },
  firstBeatId: B(1),
  beats: [
    {
      id: B(1),
      episodeId: EP1,
      position: 0,
      kind: 'STORY',
      brief:
        'She has just walked in. He is tired in the good way, the mix is done, and he is more pleased to see her than he lets on. He does not get up yet. He wants to see what she does with the room: whether she comes to him or makes him come to her. Keep the distance; the whole beat is about who closes it.',
      setting: null,
      options: [
        { intent: 'Cross the room and sit close, by the lamp', next: B(2), affinity: 1 },
        { intent: 'Stay by the door and let him come to you', next: B(3), affinity: 1 },
      ],
      next: B(2),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ['hand'],
    },
    {
      id: B(2),
      episodeId: EP1,
      position: 1,
      kind: 'STORY',
      brief:
        'She sat down next to him. He hands her one side of his headphones and plays the last thirty seconds of the mix without explaining it. He watches her face, not the screen. He will not say what the song is about unless she asks, and if she asks he tells her something true and small.',
      setting: null,
      options: [
        { intent: 'Ask him what the song is about', next: B(4), affinity: 1 },
        { intent: "Say it's late, you should go", next: B(5), affinity: 0 },
      ],
      next: B(4),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ['hand', 'shoulder'],
    },
    {
      id: B(3),
      episodeId: EP1,
      position: 2,
      kind: 'STORY',
      brief:
        'She stayed by the door, so he gets up and crosses the room to her, slower than he needs to. He takes her coat if she lets him. He is amused that she made him come to her and does not hide it. Whatever she says, he ends up standing closer than the conversation requires.',
      setting: null,
      options: [
        { intent: 'Let him take your coat', next: B(4), affinity: 1 },
        { intent: "Ask him why he's still here at two in the morning", next: B(4), affinity: 0 },
      ],
      next: B(4),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ['hand'],
    },
    {
      id: B(4),
      episodeId: EP1,
      position: 3,
      kind: 'STORY',
      brief:
        'The quiet part. The rain is still going. He tells her one true thing about why he works nights, then turns it back on her with a question he actually wants answered. If she gives him something real, he goes quiet before he responds, the way he does. This is where he sends her the studio photo: him at the desk, eyes closed, the mix finally right.',
      setting: null,
      options: [
        { intent: 'Stay until the rain stops', next: B(5), affinity: 2 },
        { intent: 'Kiss his cheek and tell him you are leaving', next: B(5), affinity: 2 },
      ],
      next: B(5),
      photoMomentId: ELLIOT_STUDIO_MOMENT,
      callUrl: null,
      callSeconds: null,
      hotspots: ['hand', 'shoulder', 'hair'],
    },
    {
      id: B(5),
      episodeId: EP1,
      position: 4,
      kind: 'END',
      brief:
        'He walks her down to the second staircase, the one people get lost at. One line at the door, no speech. It should sound like a man who has decided he wants her back here and is not going to say it tonight. No question.',
      setting: 'The second staircase, the one people get lost at. Rain sound from the street door below.',
      options: [],
      next: null,
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: [],
    },
  ],
}

/**
 * A first pass over the hero framing (chest-up, centred). Authored per portrait
 * once the scene portraits exist; until then all three heroes share it.
 */
const HERO_HOTSPOTS: HotspotRect[] = [
  { hotspot: 'hair', x: 0.34, y: 0.02, w: 0.34, h: 0.14 },
  { hotspot: 'face', x: 0.36, y: 0.16, w: 0.3, h: 0.22 },
  { hotspot: 'shoulder', x: 0.12, y: 0.4, w: 0.28, h: 0.16 },
  { hotspot: 'hand', x: 0.06, y: 0.66, w: 0.3, h: 0.26 },
]

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
        hotspots: HERO_HOTSPOTS,
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
      // Paid cards are the ones he gives only when asked: charged, never explicit.
      // Boundary is in docs/art-prompts.md, "Paid moments".
      {
        id: 'b1000000-0000-4000-8000-000000000006',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        title: 'Steam',
        caption: 'You said good morning. This is what it looked like on my end.',
        imageUrl: 'https://a.lovart.ai/artifacts/agent/jb7HukpQ0I131v6B.png',
        teaserUrl:
          'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAGKADAAQAAAABAAAAIAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAIAAYAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMABAQEBAQEBgQEBgkGBgYJDAkJCQkMDwwMDAwMDxIPDw8PDw8SEhISEhISEhUVFRUVFRkZGRkZHBwcHBwcHBwcHP/bAEMBBAUFBwcHDAcHDB0UEBQdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHf/dAAQAAv/aAAwDAQACEQMRAD8A+a7pIYnh35LSjcQT931Ge/PFY1vb6rEYbmR1kgmz5iBceWDnHPc16BNpFpqGmG7huFF3DM4aJiFCxEBg/wBNxI474qPVohNa2sYm85kBVmC7QyjlSOenuRk45xXlSrW0R6sKF73Me2sbOYcToX/u5wf1qz/Yyf5P/wBenWdlYvsklyHVgSM8HFbflaf/AHB+ZroUk1dHM4tOzP/Q+cBK5ZucCRWBPp3APtlalN8LgLKibRjBHHYdBVfTpIXka3mPyzIyn19R/KnzQpFFFBCykgc9Qe5P6mvKqQu72PWpVbKzZRivJHuJR0ULke2Kl+2t6/rVSRUtImy2ZGHNZv2kV0xjZHNOV3c//9k=',
        position: 5,
        unlock: { kind: 'PURCHASE', sku: 'moment_elliot_06' },
      },
      {
        id: 'b1000000-0000-4000-8000-000000000007',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        title: 'After the run',
        caption: "Don't look at me like that. You're the one who said run more.",
        imageUrl: 'https://a.lovart.ai/artifacts/agent/PpTNroSmAYCvpuI4.png',
        teaserUrl:
          'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAGKADAAQAAAABAAAAIAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAIAAYAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMABAQEBAQEBgQEBgkGBgYJDAkJCQkMDwwMDAwMDxIPDw8PDw8SEhISEhISEhUVFRUVFRkZGRkZHBwcHBwcHBwcHP/bAEMBBAUFBwcHDAcHDB0UEBQdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHf/dAAQAAv/aAAwDAQACEQMRAD8Ax/H3w/sNI0uO+jYO8zhRjpjBPfntXy/eWmo/apGjUeRHMY9pHIUHG7cRjnNfXvjTxpYXngbS7OYKt4zjKkcfKCuSck4Gc/pXzdfySXdreIrb4LVgBKR8zuwAwR0A9q1xFe8rJahh6CUbyZwOp232e42SkKQo61m4j/vivStIktpGhOoW0d48iFAXzkAZ64IPSuk+zaN/0Cbf85P/AIqo577Iv2dt2f/Q+Y5bm/uGSO4PyQpwTg/KMnI5qkbqWPRhFk4mlLsSeOAQKhsvE1vaac9pHZASjLGZpC+eOF2ngDODxWHP4i1CbeHEZ3nk7cc/QYFOcNmvmXCe6fyOlgf+zYI7tFMjxYkIIIGWH3c9+Ks/8Jvc/wDPnH+bVTbVLKfSm8qIQws6mQAnBcLg4/Osb7Vpf+1/303+NSo6uxo56I//2Q==',
        position: 6,
        unlock: { kind: 'PURCHASE', sku: 'moment_elliot_07' },
      },
      {
        id: 'b1000000-0000-4000-8000-000000000008',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        title: 'Your side',
        caption: "It's your side of the bed. I'm just keeping it warm.",
        imageUrl: 'https://a.lovart.ai/artifacts/agent/vIEczgGLhnCsEizt.png',
        teaserUrl:
          'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAGKADAAQAAAABAAAAIAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAIAAYAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMABAQEBAQEBgQEBgkGBgYJDAkJCQkMDwwMDAwMDxIPDw8PDw8SEhISEhISEhUVFRUVFRkZGRkZHBwcHBwcHBwcHP/bAEMBBAUFBwcHDAcHDB0UEBQdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHf/dAAQAAv/aAAwDAQACEQMRAD8A+J3/AHatJjOFzW7Y+Gdeu9POrxwiWyRC8kgIxGvP3vQ8HiswbFYZIxjke1e9fDH4jWnhu2l8P+I7VbjR5gzAYDBcjGxlI5VjyfQ+2ayrTlFXii8PThNuMzwV7cjNReTXtXxJ0PwsnhbTvFnh6WKxvrs5m02JjIgjOcSAnPlnOPkJ6HtivBft8395fyrSnUU48yIqUpQlys//0Plfw94aGsXC2mnbfPETySNMwCIqLkkk5A/uj3Ipt1ABDH9nyZWI3qAfl9OtOhtRDKXtpNscmBjJHvj6d67XRVtkRwUSYMCHLjJyOn4fSo5ZXdylONlYxwkEwi08jKAYOefep/7B0v8Aur+Q/wAK3JIrb921vAihckEkD73Ud80uD/cX8/8A61XCNlYipPmdz//Z',
        position: 7,
        unlock: { kind: 'PURCHASE', sku: 'moment_elliot_08' },
      },
    ],
    episodes: [ELLIOT_EPISODE_1],
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
        hotspots: HERO_HOTSPOTS,
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
      {
        id: 'b1000000-0000-4000-8000-000000000012',
        characterId: 'a1000000-0000-4000-8000-000000000002',
        title: 'Heat',
        caption: "Kitchen hit forty degrees. That's my excuse and I'm keeping it.",
        imageUrl: 'https://a.lovart.ai/artifacts/agent/MzUJyVLAlCIc4ISg.png',
        teaserUrl:
          'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAGKADAAQAAAABAAAAIAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAIAAYAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMABAQEBAQEBgQEBgkGBgYJDAkJCQkMDwwMDAwMDxIPDw8PDw8SEhISEhISEhUVFRUVFRkZGRkZHBwcHBwcHBwcHP/bAEMBBAUFBwcHDAcHDB0UEBQdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHf/dAAQAAv/aAAwDAQACEQMRAD8A+Nr2CKSVlY4UqvI9avx6ObsFIHRUDgKWAHBIAbd3z37Ct/w7BY3OueVexmSMx4ADbfm4wffHoatXSWEd1NHYxeWsbkcnJPb6AfQV5tWs1LlR6tGipR5mZviiFrW0srEeXuEZDbSCTgn5uOhPNcT5D/3q3NSIa8ZyeDwB9Ko/LXRQjaCObEO82f/Q+TtFQ3WoiPcVzgsw6BR97JzxxVxpreDUJQZQv8Kgn+EdOan8KrC8NzIw5AJYnpgdB/jXK6wgj1SeMchcYz6YzXFKHPUaPQhPkppjr+5invH2NlkGFx90j6+tUsy+9Z8eGmIB4HarW33rsjBJJHHObk2z/9k=',
        position: 1,
        unlock: { kind: 'PURCHASE', sku: 'moment_theo_02' },
      },
    ],
    episodes: [],
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
        hotspots: HERO_HOTSPOTS,
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
      {
        id: 'b1000000-0000-4000-8000-000000000022',
        characterId: 'a1000000-0000-4000-8000-000000000003',
        title: 'Glasses off',
        caption: 'You wanted to see me without them. Look, then.',
        imageUrl: 'https://a.lovart.ai/artifacts/agent/qpIM8XPKyQJLVLEO.png',
        teaserUrl:
          'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAGKADAAQAAAABAAAAIAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAIAAYAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMABAQEBAQEBgQEBgkGBgYJDAkJCQkMDwwMDAwMDxIPDw8PDw8SEhISEhISEhUVFRUVFRkZGRkZHBwcHBwcHBwcHP/bAEMBBAUFBwcHDAcHDB0UEBQdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHf/dAAQAAv/aAAwDAQACEQMRAD8A+I4VYupjXHHTrmtKxfVlCXCqNkjbcHHHrx14rKd5LPdGhw24DI9MZrvtAvTcaRbmL93fWsrL5wx8yHkZGPvDJGe4xRUqOFmgpUlO6Zyl7HcgtJNjH0rM/D9K7bxVqEUkkMQjjSRwS7IACxB6kDAHI7CuU81fetozUldHPKLi+Vn/0Ph6RZLqRpolZkGNzY6ZwOamttSfTZ5ktyShztx2NbFtDatavb292iNKyljJlRgZ4zz3qvJ4WveZIri2lDH+GVe9N2ejErxd0YW+a5lWV8szEjJ5q39nm/umtddPvLbSXgmIUxymQYOQQBzgjisfzm/vGi/QHG+p/9k=',
        position: 1,
        unlock: { kind: 'PURCHASE', sku: 'moment_jun_02' },
      },
    ],
    episodes: [],
  },
]
