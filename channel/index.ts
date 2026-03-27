/**
 * OpenTeam Channel Plugin
 * OpenClaw Channel 插件，用于集成 Vibe Coding Team
 * 
 * 这个插件作为独立的 channel 类型注入 OpenClaw，不修改 OpenClaw 本身代码
 */

import type { AgentDef, TeamManifest, InboundMessage, OutboundMessage } from '../core/types/index.js';

// Channel 插件配置
export const openteamChannelPlugin = {
  id: 'openteam',
  name: 'OpenTeam Studio',
  description: 'Multi-agent team management channel',
  version: '0.1.0',

  /**
   * Channel 元数据
   */
  meta: {
    capabilities: ['messaging', 'streaming', 'multi-agent', 'team-collaboration'],
    supportedMessageTypes: ['user-message', 'agent-reply', 'agent-status', 'team-status'],
  },

  /**
   * 配置解析
   */
  config: {
    /**
     * 解析账号配置
     */
    resolveAccount(cfg: unknown, accountId: string) {
      return {
        enabled: true,
        configured: true,
        accountId,
      };
    },

    /**
     * 检查账号配置
     */
    inspectAccount(cfg: unknown, accountId: string) {
      return {
        enabled: true,
        configured: true,
        accountId,
        info: `OpenTeam account: ${accountId}`,
      };
    },
  },

  /**
   * 入站消息处理
   */
  inbound: {
    /**
     * 处理用户消息
     */
    async handle(ctx: ChannelContext, message: InboundMessage): Promise<OutboundMessage | null> {
      const { to, body, context } = message;
      
      console.log(`[OpenTeam] Inbound message to ${to}: ${body.slice(0, 50)}...`);

      // 获取目标 Agent
      const agent = await ctx.getAgent(to);
      if (!agent) {
        return {
          type: 'error',
          error: `Agent not found: ${to}`,
          timestamp: new Date().toISOString(),
        };
      }

      // 更新 Agent 状态为工作中
      await ctx.updateAgentStatus(to, 'working', body.slice(0, 50));

      // 调用 LLM 生成响应
      const response = await ctx.generateResponse(agent, body, context);

      // 更新 Agent 状态为空闲
      await ctx.updateAgentStatus(to, 'idle');

      return {
        type: 'agent-reply',
        from: to,
        body: response,
        metadata: {
          model: agent.model,
          tokens: { input: body.length, output: response.length },
        },
        timestamp: new Date().toISOString(),
      };
    },
  },

  /**
   * 出站消息处理
   */
  outbound: {
    /**
     * 发送消息到客户端
     */
    async send(ctx: ChannelContext, messages: OutboundMessage[]): Promise<void> {
      console.log(`[OpenTeam] Outbound: ${messages.length} messages`);
      // WebSocket 发送由 server 层处理
    },
  },

  /**
   * Workspace 路径解析
   */
  resolver: {
    /**
     * 解析 Agent workspace 路径
     */
    resolveWorkspace(agentId: string, teamId: string): string {
      return `./teams/${teamId}/agents/${agentId}`;
    },

    /**
     * 解析 Team workspace 路径
     */
    resolveTeamWorkspace(teamId: string): string {
      return `./teams/${teamId}/workspaces`;
    },
  },

  /**
   * Agent 管理
   */
  agents: {
    /**
     * 列出 Team 所有 Agent
     */
    async list(teamId: string): Promise<AgentDef[]> {
      // 由 TeamStateManager 处理
      return [];
    },

    /**
     * 获取 Agent 详情
     */
    async get(agentId: string, teamId: string): Promise<AgentDef | null> {
      return null;
    },
  },
};

/**
 * Channel 上下文接口
 * 由 server 层实现并注入
 */
export interface ChannelContext {
  // Agent 操作
  getAgent(agentId: string): Promise<AgentDef | null>;
  updateAgentStatus(agentId: string, status: string, task?: string): Promise<void>;

  // LLM 调用
  generateResponse(agent: AgentDef, prompt: string, context: any): Promise<string>;

  // 消息操作
  broadcast(message: OutboundMessage): void;
  sendToClient(clientId: string, message: OutboundMessage): void;
}

export default openteamChannelPlugin;
