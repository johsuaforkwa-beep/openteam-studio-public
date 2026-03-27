/**
 * Agent API 路由
 * GET/POST/PUT/DELETE /api/agents
 * 
 * Agent 定义存储在 ~/.openclaw/agents/，由 OpenClaw 管理
 * 创建/删除时会自动向 OpenClaw 注册/取消注册
 */

import { IncomingMessage, ServerResponse } from 'http';
import { existsSync, mkdirSync, writeFileSync, readdirSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { success, error, sendJson } from '../utils/response.js';
import { validateAgentId } from '../utils/validation.js';
import { parseSoulMd } from '../utils/soul-parser.js';
import type { SoulConfig } from '../../core/types/index.js';

// OpenClaw agents 目录
const OPENCLAW_DIR = join(homedir(), '.openclaw');
const AGENTS_DIR = join(OPENCLAW_DIR, 'agents');

/**
 * 向 OpenClaw 注册 agent
 * 调用 openclaw agents add 命令
 */
function registerAgentToOpenClaw(agentId: string): { success: boolean; error?: string } {
  try {
    const workspace = join(AGENTS_DIR, agentId);
    const cmd = `openclaw agents add ${agentId} --workspace ${workspace} --agent-dir ${workspace} --non-interactive`;
    
    console.log(`[API] Registering agent to OpenClaw: ${agentId}`);
    execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(`[API] Successfully registered agent: ${agentId}`);
    return { success: true };
  } catch (err: any) {
    const errorMsg = err.stderr || err.message || String(err);
    console.error(`[API] Failed to register agent ${agentId}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * 从 OpenClaw 取消注册 agent
 * 调用 openclaw agents delete 命令
 */
function unregisterAgentFromOpenClaw(agentId: string): { success: boolean; error?: string } {
  try {
    const cmd = `openclaw agents delete ${agentId} --force`;
    
    console.log(`[API] Unregistering agent from OpenClaw: ${agentId}`);
    execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(`[API] Successfully unregistered agent: ${agentId}`);
    return { success: true };
  } catch (err: any) {
    const errorMsg = err.stderr || err.message || String(err);
    console.error(`[API] Failed to unregister agent ${agentId}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

export interface AgentCreateRequest {
  id: string;
  name: string;
  role: string;
  soul: SoulConfig;
  skills: string[];
  model: string;
}

/**
 * 处理 Agent 相关 API 请求
 * @returns true 表示已处理，false 表示不匹配
 */
export async function handleAgentRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  _teamsDir: string  // 不再使用 teamsDir，使用 ~/.openclaw/agents/
): Promise<boolean> {
  const url = req.url || '/';
  const method = req.method || 'GET';

  // GET /api/agents - 列出所有 Agent
  if (url === '/api/agents' && method === 'GET') {
    await handleListAgents(req, res);
    return true;
  }

  // GET /api/agents/:id - 获取单个 Agent
  const agentMatch = url.match(/^\/api\/agents\/([^\/]+)$/);
  if (agentMatch && method === 'GET') {
    await handleGetAgent(req, res, agentMatch[1]);
    return true;
  }

  // POST /api/agents - 创建 Agent（在 ~/.openclaw/agents/ 下）
  if (url === '/api/agents' && method === 'POST') {
    await handleCreateAgent(req, res);
    return true;
  }

  // PUT /api/agents/:id - 更新 Agent
  if (agentMatch && method === 'PUT') {
    await handleUpdateAgent(req, res, agentMatch[1]);
    return true;
  }

  // DELETE /api/agents/:id - 删除 Agent
  if (agentMatch && method === 'DELETE') {
    await handleDeleteAgent(req, res, agentMatch[1]);
    return true;
  }

  return false;
}

/**
 * GET /api/agents - 列出所有 Agent（从 ~/.openclaw/agents/）
 */
async function handleListAgents(
  _req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    // 确保 agents 目录存在
    if (!existsSync(AGENTS_DIR)) {
      mkdirSync(AGENTS_DIR, { recursive: true });
      console.log(`[API] Created agents directory: ${AGENTS_DIR}`);
    }

    const agents: any[] = [];
    const agentDirs = readdirSync(AGENTS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const agentId of agentDirs) {
      const agentDir = join(AGENTS_DIR, agentId);
      const soulPath = join(agentDir, 'SOUL.md');
      
      let soul: SoulConfig | null = null;
      if (existsSync(soulPath)) {
        const content = readFileSync(soulPath, 'utf-8');
        soul = parseSoulMd(content);
      }

      agents.push({
        id: agentId,
        path: agentDir,
        soulPath: existsSync(soulPath) ? soulPath : null,
        soul,
      });
    }

    sendJson(res, 200, success(agents));
  } catch (err) {
    console.error('[API] Failed to list agents:', err);
    sendJson(res, 500, error(String(err)));
  }
}

/**
 * GET /api/agents/:id - 获取单个 Agent
 */
async function handleGetAgent(
  _req: IncomingMessage,
  res: ServerResponse,
  agentId: string
): Promise<void> {
  try {
    const agentDir = join(AGENTS_DIR, agentId);
    
    if (!existsSync(agentDir)) {
      sendJson(res, 404, error('Agent not found'));
      return;
    }

    const soulPath = join(agentDir, 'SOUL.md');
    let soul: SoulConfig | null = null;
    
    if (existsSync(soulPath)) {
      const content = readFileSync(soulPath, 'utf-8');
      soul = parseSoulMd(content);
    }

    sendJson(res, 200, success({
      id: agentId,
      path: agentDir,
      soulPath: existsSync(soulPath) ? soulPath : null,
      soul,
    }));
  } catch (err) {
    console.error('[API] Failed to get agent:', err);
    sendJson(res, 500, error(String(err)));
  }
}

/**
 * POST /api/agents - 创建 Agent（在 ~/.openclaw/agents/ 下）
 * 自动向 OpenClaw 注册
 */
async function handleCreateAgent(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const body = await readBody(req);
    const agent = JSON.parse(body) as AgentCreateRequest;

    const validationError = validateAgentId(agent.id);
    if (validationError) {
      sendJson(res, 400, error(validationError));
      return;
    }

    const agentDir = join(AGENTS_DIR, agent.id);
    
    if (existsSync(agentDir)) {
      sendJson(res, 409, error('Agent already exists'));
      return;
    }

    // 创建 agent 目录
    mkdirSync(agentDir, { recursive: true });
    
    // 生成 SOUL.md
    const soulContent = generateSoulMd(agent);
    writeFileSync(join(agentDir, 'SOUL.md'), soulContent, 'utf-8');

    // 向 OpenClaw 注册
    const registerResult = registerAgentToOpenClaw(agent.id);
    if (!registerResult.success) {
      // 注册失败，回滚：删除已创建的目录
      rmSync(agentDir, { recursive: true });
      sendJson(res, 500, error(`Failed to register agent to OpenClaw: ${registerResult.error}`));
      return;
    }

    console.log(`[API] Created agent: ${agent.id} at ${agentDir}`);
    sendJson(res, 201, success({
      id: agent.id,
      path: agentDir,
      soulPath: join(agentDir, 'SOUL.md'),
      registered: true,
    }));
  } catch (err) {
    console.error('[API] Failed to create agent:', err);
    sendJson(res, 500, error(String(err)));
  }
}

/**
 * PUT /api/agents/:id - 更新 Agent
 */
async function handleUpdateAgent(
  req: IncomingMessage,
  res: ServerResponse,
  agentId: string
): Promise<void> {
  try {
    const agentDir = join(AGENTS_DIR, agentId);
    
    if (!existsSync(agentDir)) {
      sendJson(res, 404, error('Agent not found'));
      return;
    }

    const body = await readBody(req);
    const agent = JSON.parse(body) as AgentCreateRequest;

    // 更新 SOUL.md
    const soulContent = generateSoulMd(agent);
    writeFileSync(join(agentDir, 'SOUL.md'), soulContent, 'utf-8');

    console.log(`[API] Updated agent: ${agentId}`);
    sendJson(res, 200, success({
      id: agentId,
      path: agentDir,
    }));
  } catch (err) {
    console.error('[API] Failed to update agent:', err);
    sendJson(res, 500, error(String(err)));
  }
}

/**
 * DELETE /api/agents/:id - 删除 Agent
 * 自动向 OpenClaw 取消注册（openclaw agents delete 会同时删除目录）
 */
async function handleDeleteAgent(
  _req: IncomingMessage,
  res: ServerResponse,
  agentId: string
): Promise<void> {
  try {
    const agentDir = join(AGENTS_DIR, agentId);
    
    if (!existsSync(agentDir)) {
      sendJson(res, 404, error('Agent not found'));
      return;
    }

    // 从 OpenClaw 取消注册（这会同时删除目录）
    const unregisterResult = unregisterAgentFromOpenClaw(agentId);
    
    if (unregisterResult.success) {
      // openclaw agents delete 已经删除了目录
      console.log(`[API] Deleted agent: ${agentId}`);
      sendJson(res, 200, success({ 
        id: agentId,
        unregistered: true,
      }));
    } else {
      // 取消注册失败，手动删除目录
      console.warn(`[API] Failed to unregister agent ${agentId}, manually deleting:`, unregisterResult.error);
      rmSync(agentDir, { recursive: true });
      console.log(`[API] Deleted agent (manual): ${agentId}`);
      sendJson(res, 200, success({ 
        id: agentId,
        unregistered: false,
        error: unregisterResult.error,
      }));
    }
  } catch (err) {
    console.error('[API] Failed to delete agent:', err);
    sendJson(res, 500, error(String(err)));
  }
}

/**
 * 生成 SOUL.md 内容
 */
function generateSoulMd(agent: AgentCreateRequest): string {
  const soul = agent.soul || {};
  
  return `---
id: ${agent.id}
role: ${agent.role || 'Agent'}
model: ${agent.model || 'claude-sonnet-4-6'}
temperature: ${soul.temperature || 0.7}
language: ${soul.language || 'zh-CN'}
---

# Identity

${soul.identity || `我是 ${agent.name || agent.id}，一个 AI Agent。`}

# Personality

${soul.personality || '专业、高效、协作。'}

# Mission

${soul.mission || '帮助用户完成任务。'}

# Communication Style

${soul.communication || '清晰简洁，结构化输出。'}

# Constraints

${soul.constraints || '不做超出职责范围的事。'}

# Traits

${(soul.traits || ['团队协作', '专业高效']).map(t => `- ${t}`).join('\n')}
`;
}

/**
 * 读取请求体
 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}
