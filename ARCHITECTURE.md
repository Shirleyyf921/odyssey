# odyssey 技术架构

> 状态：草案 v0.1 · 待评审
> 最后更新：2026-08-31

## 1. 产品定位

AI 男友陪伴应用。**混合形态**：以一个专属男友为主线关系，同时开放其他角色供探索。

内容尺度 **SFW**，目标上架 App Store / Google Play。

### 竞品参照

| | Replika | SpicyChat | odyssey |
|---|---|---|---|
| 形态 | 专属伴侣 | UGC 角色广场 | 主线专属 + 官方角色探索 |
| 壁垒 | 记忆深度、人设一致性 | 内容供给、发现机制 | 记忆深度为主，探索区做留存 |
| 尺度 | 基本 SFW | NSFW | SFW |
| 分发 | 应用商店 | 纯 Web | 应用商店 |

### 核心设计决策：探索区不稀释专属感

混合形态最大的风险是「有了别人，主线就不特别了」。处理方式：

1. **主线男友感知探索行为** —— 用户和其他角色聊过后，主线会追问、吃醋、提及。探索区从稀释变成强化主线存在感的燃料。
2. **能力分层** —— 语音、主动消息、纪念日、深度记忆只有主线有；探索角色是轻量会话。
3. **探索角色早期只做官方出品**，不开 UGC。UGC 意味着审核成本 + 冷启动供给问题，是另一个盘子。

## 2. 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 客户端 | Expo (SDK 54+) + EAS Build | config plugins 已能接原生模块，省整套构建配置；OTA 热更可绕审核改 prompt/文案 |
| 路由 | expo-router | file-based，和 Next.js 心智一致 |
| 状态 | Zustand + TanStack Query | 本地 UI 态 / 服务端态分离 |
| 本地存储 | expo-sqlite + expo-secure-store | 消息本地缓存支持离线读历史；token 走 secure store |
| 服务端 | TypeScript + Fastify | 与客户端共享 zod schema 和类型，小团队收益 > Python AI 生态优势（推理都在外部 API） |
| 部署 | Railway | API + Postgres(pgvector) + Redis；支持 PR preview environment |
| 数据库 | Postgres + pgvector | 关系数据与记忆向量同库，早期不引入独立向量库 |
| 队列/缓存 | Redis + BullMQ | 会话缓存、限流、主动消息调度 |
| 推理 | 外部 API，经自建 Gateway | Railway 无 GPU；Gateway 层避免焊死单一供应商 |
| 付费 | RevenueCat | 封装 StoreKit / Play Billing |

### 已知约束

- **Railway 没有 GPU**，模型推理必须走外部 API，Railway 只跑编排层。
- **RN 的 `fetch` 不支持 streaming body**（基于 XHR polyfill），逐字输出做不了。

## 3. 实时通信：WebSocket

不用 SSE，直接上 WebSocket。理由是主动消息（「他早上给你发消息」）需要长连接 + 推送，一步到位。

注意事项：
- Railway 实例重启会断连，客户端必须有**指数退避重连**
- 消息需要客户端生成 `client_msg_id` 做幂等，断连重发不产生重复
- 心跳保活，避免中间代理掐掉空闲连接

备选：若后期发现 WS 运维成本高，可退回 `expo/fetch`（SDK 52+ 支持流式）+ 推送通道分离。

## 4. 记忆系统

陪伴类产品的真正护城河。四层，按 `Relationship.depth` 分流：

| 层 | 机制 | DEEP | LIGHT |
|---|---|---|---|
| 短期 | 最近 N 轮原文进 context | ✅ | ✅ |
| 中期 | rolling summary，每 N 轮压缩 | ✅ | ✅ |
| 长期 | 结构化事实抽取 → pgvector，RAG 召回 | ✅ | ❌ |
| 关系态 | 好感度、关系阶段、纪念日 → 注入 system prompt | ✅ | ❌ |

长期记忆的写入是异步任务（BullMQ），不阻塞回复链路。

## 5. 数据模型草案

```
users              账号、年龄门、偏好设置
characters         kind(PRIMARY|EXPLORE), persona_template, voice_id
relationships      user × character, depth, stage, affinity, 纪念日
conversations      会话容器
messages           role, content, client_msg_id, token 用量
memories           user × character, 事实文本, embedding(pgvector), 置信度
subscriptions      RevenueCat 同步
proactive_jobs     主动消息调度与频控
```

## 6. LLM Gateway

业务代码不直接调任何厂商 SDK，统一走内部 Gateway，职责：

- **模型分级路由** —— 日常闲聊走低成本模型，关键剧情/记忆抽取走强模型
- 供应商故障转移
- token 用量记账（按用户，用于成本核算和限流）
- **moderation 前置** —— SFW 定位下用户可能诱导越界，必须有过滤层，这也是应用商店审核要求

### 成本模型（需早期验证）

主线深聊单条消息 context 约 3–8k tokens。假设日活用户 30 条/天 → 单用户约 150k input tokens/天。这个数字决定订阅定价能不能覆盖成本，**MVP 阶段必须实测**。

## 7. 主动消息

留存核武器，也是投诉来源。

- 调度：Railway cron + BullMQ
- 推送：expo-notifications → APNs / FCM
- **必须做频控**：每日上限、免打扰时段、用户可关闭
- 内容需带上下文（引用最近聊过的事），否则是骚扰不是陪伴

## 8. 仓库结构

pnpm workspaces + Turborepo monorepo：

```
odyssey/
├── apps/
│   ├── mobile/          Expo RN 客户端
│   └── api/             Fastify 服务端 → Railway
├── packages/
│   ├── shared/          zod schema、类型、常量
│   └── prompts/         人设与 prompt 模板（版本化，可回滚）
├── .github/workflows/   CI: typecheck / lint / test；EAS Build
└── docs/
```

`packages/prompts` 单独拆出来是因为人设 prompt 会频繁迭代，需要版本化和 A/B，不该混在业务代码里。

Railway 部署 monorepo 子目录：设置 Root Directory 为 `apps/api`。

## 9. 协作流程

- `main` 分支保护，feature 分支 + PR
- CI 必过：typecheck、lint、test
- Railway：`main` → production，PR → preview environment
- 客户端出包走 GitHub Actions 调 EAS Build

## 10. 合规

SFW 定位仍需处理：

- Apple 对 AI 陪伴类有额外审查，分级 17+
- 年龄门 + 未成年人保护
- 亲密对话属高敏感个人数据：加密存储、提供导出与删除
- 内容过滤层（见 §6），防止用户诱导模型越界导致下架风险

## 11. MVP 范围建议

**v1 收敛到**：主线男友（定制外观/性格/名字）+ 文字聊天 + 四层记忆 + 订阅 + 3–5 个官方探索角色。

**推迟到 v2**：语音（TTS 延迟优化是独立工程）、主动消息、纪念日系统、更多探索角色。

理由：记忆系统的效果是这个产品成不成立的唯一验证点，其他都是放大器。先验证放大器没有意义。

## 待决事项

- [ ] 推理供应商与模型分级具体选型（需跑成本实测）
- [ ] TTS 供应商（中文表现是关键，候选：MiniMax / Fish Audio / ElevenLabs）
- [ ] 订阅定价与档位设计
- [ ] 主线男友的人设可定制维度到什么粒度
