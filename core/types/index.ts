/**
 * OpenTeam Studio - Core Types
 * 核心类型定义
 * 
 * Agent 定义归 OpenClaw，Team 只引用 agent IDs
 */

// ============================================================================
// Agent Types
// ============================================================================

export interface SoulConfig {
  // YAML frontmatter 字段
  id?: string;
  role?: string;
  name?: string;
  model?: string;
  temperature?: number;
  language?: string;
  
  // Markdown 内容字段
  identity: string;        // 身份：这个 agent 是谁
  personality: string;     // 个性：行为风格
  mission: string;         // 使命：核心目标
  communication: string;   // 沟通方式：输出格式偏好
  constraints: string;     // 约束：绝对不做的事
  traits: string[];        // 特征标签
}

export type AgentStatus = 'idle' | 'working' | 'done' | 'blocked' | 'offline';

export interface AgentDef {
  id: string;              // 唯一标识，如 "pm-01"
  teamId: string;          // 所属 Team（运行时绑定，agent 可属于多个 team）
  role: string;            // 角色类型：PM / Dev / Reviewer / QA
  name: string;            // 角色名称，如 "Aria"
  
  soul: SoulConfig;        // SOUL.md 配置（从 ~/.openclaw/agents/{id}/SOUL.md 加载）
  skills: string[];        // 启用的技能
  model: string;           // 使用的模型
  
  status: AgentStatus;     // 运行时状态
  currentTask?: string;    // 当前任务
}

// ============================================================================
// Team Types
// ============================================================================

/**
 * Agent 引用类型 - 支持字符串或完整对象
 */
export type AgentRef = string | {
  id: string;
  role?: string;
  name?: string;
  required?: boolean;
  soul?: string;
  skills?: string[];
  model?: string;
  count?: { min: number; max: number };
};

/**
 * Team Manifest - Team 实例配置
 * 
 * 只引用 agent IDs，不定义 agent 细节（agent 定义在 ~/.openclaw/agents/）
 */
export interface TeamManifest {
  id: string;
  name: string;
  type: 'dev' | 'research' | 'business' | 'creative' | 'ops';
  icon: string;
  description: string;
  
  template?: string;       // 来源模板 ID（可选）
  
  // Agent 引用 - 支持字符串 ID 或完整对象
  agents: AgentRef[];      // ['pm-01', { id: 'dev-01', role: 'Dev', ... }]
  
  dashboard?: string;
  skill?: string;
  
  workflow?: {
    entry: string;
    phases: WorkflowPhase[];
    transitions: WorkflowTransition[];
  };
  
  // 通信规则配置（强制执行）
  communication?: CommunicationConfig;
  
  config?: {
    defaultModel: string;
    tools: Record<string, string[]>;
    filePatterns: Record<string, string>;
  };
}

export interface WorkflowPhase {
  name: string;
  agent?: string;
  agents?: string[];
  role?: string;
  roles?: string[];
  output?: string;
  parallel?: boolean;
  tag?: string;
  action?: string;
}

export interface WorkflowTransition {
  from: string;
  to: string | string[];
  trigger: 'mention' | 'condition' | 'auto';
}

/**
 * TeamDef - Team 运行时定义
 * 
 * 包含从 ~/.openclaw/agents/ 加载的完整 agent 定义
 */
export interface TeamDef {
  id: string;
  name: string;
  type: string;
  icon: string;
  description: string;
  
  manifest: TeamManifest;
  
  // 运行时加载的完整 agent 定义
  agents: AgentDef[];
  
  // 运行时状态
  projects: ProjectDef[];
  activeProject?: string;
}

export interface ProjectDef {
  id: string;
  name: string;
  teamId: string;
  path: string;
  
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * 通信规则 - 定义 agent 之间的通信权限
 */
export interface CommunicationRule {
  /** 允许接收消息的来源列表，支持通配符 "*" 表示所有人，"user" 表示用户 */
  receiveFrom?: string[];
  /** 允许发送消息（@mention）的目标列表 */
  sendTo?: string[];
  /** 是否允许自动回复 agent 消息（非用户消息） */
  allowAutoReply?: boolean;
  /** 回复冷却期（毫秒），防止快速连续回复 */
  replyCooldownMs?: number;
  /** 最大对话链深度，超过后停止回复 */
  maxChainDepth?: number;
}

/**
 * Team 通信规则配置
 */
export interface CommunicationConfig {
  /** 是否启用通信规则（默认 true） */
  enabled: boolean;
  /** 全局默认规则 */
  defaults: CommunicationRule;
  /** 每个 agent 的规则配置 */
  agents: Record<string, CommunicationRule>;
  /** 通配符规则，如 "dev-*" 匹配所有 dev */
  patterns?: Record<string, CommunicationRule>;
}

export interface InboundMessage {
  type: 'user-message';
  to: string;              // agentId 或 @mention
  body: string;            // 消息内容
  context: MessageContext;
  replyTo?: string;
  timestamp: string;
}

export interface OutboundMessage {
  type: 'agent-reply' | 'agent-status' | 'agent-thinking' | 'agent-outbound' | 'agent-intercept' | 'agent-blocked' | 'team-status' | 'session-init' | 'error';
  from?: string;           // agentId
  to?: string;             // 目标 agentId (agent-outbound/agent-intercept 专用)
  body?: string;           // 回复内容
  thinking?: string;       // 思考内容 (agent-thinking 专用)
  metadata?: MessageMetadata;
  status?: AgentStatus;
  currentTask?: string;
  error?: string;
  timestamp: string;
  // session-init 专用字段
  teamId?: string;
  teamSkillPath?: string;
  message?: string;
}

export interface MessageContext {
  teamId: string;
  projectId: string;
  userId?: string;
}

export interface MessageMetadata {
  model?: string;
  tokens?: { input: number; output: number };
  duration?: number;
  blocked?: boolean;
  reason?: string;
  ruleViolation?: boolean;
}

// ============================================================================
// WebSocket Types
// ============================================================================

import type { WebSocket as NodeWebSocket } from 'ws';

export interface WebSocketClient {
  id: string;
  teamId: string;
  projectId?: string;
  ws: NodeWebSocket;
  connectedAt: string;
}

export interface BroadcastMessage {
  teamId: string;
  projectId?: string;
  message: OutboundMessage;
  excludeClientId?: string;
}

// ============================================================================
// Store Types
// ============================================================================

export interface TeamState {
  teamId: string;
  agents: Map<string, AgentDef>;
  projects: Map<string, ProjectDef>;
  activeProjectId?: string;
}

export interface AppState {
  teams: Map<string, TeamState>;
  clients: Map<string, WebSocketClient>;
}
