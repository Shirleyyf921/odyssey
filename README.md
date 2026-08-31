# odyssey

An AI boyfriend companion app. One dedicated primary relationship, plus curated characters to explore.

## Status

🚧 Architecture design phase. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the technical plan.

## Stack

| Layer | Choice |
|---|---|
| Client | React Native (Expo SDK 54+) + EAS Build |
| Server | TypeScript + Fastify |
| Hosting | Railway |
| Database | Postgres + pgvector · Redis |
| Inference | External LLM APIs behind an internal gateway |
| Billing | RevenueCat (in-app purchase) |

## Positioning

- **Market** — English-speaking, international
- **Content rating** — SFW, targeting App Store and Google Play
- **Moat** — memory depth and persona consistency
- **Reference points** — [Replika](https://replika.com), [Character.AI](https://character.ai), [SpicyChat](https://spicychat.ai)

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

## Contributing

- `main` is protected; work on feature branches and open a PR
- CI gates: typecheck, lint, test
- Railway: `main` → production, PRs → preview environments

## License

MIT
