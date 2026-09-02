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

### Running the client

```bash
pnpm --filter @odyssey/api dev                                   # terminal 1
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000 pnpm --filter @odyssey/mobile dev   # terminal 2
```

A phone cannot reach `localhost` on your laptop, so point `EXPO_PUBLIC_API_URL` at the LAN
address. The client mints a device id on first launch and sends it as `x-device-id`; that is
the whole identity story until real sign-in lands.

### HTTP API

All routes except `/health` require `x-device-id: <uuid>`.

| Route | Purpose |
|---|---|
| `GET /characters` | Roster with the caller's relationship on each |
| `GET /characters/:id` | Portraits, relationship, moment count |
| `POST /characters/:id/start` | Idempotent; creates the relationship and its conversation |
| `GET /characters/:id/moments` | Cards; locked ones carry no asset URL |
| `ws://…/ws/chat?deviceId=<uuid>` | Chat, see `packages/shared/src/protocol.ts` |

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
