# odyssey — Technical Architecture

> Status: Draft v0.2 · Pending review
> Last updated: 2026-08-31

## 1. Product Definition

An AI boyfriend companion app. **Hybrid model**: one dedicated primary boyfriend as the anchor
relationship, plus additional characters available for exploration.

Content rating **SFW**. Target distribution: App Store and Google Play.
Market: **English-speaking, international** (no China distribution).

### Competitive Landscape

| | Replika | Character.AI | SpicyChat | odyssey |
|---|---|---|---|---|
| Shape | Dedicated companion | Character platform at scale | UGC character board | Primary companion + curated exploration |
| Moat | Memory depth, persona consistency | Content volume, discovery | Content supply | Memory depth, with exploration for retention |
| Rating | Largely SFW | SFW | NSFW | SFW |
| Distribution | App stores | App stores + web | Web only | App stores |

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

## 7. Proactive Messaging

The strongest retention lever, and also the biggest source of complaints.

- Scheduling: Railway cron + BullMQ
- Delivery: expo-notifications → APNs / FCM
- **Rate limiting is mandatory**: daily cap, quiet hours, user can disable
- Content must carry context (reference something recently discussed) or it reads as spam, not care

## 8. Repository Layout

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

## 9. Collaboration

- `main` is protected; feature branches with PRs
- CI gates: typecheck, lint, test
- Railway: `main` → production, PRs → preview environments
- Client builds via GitHub Actions triggering EAS Build

## 10. Compliance

International distribution means several overlapping regimes:

- **App Store / Play** — AI companion apps get extra scrutiny; expect a 17+ rating
- **GDPR (EU/UK)** — intimate conversation logs are sensitive personal data. Requires lawful basis,
  encryption at rest, data export, and right to erasure. Consider EU data residency (Railway
  supports EU regions) if we launch in Europe.
- **UK Online Safety Act** — age assurance obligations for services accessible to minors
- **US state age-verification laws** — a growing patchwork; several states now require age checks
  for companion and adult-adjacent services
- **Age gate and minor protection** at signup, plus the moderation layer in §6

## 11. Proposed MVP Scope

**v1 ships**: primary boyfriend (customizable appearance, personality, name) + text chat +
the four-layer memory system + subscription + 3–5 curated exploration characters.

**Deferred to v2**: voice (TTS latency optimization is its own engineering effort), proactive
messaging, anniversary system, expanded character roster.

Rationale: whether the memory system actually works is the **single validation point** for whether
this product exists. Everything else is an amplifier. Validating amplifiers before the core is
wasted effort.

## Open Questions

- [ ] Inference vendor and tiering strategy (blocked on cost measurement)
- [ ] TTS vendor — English-first, latency is the primary criterion (candidates: Cartesia, ElevenLabs, PlayHT)
- [ ] Subscription pricing and tier design
- [ ] How granular should primary-boyfriend persona customization be
- [ ] Launch geographies — determines which compliance regimes apply on day one
