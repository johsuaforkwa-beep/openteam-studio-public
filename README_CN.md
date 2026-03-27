# OpenTeam Studio

> **将 Agent 协作转化为可复用的团队应用**
>
> 单个 Agent 与团队智能之间缺失的那一层。

[English](README.md) | [🌐 在线演示](https://agi4sci.github.io/openteam-studio-public/)

---

## 截图预览

### 🏠 OpenTeam Studio — 主界面

<img src="figs/OpenTeam-Studio.png" width="800" alt="OpenTeam Studio 界面">

### 🤖 Agent 工坊 — 定义你的 Agent

<img src="figs/agent.png" width="800" alt="Agent 工坊">

### 👥 团队组建 — 组合你的团队

<img src="figs/team.png" width="800" alt="团队组建">

### 🛒 模板商城 — 发现团队模板

<img src="figs/Marketplace.png" width="800" alt="模板商城">

### 💬 Vibe Coding 团队 — 多 Agent 协作

<img src="figs/vibe-coding-chat.png" width="800" alt="Vibe Coding 团队聊天">

### ✅ 项目成果 — AI 团队交付

<img src="figs/result.png" width="800" alt="项目成果">

---

## 为什么需要 OpenTeam Studio？

你拥有强大的 Agent，但单打独斗的 Agent 有其局限：

- **上下文碎片化** — 每个 Agent 从零开始，没有共享记忆
- **协作混乱** — 谁做什么？谁来审核？谁来做决策？
- **知识蒸发** — 协作模式随着每次会话结束而消散

**OpenTeam Studio 解决这些问题。** 它不创造 Agent，而是让 Agent 组成团队——配备可复用的工作流、共享上下文和持久化的知识。

---

## 缺失的那一层

```
┌─────────────────────────────────────────────────────────┐
│                    OpenTeam Studio                       │
│         团队模板 • Dashboard • 技能                      │
│              （这是我们构建的）                          │
├─────────────────────────────────────────────────────────┤
│                    Agent 运行时层                        │
│    OpenClaw • Claude Code • Gemini CLI • 自定义 Agent   │
│              （你已有的基础设施）                        │
└─────────────────────────────────────────────────────────┘
```

OpenTeam Studio 位于你现有 Agent 基础设施**之上**。无论你使用 OpenClaw、Claude Code、Gemini CLI 还是自建的 Agent 运行时——OpenTeam 都能为其添加团队协作层。

---

## 核心概念

### 🎭 团队模板 — 团队即代码

定义一次，随处部署：

```json
{
  "id": "vibe-coding",
  "name": "Vibe Coding 团队",
  "agents": [
    { "id": "pm-01", "role": "PM", "model": "claude-sonnet-4-6" },
    { "id": "dev-*", "role": "Dev", "count": { "min": 1, "max": 5 } },
    { "id": "reviewer-01", "role": "Reviewer" },
    { "id": "qa-01", "role": "QA" }
  ],
  "workflow": {
    "entry": "pm-01",
    "phases": ["分析", "开发", "审查", "测试"]
  }
}
```

模板具有以下特点：
- **版本控制** — Git 管理，可分享、可 fork
- **可配置** — 调整角色、模型、工具
- **可组合** — 混合来自不同来源的 Agent

### 🧠 知识沉淀 — 从会话到应用

每个团队都配备一个 **Dashboard** —— 一个固化团队工作方式的网页应用：

```
团队模板
├── manifest.json      # 团队定义
├── dashboard.html     # 该团队的自定义 UI
├── skills/SKILL.md    # 团队专属工作流
└── projects/          # 持久化的项目记忆
```

**沉淀的知识包括：**
- 项目状态和进度追踪
- 文件管理和代码审查
- 团队沟通模式
- 决策历史和理由

### 🔌 Agent 无关 — 带上你自己的 Agent

OpenTeam 不锁定你到某个 Agent 生态：

| 运行时 | 状态 | 说明 |
|--------|------|------|
| OpenClaw | ✅ 完整支持 | 原生 WebSocket 集成 |
| Claude Code | 🚧 计划中 | 通过 MCP 或 API 桥接 |
| Gemini CLI | 🚧 计划中 | 通过 API 桥接 |
| 自定义 Agent | ✅ 支持 | 实现 WebSocket 协议 |

---

## 你可以构建什么？

### 🛠 软件开发团队
PM → 开发者 → 审查者 → QA

完整的开发流水线：
- PM 分解需求
- 开发者并行实现
- 审查者早期发现问题
- QA 发布前验证

### 🔬 研究团队
研究负责人 → 分析师 → 事实核查员 → 撰稿人

多视角研究协作：
- 负责人定义方法论
- 分析师探索不同角度
- 核查员验证论据
- 撰稿人综合发现

### 📝 内容团队
主编 → 作者 → SEO 专员 → 校对

内容生产流水线：
- 主编分配和追踪选题
- 作者并行撰写
- SEO 优化可发现性
- 校对确保质量

**想象力是唯一限制。** 任何多步骤、多角色的流程都可以成为团队模板。

---

## 快速开始

### 前置条件

- Node.js 18+
- 一个 Agent 运行时（推荐 OpenClaw）

### 安装

```bash
git clone https://github.com/AGI4Sci/openteam-studio-public.git
cd openteam-studio-public
npm install
```

### 配置

创建 `.env` 文件（参考 `.env.example`）：

```bash
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=your-token
PORT=3456
```

### 启动

```bash
npm run dev
```

访问 http://localhost:3456/ui/studio.html 创建你的第一个团队。

---

## 架构

```
openteam-studio/
├── ui/                    # Studio UI（团队管理）
├── server/                # WebSocket + REST API
├── core/                  # 共享类型和状态
└── teams/                 # 团队模板（Git 管理）
    └── vibe-coding/       # 示例：开发团队模板
        ├── manifest.json  # 团队定义
        ├── package/       # Dashboard UI
        │   ├── dashboard.html
        │   ├── js/
        │   └── css/
        └── skills/        # 团队工作流
            └── SKILL.md
```

---

## 路线图

- [ ] 多运行时支持（Claude Code、Gemini CLI）
- [ ] 团队模板市场
- [ ] 实时协作 Dashboard
- [ ] 项目记忆和知识图谱
- [ ] Agent 性能分析

---

## 贡献

欢迎贡献！感兴趣的领域：

- 新的团队模板
- Dashboard 组件
- Agent 运行时适配器
- 文档改进

---

## 许可证

MIT

---

**OpenTeam Studio：让 Agent 成为团队，让团队成为应用。**
