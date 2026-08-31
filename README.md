# odyssey

AI 男友陪伴应用。以一个专属男友为主线关系，同时开放其他角色供探索。

## 现状

🚧 架构设计阶段。技术方案见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

## 技术栈

| 层 | 选型 |
|---|---|
| 客户端 | React Native (Expo SDK 54+) + EAS Build |
| 服务端 | TypeScript + Fastify |
| 部署 | Railway |
| 数据库 | Postgres + pgvector · Redis |
| 推理 | 外部 LLM API（经自建 Gateway 抽象） |
| 付费 | RevenueCat（IAP） |

## 定位

- **内容尺度**：SFW，目标上架 App Store / Google Play
- **核心壁垒**：记忆深度与人设一致性
- **竞品参照**：[Replika](https://replika.com)（专属伴侣）、[SpicyChat](https://spicychat.ai)（角色广场）

## 仓库结构

规划中的 monorepo 结构（pnpm workspaces + Turborepo）：

```
odyssey/
├── apps/mobile/        Expo RN 客户端
├── apps/api/           Fastify 服务端 → Railway
├── packages/shared/    zod schema、类型
├── packages/prompts/   人设与 prompt 模板（版本化）
└── docs/
```

## 协作

- `main` 分支保护，feature 分支 + PR
- CI 必过：typecheck / lint / test
- Railway：`main` → production，PR → preview environment

## License

MIT
