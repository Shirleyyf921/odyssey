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
4. Check both before starting the app:

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

Either key alone works: the other tier falls back to whichever provider exists. `.env` is
gitignored; never commit it. On Railway, set the same variables in the service settings.

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
| `GET /characters/:id/moments` | Cards; locked ones carry no asset URL |
| `ws://…/ws/chat?token=…` or `?deviceId=…` | Chat, see `packages/shared/src/protocol.ts` |

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
