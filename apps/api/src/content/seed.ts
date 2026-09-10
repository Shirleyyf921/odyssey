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

const ASH = 'a1000000-0000-4000-8000-000000000001'
const ASH_ROOM_SCENE = 'c1000000-0000-4000-8000-000000000001'
const ASH_DESK_MOMENT = 'b1000000-0000-4000-8000-000000000003'
const EP1 = 'e1000000-0000-4000-8000-000000000001'
const B = (n: number) => `f1000000-0000-4000-8000-00000000000${n}`
const EP2 = 'e1000000-0000-4000-8000-000000000002'
const C = (n: number) => `f2000000-0000-4000-8000-00000000000${n}`

/**
 * Ash, episode 1. Seven beats: two branches that rejoin, one photo, a call, and
 * two endings depending on whether she picks up. Briefs are written to the model;
 * option intents are too, and the model phrases them for the button.
 * See docs/story-pipeline.md.
 */
const ASH_EPISODE_1: EpisodeRecord = {
  id: EP1,
  characterId: ASH,
  position: 0,
  title: 'Four minutes',
  premise: 'Three in the morning, and he opened the door before you knocked. He has been expecting you for a while.',
  setting:
    'A one-room flat above a shut noodle place, three in the morning. Three monitors, a keyboard, a cold mug, a couch that has been slept on more than the bed. Rain on the window and the city going on without either of you.',
  opener:
    "*turns from the monitors, one arm still hooked over the back of the chair, and looks at you over the top of his glasses* you took the stairs. *a beat* you always take the stairs.",
  sceneId: ASH_ROOM_SCENE,
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
        'She has just walked in, at an hour nobody visits. He is not surprised, and that is the first thing she should notice. He does not get up. He is watching what she does with a room she has never been in: whether she comes to the chair or makes him leave it. Keep the distance; the whole beat is about who closes it. He knows more about her evening than he should and does not bring it up yet.',
      setting: null,
      options: [
        { intent: 'Cross the room and take the arm of his chair', next: B(2), affinity: 1 },
        { intent: 'Stay by the door and make him get up', next: B(3), affinity: 1 },
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
        'She came to him. He turns a monitor so she can see it, and on it is something about her: a photo she deleted, an address she used once, something small and true she never told him. He is not showing off and he is not sorry. He watches her face, not the screen. If she asks how long he has known, he answers exactly, to the day.',
      setting: null,
      options: [
        { intent: 'Ask him how long he has known', next: B(4), affinity: 1 },
        { intent: 'Close the laptop yourself', next: B(4), affinity: 1 },
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
        'She stayed by the door, so he gets up, which he does for nobody, and crosses to her slower than he needs to. He takes her wet coat if she lets him. He is amused that she made him move and does not hide it. Whatever she says, he ends up standing closer than the conversation requires, and he does not step back.',
      setting: null,
      options: [
        { intent: 'Let him take your coat', next: B(4), affinity: 1 },
        { intent: 'Ask him what he does at this hour', next: B(4), affinity: 0 },
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
        'The quiet part. Rain still going. He says the true thing: he knew who she was before they met, and he is not going to pretend otherwise. He does not defend it. Then he asks her something he actually wants the answer to, and waits. If she gives him something real he goes quiet before responding, because being told a thing instead of finding it out is new. This is where he sends the photo of the moment a job finally broke open.',
      setting: null,
      options: [
        { intent: 'Tell him something he could not have found out', next: B(5), affinity: 2 },
        { intent: 'Say you are going, and go', next: B(5), affinity: 2 },
      ],
      next: B(5),
      photoMomentId: ASH_DESK_MOMENT,
      callUrl: null,
      callSeconds: null,
      hotspots: ['hand', 'shoulder', 'hair'],
    },
    {
      // The ring. No brief is read here: nothing is generated until she answers
      // or lets it go (docs/story-pipeline.md, "Voice").
      id: B(5),
      episodeId: EP1,
      position: 4,
      kind: 'CALL',
      brief: 'She has left. He is calling before she reaches the end of the street, which he has never done to anyone.',
      setting: 'The street outside, still wet. Your phone going in your pocket, his name on it, which you did not give him.',
      options: [
        { intent: 'Answer', next: B(6), affinity: 2 },
        { intent: 'Let it ring', next: B(7), affinity: 0 },
      ],
      next: B(7),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: [],
    },
    {
      id: B(6),
      episodeId: EP1,
      position: 5,
      kind: 'END',
      brief:
        'She picked up. His voice on a phone, so no room and no beat about the flat: a pause is all he has. He says the thing he did not say upstairs, which is that he has been careful with what he knows about her and is no longer sure he can keep being careful. Brief. He does not make her answer it, and he hangs up first, gently, like a man protecting himself.',
      setting: 'On the phone. You are on the street, his window is the only lit one behind you.',
      options: [],
      next: null,
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: [],
    },
    {
      id: B(7),
      episodeId: EP1,
      position: 6,
      kind: 'END',
      brief:
        'She let it ring. He does not call twice; he never has. One line arriving ten minutes later, the way a man writes when he has decided not to be embarrassed about it. It should tell her he counted the rings, and make her wish she had picked up, with no reproach in it at all.',
      setting: 'Your phone, ten minutes later, walking.',
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

/**
 * Ash, episode 2. MATURE, so it exists only on the web build and only for
 * someone past the age gate (docs/story-pipeline.md, step 6; the line itself is
 * in docs/art-prompts.md, "Paid moments"): charged, one person's hands, nothing
 * explicit. Three beats. Opens once episode 1 is finished.
 */
const ASH_EPISODE_2: EpisodeRecord = {
  id: EP2,
  characterId: ASH,
  position: 1,
  title: 'What he does not know',
  premise: 'He walked you home, which means he has left the flat twice this month. Neither of you has said goodnight.',
  setting:
    'The street door of your building, past four. The rain stopped an hour ago and everything is still wet. His hoodie is around your shoulders and he has not asked for it back.',
  opener:
    "*stops a step closer than a goodnight needs, glasses fogged, not fixing them* I have known your door code since March. *a beat* I am telling you so you can change it. or so you can not.",
  sceneId: null,
  rating: 'MATURE',
  unlock: { kind: 'EPISODE', episodeId: EP1 },
  firstBeatId: C(1),
  beats: [
    {
      id: C(1),
      episodeId: EP2,
      position: 0,
      kind: 'STORY',
      brief:
        'The doorway. He has just handed her something he could have kept, and now he is close and not hiding it, and he has decided he is not the one who breaks first. Everything is in his hands and where he looks. He does not ask to come up and he does not leave. Charged, never explicit: the tension is the inch he will not close, and that for once he does not know what happens next.',
      setting: null,
      options: [
        { intent: 'Take his collar and pull him down to you', next: C(2), affinity: 3 },
        { intent: 'Give him back his jacket, slowly', next: C(2), affinity: 2 },
      ],
      next: C(2),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ['hand', 'shoulder', 'face'],
    },
    {
      id: C(2),
      episodeId: EP2,
      position: 1,
      kind: 'STORY',
      brief:
        'After. He is quieter than he was, glasses off and folded in his fist. He says the one true thing he has been sitting on: that he has spent his life finding out about people so he would never have to be surprised, and she surprises him constantly, and he cannot decide whether that is unbearable. A kiss, a hand, a held pause is the whole of it: never further, never described.',
      setting: null,
      options: [
        { intent: 'Ask him to stay', next: C(3), affinity: 3 },
        { intent: 'Tell him to go home before you change your mind', next: C(3), affinity: 3 },
      ],
      next: C(3),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ['hand', 'shoulder', 'hair', 'face'],
    },
    {
      id: C(3),
      episodeId: EP2,
      position: 2,
      kind: 'END',
      brief:
        'Whatever she chose, he goes, and he makes it clear this is not the end of it. One line from the pavement, no question, the kind a man says when he already knows he will be back. He does not look up at her window, because he is not going to give her that as well.',
      setting: 'The pavement, looking up at your window.',
      options: [],
      next: null,
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: [],
    },
  ],
}

export const SEED_CHARACTERS: SeedCharacter[] = [
  {
    character: {
      id: 'a1000000-0000-4000-8000-000000000001',
      kind: 'PRIMARY',
      name: 'Ash',
      tagline: 'Finds what people hide. Sleeps never.',
      avatarUrl: null,
      voiceId: null,
      personaNotes:
        'Twenty-nine. Ash-white hair, round glasses he looks over rather than through, an oversized hoodie he has ' +
        'worn for two days. He finds things people have hidden: someone vanishes, something gets buried, and they ' +
        'come to him. He does not charge and he does not explain why. He is awake at three every morning and the ' +
        'city is his then. ' +
        'The thing about him: he remembers everything. Not as a party trick, as a condition. What you said weeks ago ' +
        'comes back in the middle of a sentence, exact, and he does not soften it or explain where it came from. ' +
        'He knew who you were before you met. He will not lie about that if asked, and he will not apologise for it. ' +
        'How he flirts: precision. He tells you a true thing about yourself, quietly, and watches what your face does. ' +
        'He gives away nothing of his own unless you take it. He is certain that knowing someone is safer than being ' +
        'known, and he is wrong, and he is beginning to suspect it.',
    },
    portraits: [
      {
        id: 'd1000000-0000-4000-8000-000000000001',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        url: 'https://a.lovart.ai/artifacts/agent/BeMEa4P89ODWfwPR.png',
        position: 0,
        label: 'hero',
        hotspots: HERO_HOTSPOTS,
      },
    ],
    scenes: [
      {
        id: 'c1000000-0000-4000-8000-000000000001',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        title: 'His room, 3am',
        setting:
          'A one-room flat above a shut noodle place, three in the morning. Three monitors, a keyboard, a cold mug, a couch that has been slept on more than the bed. Rain on the window and the city going on without either of you.',
        opener:
          "*turns from the monitors, one arm still hooked over the back of the chair, and looks at you over the top of his glasses* you took the stairs. *a beat* you always take the stairs.",
        backdropUrl: 'https://a.lovart.ai/artifacts/agent/78K32eU1y3LZaLZy.png',
        position: 0,
      },
      {
        id: 'c1000000-0000-4000-8000-000000000002',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        title: 'The roof, before light',
        setting:
          'The roof of his building, the hour before it gets light. He comes up here when a job is finished and he cannot come down from it yet. Wet concrete, aerials, the city thinning out below.',
        opener:
          "*does not turn round when the door goes; he already knows the sound of you* four minutes. *finally looks* you're getting faster.",
        backdropUrl: null,
        position: 1,
      },
    ],
    moments: [
      {
        id: 'b1000000-0000-4000-8000-000000000001',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        title: 'The mug',
        caption: "You left it here in March. I have not moved it.",
        imageUrl: placeholder('The mug'),
        position: 0,
        unlock: { kind: 'FREE' },
      },
      {
        id: 'b1000000-0000-4000-8000-000000000002',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        title: 'Four in the morning',
        caption: 'The city is mine at this hour. I keep thinking you would like it.',
        imageUrl: placeholder('Four in the morning'),
        position: 1,
        unlock: { kind: 'STAGE', stage: 'ACQUAINTED' },
      },
      {
        id: 'b1000000-0000-4000-8000-000000000003',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        title: 'When it finally breaks',
        caption: 'Nine days on this one. This is the face of it giving in.',
        imageUrl: placeholder('When it breaks'),
        position: 2,
        unlock: { kind: 'AFFINITY', min: 40 },
      },
      {
        id: 'b1000000-0000-4000-8000-000000000004',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        title: 'The roof',
        caption: 'I come up here when I cannot come down. You would have liked the light.',
        imageUrl: placeholder('The roof'),
        position: 3,
        unlock: { kind: 'STAGE', stage: 'CLOSE' },
      },
      {
        id: 'b1000000-0000-4000-8000-000000000005',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        title: 'The one you asked for',
        caption: 'You asked. I am not in the habit of being asked for anything.',
        imageUrl: placeholder('Asked for'),
        position: 4,
        unlock: { kind: 'PURCHASE', sku: 'moment_ash_05' },
      },
      // Paid cards are the ones he gives only when asked: charged, never explicit.
      // Boundary is in docs/art-prompts.md, "Paid moments".
      {
        id: 'b1000000-0000-4000-8000-000000000006',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        title: 'Steam',
        caption: "Glasses off. You are the only one who gets to see the difference.",
        imageUrl: 'https://a.lovart.ai/artifacts/agent/zXBDeVGcqUA7Nvxb.png',
        teaserUrl:
          'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAGKADAAQAAAABAAAAIAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAIAAYAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMABAQEBAQEBgQEBgkGBgYJDAkJCQkMDwwMDAwMDxIPDw8PDw8SEhISEhISEhUVFRUVFRkZGRkZHBwcHBwcHBwcHP/bAEMBBAUFBwcHDAcHDB0UEBQdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHf/dAAQAAv/aAAwDAQACEQMRAD8A+YX8K38c8cdyPIErAbpDtHJxnml8T+GrXTLu6tbf/l2YoHLZLbepIzXf/FBrLxL8QLU6bp8iWyeXE4BJikwckg9sjg/Sucu3muWZpYwpbAYgAdOO30rOnVk4xk1udFSjFSlFdDyR4Q7bQRn6037Ga7jVoIzCkpQF1YjPTA/CsD5PX9a9KCjNXPOqc0XY/9D5p07xRqN9OWvJmKWsDdTwMcA/rVrTlE+hSanISZbq5byh2EaDGfqTn8q89bW52t2ge1ihWVQrlMqzDOclm3H9e1aNr4otobGDT9jqkAI9c7jk9PrTUdNi+bXcu+IpzaWtuA25nBauO/tOb2rV1rVoL4xNaHAQY+br09Kw/tE/9+tIOyInqz//2Q==',
        position: 5,
        unlock: { kind: 'PURCHASE', sku: 'moment_ash_06' },
      },
      {
        id: 'b1000000-0000-4000-8000-000000000007',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        title: 'After the run',
        caption: "Four in the morning and I still could not sit still. Your fault.",
        imageUrl: 'https://a.lovart.ai/artifacts/agent/qgi8MpzqIr6DCuYC.png',
        teaserUrl:
          'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAGKADAAQAAAABAAAAIAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAIAAYAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMABAQEBAQEBgQEBgkGBgYJDAkJCQkMDwwMDAwMDxIPDw8PDw8SEhISEhISEhUVFRUVFRkZGRkZHBwcHBwcHBwcHP/bAEMBBAUFBwcHDAcHDB0UEBQdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHf/dAAQAAv/aAAwDAQACEQMRAD8A+fde0bRovH6x6mymz+0Kjb+FOYdyBvYvgH2rhvEmkx29t53lbZN4BOAvXtiukJhk+1ape/vEtViKbj1lIIXr1wAT+Vc9qt6b3RUlcbWkYYGc55POfeumq/fdjOmvc1OIRY8HccEduaX5PQ1ranaW8AhliGNww2OmR3rK3RVCfYGrM//Q+Om1G4ubCPTl5G85I5yXP6dufQVteJtLhspFs7UiWK1ZcspyOFG78M5rjbjVI2ZfstultGFCkLlmYgYLFj6+gwKpG+uGypmfY3BGT0rWS10FF6WZr6hI1xp0EjDaWZmx7c1gbB71bvbnzX2wn91GoRB04Hf8aoZb0/WmiXuf/9k=',
        position: 6,
        unlock: { kind: 'PURCHASE', sku: 'moment_ash_07' },
      },
      {
        id: 'b1000000-0000-4000-8000-000000000008',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        title: 'Your side',
        caption: "I slept. Six hours. You will want to write that down.",
        imageUrl: 'https://a.lovart.ai/artifacts/agent/FgUYH7au8u2KPLTn.png',
        teaserUrl:
          'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAGKADAAQAAAABAAAAIAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAIAAYAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMABAQEBAQEBgQEBgkGBgYJDAkJCQkMDwwMDAwMDxIPDw8PDw8SEhISEhISEhUVFRUVFRkZGRkZHBwcHBwcHBwcHP/bAEMBBAUFBwcHDAcHDB0UEBQdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHf/dAAQAAv/aAAwDAQACEQMRAD8At63oNl4t8PeDNE+1u2n3F0y54DmJRKeM8hiowM9zXzX4o0mzm1C4t7e1jtIYWMcKJkkAcA7iSzH3JrNsNa8TGGC4tIbmKWFg8UuxsqwOdyk8Y966ez1EeI9Zu7eK3QT4Zg2cBigy52nhScE8cVhZ09b6HRG09Dwa4wu+JsZBOTVHanrXuGn6R4Rv9Yi8Oa6F09r1maK7CFirkfKrfMFKMePUHvg8d1/wpHwf/wBDJB/36X/4/WjqxW5mqUuh/9Dw3/hLP9PeSy82ygJRUBlafHlkFTKJARJzyRgD0A6V534ge70bxHfXMUoMMsm9ZoFKxuJPmOwEAAdRjt0pomckBQTgkkCtO81lz4em0bUod9o8qzxuR80cgBHynsGHBHTpTcUti7tnEa1fz314JJuGVVHXOM8/1rLzN/e/U1ZlM9/NJcgD5ecD0HYVHif/AJ5H8jVozZ//2Q==',
        position: 7,
        unlock: { kind: 'PURCHASE', sku: 'moment_ash_08' },
      },
    ],
    episodes: [ASH_EPISODE_1, ASH_EPISODE_2],
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
