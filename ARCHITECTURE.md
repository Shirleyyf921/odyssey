# odyssey — Technical Architecture

> Status: Draft v0.2 · Pending review
> Last updated: 2026-08-31

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
3. **Curated characters only, no UGC at launch.** UGC means moderation cost plus a cold-start
   supply problem — a separate business entirely.

## 2. Stack

| Layer | Choice | Rationale |
|---|---|---|
| Client | Expo (SDK 54+) + EAS Build | Config plugins now cover native modules; skips the entire native build setup. OTA updates let us ship prompt and copy changes without review |
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

## 5. Data Model (draft)

```
users              account, age gate, preferences, locale
characters         kind(PRIMARY|EXPLORE), persona_template, voice_id
relationships      user × character, depth, stage, affinity, anniversaries
conversations      conversation container
messages           role, content, client_msg_id, token usage
memories           user × character, fact text, embedding(pgvector), confidence
subscriptions      synced from RevenueCat
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

## 8. Proactive Messaging

The strongest retention lever, and also the biggest source of complaints.

- Scheduling: Railway cron + BullMQ
- Delivery: expo-notifications → APNs / FCM
- **Rate limiting is mandatory**: daily cap, quiet hours, user can disable
- Content must carry context (reference something recently discussed) or it reads as spam, not care

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

**v1 ships**: primary boyfriend (customizable appearance, personality, name) + text chat +
the four-layer memory system + subscription + 3–5 curated exploration characters.

**Not deferrable**: the safety systems in §12 ship in v1.

**Deferred to v2**: voice (TTS latency optimization is its own engineering effort), proactive
messaging, anniversary system, expanded character roster.

Rationale: whether the memory system actually works is the **single validation point** for whether
this product exists. Everything else is an amplifier. Validating amplifiers before the core is
wasted effort.

## Open Questions

- [ ] Inference vendor and tiering strategy (blocked on cost measurement)
- [ ] TTS vendor — English-first, latency is the primary criterion (candidates: Cartesia, ElevenLabs, PlayHT)
- [ ] Subscription pricing and tier design — flat vs. metered, see §7
- [ ] How granular should primary-boyfriend persona customization be
- [ ] Launch geographies — determines both compliance regimes (§11) and the crisis-resource mapping we must maintain (§12)
