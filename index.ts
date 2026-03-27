/**
 * OpenTeam Studio - Channel Plugin Entry
 * OpenClaw Channel 插件入口
 * 
 * 独立原型阶段：可作为独立服务运行
 * OpenClaw 集成阶段：导出 defineChannelPluginEntry 配置
 * 
 * 数据存储：
 * - Agent 定义：~/.openclaw/agents/
 * - Team 实例：~/.openclaw/openteam/teams/
 */

import { OpenTeamServer, type ServerOptions } from './server/index.js';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

// 获取当前目录
const __dirname = dirname(fileURLToPath(import.meta.url));

// 数据目录
const OPENCLAW_DIR = join(homedir(), '.openclaw');
const AGENTS_DIR = join(OPENCLAW_DIR, 'agents');
const OPENTEAM_DIR = join(homedir(), '.openteam');

// 默认配置
const DEFAULT_OPTIONS: ServerOptions = {
  port: parseInt(process.env.PORT || '3456', 10),
};

/**
 * 启动服务器（独立运行时）
 */
export async function main(): Promise<void> {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║       OpenTeam Studio - Starting...       ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');
  console.log('📁 Data directories:');
  console.log(`   Agents:  ${AGENTS_DIR}`);
  console.log(`   Teams:   ${join(OPENTEAM_DIR, 'teams')}`);
  console.log('');

  const server = new OpenTeamServer(DEFAULT_OPTIONS);
  
  await server.start();
}

// 独立运行入口
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

// ============================================================================
// OpenClaw Channel Plugin 导出（后续集成阶段使用）
// ============================================================================

/**
 * Channel Plugin 定义
 * 参考: https://docs.openclaw.ai/plugins/building-extensions
 */
export const channelPlugin = {
  id: 'openteam',
  name: 'OpenTeam Studio',
  description: 'Multi-agent team management platform',
  version: '0.2.0',

  /**
   * Plugin 元数据
   */
  meta: {
    capabilities: ['messaging', 'streaming', 'multi-agent'],
  },

  /**
   * 配置解析
   */
  config: {
    resolveAccount(cfg: unknown, accountId: string) {
      return {
        enabled: true,
        configured: true,
      };
    },

    inspectAccount(cfg: unknown, accountId: string) {
      return {
        enabled: true,
        configured: true,
      };
    },
  },

  /**
   * 出站消息（OpenClaw → OpenTeam UI）
   */
  outbound: {
    async send(ctx: unknown, messages: unknown[]) {
      // TODO: 实现真实 OpenClaw 集成
      console.log('[OpenTeam] outbound.send called with', messages.length, 'messages');
    },
  },

  /**
   * Workspace 路径解析 → 指向 OpenClaw agents 目录
   */
  resolver: {
    resolveWorkspace(agentId: string) {
      return join(AGENTS_DIR, agentId);
    },
  },
};

/**
 * 导出 Channel Plugin 入口
 * OpenClaw 会调用这个函数获取插件配置
 */
export default channelPlugin;
