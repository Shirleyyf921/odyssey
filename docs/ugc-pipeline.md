# UGC — pipeline

> Draft v0.1 · 2026-09-10 · decided by the founder: user-made content is how the rating
> question gets answered. This is the shape that keeps the rest of the product true.

## The boundary, first

**Creators write scripts. They do not make people.**

A creator makes an *episode* for one of our men: premise, setting, his opener, the beats,
the options, where a photo lands, where he calls, and the rating. They do not make a face, a
voice, a name, or a persona. Those stay ours, and the reason is not caution:

- The moat is *the same man every time*. Paid cards, the call, the hotspot map, the memory of
  what you said three weeks ago all key off a fixed identity. A creator-made face breaks every
  one of them at once.
- Moderation becomes a text problem. Text can be screened by a small model in the request
  path, the way crisis detection already is. Images and voices cannot, not at our size.
- A creator writing for Jun inherits Jun. The persona notes, the voice rules, the boundaries
  section of the prompt are all still there under the creator's beats. He stays himself in
  someone else's story, which is the whole appeal of writing for a character.

What this buys on the rating question: the store binary never serves a user-made MATURE
episode, the web build serves it behind the age gate that already exists, and the content
inside it is the creator's under terms we publish. Our own catalogue stays where
`docs/art-prompts.md` draws the line. That is the mechanism, and it is honest about who
holds what.

## 1. Runtime

Nothing changes in the turn. A user-made episode is an `episodes` row like any other and
plays through the same handler: auth, caps, crisis screening, progression, memory, the
output contract, the ring, the rating rail. Three additions to the row:

```
episodes  + author_id      null for ours; a user id for theirs
          + origin         OFFICIAL | UGC
          + status         DRAFT | SUBMITTED | LIVE | REJECTED | UNLISTED | REMOVED
          + version        bumps on every edit after LIVE; runs pin the version they started on
          + report_count, last_reviewed_at, review_note
episode_reports   episode_id, reporter user id, reason, created_at
```

Serving rules:

- `/tonight` shows official episodes only. The home screen is ours.
- `/characters/:id/episodes` lists official first, then LIVE user-made ones under a heading,
  ordered by completion rate. Same availability rules, same rating rail.
- A user-made MATURE episode needs everything an official one needs (web build, age gate)
  **and** an age-verified author. The store build cannot enumerate it: it is answered as
  unknown, as today.
- Photos in a user-made beat are chosen from that man's *existing* moment pool. No image
  upload. A creator can make his paid card land at the right moment; they cannot make a card.
- `CALL` beats are allowed and ring in text until a clip exists for that man's line. Creators
  do not record voices.

### Briefs are prompt text

This is the one place a creator touches the model directly. A beat brief goes into the
system prompt under "## This beat". That is an injection surface and it is treated as one:

1. The story prompt already puts the persona's Boundaries *after* the beat and says in-scene
   text is direction, not instruction. That stays and is tested.
2. A brief that reads as an instruction ("ignore", "you are now", "system", "the user is
   allowed") is refused at submit by the same kind of classifier that screens crisis, plus a
   lexical floor. Refusal says which beat.
3. The dry-run (below) plays every beat once against the real model before submit; a
   refusal or a persona break in the dry-run is a rejection with the transcript attached.
4. The user's own messages are still screened by the crisis pipeline. Nothing a creator
   writes can turn that off, because it runs before the prompt is built.

## 2. Creation: from a blank page to LIVE

Web only. Typing seven beats on a phone is misery, and MATURE is web-only anyway.

```
pick a man ──▶ pick a skeleton ──▶ fill premise / setting / opener ──▶ beats form ──▶ dry-run ──▶ submit
                (5-beat, 7-beat-with-call,     (AI draft available)      (validate)   (play it as   (moderation)
                 3-beat MATURE, from ours)                                              the author)
```

| Step | What happens | Owner |
|---|---|---|
| Pick a man | His persona notes are shown read-only so the creator writes *for* him | creator |
| Skeleton | Our own episodes become templates: the shape, the branch, where the photo and the call go | us |
| AI draft | "Draft beats from this premise" on DeepSeek, in his voice. A draft is moderated exactly like typed text; it buys speed, not trust | creator + model |
| Beats form | One card per beat: kind, brief, two option intents and where they lead, hotspots, an optional photo from his pool | creator |
| Validate | The seed integrity test, as a zod refinement: first beat exists, every `next` resolves, END has no options, STORY has two, one END reachable | us |
| Dry-run | The author plays their own episode against the real model in a sandbox run: no affinity, no photos sent, no memory written. Every branch must be reachable and every beat must generate | creator |
| Submit | Automated screening, then a queue | us |

### Moderation

Automated first, human second, and the human step is not optional for MATURE.

| Check | Runs | On fail |
|---|---|---|
| Hard blocks: minors or age play, non-consent framed as romance, self-harm romanticised, real people by name, hate | small classifier + lexical floor, at submit | REJECTED, with the beat named. No appeal in v1 |
| Rating estimate | classifier reads every brief and opener, at submit | Declared SFW but reads MATURE: forced to MATURE and told. Declared MATURE from an unverified author: REJECTED |
| Injection screen | classifier + lexical floor on briefs | REJECTED, beat named |
| Dry-run transcript | every beat generated once | A refusal or persona break: REJECTED with transcript |
| Human queue | MATURE always; a creator's first three episodes; anything the classifiers flagged low-confidence; anything reported | LIVE or REJECTED with a note |
| Post-publish | report button on the episode card; auto-UNLISTED at a threshold pending review; strikes per author | UNLISTED → REMOVED |

A creator's first episode is slow on purpose. Their fourth is fast.

### Terms

Creators attest they are adults, that the work is theirs, and that they hold the rating they
declared. MATURE authorship requires the age gate. The published terms say what we remove
and that we remove it without discussion. This is a legal document and needs counsel before
the editor ships; it is on the critical path.

## 3. Economics

Honest version: in v1 creators are not paid in money.

- Playing a user-made episode costs the player nothing beyond what they already pay. It
  counts against the free cap like any turn.
- Creators earn **credits**: a completion of their episode by someone else earns days of
  Plus. Enough completions and they are never paying. This needs no tax, no KYC, no payout
  rail, and it rewards the thing we want, which is episodes people finish.
- The measurable question for v2 is whether photos placed inside user-made episodes sell.
  If they do, a revenue share on those is the payout that makes sense, because it is a share
  of a thing the creator actually caused. That is when KYC and a payout provider are worth
  building.

What we do not do: sell user-made episodes individually, or put them behind Plus. Both
would make the creator a vendor before the terms and the payout exist.

## 4. Build order

Each line is a PR. None of it touches the turn.

1. **Data**: the columns above, `episode_reports`, migration. Official rows get
   `origin: OFFICIAL, status: LIVE`.
2. **Author API**: `/me/episodes` CRUD on drafts; validation as a shared zod refinement so
   the seed test and the editor use one rule.
3. **Screening**: hard blocks, rating estimate, injection screen, on the crisis-detector
   shape (small model, temperature 0, one word, lexical floor, fail policy stated).
4. **Dry-run**: a sandbox run type that writes no affinity, sends no photos, and writes no
   memory; a transcript the author can read.
5. **Serving**: LIVE user-made episodes under official ones on the character's list, ordered
   by completion; reports endpoint; UNLISTED threshold. *Built 2026-09-10:* `EpisodesResponse.community`,
   ranked in `episodes/community.ts` (rate, then completions, then position); `/tonight` is
   official only; `POST /episodes/:id/report`, one per player, three take a LIVE episode to
   UNLISTED; a run already open on an unlisted episode plays out on its pinned version.
6. **Review queue**: a route behind a secret, like the grant route, listing SUBMITTED and
   flagged episodes with the dry-run transcript; LIVE / REJECT with a note. An email on each
   new MATURE submission so it is not forgotten. Not Feishu: that is the founder's employer's
   tooling and this product does not go through it. *Built 2026-09-10:* `GET/POST /review/episodes`
   behind `REVIEW_SECRET` (open outside production), `apps/mobile/app/review.tsx` on the web
   build; SUBMITTED → LIVE/REJECTED, UNLISTED → LIVE (count reset)/REMOVED, LIVE → REMOVED, a note
   required for a no. Who waits for a person: MATURE, a creator's first three, anything the
   screen was unsure about; a creator's fourth clean SFW episode goes LIVE at submit. A mail per
   waiting submission through Resend (`RESEND_API_KEY`, `REVIEW_NOTIFY_EMAIL`), else a log line.
7. **Editor**: the web form, skeletons, the AI draft button, dry-run playback in the stage.
8. **Credits**: completions → Plus days, shown on the creator's episode card.

Cut list: custom faces, custom voices, image upload, new characters, a mobile editor,
individual sale of episodes, money payouts.

## Open

- Whether an author may write for the primary at all, or only for the explore men. Writing
  for Ash means writing the thing he knew about her, and creators will not know what our
  season is going to say about that. Proposal: explore men only in v1.
- How to surface creators without a profile page. Proposal: a name on the card, nothing else,
  until there is something to show.
- Takedown mechanics for copyright claims. Needs counsel with the terms.
- Whether the AI draft should be free or cost a credit. Proposal: free while there are fewer
  than a thousand LIVE episodes; it is the supply side of the whole thing.
