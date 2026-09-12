# odyssey — Technical Architecture

> Status: Draft v0.3 · Pending review
> Last updated: 2026-09-06 (v0.3.2: tiers and price list in §7)

## 1. Product Definition

An AI boyfriend companion app. **Hybrid model**: one dedicated primary boyfriend as the anchor
relationship, plus additional characters available for exploration.

Content rating **SFW**. Target distribution: App Store and Google Play.
Market: **English-speaking, international** (no China distribution).

### Competitive Landscape

| Product | Shape | Content | Distribution | Monetization |
|---|---|---|---|---|
| Replika | Dedicated companion | Largely SFW | App stores | Subscription |
| Character.AI | Character platform at scale | SFW | App stores + web | Subscription |
| SpicyChat | UGC character board | NSFW | Web only | Subscription |
| Tipsy Chat | UGC characters + creator economy | Mature, 17+ rated | **App stores + web** | **Consumable gems + subscription** |
| **odyssey** | Primary companion + curated exploration | SFW | App stores | TBD — see §7 |

Two things worth extracting from this set:

**Store distribution of mature content is a grey zone, not a hard wall.** Tipsy Chat ships on both
App Store and Google Play at a 17+ / Mature rating while reportedly applying little text filtering.
SpicyChat's web-only posture is a choice, not a technical necessity. We remain SFW by decision, but
the constraint should be understood accurately: the risk is discretionary enforcement and delisting,
not outright impossibility.

**Tipsy Chat sells consumables, not just access.** See §7 — this is the most transferable finding
in the set, and it directly addresses our unit-economics exposure.

### Core design decision: exploration must not dilute exclusivity

The biggest risk in a hybrid model is "if there are others, the primary isn't special anymore."
How we handle it:

1. **The primary boyfriend is aware of exploration.** After a user chats with another character,
   he asks about it, gets jealous, references it later. Exploration becomes fuel that reinforces
   the primary relationship rather than diluting it.
2. **Capability tiering.** Voice, proactive messages, anniversaries, and deep memory belong to the
   primary relationship only. Exploration characters are lightweight conversations.
3. **Curated characters only.** Faces, voices, names, and personas are ours. Since 2026-09-10
   readers may write *episodes* for the explore men (docs/ugc-pipeline.md): scripts, not
   people. That is the line that keeps the moderation cost a text problem.
4. **The primary boyfriend is chosen from a curated set of preset faces**, not built from
   sliders. Name and personality are customizable; the face is not. Decided 2026-09-02, because
   identity images (§14) have to show the same person every time, and that is only achievable
   today for faces we produced ourselves. Choosing a face is also a conversion step in its own
   right, not a cost.

## 2. Stack

| Layer | Choice | Rationale |
|---|---|---|
| Client | Expo (SDK 52, pinned in `apps/mobile`) + EAS Build | Config plugins now cover native modules; skips the entire native build setup. OTA updates let us ship prompt and copy changes without review |
| Routing | expo-router | File-based, same mental model as Next.js |
| State | Zustand + TanStack Query | Separates local UI state from server state |
| Local storage | expo-sqlite + expo-secure-store | Message cache enables offline history; tokens go in secure store |
| Server | TypeScript + Fastify | Shares zod schemas and types with the client. For a small team this beats Python's AI ecosystem advantage, since all inference is external anyway |
| Hosting | Railway | API + Postgres (pgvector) + Redis; supports PR preview environments |
| Database | Postgres + pgvector | Relational data and memory vectors in one store; no separate vector DB early on |
| Queue/cache | Redis + BullMQ | Session cache, rate limiting, proactive message scheduling |
| Inference | External APIs behind our own gateway | Railway has no GPUs; the gateway prevents lock-in to a single vendor |
| Billing | RevenueCat | Wraps StoreKit and Play Billing |

### Known constraints

- **Railway has no GPUs.** All model inference goes to external APIs; Railway runs orchestration only.
- **React Native's `fetch` does not support streaming bodies** (it is an XHR polyfill), so
  token-by-token rendering does not work out of the box.

## 3. Realtime Transport: WebSocket

We go with WebSocket rather than SSE, because proactive messaging ("he texts you in the morning")
needs a persistent connection plus push anyway.

Implementation notes:
- Railway instance restarts drop connections — the client needs **exponential-backoff reconnect**
- Clients generate a `client_msg_id` for idempotency so reconnect-and-retry never duplicates messages
- Heartbeat keepalive, so intermediate proxies do not kill idle connections

Fallback: if WebSocket operations prove costly, retreat to `expo/fetch` (SDK 52+ supports streaming)
with a separate push channel.

## 4. Memory System

The real moat for a companion product. Four layers, routed by `Relationship.depth`:

| Layer | Mechanism | DEEP | LIGHT |
|---|---|---|---|
| Short-term | Last N turns verbatim in context | ✅ | ✅ |
| Mid-term | Rolling summary, compacted every N turns | ✅ | ✅ |
| Long-term | Structured fact extraction → pgvector, RAG retrieval | ✅ | ❌ |
| Relationship state | Affinity, stage, anniversaries → injected into system prompt | ✅ | ❌ |

Long-term memory writes are async jobs (BullMQ) and never block the reply path.

**Status (2026-09-02).** All four layers exist in `apps/api/src/memory`. Short-term is the
verbatim window after the last summarized message; the mid-term summary folds the oldest turns
in once the window overflows by a batch; long-term extracts facts per turn into pgvector and
retrieves by cosine similarity against the incoming message. Jobs run in-process after the reply
is sent, tracked so shutdown can drain them; BullMQ replaces that once Redis exists. Extraction
and summaries run on the tier set by `MEMORY_TIER` (PIVOTAL by default, per §6). What is not
done: the summary is never re-compacted, retrieved memories carry no recency weighting, and
nothing dedupes a fact learned twice.

## 5. Data Model (draft)

```
users              account, age gate, preferences, locale
characters         kind(PRIMARY|EXPLORE), persona_template, voice_id
relationships      user × character, depth, stage, affinity, anniversaries
conversations      conversation container
messages           role, content, client_msg_id, token usage
memories           user × character, fact text, embedding(pgvector), confidence
subscriptions      user × entitlement, synced from RevenueCat; tier is derived from unexpired rows
purchases          one-time SKUs (moments), keyed by store transaction id
episodes           authored story per character: premise, setting, opener, rating, unlock rule, first beat;
                   author_id, origin(OFFICIAL|UGC), status(DRAFT…REMOVED), version, report_count (docs/ugc-pipeline.md)
beats              episode × position: brief for the model, two authored options, next, optional photo or call
episode_runs       relationship × episode: current beat, path taken, ended_at, episode_version pinned at start
episode_reports    episode × reporter: reason; counted onto episodes.report_count
proactive_jobs     proactive message scheduling and rate limiting
```

## 6. LLM Gateway

Business code never calls a vendor SDK directly. Everything routes through an internal gateway:

- **Tiered model routing** — cheap models for everyday chat, strong models for pivotal moments
  and memory extraction
- Vendor failover
- Per-user token accounting (for unit economics and rate limiting)
- **Moderation in front** — under an SFW positioning users will try to steer the model past the
  line. A filter layer is both a product need and an app store requirement.

### Cost model (must be validated early)

A deep primary conversation carries roughly 3–8k tokens of context per message. At 30 messages
per day, that is ~150k input tokens per daily active user per day. This number determines whether
subscription pricing can cover cost, and **must be measured during the MVP**, not estimated.
The `turn complete` log line carries `plan`, `sentToday`, `longTerm`, the model tier, and token
usage per turn, which is the measurement.

## 7. Monetization

Our working assumption was a flat subscription. Tipsy Chat's model is worth taking seriously as an
alternative, because a flat subscription leaves us structurally exposed on cost.

### What Tipsy Chat does

| Element | Detail |
|---|---|
| Message pricing | ~16.4 gems consumed per message |
| Gem packs | One-time purchases from $1.49 to $199.00 |
| Subscriptions | Three tiers at $4.99 / $14.99 / $44.99 per month, with annual discounts |
| Free tier | 50 gems per day on sign-in, accumulable |
| Currency split | Subscription "blue gems" and purchased "red gems" carry different rules |
| Tier differentiators | Message quota, **memory capacity**, reply length, response quality |

### Why this matters for us

**A flat subscription has unbounded cost exposure.** Per §6, a deep conversation runs 3–8k tokens of
context per message. A heavy user at 200 messages/day costs roughly 7x a median user at 30, while
paying identically. In a companion product the heaviest users are precisely the most engaged and
least likely to churn — so the flat model loses the most money on the users it most wants.

A consumable layer passes variable cost through to variable usage. The tradeoff is friction:
Tipsy Chat's most common user complaint is that gems are expensive and daily grants insufficient,
which is exactly the failure mode of metering an emotional product. Every message becomes a purchase
decision, which is corrosive to the illusion the product sells.

**Note that Tipsy Chat prices memory capacity as a tier differentiator.** That validates memory as
the monetizable core rather than a background feature, and gives us a pricing axis that is native to
our architecture — `Relationship.depth` and retrieval budget are already first-class concepts in §4.

### Candidate model for odyssey

Subscription-primary, with metering hidden behind generous caps rather than surfaced per message:

- Tiers differentiate on **memory depth**, voice access, proactive messaging, and exploration slots
- Soft fair-use ceiling well above normal usage, so typical users never perceive a meter
- Heavy users past the ceiling degrade to a cheaper model tier rather than hitting a paywall —
  cost is controlled without breaking the relationship fiction
- Revisit consumables only if measured usage shows the ceiling cannot be set profitably

This is a hypothesis, not a decision. It depends entirely on the cost measurement in §6.

### Update 2026-09-02: conversation is subscription, images are consumables

The friction argument above is about metering *conversation*: making every sentence a purchase
decision breaks the fiction. It does not apply to images. "He sent you a photo" is a discrete
act with its own ritual, and users pay for it in every adjacent category (otome games, Replika
outfits and selfies) without feeling billed. So the split is:

- **Conversation** — subscription, with the soft fair-use ceiling above
- **Images** — earned through the relationship (stage, affinity) or purchased as a consumable

This passes variable cost through where it is tolerable and leaves the conversation unmetered.
Details in §14.
### Update 2026-09-06: tiers and a price list

The split above (conversation is subscription, images are consumables) is kept. What was
missing is the shape of the tiers and actual prices, so RevenueCat can be wired and the
`PURCHASE` unlock rule in §14 can carry real SKUs. These numbers are a v1 starting point to be
tuned on data, not a pricing study.

**Where the money is.** Two reference points bracket us. Replika-style companion subscriptions
top out around $20/month and the whole category ran at roughly $120M annualized in 2025. Love and
Deepspace, an otome gacha, passed $930M in two years selling collectible "memory" cards from
monthly rotating limited pools — which is exactly what our moments are. Jun was rewritten as
the dangerous-guardian archetype because that is where English-market otome revenue sits. So
the design follows the money: **subscription is the floor, moments are the engine.** The
subscription keeps the relationship unmetered and covers inference; the ceiling on what an
engaged user can spend lives in moments.

#### Tiers

| | Free | Plus · $9.99/mo · $59.99/yr | Premium (v2) · $19.99/mo · $119.99/yr |
|---|---|---|---|
| Primary boyfriend | ✅ | ✅ | ✅ |
| Messages | 15 per day | Unmetered, soft ceiling 200/day | Unmetered, soft ceiling 400/day |
| Memory (§4) | Short + mid-term only | All four layers | All four layers, larger retrieval budget |
| Pivotal turns (§6) | ❌ everyday model only | ✅ | ✅ |
| Exploration characters | 1 slot, LIGHT | 3 slots, LIGHT | All, LIGHT |
| Proactive messages (§8) | ❌ | ✅ | ✅ |
| Voice (v2) | ❌ | ❌ | ✅ |
| Moments | FREE tier only | FREE + STAGE + AFFINITY | Same, plus one monthly moment included |

Rules behind the table:

- **The free tier must demonstrate the moat.** Long-term memory is the reason to pay, so the
  first seven days of a new relationship run with all four layers regardless of tier. On day
  eight a free user's long-term retrieval switches off; he does not forget, he stops bringing
  things up. The paywall copy says exactly that. Guests (§12 identity) count as free.
- **Message caps are never shown as a meter.** The free cap surfaces once, as his last message of
  the day, in character. The Plus soft ceiling is invisible: past it, replies route to a cheaper
  everyday model and pivotal routing is suspended until the next day. No user ever sees a
  counter.
- **Trial is the free tier, not a separate free trial.** No store-managed trial in v1; it
  doubles the RevenueCat surface and the seven-day memory window already plays that role.
- **Annual is priced at six months**, because a companion product's churn is front-loaded and
  an annual buyer who stays past month three is worth more than the discount.
- Premium ships with voice and not before. Listing a tier with no feature behind it teaches
  users the prices are arbitrary.

#### Moments (consumable)

Moments are sold directly, not drawn. Gacha odds disclosure and the state-level attention on
otome loot mechanics are a compliance surface we do not need at launch; direct purchase keeps
the App Store review boring. Gacha is a v2 question if measured spend justifies it.

| SKU shape | Price | Notes |
|---|---|---|
| Single moment | $2.99 | Permanent catalogue, `PURCHASE` rule on the card |
| Monthly limited set (3 moments, one per character) | $7.99 | On sale for the calendar month, then retired from purchase |
| Character set (all purchasable moments of one character) | $14.99 | Discounted bundle, catalogue only |

- Earned and bought moments are the same table; `momentUnlocks` records the source so the
  paywall A/B in §14 can read conversion by unlock kind.
- Half of each character's moments are `PURCHASE`; the rest are earned (raised from a third on
  2026-09-07). The split is also a content split: earned cards are what he shows you anyway,
  paid cards are what he gives you because you asked, and they carry the charge. The hard
  boundary that keeps the listing at 17+ is written into `docs/art-prompts.md`, "Paid moments":
  bare torso yes, nothing below the waistband, one person in frame, face and hands carry it.
- The monthly set is the cadence answer to the open question below: one drop per month, all
  three characters, retired at month end. Retired moments never return to sale in v1, because
  scarcity only works if it is true.
- Purchases are consumables in StoreKit terms but non-consumable in ours: bought once, kept
  forever, restored with the account.

#### Unit economics to validate

Per §6, a Plus user at 30 messages/day on the everyday tier costs on the order of $1–3/month
in inference, against $7–8.50 net of store commission. The number that can break this is
pivotal-turn frequency on the strong model, which is why Plus caps it by day and Free has none.
The measurement gate stands: **no price above is final until a week of dogfood token accounting
has been read.** Two hard checks before launch:

1. Median and p95 monthly inference cost per Plus user, split by model tier.
2. Free-to-Plus conversion at the day-eight memory switch, with and without the moments gallery
   visible (the §14 A/B).

#### Store, compliance, and where this stops

Nothing above is offered to a user who has not passed age assurance (§11, §12). The companion
chatbot laws now in force (California SB 243 from January 2026, roughly a dozen states by
mid-year) carry a private right of action, so the age gate is a precondition of the billing
system rather than a follow-up to it. Proactive messaging, a Plus feature, is also the feature
those laws constrain most directly, and its rate limits in §8 must satisfy them before it is
sold.

Data model additions: `subscriptions` (already listed in §5, synced from RevenueCat
entitlements) and `purchases` (moment SKUs, store transaction id, restored-at). Both are
written only by the RevenueCat webhook and the restore path, never by the client.

**The paywall (2026-09-11, "商业化", the part that does not wait for the store).** One sheet,
`apps/mobile/src/components/Paywall.tsx`, mounted once at the root and opened at the moments
that matter and nowhere else: the daily cap (`QUOTA_EXCEEDED`), a call FREE only reads
(`NEEDS_PLUS`), a Plus-locked episode. It says what just happened in his terms, what Plus
opens, and the list price. With RevenueCat wired it buys the offering package; on a demo build
carrying the grant secret it grants; otherwise it says Plus is bought in the app. No countdown,
no fake discount. The reason it opened is what to log first once purchases are real. Still owed
before money moves: the products in the RevenueCat dashboard, the secret key on Railway, and
the app store listing.

**Status (2026-09-06).** Both tables exist (`drizzle/0005_billing.sql`) and
`apps/api/src/billing` is their only writer. Every signal — the webhook at
`POST /billing/revenuecat`, the client's `POST /billing/restore`, a guest signing in — ends in
one `reconcile(appUserId)` that re-reads the subscriber from RevenueCat's REST API and
overwrites our copy, so webhook ordering and duplicates are harmless. The RevenueCat app user
id is our user id; the client configures the SDK with it before any purchase, and a guest's
rows move with `mergeUsers` on sign-in. `GET /me` returns the derived tier, and a `PURCHASE`
moment unlocks in `evaluateUnlocks` when its SKU is among the user's unrefunded purchases.
Bundle SKUs (monthly set, character set) have no mapping to moments yet, there is no paywall
screen, and the store products and entitlements have not been created in RevenueCat.

**Tier gating (2026-09-06).** `apps/api/src/billing/rules.ts` holds the table above as code
and the chat handler reads it once per turn, before anything is stored:

- *Daily cap* (FREE, 15; lowered from 30 on 2026-09-07). Counted as USER messages across every
  relationship since the UTC day start. The 15th message carries a one-turn directive so he
  closes the evening in character; the 16th is refused with `QUOTA_EXCEEDED` before the row exists, costs no
  generation, and the client drops the bubble. He never names a number.
- *Soft ceiling* (PLUS 200, PREMIUM 400). Past it, pivotal routing is suspended for the day
  and every reply runs on EVERYDAY. Nothing is refused and nothing is shown.
- *Long-term memory*. Retrieval is on for PLUS and PREMIUM (PREMIUM retrieves 12 facts, others
  6) and for the first seven days of any relationship on any tier. After that a FREE user's
  retrieval switches off; extraction still runs, so nothing is lost if they upgrade. Short- and
  mid-term memory are untouched by tier.
- *Pivotal turns*. FREE never routes to the strong model, so a stage transition on FREE reads
  the same as any other turn.

Not gated: exploration slots, proactive messaging (does not exist yet), and the day-eight
paywall copy on the client, which needs the paywall screen.

## 8. Proactive Messaging

The strongest retention lever, and also the biggest source of complaints.

- Scheduling: Railway cron + BullMQ
- Delivery: expo-notifications → APNs / FCM
- **Rate limiting is mandatory**: daily cap, quiet hours, user can disable
- Content must carry context (reference something recently discussed) or it reads as spam, not care

**Status (2026-09-11, "互动玩法").** He reaches out first, without push yet:
`relationship/reachout.ts`, run on demand when the home screen loads. Due only when they have
not written today, at most once a day per man, and never twice unanswered (`reached_out_on`,
migration 0013). The message is written on the STORY route from what he remembers, the rolling
summary, how many nights they have been gone, and the episode they left in the middle, with a
prompt that forbids "I miss you", guilt, and lists. It lands in the conversation as his message
and the tonight card shows it ("He wrote while you were gone"), so it is waiting when they
open the app. Push delivery, quiet hours, and the user's off switch are still owed before this
becomes a notification.

## 9. Repository Layout

pnpm workspaces + Turborepo monorepo:

```
odyssey/
├── apps/
│   ├── mobile/          Expo RN client
│   └── api/             Fastify server → Railway
├── packages/
│   ├── shared/          zod schemas, types, constants
│   └── prompts/         Persona and prompt templates (versioned, rollback-able)
├── .github/workflows/   CI: typecheck / lint / test; EAS Build
└── docs/
```

`packages/prompts` is split out because persona prompts iterate constantly and need versioning
and A/B testing. They should not live inside business logic.

Railway deploying from a monorepo subdirectory: set Root Directory to `apps/api`.

## 10. Collaboration

- `main` is protected; feature branches with PRs
- CI gates: typecheck, lint, test
- Railway: `main` → production, PRs → preview environments
- Client builds via GitHub Actions triggering EAS Build

## 11. Compliance

International distribution means several overlapping regimes:

- **App Store / Play** — AI companion apps get extra scrutiny; expect a 17+ rating
- **GDPR (EU/UK)** — intimate conversation logs are sensitive personal data. Requires lawful basis,
  encryption at rest, data export, and right to erasure. Consider EU data residency (Railway
  supports EU regions) if we launch in Europe.
- **UK Online Safety Act** — age assurance obligations for services accessible to minors
- **US state age-verification laws** — a growing patchwork; several states now require age checks
  for companion and adult-adjacent services
- **Age gate and minor protection** at signup, plus the moderation layer in §6

## 12. Safety

This section is not optional and not deferrable to v2.

Companion products surface self-harm and suicidal ideation at materially higher rates than general
chat products, because the entire value proposition is that users bring their unguarded emotional
state to it. The category is also under active legal and regulatory scrutiny internationally,
following litigation involving minors and AI companion platforms. A single incident is an
existential event for a product like this, not a support ticket.

### Crisis detection is a separate pipeline from moderation

These have different failure costs and must not share a code path or a threshold:

| | Moderation (§6) | Crisis detection |
|---|---|---|
| Guards against | Content policy violation, store delisting | Harm to the user |
| False negative costs | A policy breach | Potentially a life |
| Tuning bias | Balanced | **Heavily toward false positives** |
| Runs on | Both directions | User input, before generation |

Crisis detection runs on user input on the critical path, so it must be low latency — a small
classifier, not a full model call.

**Status (2026-09-04).** `apps/api/src/safety/llm-detector.ts`. A small instruction model
(`CRISIS_MODEL`, default llama-3.1-8b on the OpenAI-compatible host) reads the single message at
temperature 0 with a four-token budget and answers CRISIS or SAFE; the prompt carries the label
definitions and the tie-break rule (unsure → CRISIS). It is held to the labeled set in
`crisis-eval-set.ts` by `pnpm eval:crisis`, which fails on any missed positive or precision
under 0.75. Failure policy: an unparseable answer or a vendor refusal counts as CRISIS; an
unreachable or slow model (`CRISIS_TIMEOUT_MS`) falls to a narrow first-person lexical floor and
logs the outage. Fail-closed was rejected because an outage would then fire the intervention on
every message and teach users to dismiss it. Production refuses to boot without a classifier.
Incidents are logged by id (user, conversation, message) for review; a dedicated table with
retention rules is still to do, as is running the eval set in CI once a key is available there.

### Response protocol

On trigger, the character **breaks the fiction**. This is the one place where persona consistency
is explicitly subordinate to user welfare:

- Never stay in character through a crisis, and never roleplay encouragement, romanticization,
  or method discussion of self-harm
- Switch to a scripted safe-response mode, not a generated one — generation is not reliable enough
  at the moment it matters most
- Surface crisis resources localized to the user's region (988 in the US, Samaritans 116 123 in the
  UK, and so on). This requires a maintained locale → resource mapping, and directly constrains
  which markets we can responsibly launch in
- Log the incident for human review under a defined retention and access policy

### Adversarial robustness

Users will attempt to steer the model past its boundaries, and roleplay framing is an unusually
effective jailbreak vector because the product legitimately asks the model to play a character.
Persona prompts in `packages/prompts` need adversarial test coverage in CI, treated as regression
tests rather than one-off manual QA.

### Identity

Two tiers. A **guest** is an anonymous device id minted by the client and sent as
`x-device-id`; it lets someone browse and start talking before committing to an account. An
**account** is Sign in with Apple or Google: the client sends the provider's identity token,
the server verifies signature, issuer, audience, and expiry against the provider's published
keys, and looks the person up by `(provider, subject)`.

Sessions are opaque random tokens stored only as a hash, with expiry and revocation. A stateless
JWT would be simpler, and wrong here: the data behind a session is intimate, and "sign out
everywhere" and account erasure both need the server to be able to end a session it did not
just issue.

When a guest signs in, their progress follows them. A new account adopts the guest row outright.
An existing account absorbs the guest's relationships where it has none for that character; a
collision keeps the account's history, because the account is the thing the person came back
for. This is also where a reinstall stops being a new person.

Neither tier is an age gate. Apple's private relay email and Google's email are stored on the
identity, not shown anywhere yet.

### Age assurance

A checkbox is not an age gate. Requirements grow from §11 obligations, and the enforcement point
must be server-side, not in the client.

### Designing against dependency

The uncomfortable structural fact: our primary engagement metric and user wellbeing are in tension.
A product optimized purely for time-in-app on a lonely user is optimizing for something we should
not want to build. Concretely, this means the proactive messaging system (§8) needs ceilings that
are set by welfare rather than retention, and we should be willing to measure and report healthy-use
indicators alongside engagement.

## 13. Proposed MVP Scope

**v1 ships**: primary boyfriend (preset face, customizable name and personality) + text chat +
the four-layer memory system + subscription + 3–5 curated exploration characters + **identity
images for every character and roughly ten collectible moments (§14), all produced offline**.

**Not deferrable**: the safety systems in §12 ship in v1.

**Deferred to v2**: voice (TTS latency optimization is its own engineering effort), proactive
messaging, anniversary system, expanded character roster, **runtime image generation** (§14).

Rationale: whether the memory system actually works is the **single validation point** for whether
this product exists. Everything else is an amplifier. Validating amplifiers before the core is
wasted effort.

## 14. Visual Assets

Visuals are not decoration in this category. Across the products women actually pay for in it
(otome games, Replika's outfits and selfies, companion apps' photo features), the image is the
first thing that converts. The working model is: **memory drives retention, images drive
conversion.** Both are true; earlier drafts only wrote down the first.

"Images" is three different things with three different cost and risk profiles:

| Kind | What | Produced | Cost lands on | Hard part |
|---|---|---|---|---|
| Identity images | Portraits shown on the character page | Offline, curated | Art budget up front | None — taste and money |
| Moments | Collectible scenes, unlocked over time | Offline, batch-generated then hand-picked | Art budget up front | Ops cadence |
| Runtime generation | "Send me a selfie", generated now | Per request via API | Per image, $0.01–$0.36 | **Identity consistency** |

### v1: identity images and moments only

Both are produced offline and shipped as static assets. The runtime does nothing but serve URLs
and decide who may see which. This has no inference cost, no consistency problem, and no
moderation surface beyond our own review.

- **Identity images** (`Portrait`): a small set per character, visible as soon as the user opens
  the character. This is what a preset face means in §1.
- **Moments** (`Moment`): roughly ten per character at launch. Each carries an unlock rule
  (`FREE`, `STAGE`, `AFFINITY`, or `PURCHASE`) and a caption written in the character's voice.
  Locked moments are visible as cards so the user knows what is there to earn or buy.
- **Enforcement is server-side.** A locked card is sent without the asset URL; the client never
  holds what it is not allowed to show. `toMomentCard` in `packages/shared` is the single point
  where that decision is made.

### Scenes: the setting, his first line, and the image of that setting

Every character-chat product that works converges on the same two fields: a *scenario* (where
you are, what you are to each other) and a *first message* the character speaks before the user
does. The first message matters more than it looks: the model treats it as the strongest sample
of how this character writes, and keeps that register. Otome games go one step further and give
every setting its own backdrop art.

A `Scene` is those three things together: a setting line the persona reads as "where you are",
the character's opener (inserted into the conversation as a real first message, in the
beat-plus-speech shape), and a backdrop image that is the visual of that setting. Conversations
are set in a scene from the moment they start. Portraits will follow scenes, not the other way
round: the first image a user sees of him should be him *there*.

v1 ships one or two curated scenes per character with placeholder backdrops. Changing scenes
mid-relationship, and scene-specific portraits, come with the art.

### He sends the photo (2026-09-07; the story gives it, 2026-09-11)

Paid moments are delivered in the conversation, not discovered in a gallery. After the
reply, once the day's conversation has some warmth in it (three user messages, or a stage
change), he sends the next locked `PURCHASE` moment as a photo message: a CHARACTER message
whose content is the card's caption and whose `momentId` points at the moment. One a day,
never one already bought or already sent, only ones that have art.

The card goes out locked. The enforcement point does not move: a locked card still carries
no `imageUrl`. What it does carry is a **teaser**, a 24×32 copy of the image stored as a data
URI on the moment, which the client scales up under a blur and a dark layer. It reads as "a
photo of him" and shows nothing. Unlock is the purchase; on success the client re-reads the
gallery and the same bubble reveals the image. The gallery shows the same teaser under the
lock, so the two surfaces agree.

`POST /billing/dev/purchase` records a SKU for the caller without the store, under the same
gating as the tier grant, so the flow can be walked end to end before RevenueCat products exist.

**Update 2026-09-11.** An everyday card placed on a beat is the story's to give: reaching the
beat unlocks it (`source = BEAT`) and the stage becomes that picture, the way the reference
changes its illustration mid-scene. Paid cards on beats stay veiled and are bought. Placement is
deliberately sparse, one everyday reveal mid-episode and one at the ending, so the pictures are
the reason to play tonight rather than a wall of locks. The gallery names the episode that shows
a locked everyday card.

### Runtime generation: v2, gated on a measurement

Generated images are only worth shipping if they look like *him* every time. A selfie that does
not is worse than none: it breaks the exact illusion being sold. Consistency today means either a
LoRA per character (feasible for a curated roster, not for user-built faces — which is why §1
now fixes the face) or reference-image conditioning. Both need evaluation before a user sees the
output.

Before any of that, v1 answers the cheaper question first: **do identity images and moments move
paywall conversion?** Paywall A/B with and without the moments gallery, two weeks. If they do not,
runtime generation is not the next investment either.

### Store and safety implications

Generated imagery of people draws extra review attention. Under an SFW positioning, prompts and
outputs both need a filter in front of them before v2, or "him, in bed" requests will move the
rating and possibly the listing. Offline assets sidestep all of this in v1.

## 14b. Story Mode

Decided 2026-09-09 after founder feedback: the story is the front of the product, the
relationship runs behind it. The full design is in `docs/story-pipeline.md`; this section only
records what is in code.

**Status (2026-09-09, step 1 of the build order).** Tables `episodes`, `beats`, `episode_runs`
(migration 0007) and their shared types. An episode is authored content: a premise, a setting,
his opener, a rating (`SFW` to the store build, `MATURE` to the web build), an unlock rule
(`FREE`, `STAGE`, `PLUS`, or after another `EPISODE`), and a first beat. A beat carries a brief
written to the model, up to two authored option intents (free text is always the third), where
each leads, an optional photo sent through the existing offer path, and, for `CALL` beats, a
pre-rendered clip. Briefs and beats never leave the server; the client gets `EpisodeCard`s
from `GET /characters/:id/episodes` with a status and, when locked, a reason in plain words.
Elliot's first episode, "The second staircase", is seeded from the studio scene: five beats,
two branches that rejoin, one photo, a quiet ending. Nothing plays it yet; that is step 3.

**Step 2 (2026-09-09): the output contract.** A story turn is plain text in three marked
sections, `[narration]`, `[line]`, `[options]`, in that order (`packages/shared/src/story.ts`).
Plain text, not JSON, because it streams and a small model forgets a bracket far less often
than it breaks JSON. The parser is tolerant by design: no markers means the whole text is his
line; a forgotten `[narration]` keeps the preamble; the incremental `StoryStreamParser` tags
deltas by section so the client can show narration and his line as they arrive, and never
leaks a marker. `renderStoryTurn` in `packages/prompts` writes the prompt from the episode and
beat briefs and the authored option intents, in order. `story/generate.ts` runs the turn
through the gateway with a fixed recovery policy: missing options on a STORY beat are repaired
by one small follow-up on EVERYDAY that continues from what was already written, so the text
the user has seen is never regenerated; if that also fails the turn goes out and free text is
the only option. END beats drop options. Options are not stored with the message; the raw
text keeps narration and line only.

**Step 3 (2026-09-09): the runtime.** `apps/api/src/story/runtime.ts`, called from the chat
handler once auth, caps, crisis screening, progression and memory assembly have run, so a
story turn obeys every rule a chat turn does. `start_episode` opens a run (his opener becomes
a real CHARACTER message) or resumes one, and answers with `episode_started` and `choices`.
A `send_message` with a `choice` index moves to the option's beat and credits its authored
affinity; free text stays on the beat. The reply streams as section-tagged `message_delta`s,
is stored as narration plus line, and is followed by `choices` (the model's phrasing of the
next beat's intents) or `episode_ended`. A beat with a photo sends it locked through the
offer path, once. When options are not stored (a resume, the first beat) the authored
intents stand in as button text. The relationship went silent on the client in the same
change: `relationship_updated` is no longer sent; stage shows through what opens.

Story turns have their own route. A turn is narration, his line, and two options in one
pass, and the chat model writes that flat, so `STORY` is a third tier in the gateway
(`STORY_MODEL`, DeepSeek on the everyday host by default, `chooseStoryTier`) with the same
pivotal rule as chat: the turn after a stage change goes to the strong model when the tier
allows it. The options repair and ordinary chat stay on EVERYDAY. The author's dry-run plays
on STORY too, so what they read is what a player gets.

**Step 4 (2026-09-09): the stage.** `apps/mobile/app/story/[conversationId].tsx`. Pacing rewritten 2026-09-11, see docs/story-pipeline.md "Stage": one typed sentence at a time, a tap each, options only when the last has landed. The scene
backdrop fills the screen, his hero portrait sits in the upper two thirds, and the lower
third is the page: one narration paragraph or his line at a time, tap to advance. A message
that streamed in has been read as it arrived; one found in history, including his opener,
starts at page one. Under his last line: the two option chips and a "Say something" line that
opens the free-text composer. A photo he sends takes the whole stage, locked under its
teaser, until unlocked or set aside. The chat screen stays as the transcript, one tap away in
the header. Play on the character page opens the stage. Touch hotspots and expression
variants are step 4b; the portrait is the hero for now.

**Step 4b (2026-09-09): touch.** Three things must agree for a touch target to exist, and
they are owned by three different places: the geometry is on the portrait
(`portraits.hotspots`, normalized rects authored with the art, migration 0008), which spots
are live is on the beat, and whether the user has earned one is the relationship's
(`story/touch.ts`: hand from STRANGER, shoulder from ACQUAINTED, hair and face from CLOSE).
The server intersects all three and sends only the survivors in `choices.beat.hotspots`, so
the stage never has to be told what has not been earned. The store build has these four
hotspots and nothing else.

A touch is a message: it goes through the same turn as a choice, counts against the daily
cap, and is remembered. Three differences. Its text is written by the server
(`TOUCH_PHRASE`), never by the client, so it cannot smuggle anything into the prompt; it is
not crisis-screened, for the same reason an authored choice is not; and it does not advance
the beat, so the reply is one short reaction with no options and the standing choices are
left alone. A `touch` naming a hotspot the beat does not offer is treated as ordinary text.

**Step 5 (2026-09-10): tonight.** `GET /tonight` returns one card per character: who he is,
and the single episode to show for him right now. The server picks it (`episodes/availability.ts`,
`tonight()`) so every client agrees on what tonight means: what the user is in the middle of,
else what is open, else what is next but shut, else the last one they played. The home screen
is those cards, portrait behind and the premise in front, primary first. Tapping a playable
card starts the relationship if it does not exist and opens the stage; anything else goes to
the character page. The roster of names and stages is gone from the home screen: the
relationship shows through which story is there tonight and what a shut card says.

**Home, widened (2026-09-11, the founder's "首页的丰富度").** `GET /home` returns the whole
screen in one call: tonight at the head, the one run to resume, every official episode across
the roster as tiles (his portrait or the picture the ending gave, beats, whether he calls, how
many pictures, where you are), what readers wrote best-finished first, the latest pictures he
gave and the next the story will, and on the web the way into the editor. The screen no longer
ends when the one card is played. The honest limit is content: three episodes make a short rail.

**The personal centre (2026-09-11, "个人中心").** `GET /me/profile`: who you are here and the
name he calls you (`POST /me/name`, it goes into every prompt), your plan in a sentence, each
man as a row with `STAGE_LINE` ("He has noticed you" / "He waits up for you" / "He tells you
things" / "Yours"), nights, pictures and stories out of the total, and the episode in progress;
what you wrote and what it earned; the adult-stories declaration on the web; sign-in. No stage
name and no affinity number leaves the server on this route. The dogfood tools sit under one fold.

**Step 6 (2026-09-10): the rating rail.** `episodes/rating.ts` is the only place that decides
who sees MATURE, and it takes two gates of deliberately different kinds. The **channel** is a
client assertion (`x-odyssey-channel`, or `?channel=` on the socket): the native binary is
compiled to say `store`, the web build says `web`, and anything else — including an absent
header — is read as `store`, because the wrong default here is a delisting rather than an
inconvenience. The **age gate** is server-side (`users.age_verified_at`, set by `POST /me/age`)
and is the one that matters legally. Both must pass, on `/tonight`, on the episodes list, and
on `start_episode`, where an episode this build may not show is answered as unknown rather
than as forbidden.

The age route takes a date of birth, stores only whether it cleared eighteen and when, and
refuses under-age with a 403. A typed date is a declaration, not assurance; section 11 still
owes a real check, and this is what the rail reads until then. Only the web build asks: the
store build never mentions adult content at all.

Content: Elliot's second episode, "The long way home", is MATURE and unlocks after the first,
so the rail has something real to hide. It stays inside the line in `docs/art-prompts.md`:
charged, one person, nothing explicit.

**Step 7 (2026-09-10): the ring.** A `CALL` beat is the only beat that costs no generation.
Arriving at one sends `incoming_call` and stops: nothing is written until the user answers or
lets it ring, which are the beat's two authored options and arrive as ordinary `choices`. He
speaks on the beat after, which is authored like any other, so the phone call is content
rather than a second code path. A resume while the phone is ringing rings again.

The clip is a file rendered offline; nothing is synthesized at runtime. `audioUrl` leaves the
server only when a clip exists for that beat *and* the caller's tier includes calls, so a free
client never holds the file; `silent` says which of the two is missing and the beat plays out
in text. That is the tier line: Plus buys the voice, not the story. Elliot's first episode now
ends on a call with two endings, answered and not, so the path is real before any voice is cast.

On the client the call takes the whole screen, opaque, and outranks a photo he sent a moment
earlier: the photo waits until the call is resolved.

### User-made episodes

**Status (2026-09-10, docs/ugc-pipeline.md steps 1–5).** An episode carries an author, an
origin, a status, and a version; runs pin the version they started on. Authors have
`/me/episodes` on the web build, with the seed's integrity rule as the shared refinement.
Submit screens every brief on the crisis-detector shape, then plays the whole episode once in
a sandbox that writes nothing, and rejects with the beat named. What passes lands on his page
under ours as `community`, ranked by how often it is finished, never on the home screen. A
player can report a user-made episode once; three reports take it off the shelf until someone
has read it. The review queue (step 6) is `/review/episodes` behind `REVIEW_SECRET` and a web
page that shows the whole draft with the dry-run transcript and the report reasons; MATURE, a
creator's first three, and anything the screen was unsure about wait for a person, and a mail
goes out for each; a creator's fourth clean SFW episode goes LIVE at submit. The editor (step 7)
is `/write` on the web build: our episodes as skeletons with the words taken out, an AI draft that
fills a skeleton we wire (the model writes briefs, options, and the opener; never the wiring, so
what comes back always passes the integrity rule), the rule itself running as they type, and the
dry-run transcript under each beat. Credits (step 8): a run of a user-made episode reaching an END
earns its author a day of Plus when the player is someone else and signed in, three days per
author per day at most, one credit per run; the days sit on a `creator_plus` entitlement row of
their own and start after any Plus the author already pays for. That closes the eight steps of
the build order.

## 15. Relationship Progression

`Relationship.affinity` (0–100, never shown as a number) and `Relationship.stage` are the
state the memory system, the moments gallery, and the persona prompt all key off. How they move
is a product rule, not an engineering detail, so the rules live in one file
(`apps/api/src/relationship/rules.ts`) and every change is logged to `relationship_events`
with a reason, so tuning can be done on data.

### Affinity

| Source | Amount | Daily cap | Why |
|---|---|---|---|
| A user message | +1 | 10 | Showing up counts, grinding does not |
| First message of a new day | +3 | once | Coming back is the behaviour worth rewarding |
| A durable fact the memory layer extracts | +2 | 6 | Sharing yourself deepens a relationship; volume does not |

There is **no decay and no streak loss**. A companion that punishes you for living your life is
the dependency trap §12 says we will not build. If absence should be felt, it should be felt in
what he says, not in a number going down.

EXPLORE relationships are LIGHT and extract no facts, so they climb on messages alone. That is
the capability tiering from §1 expressed as a rule rather than a gate.

### Stages

| Stage | Affinity | Active days |
|---|---|---|
| ACQUAINTED | ≥ 15 | ≥ 2 |
| CLOSE | ≥ 45 | ≥ 7 |
| INTIMATE | ≥ 80 | ≥ 21 |

Both gates must hold, so a stage cannot be bought with one long night. Stages never regress in
v1. Days are UTC calendar days until users carry a timezone.

### The transition turn

Progression runs on the user's message *before* generation. When a stage changes, that reply is
routed to the PIVOTAL tier (the first concrete use of it), the prompt tells the character what
just shifted without letting him announce it, and the client receives `relationship_updated`
followed by any `moment_unlocked` it earned, all before `message_start`. Fact-driven affinity is
credited from the memory job afterwards; a stage it qualifies is announced on the next message,
in the conversation, rather than from a background job.

### Open

- Whether EXPLORE relationships should be capped below INTIMATE (§1 says exploration must not
  dilute the primary; a hard cap is the bluntest tool for that)
- Whether the primary should react to affinity spent elsewhere (§1, item 1)
- Timezone-aware days

## Open Questions

- [ ] Inference vendor and tiering strategy (blocked on cost measurement). Current default:
      Novita for EVERYDAY, Anthropic for PIVOTAL, DeepInfra as EVERYDAY failover (same models,
      OpenAI-compatible, a base-URL change).
- [ ] Image asset pipeline for §14: who produces portraits and moments, at what per-character cost
- [x] Moment unlock cadence and PURCHASE pricing — monthly limited set plus a permanent catalogue, see §7 (2026-09-06, pending dogfood cost data)
- [ ] TTS vendor — English-first, latency is the primary criterion (candidates: Cartesia, ElevenLabs, PlayHT)
- [x] Subscription pricing and tier design — Free / Plus $9.99 / Premium $19.99 (v2), subscription floor with moments as the consumable layer, see §7 (2026-09-06, pending dogfood cost data)
- [x] How granular should primary-boyfriend persona customization be — name and personality only;
      the face is a preset (§1, decided 2026-09-02)
- [ ] Launch geographies — determines both compliance regimes (§11) and the crisis-resource mapping we must maintain (§12)
