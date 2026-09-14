import { defineRailway, github, postgres, preserve, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  const Postgres = postgres("Postgres", { region: "sfo" });
  Postgres.networking = { privateNetworkEndpoint: "postgres" };
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "sfo", sizeMB: 500 });
  // One service hosts the API and the web build. Build, start and healthcheck
  // used to live in railway.json (Config as Code, deprecated 2026-12-01).
  const api = service("api", {
    source: github("Shirleyyf921/odyssey"),
    build: {
      builder: "RAILPACK",
      buildCommand: "pnpm install --frozen-lockfile && pnpm run build",
    },
    start:
      "pnpm --filter @odyssey/api db:migrate && pnpm --filter @odyssey/api db:seed && pnpm --filter @odyssey/api start",
    healthcheck: "/health",
    healthcheckTimeout: 30,
    // Restart policy stays on Railway's default (on failure); setting it here never converges in plan.
    replicas: { "sfo": 1 },
    env: { BILLING_GRANT_SECRET: preserve(), DATABASE_URL: preserve(), MEMORY_TIER: preserve(), NODE_ENV: preserve(), NOVITA_API_KEY: preserve(), REVIEW_SECRET: preserve() },
  });

  return project("odyssey", {
    resources: [Postgres, api, postgresVolume],
  });
});
