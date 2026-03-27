# OpenClaw Agent 集成设计

## 目标

让 OpenTeam Studio 的 agent 真正由 OpenClaw 驱动，而不是使用静态数据或 LLM fallback。

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                   OpenTeam Studio                           │
├─────────────────────────────────────────────────────────────┤
│  Dashboard (前端)                                           │
│       ↓ WebSocket                                           │
│  OpenTeam Server                                            │
│       ↓ OpenClawClient                                      │
├─────────────────────────────────────────────────────────────┤
│                   OpenClaw Gateway                           │
│  (ws://127.0.0.1:18789)                                     │
├─────────────────────────────────────────────────────────────┤
│  sessions_spawn → 创建 agent session                        │
│  sessions_send   → 发送消息给 agent                         │
│  sessions_list   → 列出活跃 sessions                        │
└─────────────────────────────────────────────────────────────┘
```

## 实现步骤

### Phase 1: OpenClawClient 实现

1. 创建 `server/openclaw/client.ts`
   - WebSocket 连接到 Gateway
   - 实现 `connect` 握手协议
   - 调用 `sessions_spawn` 创建 agent
   - 调用 `sessions_send` 发送消息
   - 接收 agent 响应事件

2. 配置
   - Gateway 地址：从环境变量或配置文件读取
   - 认证：使用 Gateway token

### Phase 2: Agent 映射

1. Team → OpenClaw Session Group
   - 每个 Team 对应一组 OpenClaw agent sessions
   - Agent ID 映射到 OpenClaw session

2. Agent 定义来源
   - 从 `~/.openclaw/agents/` 读取 SOUL.md
   - 复用 OpenClaw 现有的 agent 定义

### Phase 3: 消息路由

1. 用户消息流程
   ```
   Dashboard → OpenTeam Server → OpenClawClient
   → sessions_send(agentId, message) → OpenClaw Gateway
   → Agent 处理 → 响应事件 → OpenClawClient
   → 转发给 Dashboard
   ```

2. Thinking 流
   - 监听 agent 的 thinking 事件
   - 实时推送到 Dashboard

## 关键代码

### OpenClawClient 接口

```typescript
interface OpenClawClient {
  connect(): Promise<void>;
  spawnAgent(agentId: string, soul: string): Promise<string>;
  sendToAgent(sessionKey: string, message: string): Promise<void>;
  onAgentResponse(callback: (response: AgentResponse) => void): void;
  onAgentThinking(callback: (thinking: AgentThinking) => void): void;
}
```

### Gateway 协议

```typescript
// 连接
{
  type: "req",
  id: "xxx",
  method: "connect",
  params: {
    minProtocol: 3,
    maxProtocol: 3,
    role: "operator",
    scopes: ["operator.read", "operator.write"],
    auth: { token: "xxx" }
  }
}

// Spawn agent
{
  type: "req",
  id: "xxx",
  method: "sessions_spawn",
  params: {
    task: "你是一个 PM agent...",
    agentId: "pm-01",
    runtime: "subagent"
  }
}

// 发送消息
{
  type: "req",
  id: "xxx",
  method: "sessions_send",
  params: {
    sessionKey: "xxx",
    message: "@pm-01 请分析任务"
  }
}
```

## 配置示例

```json
// ~/.openclaw/openteam-config.json
{
  "gateway": {
    "url": "ws://127.0.0.1:18789",
    "token": "${OPENCLAW_GATEWAY_TOKEN}"
  },
  "agents": {
    "definitionPath": "~/.openclaw/agents"
  }
}
```

## 后续扩展

### 多平台支持

当需要支持其他平台时：

```typescript
interface AgentDriver {
  spawnAgent(id: string, config: AgentConfig): Promise<string>;
  sendMessage(sessionKey: string, message: string): Promise<void>;
  onResponse(callback: ResponseCallback): void;
}

class OpenClawDriver implements AgentDriver { ... }
class ClaudeCodeDriver implements AgentDriver { ... }  // 未来
class OpenCodeDriver implements AgentDriver { ... }    // 未来
```

## 状态

- [ ] Phase 1: OpenClawClient 实现
- [ ] Phase 2: Agent 映射
- [ ] Phase 3: 消息路由
- [ ] Phase 4: Thinking 流
- [ ] Phase 5: 多平台抽象
