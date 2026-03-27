# OpenTeam Studio

一个基于 [OpenClaw](https://openclaw.ai) 的多 Agent 团队协作平台。OpenTeam 作为 OpenClaw 的 Channel 插件运行，专注于 Team 组建和协作流程。

## 特性

- **Team 模板系统** - 预定义的 Agent 角色和工作流程
- **实时协作** - WebSocket 支持的 Agent 间通信
- **可视化 Dashboard** - 项目进度、文件管理、聊天面板
- **通信规则控制** - 可配置的 Agent 间消息路由和防无限对话机制

## 快速开始

### 前置条件

- Node.js 18+
- OpenClaw Gateway 运行中（默认端口 18789）

### 安装

```bash
cd openteam-studio
npm install
```

### 配置

创建 `.env` 文件（参考 `.env.example`）：

```bash
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=your-gateway-token
PORT=3456
```

### 启动

```bash
npm run dev
```

### 访问

| 用途 | URL |
|------|-----|
| Studio 主界面 | http://localhost:3456/ui/studio.html |
| Team Dashboard | http://localhost:3456/teams/vibe-coding/dashboard.html |

## 项目结构

```
openteam-studio/
├── ui/                    # OpenTeam Studio 主界面
├── server/                # WebSocket + REST API
├── core/                  # 共享核心（类型、状态管理）
└── teams/                 # Team 模板
    └── vibe-coding/       # 示例：开发团队模板
        ├── manifest.json  # 模板定义
        ├── package/       # 前端资源
        └── skills/        # Team Skill
```

## 内置 Team 模板

### Vibe Coding 团队

PM → Dev → Reviewer → QA 协作流程：

1. **PM** - 需求分析、任务分配
2. **Dev** - 代码实现
3. **Reviewer** - 代码审查
4. **QA** - 测试验证

## 文档

- [OpenClaw 文档](https://docs.openclaw.ai)
- [Channel Plugin 开发指南](https://docs.openclaw.ai/plugins/building-extensions)

## License

MIT
