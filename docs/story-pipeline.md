# Story mode — pipeline

> Draft v0.1 · 2026-09-09 · follows the 2026-09-09 direction: story in front, relationship behind.

Three pipelines. The first two run in production; the third is the build order.

## 1. Runtime: one turn of an episode

Replaces the plain chat turn in `chat/handler.ts`. Everything that exists today stays; the
generation step changes shape and two steps are added (episode state, choices).

```
client ─ send_message | choose(option) ─▶ ws/chat
   │
   ├─ 1 authorize + idempotency ........................ existing
   ├─ 2 crisis screen (before anything else) ........... existing, unchanged
   ├─ 3 tier rules: cap / ceiling / memory / pivotal .... existing (billing/rules.ts)
   ├─ 4 store USER message (a choice is stored as text) . existing
   ├─ 5 relationship progression ....................... existing, but silent: no client event
   ├─ 6 EPISODE STATE ................................. new
   │      load episode + beat, resolve which branch the choice took,
   │      decide if this beat is a checkpoint (cliffhanger / paywall / photo)
   ├─ 7 memory assemble ................................ existing, policy from step 3
   ├─ 8 prompt = persona + episode brief + beat brief + history ..... new template
   ├─ 9 generate (DeepSeek STORY / Claude PIVOTAL) ...... existing gateway, STORY tier + chooseStoryTier
   │      output contract: narration, his line, 3 options (C is always "say something")
   ├─ 10 parse + validate output; on failure regenerate once, then fall back to line-only ... new
   ├─ 11 stream: message_start/delta/end for the line; then `choices` event ............ new event
   ├─ 12 checkpoint side-effects: moment_offer (existing), episode_end, paywall ........ new
   └─ 13 afterTurn: memory extraction, summary ........... existing
```

Rules that make it hold together:

- **A choice is just a message.** Option text is sent as the user's message, so history, memory,
  caps and crisis screening see it like any other turn. No second code path.
- **The model never owns the plot.** Beats and branches are authored (pipeline 2). The model
  writes the prose of *this* beat and phrases the three options; it cannot invent a beat.
- **Relationship stays behind the curtain.** Step 5 stops emitting `relationship_updated` to the
  client. Stage and affinity gate which episodes, branches and photos exist; they are never
  shown as numbers or notices.
- **Photos ride on beats.** A beat can be marked `photo: <momentId>`; the existing offer path
  sends it locked. The daily cadence rule in `moments/offers.ts` still applies.
- **Calls ride on beats too.** A beat can be `kind: call`: the client turns into an incoming-call
  screen, plays a pre-rendered clip of his voice, and returns to the story. Same enforcement as
  photos: the audio URL leaves the server only when the beat is reachable. Nothing is
  synthesized at runtime in v1.

## 2. Content: from character to playable episode

Offline, versioned in `packages/prompts` (text) and `content/seed.ts` (structure). Two people can
run it: one writes, one generates art.

```
character bible ──▶ season outline ──▶ episode script ──▶ beat sheet ──▶ QA play ──▶ seed
  (exists)          (new, per man)     (new, 6–10/season)  (new, 5–8 beats)  (new)      (existing)
                                                              │
                                              photo beats ──▶ art pipeline (docs/art-prompts.md) ──▶ teaser
```

| Stage | Artifact | Owner | Tooling |
|---|---|---|---|
| Character bible | persona notes, voice rules, hard limits | writer | exists (`packages/prompts`) |
| Season outline | 6–10 episode titles, the arc, which stage unlocks which episode | writer | markdown |
| Episode script | premise, setting, his opener, the ending states, which ending moves affinity | writer + model draft | DeepSeek draft, human edit |
| Beat sheet | 5–8 beats; each: brief for the model, 3 authored option *intents* (not final text), checkpoint flags, optional photo | writer | zod-typed JSON in seed |
| Art | photo beats → paid cards → teaser; scene portraits with 2–3 expressions and a hotspot map | art | Lovart, existing recipe |
| Voice | call beats → scripted line → rendered clip | writer + eng | see "Voice" below |
| QA play | play every branch once in dev with the sign-off directive off; log tokens per beat | anyone | dev build + `turn complete` log |
| Ship | seed upsert, OTA for copy | eng | existing |

### Stage: what the user looks at

The story is not read in chat bubbles. The screen is his portrait in the scene, full bleed;
narration and his line sit in the lower third; the user taps to advance. Three layers, in order
of cost:

**Pacing (2026-09-11, after the Tipsy Chat reference).** Nothing is ever on screen at once. A
turn is a queue of pages: the episode's premise and setting the first time, the user's own
words once, each sentence of narration unnamed, each beat and stretch of his line under his
name. A page types itself out; a tap finishes it, the next tap brings the next; a page fades
before the next types. A message that streams in feeds the queue as sentences complete, so the
user reads at their own speed and never sees a half-written sentence. A pulsing ring drifts over
him while there is more to read. The options rise from below only when the last page has
landed; a photo he sent waits for the same moment and goes away when they answer. The user's
own words give way to his first sentence on their own: that is what they are waiting for.

**The story gives the pictures (2026-09-11).** An everyday card placed on a beat is unlocked the
moment the story reaches that beat (`moment_unlocks.source = BEAT`), and the stage becomes that
picture from that page on: the scene cut in the reference. His caption is the page under his
name. A paid card on a beat is still bought; the story only puts it in front of them, veiled,
once the turn is read. The gallery says which episode shows a locked everyday card instead of a
stage or a number. Not too many: one everyday reveal mid-episode, one at the ending, one paid
offer in the second half. The point is that playing tonight is how the pictures happen.

| Layer | What | Cost | When |
|---|---|---|---|
| Tap to advance | One sentence at a time, typed; a tap per sentence; his line under his name | Client only | v1, with the story screen; pacing 2026-09-11 |
| Touch | Hotspots on the portrait (hand, shoulder, hair, face). Touching one plays a reaction: an authored line, or one short generated line in his voice | One short turn at most | v1 |
| Motion | Breathing, blinks, a head turn: Live2D rig or a looping clip per portrait | Rigging per portrait | v2 |

Rules for touch:

- **Hotspots are authored per beat, gated by stage and rating.** STRANGER can touch his hand;
  CLOSE can touch his face; nothing below the waist exists in the store build. This is the most
  natural way the hidden relationship shows: the user never sees a number, they notice what
  they are allowed to touch tonight.
- **A touch is a message.** It goes through the same turn pipeline as a choice ("touches his
  hand"), so history, memory, caps and crisis screening all see it. Reactions are one line, no
  options, and do not advance the beat.
- **Store review reads touch mechanics harder than images.** Keep the store hotspot set to
  hand, shoulder, hair, face. Anything else is web-build only, on MATURE episodes.

What it asks of art: portraits are produced per scene (already the plan in ARCHITECTURE §14),
each with two or three expression variants, and a hotspot map (normalized rectangles) stored
with the portrait. The hero faces are fixed; expressions are variants of the hero, never a new
generation.

### Voice

Two different things, kept apart the way photos and runtime image generation are (§14):

| | v1: the call beat | v2: his lines spoken |
|---|---|---|
| What | An authored 20–60 s monologue, rendered once, served as a file | Every generated line through TTS |
| When | A beat the writer marks `call`; usually the end of an episode or a late-night checkpoint | Every story turn |
| Cost lands on | Content budget, once per clip | Per user per turn |
| Hard part | Casting the voice | Latency, and the voice drifting from the cast one |
| Tier (ARCHITECTURE §7) | PLUS gets calls; FREE hears it ring and gets his text instead | PREMIUM, as already planned |

The v1 pipeline is the art pipeline with a different tool:

```
call beat ──▶ scripted monologue (writer, in his voice rules) ──▶ TTS render (one fixed voice id per man)
          ──▶ listen + reject drift ──▶ self-host the file ──▶ seed: beat.callUrl, beat.callSeconds
```

Rules: one voice id per character, cast once and never changed, exactly like the face. Vendor is
whichever of Cartesia / ElevenLabs / PlayHT passes a blind listen on the three casts; English
first. The call screen needs no speech input in v1: the user answers or declines, and the
decline is itself a choice the story can react to. MATURE episodes need a vendor whose policy
allows the script; check before casting, not after.

What v1 deliberately does not do: no live back-and-forth on the call, no user microphone, no
runtime synthesis. If calls move retention, v2 spends on the runtime path.

Content rating is a field on the episode, not on the character: `SFW` ships to the store build,
`MATURE` only to the web build. Same backend, same characters, different episode pool.

## 3. Build order

Each line is one PR. Nothing below depends on RevenueCat products existing.

1. **Data model**: `episodes`, `beats`, `episode_runs` (user × episode: current beat, path taken,
   ended_at). Seed one episode for Elliot from the existing studio scene. Migration 0007.
2. **Output contract + parser**: prompt template for narration / line / options; strict parser
   with one retry; tests on malformed output.
3. **Runtime**: episode state in the handler, `choices` event in the protocol, silent
   progression, DeepSeek as the STORY route for story turns (built 2026-09-10: `STORY_MODEL`).
4. **Client**: story screen replaces chat as the default entry: full-bleed portrait in the
   scene, narration and his line in the lower third, tap to advance, option chips under his
   line, free text as option C. Photo bubbles become full-screen reveals on the stage.
4b. **Touch**: hotspot maps on portraits, expression variants, one-line reactions through the
   turn pipeline. Ships with the client PR or right after it.
5. **Home**: "tonight" layout, one episode card per man, locked ones show why.
6. **Rating rail**: `contentRating` on episodes, web build serves MATURE, store build never does.
7. **Call beats**: `kind: call` on beats, the call screen, one rendered clip for Elliot's first
   episode ending. Voice casting happens in parallel with 1–5, it is not on the critical path.
8. **Second and third episodes for Elliot**, first for Theo and Jun; then the season outlines.

Cut list from this change: `relationship_updated` on the client, the Moments count on the
character page, exploration characters as parallel relationships (they become supporting cast
inside episodes), any plan for realtime video. Runtime TTS stays v2.

## Open

- Does an episode cost anything beyond the subscription? Proposal: episodes are free, the
  photos inside them are the consumable, cliffhanger continuation is Plus. Measure before
  adding "next episode" as a SKU.
- Whether choices should ever be hidden behind Plus (Tipsy locks some). Default no; it breaks
  the fiction the same way metering messages does.
- Mythological / "Odyssey" cast: keep as a season concept for later, not a character type.
- User-made episodes: decided 2026-09-10, see `docs/ugc-pipeline.md`. Creators write scripts
  for our men; they do not make people.
