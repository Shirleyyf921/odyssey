# odyssey

An AI boyfriend companion app. One dedicated primary relationship, plus curated characters to explore.

## Status

🚧 Framework stage. The chat loop runs end to end (WebSocket → LLM gateway → Postgres), with
memory, safety detection, and the client still to come. See [ARCHITECTURE.md](./ARCHITECTURE.md).

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
```

The Postgres instance needs the `vector` extension (Railway's pgvector image has it).

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
