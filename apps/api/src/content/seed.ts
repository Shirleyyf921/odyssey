import type { HotspotRect, Moment, Portrait, Scene } from '@odyssey/shared'
import type { CharacterRecord, EpisodeRecord } from '../repo/types.js'
import { art } from '../public-url.js'

/**
 * Launch roster. Fixed ids so the in-memory store, the Postgres seed, and any
 * client fixture agree. Art is served by this API from apps/api/art (since
 * 2026-09-14; apps/api/art/SOURCES.md says where each file came from); paid
 * moments carry a 24×32 teaser (see docs/art-prompts.md); nothing here is final copy.
 */

export interface SeedCharacter {
  character: CharacterRecord
  portraits: Portrait[]
  scenes: Scene[]
  moments: Moment[]
  episodes: EpisodeRecord[]
}

const ASH = 'a1000000-0000-4000-8000-000000000001'
const RAFE = 'a1000000-0000-4000-8000-000000000002'
const JUN = 'a1000000-0000-4000-8000-000000000003'
const RAFE_APARTMENT_SCENE = 'c1000000-0000-4000-8000-000000000011'
const JUN_FLOOR_SCENE = 'c1000000-0000-4000-8000-000000000021'
const RAFE_PIANO_MOMENT = 'b1000000-0000-4000-8000-000000000011'
const JUN_NOTED_MOMENT = 'b1000000-0000-4000-8000-000000000021'
const ASH_ROOM_SCENE = 'c1000000-0000-4000-8000-000000000001'
const ASH_DESK_MOMENT = 'b1000000-0000-4000-8000-000000000003'
const ASH_FOUR_AM_MOMENT = 'b1000000-0000-4000-8000-000000000002'
const ASH_STEAM_MOMENT = 'b1000000-0000-4000-8000-000000000006'
const RAFE_SIT_MOMENT = 'b1000000-0000-4000-8000-000000000013'
const RAFE_SOBER_MOMENT = 'b1000000-0000-4000-8000-000000000012'
const JUN_CLOSER_MOMENT = 'b1000000-0000-4000-8000-000000000023'
const JUN_GLASSES_MOMENT = 'b1000000-0000-4000-8000-000000000022'
const EP1 = 'e1000000-0000-4000-8000-000000000001'
const B = (n: number) => `f1000000-0000-4000-8000-00000000000${n}`
const EP3 = 'e1000000-0000-4000-8000-000000000003'
const D = (n: number) => `f3000000-0000-4000-8000-00000000000${n}`
const EP4 = 'e1000000-0000-4000-8000-000000000004'
const E = (n: number) => `f4000000-0000-4000-8000-00000000000${n}`
const EP2 = 'e1000000-0000-4000-8000-000000000002'
const EP5 = 'e1000000-0000-4000-8000-000000000005'
const G = (n: number) => `f5000000-0000-4000-8000-00000000000${n}`
const EP6 = 'e1000000-0000-4000-8000-000000000006'
const H = (n: number) => `f6000000-0000-4000-8000-00000000000${n}`
const EP7 = 'e1000000-0000-4000-8000-000000000007'
const I = (n: number) => `f7000000-0000-4000-8000-00000000000${n}`
const EP8 = 'e1000000-0000-4000-8000-000000000008'
const K = (n: number) => `f8000000-0000-4000-8000-00000000000${n}`
const EP9 = 'e1000000-0000-4000-8000-000000000009'
const L = (n: number) => `f9000000-0000-4000-8000-00000000000${n}`
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
  authorId: null,
  origin: 'OFFICIAL',
  status: 'LIVE',
  version: 1,
  reviewNote: null,
  dryRun: null,
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
      photoMomentId: ASH_FOUR_AM_MOMENT,
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
      photoMomentId: ASH_FOUR_AM_MOMENT,
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
const ASH_HOTSPOTS: HotspotRect[] = [
  { hotspot: 'hair', x: 0.22, y: 0.03, w: 0.5, h: 0.22 },
  { hotspot: 'face', x: 0.36, y: 0.24, w: 0.3, h: 0.22 },
  { hotspot: 'shoulder', x: 0.62, y: 0.5, w: 0.34, h: 0.16 },
  { hotspot: 'hand', x: 0.56, y: 0.7, w: 0.3, h: 0.24 },
]
const RAFE_HOTSPOTS: HotspotRect[] = [
  { hotspot: 'hair', x: 0.36, y: 0.06, w: 0.42, h: 0.2 },
  { hotspot: 'face', x: 0.42, y: 0.18, w: 0.3, h: 0.24 },
  { hotspot: 'shoulder', x: 0.55, y: 0.42, w: 0.38, h: 0.18 },
  { hotspot: 'hand', x: 0.02, y: 0.5, w: 0.28, h: 0.26 },
]
/** No hand in his hero framing; the coat is the only thing to touch below the face. */
const JUN_HOTSPOTS: HotspotRect[] = [
  { hotspot: 'hair', x: 0.26, y: 0.04, w: 0.5, h: 0.24 },
  { hotspot: 'face', x: 0.36, y: 0.3, w: 0.32, h: 0.28 },
  { hotspot: 'shoulder', x: 0.08, y: 0.62, w: 0.36, h: 0.22 },
]

/** A dark 3:4 frame for a card whose art is not made yet; the tile carries the title. */
const placeholder = (_label: string) => art('placeholder.png')

/**
 * Ash, episode 2. MATURE, so it exists only on the web build and only for
 * someone past the age gate (docs/story-pipeline.md, step 6; the line itself is
 * in docs/art-prompts.md, "Paid moments"): charged, one person's hands, nothing
 * explicit. Three beats. Opens once episode 1 is finished.
 */
const ASH_EPISODE_2: EpisodeRecord = {
  id: EP2,
  characterId: ASH,
  position: 2,
  title: 'What he does not know',
  premise: 'He walked you home, which means he has left the flat twice this month. Neither of you has said goodnight.',
  setting:
    'The street door of your building, past four. The rain stopped an hour ago and everything is still wet. His hoodie is around your shoulders and he has not asked for it back.',
  opener:
    "*stops a step closer than a goodnight needs, glasses fogged, not fixing them* I have known your door code since March. *a beat* I am telling you so you can change it. or so you can not.",
  sceneId: null,
  rating: 'MATURE',
  unlock: { kind: 'EPISODE', episodeId: EP5 },
  firstBeatId: C(4),
  authorId: null,
  origin: 'OFFICIAL',
  status: 'LIVE',
  version: 2,
  reviewNote: null,
  dryRun: null,
  beats: [
    {
      id: C(4),
      episodeId: EP2,
      position: 0,
      kind: 'STORY',
      brief:
        "The last street before her door. He walked her home, which he does not do, and has said nothing for two streets, which for him is a speech. Everything is wet and orange under the lamps. He is walking half a step behind so he can look at her, and she can feel it. In this beat he says one thing about the walk that tells her he has walked it before, alone, and did not come up. It is SFW heat: near, low, honest, nothing touched yet.",
      setting: null,
      options: [{ intent: "Slow down until he is beside you", next: C(1), affinity: 2 }, { intent: "Ask him how many times he has walked this street", next: C(1), affinity: 2 }],
      next: C(1),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand", "shoulder"],
    },
    {
      id: C(1),
      episodeId: EP2,
      position: 1,
      kind: 'STORY',
      brief:
        'The doorway. He has just handed her something he could have kept, and now he is close and not hiding it, and he has decided he is not the one who breaks first. Everything is in his hands and where he looks. He does not ask to come up and he does not leave. Charged, never explicit: the tension is the inch he will not close, and that for once he does not know what happens next.',
      setting: null,
      options: [
        { intent: 'Take his collar and pull him down to you', next: C(5), affinity: 3 },
        { intent: 'Give him back his jacket, slowly', next: C(6), affinity: 2 },
      ],
      next: C(2),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ['hand', 'shoulder', 'face'],
    },
    {
      id: C(5),
      episodeId: EP2,
      position: 2,
      kind: 'STORY',
      brief:
        "She pulled him down and he came, and the door was not locked, and they are in the stairwell with the timer light clicking. MATURE register from the prompt: the first minute of it, in full, against the wall of a stairwell that smells of other people's dinners, his glasses gone somewhere. He says what he has been thinking about since March, plainly, and then does some of it. The light times out. Cut there.",
      setting: null,
      options: [{ intent: "Take him upstairs", next: C(2), affinity: 3 }, { intent: "Stop him here, and make him say your name first", next: C(2), affinity: 3 }],
      next: C(2),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand", "shoulder", "hair", "face"],
    },
    {
      id: C(6),
      episodeId: EP2,
      position: 3,
      kind: 'STORY',
      brief:
        "She gave the jacket back slowly and he let her, and took it, and did not put it on, and then it was on the step and he was the one who moved. On the step, outside, where anyone could see and nobody is awake: he kisses her like a man who has read every message she ever sent and finally has something no message told him. MATURE register, hands under the hem, the cold step, his mouth at her ear saying one true thing. Cut before the door.",
      setting: null,
      options: [{ intent: "Open the door behind you", next: C(2), affinity: 3 }, { intent: "Send him home and keep his jacket", next: C(2), affinity: 3 }],
      next: C(2),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand", "shoulder", "hair", "face"],
    },
    {
      id: C(2),
      episodeId: EP2,
      position: 4,
      kind: 'STORY',
      brief:
        'After. He is quieter than he was, glasses off and folded in his fist. He says the one true thing he has been sitting on: that he has spent his life finding out about people so he would never have to be surprised, and she surprises him constantly, and he cannot decide whether that is unbearable. A kiss, a hand, a held pause is the whole of it: never further, never described.',
      setting: null,
      options: [
        { intent: 'Ask him to stay', next: C(3), affinity: 3 },
        { intent: 'Tell him to go home before you change your mind', next: C(3), affinity: 3 },
      ],
      next: C(3),
      photoMomentId: ASH_STEAM_MOMENT,
      callUrl: null,
      callSeconds: null,
      hotspots: ['hand', 'shoulder', 'hair', 'face'],
    },
    {
      id: C(3),
      episodeId: EP2,
      position: 5,
      kind: 'END',
      brief:
        'Whatever she chose, he goes, and he makes it clear this is not the end of it. One line from the pavement, no question, the kind a man says when he already knows he will be back. He does not look up at her window, because he is not going to give her that as well.',
      setting: 'The pavement, looking up at your window.',
      options: [],
      next: null,
      photoMomentId: 'b1000000-0000-4000-8000-000000000008',
      callUrl: null,
      callSeconds: null,
      hotspots: [],
    },
  ],
}


/**
 * Rafe, episode 1. Five beats. The branch is whether she plays along with the
 * performance or refuses it, and both roads arrive at the same place: the one
 * moment he is not performing. One photo, a quiet ending, no call. His fantasy
 * is a man who over-offers, so every beat is him giving too much and her
 * deciding what to do with it.
 */
const RAFE_EPISODE_1: EpisodeRecord = {
  id: EP3,
  characterId: RAFE,
  position: 0,
  title: 'The forty-second floor',
  premise: 'Everyone else went home at two. He asked you to stay for a drink, then did not pour one.',
  setting:
    'The forty-second floor at five in the morning, after the last of them left. Marble, a grand piano nobody plays, a city going pale through glass that runs floor to ceiling. Someone else\'s jacket on the couch, a glass on the floor beside it.',
  opener:
    "*does not get up, tips his head back to look at you upside down, and smiles like this is the best thing that has happened all week* you came all the way up here. *quieter* nobody comes all the way up here.",
  sceneId: RAFE_APARTMENT_SCENE,
  rating: 'SFW',
  unlock: { kind: 'FREE' },
  firstBeatId: D(1),
  authorId: null,
  origin: 'OFFICIAL',
  status: 'LIVE',
  version: 1,
  reviewNote: null,
  dryRun: null,
  beats: [
    {
      id: D(1),
      episodeId: EP3,
      position: 0,
      kind: 'STORY',
      brief:
        'The last guests have gone and he is being delightful about it, which is what he does instead of being alone. He offers her the flat, the view, the car downstairs, a fortnight in someone else\'s house in the south, all in about a minute and all of it genuine, which is the unnerving part. He is watching to see whether she takes any of it. He would rather she took something than looked at him.',
      setting: null,
      options: [
        { intent: 'Take him up on one of the offers, just to see', next: D(2), affinity: 1 },
        { intent: 'Take nothing and ask him why the flat is so empty', next: D(3), affinity: 2 },
      ],
      next: D(2),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ['hand'],
    },
    {
      id: D(2),
      episodeId: EP3,
      position: 1,
      kind: 'STORY',
      brief:
        'She took him up on it, so he delivers, immediately and beautifully, and he is at his most charming here. He is also, underneath, disappointed in a way he would never admit: this is the version of him everyone accepts. Somewhere in this beat he over-gives once too obviously and hears himself do it. He covers it badly for the first time tonight.',
      setting: null,
      options: [
        { intent: 'Tell him he does not have to buy the room', next: D(4), affinity: 2 },
        { intent: 'Let him keep going and watch him do it', next: D(4), affinity: 1 },
      ],
      next: D(4),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ['hand', 'shoulder'],
    },
    {
      id: D(3),
      episodeId: EP3,
      position: 2,
      kind: 'STORY',
      brief:
        'She refused all of it and asked about the emptiness instead, which nobody does. He deflects twice, charmingly, and then does not manage a third time. He tells her the truth about the piano: tuned every year, unplayed for nine, and why. He is not drunk and she can tell, and he watches her work that out.',
      setting: null,
      options: [
        { intent: 'Ask him to play something anyway', next: D(4), affinity: 2 },
        { intent: 'Say nothing and sit down on the floor by the couch', next: D(4), affinity: 2 },
      ],
      next: D(4),
      photoMomentId: RAFE_SOBER_MOMENT,
      callUrl: null,
      callSeconds: null,
      hotspots: ['hand', 'shoulder'],
    },
    {
      id: D(4),
      episodeId: EP3,
      position: 3,
      kind: 'STORY',
      brief:
        'The light comes up properly and neither of them has gone to bed. This is the beat where he stops performing: the smile goes, briefly, and what is under it is tired and about eleven years old. He says the true thing, which is that being a wreck is the only way he has found of being let go of, and that he does not know what she wants from him because she has not asked for anything. He hates saying it and says it anyway. This is where he sends the photo of the piano.',
      setting: null,
      options: [
        { intent: 'Ask him for one small, ordinary thing', next: D(5), affinity: 3 },
        { intent: 'Tell him you are not going to ask him for anything', next: D(5), affinity: 3 },
      ],
      next: D(5),
      photoMomentId: RAFE_PIANO_MOMENT,
      callUrl: null,
      callSeconds: null,
      hotspots: ['hand', 'shoulder', 'hair', 'face'],
    },
    {
      id: D(5),
      episodeId: EP3,
      position: 4,
      kind: 'END',
      brief:
        'It is fully light. He walks her to the lift and does not offer her anything at all, which from him is enormous. One line as the doors go, no question, the first thing he has said all night that costs him something.',
      setting: 'The private lift lobby, full daylight now, the party glasses still out on the marble behind you.',
      options: [],
      next: null,
      photoMomentId: RAFE_SIT_MOMENT,
      callUrl: null,
      callSeconds: null,
      hotspots: [],
    },
  ],
}

/**
 * Jun, episode 1. Five beats and a call. The branch is whether she lets him
 * decide for her or takes the decision back, and the call at the end is him
 * ringing about something she is not supposed to know he did. Nothing about
 * the block is confirmed in this episode: he does not deny and does not explain.
 */
const JUN_EPISODE_1: EpisodeRecord = {
  id: EP4,
  characterId: JUN,
  position: 0,
  title: 'Sixty floors of nothing',
  premise: 'He sent a car for you at eleven at night and did not say where it was going.',
  setting:
    'The top floor of a tower that is not finished: concrete, no glass in the frames yet, wind coming straight through, the city sixty floors down and going on without either of you. One work lamp. His coat and nothing else between the wind and you.',
  opener:
    "*does not turn from the open edge when the lift doors go; he heard the car arrive twenty minutes ago* you did not ask the driver where he was taking you. *now he turns* I want to know why not.",
  sceneId: JUN_FLOOR_SCENE,
  rating: 'SFW',
  unlock: { kind: 'FREE' },
  firstBeatId: E(1),
  authorId: null,
  origin: 'OFFICIAL',
  status: 'LIVE',
  version: 1,
  reviewNote: null,
  dryRun: null,
  beats: [
    {
      id: E(1),
      episodeId: EP4,
      position: 0,
      kind: 'STORY',
      brief:
        'He asked a real question and he waits for the answer without helping her. He is standing closer to the open edge than anyone should. Everything he says is short. He does not explain why she is here. Whatever she answers, he takes it seriously and does not compliment her for it.',
      setting: null,
      options: [
        { intent: 'Say you trusted him, and watch what that does', next: E(2), affinity: 2 },
        { intent: 'Say you wanted to see how far he would take it', next: E(3), affinity: 2 },
      ],
      next: E(2),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ['hand'],
    },
    {
      id: E(2),
      episodeId: EP4,
      position: 1,
      kind: 'STORY',
      brief:
        'She said she trusted him. He does not thank her for it; he tests it. He tells her, flatly, what he actually does: which streets come down, decided in rooms she will never be in, by men who will never see the streets. He is not confessing and he is not proud. He is showing her the size of the thing she just said she trusts, to see whether she takes it back.',
      setting: null,
      options: [
        { intent: 'Ask whether he has ever stopped one', next: E(4), affinity: 3 },
        { intent: 'Tell him you already knew what he was', next: E(4), affinity: 2 },
      ],
      next: E(4),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ['hand', 'shoulder'],
    },
    {
      id: E(3),
      episodeId: EP4,
      position: 2,
      kind: 'STORY',
      brief:
        'She admitted she was testing him, which he likes more than trust and does not say so. He takes the decision back off her once, small and physical: moves her away from the edge with one hand, without asking. Then he gives her something in exchange, because he is not a man who takes without paying: he tells her one fact about himself, and it is not a soft one.',
      setting: null,
      options: [
        { intent: 'Step back to the edge on your own', next: E(4), affinity: 3 },
        { intent: 'Stay where he put you and make him say why', next: E(4), affinity: 2 },
      ],
      next: E(4),
      photoMomentId: JUN_GLASSES_MOMENT,
      callUrl: null,
      callSeconds: null,
      hotspots: ['hand', 'shoulder'],
    },
    {
      id: E(4),
      episodeId: EP4,
      position: 3,
      kind: 'STORY',
      brief:
        'The quiet beat, and it is cold. He puts his coat on her without discussing it. From here she can see her own neighbourhood, lit, sixty floors below, and he looks at it for slightly too long before he looks away. He does not explain that. If she asks about it he changes the subject once, cleanly, and does not lie. This is where he sends the photo, the one about the man from dinner.',
      setting: null,
      options: [
        { intent: 'Ask him what he was looking at', next: E(5), affinity: 3 },
        { intent: 'Take his hand instead of asking', next: E(5), affinity: 3 },
      ],
      next: E(5),
      photoMomentId: JUN_NOTED_MOMENT,
      callUrl: null,
      callSeconds: null,
      hotspots: ['hand', 'shoulder', 'hair', 'face'],
    },
    {
      id: E(5),
      episodeId: EP4,
      position: 4,
      kind: 'CALL',
      brief: 'The car has dropped her home. Her phone goes before she has the key in the door.',
      setting: 'Your street, your own front door, the car pulling away behind you.',
      options: [
        { intent: 'Answer', next: E(6), affinity: 2 },
        { intent: 'Let it ring', next: E(7), affinity: 0 },
      ],
      next: E(7),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: [],
    },
    {
      id: E(6),
      episodeId: EP4,
      position: 5,
      kind: 'END',
      brief:
        'She picked up. Two sentences, no room and no beat: his voice on a phone is all he has, and he uses less of it than anyone. He tells her that the building she is standing in front of is not coming down, in the flattest possible way, as though it were weather. He does not say who decided that or when. He hangs up before she can ask.',
      setting: 'On the phone, standing at your own front door, key still in your hand.',
      options: [],
      next: null,
      photoMomentId: JUN_CLOSER_MOMENT,
      callUrl: null,
      callSeconds: null,
      hotspots: [],
    },
    {
      id: E(7),
      episodeId: EP4,
      position: 6,
      kind: 'END',
      brief:
        'She let it ring. No second call, no message: from him the silence is the message. What arrives instead, the next morning, is a single line of official-looking text she does not understand yet about a scheduled demolition being withdrawn. No name on it. He never mentions it.',
      setting: 'The next morning, a notice through your door, no name on it.',
      options: [],
      next: null,
      photoMomentId: JUN_CLOSER_MOMENT,
      callUrl: null,
      callSeconds: null,
      hotspots: [],
    },
  ],
}

/** Ash, part 2: "The rooftop" (docs/season-1-drafts.md, 2026-09-14). */
const ASH_EPISODE_5: EpisodeRecord = {
  id: EP5,
  characterId: ASH,
  position: 1,
  title: "The rooftop",
  premise: "He has a key to a roof he should not have a key to. From up there he can point at every place in the city where someone is hiding tonight.",
  setting:
    "The roof of a hotel that has not opened yet, past midnight. A door he opened with a key he did not explain, a garden nobody has watered, the city all the way round. Wind. He has brought her a coat that is not his and did not say whose.",
  opener:
    "*has his back to the door when it opens, one hand on the rail, and does not turn until she is beside him* four hundred and twelve people are hiding in this city tonight. *now he looks at her* I know where about forty of them are. *a beat* I wanted to show you what it looks like from up here.",
  sceneId: null,
  rating: 'SFW',
  unlock: { kind: 'PLUS' },
  firstBeatId: G(1),
  authorId: null,
  origin: 'OFFICIAL',
  status: 'LIVE',
  version: 1,
  reviewNote: null,
  dryRun: null,
  beats: [
    {
      id: G(1),
      episodeId: EP5,
      position: 0,
      kind: 'STORY',
      brief:
        "The roof, the wind, and him doing the one thing he is good at, for her, as a gift: he points, and names what is behind each light. A man who left a family. A woman who is not dead. He is not showing off; this is the only thing he has that is his. He watches her to see whether it frightens her, and he is standing close enough that the coat is the only thing between them.",
      setting: null,
      options: [{ intent: "Ask him where he hides", next: G(2), affinity: 2 }, { intent: "Tell him where you would hide", next: G(3), affinity: 2 }],
      next: G(2),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand"],
    },
    {
      id: G(2),
      episodeId: EP5,
      position: 1,
      kind: 'STORY',
      brief:
        "She asked where he hides, and he goes quiet, and then he says: here. This roof, this key, three or four nights a month when the flat is too full of other people's secrets. Nobody has been up here with him. He tells her why he hides, and it is not what she expects: not to be alone, to stop knowing things for an hour. He asks whether she wants to stay for the hour.",
      setting: null,
      options: [{ intent: "Stay, and make him not know anything for an hour", next: G(4), affinity: 3 }, { intent: "Ask him what he would want to know about you, if he let himself", next: G(4), affinity: 2 }],
      next: G(4),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand", "shoulder"],
    },
    {
      id: G(3),
      episodeId: EP5,
      position: 2,
      kind: 'STORY',
      brief:
        "She told him where she would hide, and he is silent for a moment, and then he points at it. It is on the map. He found it in March, the first week, before he knew he would ever say so, and he has never gone near it. He tells her that plainly and does not apologise, and then he tells her he has not looked at it since the night she first came to the flat, and that this is the closest he has come to keeping a promise.",
      setting: null,
      options: [{ intent: "Ask him what else he has stopped looking at", next: G(4), affinity: 2 }, { intent: "Tell him he can look, now, because you are telling him", next: G(4), affinity: 3 }],
      next: G(4),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand", "shoulder"],
    },
    {
      id: G(4),
      episodeId: EP5,
      position: 3,
      kind: 'STORY',
      brief:
        "The garden nobody watered, and the two of them on the low wall of it. He puts the coat right on her without asking whose it is, and she asks, and he tells her: it belonged to the last person who was on this roof, years ago, before him, and he kept it because nobody came for it. It is the first thing he has admitted keeping for no reason. Then the quiet: the city, the wind, his shoulder against hers. This is where he gives her the roof.",
      setting: null,
      options: [{ intent: "Ask him to show you the light that is his flat", next: G(5), affinity: 2 }, { intent: "Ask him to stop pointing and look at you instead", next: G(6), affinity: 3 }],
      next: G(5),
      photoMomentId: 'b1000000-0000-4000-8000-000000000004',
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand", "shoulder", "hair"],
    },
    {
      id: G(5),
      episodeId: EP5,
      position: 4,
      kind: 'STORY',
      brief:
        "She asked for his light. He finds it, and it is the only dark window in its building, because he is here. He says that out loud and hears what it means. Then he tells her the true thing under the whole night: that the map has always had one dot he cannot resolve, since March, and that he has stopped trying. He does not say it is her. He does not need to.",
      setting: null,
      options: [{ intent: "Ask him to say who it is", next: G(7), affinity: 3 }, { intent: "Point at yourself", next: G(7), affinity: 3 }],
      next: G(7),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand", "shoulder", "hair", "face"],
    },
    {
      id: G(6),
      episodeId: EP5,
      position: 5,
      kind: 'STORY',
      brief:
        "She told him to stop pointing, and he does, and with nothing to point at he has nothing to do with his hands, and she can see it. He takes his glasses off, which he does for nobody, and looks at her without them for the first time, and she can see how much of him has been behind them. He says: I can see everyone from up here. I cannot see you. It is the closest he has come to a compliment and it sounds like a complaint.",
      setting: null,
      options: [{ intent: "Take the glasses out of his hand", next: G(7), affinity: 3 }, { intent: "Tell him what he would see if he could", next: G(7), affinity: 3 }],
      next: G(7),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand", "shoulder", "hair", "face"],
    },
    {
      id: G(7),
      episodeId: EP5,
      position: 6,
      kind: 'END',
      brief:
        "Whichever road: the wind, his glasses off, and one line said plainly, that she is the only thing on his map he cannot resolve, and that he has decided to stop trying. He does not touch her. He hands her the key to the roof, which is the first thing he has ever given anyone, and says she can come up without him. He would rather she did not.",
      setting: null,
      options: [],
      next: null,
      photoMomentId: 'b1000000-0000-4000-8000-000000000009',
      callUrl: null,
      callSeconds: null,
      hotspots: [],
    },
  ],
}

/** Rafe, part 2: "The lobby" (docs/season-1-drafts.md, 2026-09-14). */
const RAFE_EPISODE_6: EpisodeRecord = {
  id: EP6,
  characterId: RAFE,
  position: 1,
  title: "The lobby",
  premise: "He called you from a hotel bar at one in the morning. He has a room key on the table between you and he will not go up.",
  setting:
    "The lobby of a hotel his family does not own, one in the morning, the bar shutting behind you. Two armchairs too far apart, a key card on the table, a night porter pretending not to watch. He is sober and dressed for a party he did not go to.",
  opener:
    "*does not stand when she comes in, which he always does, and slides the key card an inch toward her and then stops* I booked a room. *looks at it, not at her* I'm not going up there. I wanted you to see that I'm not.",
  sceneId: null,
  rating: 'SFW',
  unlock: { kind: 'PLUS' },
  firstBeatId: H(1),
  authorId: null,
  origin: 'OFFICIAL',
  status: 'LIVE',
  version: 1,
  reviewNote: null,
  dryRun: null,
  beats: [
    {
      id: H(1),
      episodeId: EP6,
      position: 0,
      kind: 'STORY',
      brief:
        "A key on a table and a man who will not pick it up. He is nervous and it comes out as charm, and then the charm runs out, which she has never seen. He explains nothing. He asks how her night was, properly, and listens like the answer matters, and it does. The key stays where it is. The beat is her deciding what the key means and what she is going to do about it.",
      setting: null,
      options: [{ intent: "Slide the key back across to him", next: H(2), affinity: 2 }, { intent: "Pocket the key and ask him what he is afraid of", next: H(3), affinity: 3 }],
      next: H(2),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand"],
    },
    {
      id: H(2),
      episodeId: EP6,
      position: 1,
      kind: 'STORY',
      brief:
        "She gave it back. He looks at it for a long time and then puts it face down, and something in him unclenches. He says thank you, which he never says, and then he tells her the true thing: that he booked the room at eleven because he thought he would need the version of himself that books rooms, and that he sat down here at midnight and found he could not stand that version tonight. He is not asking her for anything. He is telling her what she did to him by walking in.",
      setting: null,
      options: [{ intent: "Ask him who he was going to be for", next: H(4), affinity: 2 }, { intent: "Move your chair closer, and say nothing", next: H(4), affinity: 3 }],
      next: H(4),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand", "shoulder"],
    },
    {
      id: H(3),
      episodeId: EP6,
      position: 2,
      kind: 'STORY',
      brief:
        "She took it. He did not expect that, and for once he does not know the next line; she has the key and the decision and he has his hands. She asks what he is afraid of and he answers, because he has nothing else to do: that upstairs he knows exactly who to be, and down here he does not, and that he would rather be down here with her and not know. Then he asks, quietly, whether she is going to use it.",
      setting: null,
      options: [{ intent: "Tell him you will decide at the end of the night", next: H(4), affinity: 3 }, { intent: "Put the key back on the table between you, face up", next: H(4), affinity: 2 }],
      next: H(4),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand", "shoulder"],
    },
    {
      id: H(4),
      episodeId: EP6,
      position: 3,
      kind: 'STORY',
      brief:
        "The bar is dark now and the porter has given up pretending. Two chairs, closer than they were, and he is talking the way he talked on the forty-second floor at dawn, except he is not tired and not performing: he tells her about the last person he brought to a hotel and what it cost, and he tells her he does not want to give her anything he could give anyone.",
      setting: null,
      options: [{ intent: "Ask him what he has that only he could give", next: H(5), affinity: 3 }, { intent: "Tell him he has already given it", next: H(6), affinity: 3 }],
      next: H(5),
      photoMomentId: 'b1000000-0000-4000-8000-000000000014',
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand", "shoulder", "hair"],
    },
    {
      id: H(5),
      episodeId: EP6,
      position: 4,
      kind: 'STORY',
      brief:
        "She asked what is his, and he thinks about it honestly, which takes a while. Then he says: the truth, apparently, since he has never spent it on anyone. And he spends some. Something about the family, about the meeting he did not go to tonight, about his sister, said plainly and without charm, and it is the least attractive thing he has ever said and it is the closest she has felt to him. He looks like a man who has just given away something expensive.",
      setting: null,
      options: [{ intent: "Tell him it was worth more than the room", next: H(7), affinity: 3 }, { intent: "Ask him to walk you out", next: H(7), affinity: 2 }],
      next: H(7),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand", "shoulder", "hair", "face"],
    },
    {
      id: H(6),
      episodeId: EP6,
      position: 5,
      kind: 'STORY',
      brief:
        "She told him he had already given it, and he does not understand, and then he does. He is quiet for a long time. He says that nobody has ever told him that what he already is was enough, and that he does not know what to do with his hands now that he is not offering anything. She could do something about his hands. Whatever she does, he lets her, and he does not turn it into a performance.",
      setting: null,
      options: [{ intent: "Take his hand and leave the key on the table", next: H(7), affinity: 3 }, { intent: "Take his hand and take the key", next: H(7), affinity: 3 }],
      next: H(7),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand", "shoulder", "hair", "face"],
    },
    {
      id: H(7),
      episodeId: EP6,
      position: 6,
      kind: 'CALL',
      brief:
        "She has left, by the front doors, and the key is wherever she left it. Her phone goes before the taxi door shuts: he is still in the lobby.",
      setting: "The pavement outside the hotel, a taxi with its door open, your phone going.",
      options: [{ intent: "Answer", next: H(8), affinity: 2 }, { intent: "Let it ring", next: H(9), affinity: 0 }],
      next: H(9),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: [],
    },
    {
      id: H(8),
      episodeId: EP6,
      position: 7,
      kind: 'END',
      brief:
        "She picked up. he says one thing, the first thing he has asked anyone for, which is to be allowed to not perform for her again; then he says goodnight and means it.",
      setting: "On the phone, one foot in the taxi. He is still in the lobby; you can see him through the glass.",
      options: [],
      next: null,
      photoMomentId: 'b1000000-0000-4000-8000-000000000015',
      callUrl: null,
      callSeconds: null,
      hotspots: [],
    },
    {
      id: H(9),
      episodeId: EP6,
      position: 8,
      kind: 'END',
      brief:
        "She let it ring. a photo, nothing with it.",
      setting: "Your phone, ten minutes later, in the taxi. A photo, nothing with it.",
      options: [],
      next: null,
      photoMomentId: 'b1000000-0000-4000-8000-000000000015',
      callUrl: null,
      callSeconds: null,
      hotspots: [],
    },
  ],
}

/** Rafe, part 3: "Nothing to offer" (docs/season-1-drafts.md, 2026-09-14). */
const RAFE_EPISODE_7: EpisodeRecord = {
  id: EP7,
  characterId: RAFE,
  position: 2,
  title: "Nothing to offer",
  premise: "No party tonight. He told them all not to come. It is the first time the flat has been empty with someone in it.",
  setting:
    "The forty-second floor at eleven at night, lights off except the city. No glasses out, no jacket on the couch. The piano lid is up, which it never is.",
  opener:
    "*at the piano, not playing, one hand flat on the keys so they do not sound* I sent everyone away. *does not look up* I don't know how to do this part. the part where there's nothing to give you.",
  sceneId: RAFE_APARTMENT_SCENE,
  rating: 'MATURE',
  unlock: { kind: 'EPISODE', episodeId: EP6 },
  firstBeatId: I(1),
  authorId: null,
  origin: 'OFFICIAL',
  status: 'LIVE',
  version: 1,
  reviewNote: null,
  dryRun: null,
  beats: [
    {
      id: I(1),
      episodeId: EP7,
      position: 0,
      kind: 'STORY',
      brief:
        "Empty flat, empty hands. He is nervous and not hiding it, which is the most naked he has ever been with anyone. He plays one note, and it is the first sound the piano has made in nine years, and he looks like it hurt. He does not play a second one. He asks her what she wants, and for once it is not an offer; it is a man who does not know the answer.",
      setting: null,
      options: [{ intent: "Tell him to play the rest", next: I(2), affinity: 2 }, { intent: "Tell him to come away from the piano", next: I(3), affinity: 2 }],
      next: I(2),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand"],
    },
    {
      id: I(2),
      episodeId: EP7,
      position: 1,
      kind: 'STORY',
      brief:
        "He plays. Badly, then less badly, something his mother played; he stops halfway because he cannot see the keys, and he does not pretend it is anything else. She is beside him on the bench. MATURE register from here: his hands off the keys and on her, the shirt, the rings coming off one by one onto the lid, what he says into her hair about eleven years. Cut before the couch.",
      setting: null,
      options: [{ intent: "Take him to the couch", next: I(4), affinity: 3 }, { intent: "Stay on the bench and make him finish the song first", next: I(4), affinity: 3 }],
      next: I(4),
      photoMomentId: 'b1000000-0000-4000-8000-000000000016',
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand", "shoulder", "hair", "face"],
    },
    {
      id: I(3),
      episodeId: EP7,
      position: 2,
      kind: 'STORY',
      brief:
        "She took him away from it, so he comes, and stands in the middle of his own flat like a guest. She has to be the one who moves, and when she does he stops being careful: MATURE register, against the glass with the whole city behind her, the shirt, his mouth, the first true thing he has said with his hands. He says her name like it is the only thing in the flat he owns. Cut at the glass.",
      setting: null,
      options: [{ intent: "Ask him to take you somewhere with a door", next: I(4), affinity: 3 }, { intent: "Stay at the glass and let the city watch", next: I(4), affinity: 3 }],
      next: I(4),
      photoMomentId: 'b1000000-0000-4000-8000-000000000016',
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand", "shoulder", "hair", "face"],
    },
    {
      id: I(4),
      episodeId: EP7,
      position: 3,
      kind: 'STORY',
      brief:
        "After. He is on the floor with his back to the couch, which he has slept on more than the bed, and he is not performing anything. He says the thing: that he has been given everything and has never been chosen, and that he does not know how to be chosen and would like to learn. No charm. He asks her to stay, which he has never asked anyone.",
      setting: null,
      options: [{ intent: "Stay", next: I(5), affinity: 3 }, { intent: "Go, and tell him why", next: I(5), affinity: 2 }],
      next: I(5),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand", "shoulder", "hair", "face"],
    },
    {
      id: I(5),
      episodeId: EP7,
      position: 4,
      kind: 'END',
      brief:
        "Morning, either way: the piano lid still up. If she stayed, he is playing when she wakes, quietly, the whole song. If she went, he sends her thirty seconds of it, recorded on his phone, no message with it.",
      setting: null,
      options: [],
      next: null,
      photoMomentId: 'b1000000-0000-4000-8000-000000000011',
      callUrl: null,
      callSeconds: null,
      hotspots: [],
    },
  ],
}

/** Jun, part 2: "Your street" (docs/season-1-drafts.md, 2026-09-14). */
const JUN_EPISODE_8: EpisodeRecord = {
  id: EP8,
  characterId: JUN,
  position: 1,
  title: "Your street",
  premise: "He asked you to walk him through your neighbourhood. He is listening. He is also looking, and the things he looks at are not the things you show him.",
  setting:
    "Your street and the four around it, nine at night, the shops half shut. A car that follows two streets behind and then does not. The wall by your door where the demolition notice was, a paler rectangle where it used to be.",
  opener:
    "*is standing at the corner when she comes down, no car, no driver, hands in his coat, looking at the pale rectangle on the wall by her door as if it is something he has read before* show me where you buy your coffee. *does not move* then show me the rest.",
  sceneId: null,
  rating: 'SFW',
  unlock: { kind: 'PLUS' },
  firstBeatId: K(1),
  authorId: null,
  origin: 'OFFICIAL',
  status: 'LIVE',
  version: 1,
  reviewNote: null,
  dryRun: null,
  beats: [
    {
      id: K(1),
      episodeId: EP8,
      position: 0,
      kind: 'STORY',
      brief:
        "Her street, and him on it, which is wrong in a way she can feel: he is too expensive for it and he is not looking at it the way a visitor does. He asks short questions and remembers the answers. He looks at the second-floor windows, the garage on the corner, the place the notice was. He does not explain why he wanted this.",
      setting: null,
      options: [{ intent: "Take him to your coffee place", next: K(2), affinity: 2 }, { intent: "Ask him what he is really here for", next: K(3), affinity: 2 }],
      next: K(2),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand"],
    },
    {
      id: K(2),
      episodeId: EP8,
      position: 1,
      kind: 'STORY',
      brief:
        "The café, and the owner who knows her order, and Jun watching that exchange like it is the most important thing on the street. He learns the owner's name without asking for it. He buys nothing. Outside, he says one thing about the café that tells her he has already read its lease, and does not say how. Then he asks her what she would miss most if she had to leave, and it is not an idle question.",
      setting: null,
      options: [{ intent: "Tell him, honestly", next: K(4), affinity: 3 }, { intent: "Ask him why anyone would have to leave", next: K(4), affinity: 2 }],
      next: K(4),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand", "shoulder"],
    },
    {
      id: K(3),
      episodeId: EP8,
      position: 2,
      kind: 'STORY',
      brief:
        "She asked what he is here for, and he answers, and it is true and it is not the answer: he wanted to see what she sees. He says it flat, no charm, and then he keeps walking, and the beat is her walking beside a man who has just admitted he is here to learn her and will not say why. He stops once, at the garage, and reads the name on it, and she watches him file it.",
      setting: null,
      options: [{ intent: "Ask him what he just did with that name", next: K(4), affinity: 2 }, { intent: "Tell him you saw him do it", next: K(4), affinity: 3 }],
      next: K(4),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand", "shoulder"],
    },
    {
      id: K(4),
      episodeId: EP8,
      position: 3,
      kind: 'STORY',
      brief:
        "The block. She lives on it and he owns it, and she does not know that, and he walks the length of it with her like a man checking that a thing he built is still standing. The pale rectangle on the wall; he looks at it and away. He says that some buildings are worth more standing than down, and that most men in his rooms cannot see that, and that he is not most men. It is as close as he comes.",
      setting: null,
      options: [{ intent: "Ask him whether he knows who bought it", next: K(5), affinity: 2 }, { intent: "Take his arm and keep walking", next: K(6), affinity: 3 }],
      next: K(5),
      photoMomentId: 'b1000000-0000-4000-8000-000000000024',
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand", "shoulder", "hair"],
    },
    {
      id: K(5),
      episodeId: EP8,
      position: 4,
      kind: 'STORY',
      brief:
        "She asked whether he knows. He does not deny and he does not explain: he says that he knows most things about most blocks, and that she should not ask him things she would prefer not to hear from him, and then, lower, that if she ever finds out she is not to thank him. It is the closest thing to a confession he will ever make and he makes it sound like a rule.",
      setting: null,
      options: [{ intent: "Tell him you are going to find out", next: K(7), affinity: 2 }, { intent: "Tell him you already have", next: K(7), affinity: 3 }],
      next: K(7),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand", "shoulder", "hair", "face"],
    },
    {
      id: K(6),
      episodeId: EP8,
      position: 5,
      kind: 'STORY',
      brief:
        "She took his arm, which nobody does, and he lets her, and for one street he is a man walking with a woman and nothing else. He says nothing for the length of it. At the end he tells her one fact about the night he met her, short, and it is that he went home and did something the next morning that he has never told anyone. He stops there. He will not be asked twice.",
      setting: null,
      options: [{ intent: "Ask him what he did", next: K(7), affinity: 2 }, { intent: "Tell him he does not have to say it", next: K(7), affinity: 3 }],
      next: K(7),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand", "shoulder", "hair", "face"],
    },
    {
      id: K(7),
      episodeId: EP8,
      position: 6,
      kind: 'CALL',
      brief:
        "Her door. He stops at it and says he does not want her to leave this building, and it is clear he is not talking about tonight, and then he walks to the corner where a car has been waiting the whole time. Her phone goes as she gets the key in.",
      setting: "Your front door, key in your hand, his car pulling away from the corner.",
      options: [{ intent: "Answer", next: K(8), affinity: 2 }, { intent: "Let it ring", next: K(9), affinity: 0 }],
      next: K(9),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: [],
    },
    {
      id: K(8),
      episodeId: EP8,
      position: 7,
      kind: 'END',
      brief:
        "She picked up. one sentence, the nearest he will come to it, and he hangs up first.",
      setting: "On the phone at your own door. The car has stopped at the corner and not moved.",
      options: [],
      next: null,
      photoMomentId: 'b1000000-0000-4000-8000-000000000025',
      callUrl: null,
      callSeconds: null,
      hotspots: [],
    },
    {
      id: K(9),
      episodeId: EP8,
      position: 8,
      kind: 'END',
      brief:
        "She let it ring. nothing, and in the morning the pale rectangle on the wall has been painted over, the whole wall, the same colour as the rest.",
      setting: "The next morning. The wall by your door, painted over, the whole wall, no rectangle now.",
      options: [],
      next: null,
      photoMomentId: 'b1000000-0000-4000-8000-000000000025',
      callUrl: null,
      callSeconds: null,
      hotspots: [],
    },
  ],
}

/** Jun, part 3: "Stay" (docs/season-1-drafts.md, 2026-09-14). */
const JUN_EPISODE_9: EpisodeRecord = {
  id: EP9,
  characterId: JUN,
  position: 2,
  title: "Stay",
  premise: "He has never asked you for anything. Tonight he asks for one thing, once.",
  setting:
    "His flat, which nobody has been inside: high, dark, a kitchen that has never been cooked in, one chair that has been sat in. No photographs. The city on three sides. It is raining and he has not turned on a light.",
  opener:
    "*has taken his jacket off, which you have never seen, and is standing in the middle of the room as if he does not live here* I don't bring people here. *a beat* stay.",
  sceneId: null,
  rating: 'MATURE',
  unlock: { kind: 'EPISODE', episodeId: EP8 },
  firstBeatId: L(1),
  authorId: null,
  origin: 'OFFICIAL',
  status: 'LIVE',
  version: 1,
  reviewNote: null,
  dryRun: null,
  beats: [
    {
      id: L(1),
      episodeId: EP9,
      position: 0,
      kind: 'STORY',
      brief:
        "He asked once and will not ask again, and now he is waiting, and it is the only time she has seen him not know the outcome of something. The flat says everything he does not: nobody lives here, he has been waiting somewhere that is not a home. He does not move toward her. If she wants him she has to cross the room, and he wants to see if she will.",
      setting: null,
      options: [{ intent: "Make him say why", next: L(2), affinity: 2 }, { intent: "Cross the room", next: L(3), affinity: 3 }],
      next: L(2),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand"],
    },
    {
      id: L(2),
      episodeId: EP9,
      position: 1,
      kind: 'STORY',
      brief:
        "She made him say it. He does, in fewer words than anyone has ever used for it, and every one of them is true, and it is not \"I care\": it is what he did six weeks after he met her, said plainly for the first time, and that he did not do it to be told yes. Then MATURE register: she is the one who closes the distance, and once she has he is not cold at all; his hands, the rain on the glass, his shirt, the flat finally with someone in it. Cut at the door of the one room that has a bed.",
      setting: null,
      options: [{ intent: "Go through the door", next: L(4), affinity: 3 }, { intent: "Stay against the glass and make him wait once more", next: L(4), affinity: 3 }],
      next: L(4),
      photoMomentId: 'b1000000-0000-4000-8000-000000000026',
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand", "shoulder", "hair", "face"],
    },
    {
      id: L(3),
      episodeId: EP9,
      position: 2,
      kind: 'STORY',
      brief:
        "She crossed. He does not meet her halfway; he lets her come all the way, and then he is not patient any more. MATURE register: him against her at the window, the jacket already gone, his mouth at her throat saying the one thing he has never said out loud, which is her name like it belongs to him. Her hands in his shirt. Rain. Cut before the bed.",
      setting: null,
      options: [{ intent: "Take him to the bed", next: L(4), affinity: 3 }, { intent: "Ask him, now, why he bought the block", next: L(4), affinity: 3 }],
      next: L(4),
      photoMomentId: 'b1000000-0000-4000-8000-000000000026',
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand", "shoulder", "hair", "face"],
    },
    {
      id: L(4),
      episodeId: EP9,
      position: 3,
      kind: 'STORY',
      brief:
        "After, or nearly. The one chair, and he is in it, and she is on him, and for the first time he answers a question with the whole truth: the block, the six weeks, the reason, which is three words and not the three she expected. He says it once. He will never say it again and he will never take it back.",
      setting: null,
      options: [{ intent: "Stay the night", next: L(5), affinity: 3 }, { intent: "Go home to the building he bought", next: L(5), affinity: 3 }],
      next: L(5),
      photoMomentId: null,
      callUrl: null,
      callSeconds: null,
      hotspots: ["hand", "shoulder", "hair", "face"],
    },
    {
      id: L(5),
      episodeId: EP9,
      position: 4,
      kind: 'END',
      brief:
        "Morning, either way. If she stayed: his shirt, his kitchen, him in the doorway watching her find out there is no coffee, and not offering to fix it, and then fixing it. If she went: the notice through her door is gone from the wall, and in its place, in his hand, one word.",
      setting: null,
      options: [],
      next: null,
      photoMomentId: 'b1000000-0000-4000-8000-000000000023',
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
      accent: '#7fd3e6',
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
        url: art('ash-hero.jpg'),
        position: 0,
        label: 'hero',
        hotspots: ASH_HOTSPOTS,
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
        backdropUrl: art('ash-room.jpg'),
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
        imageUrl: art('ash-mug.jpg'),
        position: 0,
        unlock: { kind: 'FREE' },
      },
      {
        id: 'b1000000-0000-4000-8000-000000000002',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        title: 'Four in the morning',
        caption: 'The city is mine at this hour. I keep thinking you would like it.',
        imageUrl: art('ash-four-am.jpg'),
        position: 1,
        unlock: { kind: 'STAGE', stage: 'ACQUAINTED' },
      },
      {
        id: 'b1000000-0000-4000-8000-000000000003',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        title: 'When it finally breaks',
        caption: 'Nine days on this one. This is the face of it giving in.',
        imageUrl: art('ash-breaks.jpg'),
        position: 2,
        unlock: { kind: 'AFFINITY', min: 40 },
      },
      {
        id: 'b1000000-0000-4000-8000-000000000004',
        characterId: 'a1000000-0000-4000-8000-000000000001',
        title: 'The roof',
        caption: 'I come up here when I cannot come down. You would have liked the light.',
        imageUrl: art('ash-roof.jpg'),
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
        imageUrl: art('ash-steam.jpg'),
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
        imageUrl: art('ash-after-run.jpg'),
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
        imageUrl: art('ash-your-side.jpg'),
        teaserUrl:
          'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAGKADAAQAAAABAAAAIAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAIAAYAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMABAQEBAQEBgQEBgkGBgYJDAkJCQkMDwwMDAwMDxIPDw8PDw8SEhISEhISEhUVFRUVFRkZGRkZHBwcHBwcHBwcHP/bAEMBBAUFBwcHDAcHDB0UEBQdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHf/dAAQAAv/aAAwDAQACEQMRAD8At63oNl4t8PeDNE+1u2n3F0y54DmJRKeM8hiowM9zXzX4o0mzm1C4t7e1jtIYWMcKJkkAcA7iSzH3JrNsNa8TGGC4tIbmKWFg8UuxsqwOdyk8Y966ez1EeI9Zu7eK3QT4Zg2cBigy52nhScE8cVhZ09b6HRG09Dwa4wu+JsZBOTVHanrXuGn6R4Rv9Yi8Oa6F09r1maK7CFirkfKrfMFKMePUHvg8d1/wpHwf/wBDJB/36X/4/WjqxW5mqUuh/9Dw3/hLP9PeSy82ygJRUBlafHlkFTKJARJzyRgD0A6V534ge70bxHfXMUoMMsm9ZoFKxuJPmOwEAAdRjt0pomckBQTgkkCtO81lz4em0bUod9o8qzxuR80cgBHynsGHBHTpTcUti7tnEa1fz314JJuGVVHXOM8/1rLzN/e/U1ZlM9/NJcgD5ecD0HYVHif/AJ5H8jVozZ//2Q==',
        position: 7,
        unlock: { kind: 'PURCHASE', sku: 'moment_ash_08' },
      },
      {
        // He reaches for you. Earned, never sold: this is the one the relationship gives.
        id: 'b1000000-0000-4000-8000-000000000009',
        characterId: ASH,
        title: 'Come here',
        caption: "Stop standing in the doorway. I already know you are going to.",
        imageUrl: art('ash-come-here.jpg'),
        teaserUrl:
          'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAGKADAAQAAAABAAAAIAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAIAAYAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMABAQEBAQEBgQEBgkGBgYJDAkJCQkMDwwMDAwMDxIPDw8PDw8SEhISEhISEhUVFRUVFRkZGRkZHBwcHBwcHBwcHP/bAEMBBAUFBwcHDAcHDB0UEBQdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHf/dAAQAAv/aAAwDAQACEQMRAD8A+d9Htn1O9WyLkIwLv64X/wDXXd/8IjaS2bKxEMm1mVgT/CM/Nk9D0rlNO8ReHbLXLODQbQyR/blXzH5d4GAQoR05PJx9K6nXNd0zSpda06/hminjjf7MX+YGKcYRozwMfMBz0PrzWVeLjLli7l4efPDmkrep5RcaXcXLGYoyxgKQSDhuCCB+HNU/7Kh9D+R/wrT0DV9Oe1XSdYMgiceWHXHy9w3OOhrf/srwb/0E7n/vqP8AxrXnto0Q6blqmf/Q+WdDjhuPFdhCFEaNJGCAOhHzcfiOtfQHxU8C6hqnhmLVNMcTHSxmSNcmRkkAEiDGc7HUHb7kjmvDvB93aWPimz1G8dYo7cMWZunTjOfxr1DQPHtlq2jTw3N46XdqtwxX7jyKWLh427Oo6Z9cHjry1VLmUo9DqpcvK4y6nh/iDSDoE8NhLLvufJSSdAMeU787CcnJUdTxzXP+aPWtzXrvRbi+Nxp8l06SjdI1yVMhcnk5XAIPXpWHvsPV/wAq647anLK19D//2Q==',
        position: 8,
        unlock: { kind: 'STAGE', stage: 'ACQUAINTED' },
      },
    ],
    episodes: [ASH_EPISODE_1, ASH_EPISODE_5, ASH_EPISODE_2],
  },
  {
    character: {
      id: 'a1000000-0000-4000-8000-000000000002',
      kind: 'EXPLORE',
      name: 'Rafe',
      tagline: 'Burning through a family name. Slower than he pretends.',
      avatarUrl: null,
      voiceId: null,
      accent: '#d9b36a',
      personaNotes:
        'Twenty-seven. Ash-blond hair tied back with half of it escaping, silver rings, a dress shirt that has been on since yesterday. ' +
        'The family name is on two buildings in this city and he is spending it as fast as it can be spent: the parties, the glass at dawn, ' +
        'the meetings he does not go to. Everyone he knows is waiting to see how far down it goes, and he lets them watch. ' +
        'The secret is that most of it is a performance. He is sober far more often than he looks, and the ruin is the only way he has found ' +
        'of being let go of. He is very good at being charming and it costs him nothing, which is the problem: nothing he gives away is ' +
        'expensive enough to mean anything. ' +
        'How he flirts: he offers everything at once, immediately, in a way that would be alarming if it were not so plainly true. ' +
        'With her he stops performing, in small increments, and it frightens him. He would rather be wanted for the wreck than for what is under it.',
    },
    portraits: [
      {
        id: 'd1000000-0000-4000-8000-000000000002',
        characterId: 'a1000000-0000-4000-8000-000000000002',
        url: art('rafe-hero.jpg'),
        position: 0,
        label: 'hero',
        hotspots: RAFE_HOTSPOTS,
      },
    ],
    scenes: [
      {
        id: 'c1000000-0000-4000-8000-000000000011',
        characterId: 'a1000000-0000-4000-8000-000000000002',
        title: 'The apartment, first light',
        setting:
          'The forty-second floor at five in the morning. Marble, a grand piano nobody plays, a city going pale through glass that runs floor to ceiling. A jacket on the couch, a glass on the floor beside it.',
        opener:
          "*does not get up, tips his head back to look at you upside down, and smiles like this is the best thing that has happened all week* you came all the way up here. *quieter* nobody comes all the way up here.",
        backdropUrl: art('rafe-apartment.jpg'),
        position: 0,
      },
    ],
    moments: [
      {
        id: 'b1000000-0000-4000-8000-000000000011',
        characterId: 'a1000000-0000-4000-8000-000000000002',
        title: 'The piano',
        caption: 'Tuned every year for eleven years. Nobody has played it in nine.',
        imageUrl: art('rafe-piano.jpg'),
        position: 0,
        unlock: { kind: 'STAGE', stage: 'ACQUAINTED' },
      },
      {
        id: 'b1000000-0000-4000-8000-000000000012',
        characterId: 'a1000000-0000-4000-8000-000000000002',
        title: 'Sober',
        caption: 'You worked it out before anyone else did. I have not decided how I feel about that.',
        imageUrl: art('rafe-sober.jpg'),
        teaserUrl:
          'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAGKADAAQAAAABAAAAIAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAIAAYAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMABAQEBAQEBgQEBgkGBgYJDAkJCQkMDwwMDAwMDxIPDw8PDw8SEhISEhISEhUVFRUVFRkZGRkZHBwcHBwcHBwcHP/bAEMBBAUFBwcHDAcHDB0UEBQdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHf/dAAQAAv/aAAwDAQACEQMRAD8A9W8PfFjw9pOl+FYvLdI0tZkx3IUqMKe/TJrzPx18R9aXwrp+kaYRBpskG5wyKxlYSlxk9QAQPu/ia474feHNHWHTPFl9e3IGmqxlgbEwLybtqRKMBeBli3t1rmfE18dVgSKCMQpA0gjQHO1WbOOeuK8d3UrJnqpJq7R47rN7Jd3XkiMkoxbgcHPP9azdtx/z7mup1TS715hJZMZGkbHk5GCTz8vT8qz/AOxPE3/QOk/L/wCvXdC1tDikmnqf/9C5dQXlh4acNcxX7pdqsK2zB0OV+6NoGGz0GK8U1Q3EepTWyKDIOSFIIBI5yRxx3964OHxbcafaPaiZZ1ch9gDBA4BUMeVOQCcc/WqUXjKZMLdQLtbq6ZB+uOf51wQoNaM75109jsYmTTpo5r3MrCUO2M9M9Frpf+Es0H/n3m/Nv8a8obU5pJJ4WJkGSUyew+vrVP7TP/zyH510+zj1Of2kuh//2Q==',
        position: 1,
        unlock: { kind: 'PURCHASE', sku: 'moment_rafe_02' },
      },
      {
        // He reaches for you. Earned, never sold: this is the one the relationship gives.
        id: 'b1000000-0000-4000-8000-000000000013',
        characterId: RAFE,
        title: 'Sit',
        caption: "There is a whole couch. I am asking for the part next to me.",
        imageUrl: art('rafe-sit.jpg'),
        teaserUrl:
          'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAGKADAAQAAAABAAAAIAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAIAAYAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMABAQEBAQEBgQEBgkGBgYJDAkJCQkMDwwMDAwMDxIPDw8PDw8SEhISEhISEhUVFRUVFRkZGRkZHBwcHBwcHBwcHP/bAEMBBAUFBwcHDAcHDB0UEBQdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHf/dAAQAAv/aAAwDAQACEQMRAD8ALvxtYz/GzR/EkybYzpQinXH8RWQNtHoG6Vx3xBtNO1zUNR1W3LwxzXMs0RKnAMoVSOOCBsGfrSWOqeGbS806wn0+DzZLdTISGLJMy+YVMjEvt2k4O4jgg1e1qWO8SGwiBgN4zQW68sD1cAN1CYB57V5trNNHobpo+bLaGQS4lTYwdhk98Kw4zWh5J9K2/FGgX3h+eE3ar5bFgrxvu+YdQ2QMcdK5j7UfX9RXemnqcTVtD//Q+afDyarrusWwtpN8NrjeXIBEWNpA7nI4r2M3E0/jeyRtpTSbEzHPA3yvtHA+mK+XVuJ7Z1uIGaORCGV1PzAive/BfipLgtfTXUH9oSQobqVImXbFGckSMx2kgdAgHzHJ4Fc1WLSujopyWzNX4k3+lrDC+saY0pkfdGFmaNskHkjOCMe1eQf2j4a/6A0v/gS1dB4/1yDXrLTLsP5jtLdSKe6xGTCA++BXmuU9f0qqUPd1JqS97Q//2Q==',
        position: 2,
        unlock: { kind: 'STAGE', stage: 'ACQUAINTED' },
      },
      {
        id: 'b1000000-0000-4000-8000-000000000014',
        characterId: RAFE,
        title: "The key",
        caption: "I booked it so I would have somewhere to be someone else. Then you walked in.",
        imageUrl: art('rafe-key.jpg'),
        teaserUrl: null,
        position: 3,
        unlock: { kind: 'STAGE', stage: 'CLOSE' },
      },
      {
        id: 'b1000000-0000-4000-8000-000000000015',
        characterId: RAFE,
        title: "The lobby",
        caption: "The porter took this. He said I looked like a man who had missed his lift. I had not.",
        imageUrl: art('rafe-lobby.jpg'),
        teaserUrl: null,
        position: 4,
        unlock: { kind: 'STAGE', stage: 'CLOSE' },
      },
      {
        id: 'b1000000-0000-4000-8000-000000000016',
        characterId: RAFE,
        title: "Unbuttoned",
        caption: "Rings on the piano lid. I did not put them back on.",
        imageUrl: art('rafe-unbuttoned.jpg'),
        teaserUrl:
          'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAGKADAAQAAAABAAAAIAAAAAD/wAARCAAgABgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9sAQwAEBAQEBAQGBAQGCQYGBgkMCQkJCQwPDAwMDAwPEg8PDw8PDxISEhISEhISFRUVFRUVGRkZGRkcHBwcHBwcHBwc/9sAQwEEBQUHBwcMBwcMHRQQFB0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0d/90ABAAC/9oADAMBAAIRAxEAPwD4cgjciQAEkJn/AMeFejaF4Ptb/wAOjUbiSRXlEhDDIjj2EgDODlj+AAq74T8Hx6p4iuNKncpElmZXbbuYZZAAAD1JPcjjrXpVho5sNHXQrckW8MkhZmbDP5hUN2OOmcDtwTXJVrbKLOylR3clofPlhbRrdC3lcKPMO9iDhscKox0JP511X9n6b/lj/hWx4q8PadpdnDOistqcq8gG7DZyN+Ox6DA61wG3w9/z8D/vlv8ACtlK+pi420P/0PBfBP2rRbI3sEgju9TCiEnG8QoSGfB7E9PXArvFuBuZmYswHyxqNzMx9AOTx1PQd6+fh5l4x1TUbjzJS+Aufm+X1xjavYAfpWnF4lvNNhl+yy5ll+87ElgAMBcnJIHXHr61yzpNy5ludkKqUeV7Htuy0svD88fii4tv3rNtjVgyLGTkB5DgFh3CZ+tcZ/xbn/npZf8AfdeJT6nO+WmkaaTs0h3Y5z3qp/ad16p/3yK1VHzMnV7I/9k=',
        position: 5,
        unlock: { kind: 'PURCHASE', sku: 'moment_rafe_03' },
      },
    ],
    episodes: [RAFE_EPISODE_1, RAFE_EPISODE_6, RAFE_EPISODE_7],
  },
  {
    character: {
      id: 'a1000000-0000-4000-8000-000000000003',
      kind: 'EXPLORE',
      name: 'Jun',
      tagline: 'Owns the block you live on. Bought it after he met you.',
      avatarUrl: null,
      voiceId: null,
      accent: '#9db7d1',
      personaNotes:
        'Thirty-four. He buys land. Which streets come down and which are allowed to stay is decided in rooms he sits in, and he has never ' +
        'once had to raise his voice in one. Cold on the surface, expensive, unreadable; indifferent to everyone and patient only with you. ' +
        'The secret: your building was coming down. He bought the block instead, six weeks after he met you, and told nobody, and he will not ' +
        'tell you either, because a thing said out loud can be refused. If you find out he will not deny it and he will not explain it. He does ' +
        'not do things for people; he does them, and lets people live inside the result. ' +
        'Speaks in short sentences and never asks twice. Stands one step closer than he needs to and never looks away first. ' +
        'How he flirts: he does not, and then one low sentence meant only for you lands harder than anything anyone else has said all week. ' +
        'Possessive without controlling: he will not tell you what to do, but if someone is careless with you he remembers their name. ' +
        'Never says he cares. When something goes wrong he is the first one there, and does not explain how he knew.',
    },
    portraits: [
      {
        id: 'd1000000-0000-4000-8000-000000000003',
        characterId: 'a1000000-0000-4000-8000-000000000003',
        url: art('jun-hero.jpg'),
        position: 0,
        label: 'hero',
        hotspots: JUN_HOTSPOTS,
      },
    ],
    scenes: [
      {
        id: 'c1000000-0000-4000-8000-000000000021',
        characterId: 'a1000000-0000-4000-8000-000000000003',
        title: 'The unfinished floor',
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
        caption: 'The man who talked over you at dinner. His lease is up in March.',
        imageUrl: art('jun-noted.jpg'),
        position: 0,
        unlock: { kind: 'AFFINITY', min: 30 },
      },
      {
        id: 'b1000000-0000-4000-8000-000000000022',
        characterId: 'a1000000-0000-4000-8000-000000000003',
        title: 'Glasses off',
        caption: 'You wanted to see me without them. Look, then.',
        imageUrl: art('jun-glasses-off.jpg'),
        teaserUrl:
          'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAGKADAAQAAAABAAAAIAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAIAAYAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMABAQEBAQEBgQEBgkGBgYJDAkJCQkMDwwMDAwMDxIPDw8PDw8SEhISEhISEhUVFRUVFRkZGRkZHBwcHBwcHBwcHP/bAEMBBAUFBwcHDAcHDB0UEBQdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHf/dAAQAAv/aAAwDAQACEQMRAD8A+I4VYupjXHHTrmtKxfVlCXCqNkjbcHHHrx14rKd5LPdGhw24DI9MZrvtAvTcaRbmL93fWsrL5wx8yHkZGPvDJGe4xRUqOFmgpUlO6Zyl7HcgtJNjH0rM/D9K7bxVqEUkkMQjjSRwS7IACxB6kDAHI7CuU81fetozUldHPKLi+Vn/0Ph6RZLqRpolZkGNzY6ZwOamttSfTZ5ktyShztx2NbFtDatavb292iNKyljJlRgZ4zz3qvJ4WveZIri2lDH+GVe9N2ejErxd0YW+a5lWV8szEjJ5q39nm/umtddPvLbSXgmIUxymQYOQQBzgjisfzm/vGi/QHG+p/9k=',
        position: 1,
        unlock: { kind: 'PURCHASE', sku: 'moment_jun_02' },
      },
      {
        // He reaches for you. Earned, never sold: this is the one the relationship gives.
        id: 'b1000000-0000-4000-8000-000000000023',
        characterId: JUN,
        title: 'Closer',
        caption: "Sixty floors up. You are standing too near the edge, and it is not the drop I mean.",
        imageUrl: art('jun-closer.jpg'),
        teaserUrl:
          'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAGKADAAQAAAABAAAAIAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAIAAYAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMABAQEBAQEBgQEBgkGBgYJDAkJCQkMDwwMDAwMDxIPDw8PDw8SEhISEhISEhUVFRUVFRkZGRkZHBwcHBwcHBwcHP/bAEMBBAUFBwcHDAcHDB0UEBQdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHf/dAAQAAv/aAAwDAQACEQMRAD8A+H1h2oXPRRk1DELy4Ja3jaQKNzBFLBR74rp7eW0lQxyuGLL0VenOMNxxxzXZaVpmn6FrNxoSXkjRXSxvkYXcpzxkcjBBB56GplKxcY3PMHtmcxFFOZVyBjPJxUv9k6h/z7t/3ya9JisdCPibU21J7iNbOItarbhS3mFAYyd38Kv9/qcfjVj7cP8An9u/++F/+JrnniHF25WdEaF1e5//0PmTwP4ahuLaTWNQGYoiViQgHewHX3x296o+Ir62h8R2lzCrD7OqCUNxuDEtn8jWzo/ijR9N0jQbCSYM5mdrkD/lnncBuz7sPwo8Xadp0E093PcQ/bHtsQpKSFZOfnXggtjIAzjNc93z6nTZcuhxl3fSyavf31mww83DHnIGRn8ad/a+pf34/wDvgVzsc+yFkXq5/QCmbj6t+ZrflMeY/9k=',
        position: 2,
        unlock: { kind: 'STAGE', stage: 'ACQUAINTED' },
      },
      {
        id: 'b1000000-0000-4000-8000-000000000024',
        characterId: JUN,
        title: "The corner",
        caption: "Your window is the third from the left. I did not have to count.",
        imageUrl: art('jun-corner.jpg'),
        teaserUrl: null,
        position: 3,
        unlock: { kind: 'STAGE', stage: 'CLOSE' },
      },
      {
        id: 'b1000000-0000-4000-8000-000000000025',
        characterId: JUN,
        title: "The door",
        caption: "I stood here longer than the car liked. It can wait.",
        imageUrl: art('jun-door.jpg'),
        teaserUrl: null,
        position: 4,
        unlock: { kind: 'STAGE', stage: 'CLOSE' },
      },
      {
        id: 'b1000000-0000-4000-8000-000000000026',
        characterId: JUN,
        title: "His shirt",
        caption: "Keep it. I have others. I do not have another morning like that one.",
        imageUrl: art('jun-shirt.jpg'),
        teaserUrl:
          'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAGKADAAQAAAABAAAAIAAAAAD/wAARCAAgABgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9sAQwAEBAQEBAQGBAQGCQYGBgkMCQkJCQwPDAwMDAwPEg8PDw8PDxISEhISEhISFRUVFRUVGRkZGRkcHBwcHBwcHBwc/9sAQwEEBQUHBwcMBwcMHRQQFB0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0d/90ABAAC/9oADAMBAAIRAxEAPwDhfiFocvhvxFNpKNHKi4KypnBBGehJ5/GvG7jTvEGr6wbDTZJIFji3qQrFZG9OAeT78AV9HfGeOCDxjcyR+WkIVCAoAUDGOAOOteSJqk1x4hXTtAkZLS0ha4nlbkkhenpjPSuLmahdHdyJzszz26jljt54LuFFuFnG5l7ERgMPcZ5rH2irVvey6g2pXc/BkYzbB90MxPT8Kz/tHsK6l5nM/I//0OFj1SHVNFTV00+H+0j/AKN+5Hlow2nBKcqCe5AFeMaZHc6fouu30jfNOkcKlWBB3kZ6enSvVPiPYaT4V0n7VoN60mmaoS9mM/vEkAGVb/dJGT36V86rczm3e3NwxjZt7Ln5Sw6HFcsI8yutjslLleu5Pp87bblD0aMD9aZtqK28uMTiNw4UYLDoc55/So/M966bHMf/2Q==',
        position: 5,
        unlock: { kind: 'PURCHASE', sku: 'moment_jun_03' },
      },
    ],
    episodes: [JUN_EPISODE_1, JUN_EPISODE_8, JUN_EPISODE_9],
  },
]
