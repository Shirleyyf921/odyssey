# odyssey

An AI boyfriend companion app. One dedicated primary relationship, plus curated characters to explore.

## Status

🚧 Framework stage. Roster, character page, chat, and moments run end to end from the Expo
client through the API to Postgres, with mid-term and long-term memory behind the reply. Character
art is placeholder until the assets arrive; crisis detection is a contract without a classifier.
See [ARCHITECTURE.md](./ARCHITECTURE.md).

## Stack

| Layer | Choice |
|---|---|
| Client | React Native (Expo SDK 52) + EAS Build |
| Server | TypeScript + Fastify |
| Hosting | Railway |
| Database | Postgres + pgvector · Redis |
| Inference | External LLM APIs behind an internal gateway (Novita for everyday chat, Anthropic for pivotal turns) |
| Billing | RevenueCat (in-app purchase) |

## Positioning

- **Market** — English-speaking, international
- **Content rating** — SFW, targeting App Store and Google Play
- **Moat** — memory depth and persona consistency
- **Reference points** — [Replika](https://replika.com), [Character.AI](https://character.ai), [SpicyChat](https://spicychat.ai), [Tipsy Chat](https://tipsy.chat)

## Repository Layout

Planned monorepo structure (pnpm workspaces + Turborepo):

```
odyssey/
├── apps/mobile/        Expo RN client
├── apps/api/           Fastify server → Railway
├── packages/shared/    zod schemas, types
├── packages/prompts/   Persona and prompt templates (versioned)
└── docs/
```

## Getting Started

```bash
pnpm install
pnpm dev          # all apps
pnpm typecheck    # all packages
```

The API serves `/health` and `ws://localhost:3000/ws/chat` on port 3000.

Without `DATABASE_URL` the API runs on an in-memory store and logs a demo `conversationId` at
boot; without LLM keys replies are scripted. Copy `apps/api/.env.example` to `apps/api/.env`
to configure Postgres, Novita, and Anthropic.

```bash
pnpm --filter @odyssey/api db:generate   # after editing src/db/schema.ts
pnpm --filter @odyssey/api db:migrate    # apply migrations to DATABASE_URL
pnpm --filter @odyssey/api db:seed       # upsert the launch roster (idempotent)
```

The Postgres instance needs the `vector` extension (Railway's pgvector image has it).

### Connecting the models

Without keys the API answers with scripted text. To talk to real models:

1. Copy `apps/api/.env.example` to `apps/api/.env`.
2. Get a Novita key at https://novita.ai (Key Management in the console) and put it in
   `NOVITA_API_KEY`. This runs everyday chat and embeddings.
3. Get an Anthropic key at https://console.anthropic.com and put it in `ANTHROPIC_API_KEY`.
   This runs pivotal turns and, by default, memory extraction.
   Story turns run on `STORY_MODEL` (DeepSeek on the Novita host by default, so the Novita key
   is enough); set `STORY_BASE_URL` and `STORY_API_KEY` to point it at DeepSeek's own endpoint.
4. Check everything before starting the app:

   ```bash
   pnpm --filter @odyssey/api check:llm
   ```

   It sends one turn through each configured provider and one embedding call, and prints the
   reply, latency, and token counts. A wrong key, model id, or base URL fails here in plain
   words.

To try another everyday model, list what the host serves and set `NOVITA_MODEL` in `.env`:

```bash
pnpm --filter @odyssey/api list:models          # everything
pnpm --filter @odyssey/api list:models qwen     # substring filter
NOVITA_MODEL=deepseek/deepseek-v4-flash pnpm --filter @odyssey/api check:llm   # try one without editing .env
```

Either key alone works: the other tier falls back to whichever provider exists. Crisis screening
(`CRISIS_MODEL`, a small model on the Novita host) needs the Novita key and is mandatory in
production; `pnpm --filter @odyssey/api eval:crisis` scores it against the labeled set. `.env` is
gitignored; never commit it. On Railway, set the same variables in the service settings.

### The web build on the API

`pnpm --filter mobile export:web` writes the web app to `apps/mobile/dist`; the API serves it
from its own origin when that directory exists (`WEB_DIST`, default `../mobile/dist`), so the
browser needs no CORS and the client no configured API URL. The Railway build runs the export,
which is how the demo at the API's URL exists. A build that carries
`EXPO_PUBLIC_BILLING_GRANT_SECRET` shows the dogfood grant button on the account page; keep that
to demo builds and rotate the secret after.

The review queue for user-made episodes (`/review`, web build) is open in development and
needs `REVIEW_SECRET` on the server and `EXPO_PUBLIC_REVIEW_SECRET` in the reviewer's web build
in production. `RESEND_API_KEY` plus `REVIEW_NOTIFY_EMAIL` turn the "something is waiting"
log line into a mail.

### Running the client

```bash
pnpm --filter @odyssey/api dev                                   # terminal 1
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000 pnpm --filter @odyssey/mobile dev   # terminal 2
```

A phone cannot reach `localhost` on your laptop, so point `EXPO_PUBLIC_API_URL` at the LAN
address. For a quick look without a phone, `pnpm --filter @odyssey/mobile web` opens the same
screens in a browser at http://localhost:8081 (preview only: web storage is not secure and
Apple sign-in is unavailable there). The client mints a device id on first launch and sends it as `x-device-id`, which
makes it a guest. Signing in (Apple on iOS, Google anywhere, or the `dev` provider outside
production) returns a bearer token the client keeps in the secure store; a guest's progress
follows them into the account.

Google sign-in needs `EXPO_PUBLIC_GOOGLE_{IOS,ANDROID,WEB}_CLIENT_ID` on the client and the same
ids in `GOOGLE_CLIENT_IDS` on the API. Apple needs nothing beyond the bundle id.

### HTTP API

All routes except `/health` and `/auth/sign-in` require either `Authorization: Bearer <token>`
or `x-device-id: <uuid>`. The token wins; an expired token is a 401 rather than a guest.

| Route | Purpose |
|---|---|
| `POST /auth/sign-in` | `{provider, identityToken, fullName?}` → session token; merges the device's guest |
| `POST /auth/sign-out` | Revokes the bearer token |
| `GET /me` | Who the caller is and how they signed in |
| `GET /characters` | Roster with the caller's relationship on each |
| `GET /characters/:id` | Portraits, relationship, moment count |
| `POST /characters/:id/start` | Idempotent; creates the relationship and its conversation |
| `GET /characters/:id/moments` | Cards; locked ones carry no asset URL. A PURCHASE card unlocks once its SKU is among the caller's purchases |
| `POST /me/age` | Age declaration: `{bornOn}`; 403 under eighteen. Gates MATURE episodes |
| `GET /tonight` | Home screen: one card per character with the single episode to show for him now |
| `GET /characters/:id/episodes` | Story cards with the caller's status on each (available, in progress, done, or locked with a reason). Briefs and beats never leave the server |
| `POST /billing/restore` | Server re-reads the caller from RevenueCat and returns `billing` (tier, expiry, purchased SKUs) |
| `POST /billing/revenuecat` | Public RevenueCat webhook, authenticated by `REVENUECAT_WEBHOOK_SECRET` in the Authorization header |
| `POST /billing/dev/purchase` | Dogfood: `{sku}` records a one-time purchase for the caller, same gating as grant |
| `POST /billing/dev/grant` | Dogfood: `{tier, days?}` grants the caller a tier as a PROMOTIONAL row. Open outside production; in production only with `BILLING_GRANT_SECRET` set and sent as `x-grant-secret` |
| `ws://…/ws/chat?token=…` or `?deviceId=…` | Chat and story mode (`start_episode`, `send_message` with `choice`, `choices`, `episode_started`, `episode_ended`), see `packages/shared/src/protocol.ts` |

Every request carries `x-odyssey-channel: store | web` (the socket uses `?channel=`). The
native build is compiled to say `store` and never receives MATURE episodes; an absent or
unknown value is read as `store`. MATURE also needs the age gate above. See
`apps/api/src/episodes/rating.ts`.

`GET /me` also carries `billing`. Every paid-state write goes through one reconcile path that
re-reads the subscriber from RevenueCat; webhook payloads are only a nudge to re-read, so
duplicate or out-of-order deliveries cannot corrupt the tables.

### Billing

RevenueCat wraps StoreKit and Play Billing. Set the server side first:

```bash
REVENUECAT_SECRET_KEY=sk_...          # RevenueCat → API keys → secret key (v1)
REVENUECAT_WEBHOOK_SECRET=<random>    # the same value goes in the webhook's Authorization header
```

Then in the RevenueCat dashboard: entitlements named `plus` and `premium`, the moment SKUs
as non-subscription products (their ids must equal `unlock.sku` in `src/content/seed.ts`),
and a webhook to `https://<api>/billing/revenuecat`. Without the keys everyone is FREE and the
client hides purchase UI.

The client needs `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
(public SDK keys) and a development build: `react-native-purchases` is a native module, so
Expo Go and the web preview run with purchases disabled. The SDK is configured with our
user id as the RevenueCat app user id, so the server can map a webhook straight to a row.

### A note on pnpm configuration

pnpm 10+ reads workspace settings from `pnpm-workspace.yaml`, **not** `.npmrc`. Two settings there
are load-bearing:

- `nodeLinker: hoisted` — required for Expo. Metro cannot resolve pnpm's default symlinked virtual
  store, and React Native breaks on duplicate React copies.
- `allowBuilds: esbuild` — pnpm blocks postinstall scripts by default, and tsx needs esbuild's
  native binary. Without it `pnpm install` exits non-zero and blocks every turbo task.

## Contributing

- `main` is protected; work on feature branches and open a PR
- CI gates: typecheck, lint, test
- Railway: `main` → production, PRs → preview environments

## License

MIT
