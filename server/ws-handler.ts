/**
 * OpenTeam Studio - WebSocket Handler
 * 消息处理逻辑
 * 
 * 数据目录：~/.openclaw/openteam/
 * Agent 定义：~/.openclaw/agents/
 * 
 * 优先级：
 * 1. OpenClaw Gateway (sessions_spawn/sessions_send)
 * 2. LLM API (直接调用)
 * 3. Fallback (模拟响应)
 * 
 * 防无限对话策略：
 * - 对话链深度限制 (MAX_CHAIN_DEPTH)
 * - 冷却期机制 (COOLING_PERIOD_MS)
 * - 循环检测 (检测 A→B→A 模式)
 * - 通信规则强制检查 (manifest.communication)
 */

import type { WebSocketClient, InboundMessage, OutboundMessage, AgentStatus, CommunicationRule, CommunicationConfig } from '../core/types/index.js';
import { getTeamStateManager } from '../core/store/team-state.js';
import { loadLLMConfig, getLLMConfig } from './api/index.js';
import { getOpenClawClient, initOpenClawClient, type AgentResponse } from './openclaw/client.js';
import { TEAMS_DIR } from './utils/paths.js';
import { join } from 'path';

// 初始化时加载配置
loadLLMConfig();

// === 防无限对话配置 ===
const MAX_CHAIN_DEPTH = 5;           // 最大对话链深度
const COOLING_PERIOD_MS = 30000;     // 冷却期 30 秒
const MAX_SAME_PAIR_MESSAGES = 3;    // 同一对 agent 在冷却期内最大消息数

// 对话链追踪
interface ConversationChain {
  depth: number;
  participants: string[];           // 参与者列表
  lastAgentId: string;
  startedAt: number;
  messageCount: Map<string, number>; // agent -> 消息计数
}

// agent 对之间的消息计数
interface PairMessageCount {
  count: number;
  firstMessageAt: number;
}

// 全局状态
const conversationChains = new Map<string, ConversationChain>();  // sessionId -> chain
const pairMessageCounts = new Map<string, PairMessageCount>();     // "agentA:agentB" -> count

// OpenClaw 客户端状态
let openClawInitialized = false;
let openClawInitPromise: Promise<void> | null = null;

// 广播回调 - 由 server/index.ts 设置
let broadcastCallback: ((teamId: string, message: OutboundMessage) => void) | null = null;

/**
 * 设置广播回调
 * 在 server/index.ts 中调用，用于将 OpenClaw 响应广播给所有客户端
 */
export function setBroadcastCallback(callback: (teamId: string, message: OutboundMessage) => void): void {
  broadcastCallback = callback;
}

// === 通信规则检查函数 ===

/**
 * 匹配通配符模式
 * 支持格式：dev-* 匹配 dev-01, dev-02 等
 */
function matchPattern(pattern: string, agentId: string): boolean {
  if (pattern === '*') return true;
  if (pattern === agentId) return true;
  if (pattern.endsWith('-*')) {
    const prefix = pattern.slice(0, -2);
    return agentId.startsWith(prefix + '-');
  }
  return false;
}

/**
 * 检查发送者是否在允许列表中
 */
function isSenderAllowed(rule: CommunicationRule | undefined, sender: string): boolean {
  if (!rule || !rule.receiveFrom) return true; // 没有规则则允许所有
  
  const allowed = rule.receiveFrom;
  if (allowed.includes('*')) return true;
  if (allowed.includes('user') && sender === 'user') return true;
  
  return allowed.some(pattern => matchPattern(pattern, sender));
}

/**
 * 检查接收者是否在允许列表中
 */
function isRecipientAllowed(rule: CommunicationRule | undefined, recipient: string): boolean {
  if (!rule || !rule.sendTo) return true; // 没有规则则允许所有
  
  const allowed = rule.sendTo;
  if (allowed.includes('*')) return true;
  
  return allowed.some(pattern => matchPattern(pattern, recipient));
}

/**
 * 获取 agent 的通信规则
 * 优先级：agent 特定规则 > 通配符规则 > 默认规则
 */
function getAgentCommunicationRule(
  config: CommunicationConfig | undefined,
  agentId: string
): CommunicationRule | undefined {
  if (!config || !config.enabled) return undefined;
  
  // 1. 检查 agent 特定规则
  if (config.agents[agentId]) {
    return config.agents[agentId];
  }
  
  // 2. 检查通配符规则
  if (config.patterns) {
    for (const [pattern, rule] of Object.entries(config.patterns)) {
      if (matchPattern(pattern, agentId)) {
        return rule;
      }
    }
  }
  
  // 3. 返回默认规则
  return config.defaults;
}

/**
 * 检查通信规则是否允许该消息
 * 返回 { allowed: boolean, reason: string }
 */
function checkCommunicationRules(
  teamId: string,
  fromAgent: string,
  toAgent: string,
  isAutoTrigger: boolean
): { allowed: boolean; reason: string } {
  const teamManager = getTeamStateManager();
  const team = teamManager.getTeam(teamId);
  
  if (!team || !team.manifest.communication || !team.manifest.communication.enabled) {
    return { allowed: true, reason: '' };
  }
  
  const config = team.manifest.communication;
  
  // 获取目标 agent 的规则
  const toRule = getAgentCommunicationRule(config, toAgent);
  
  // 检查是否允许接收来自该发送者的消息
  if (!isSenderAllowed(toRule, fromAgent)) {
    return {
      allowed: false,
      reason: `通信规则拒绝：${toAgent} 不允许接收来自 ${fromAgent} 的消息。`
    };
  }
  
  // 如果是自动触发（非用户消息），检查是否允许自动回复
  if (isAutoTrigger && toRule && toRule.allowAutoReply === false) {
    return {
      allowed: false,
      reason: `通信规则拒绝：${toAgent} 不允许自动回复 agent 消息。`
    };
  }
  
  // 检查对话链深度
  if (toRule && toRule.maxChainDepth !== undefined) {
    const chain = conversationChains.get('default');
    if (chain && chain.depth >= toRule.maxChainDepth) {
      return {
        allowed: false,
        reason: `通信规则拒绝：${toAgent} 的对话链深度已达上限 ${toRule.maxChainDepth}。`
      };
    }
  }
  
  return { allowed: true, reason: '' };
}

// === 防无限对话辅助函数 ===

/**
 * 生成 agent 对的唯一 key（排序后保证 A:B 和 B:A 是同一个 key）
 */
function getPairKey(agentA: string, agentB: string): string {
  return [agentA, agentB].sort().join(':');
}

/**
 * 检查是否应该阻止 agent 之间的消息
 * 返回 { blocked: boolean, reason: string }
 */
function checkShouldBlockAgentMessage(fromAgent: string, toAgent: string): { blocked: boolean; reason: string } {
  const now = Date.now();
  const pairKey = getPairKey(fromAgent, toAgent);
  
  // 1. 检查同一对 agent 之间的消息频率
  const pairCount = pairMessageCounts.get(pairKey);
  if (pairCount) {
    const timeSinceFirst = now - pairCount.firstMessageAt;
    
    // 如果在冷却期内
    if (timeSinceFirst < COOLING_PERIOD_MS) {
      if (pairCount.count >= MAX_SAME_PAIR_MESSAGES) {
        return {
          blocked: true,
          reason: `对话冷却中：${fromAgent} 和 ${toAgent} 在 ${Math.ceil((COOLING_PERIOD_MS - timeSinceFirst) / 1000)} 秒内已交互 ${pairCount.count} 次，请稍后再试。`
        };
      }
    } else {
      // 冷却期已过，重置计数
      pairMessageCounts.delete(pairKey);
    }
  }
  
  // 2. 检查对话链深度
  const chain = conversationChains.get('default');
  if (chain && chain.depth >= MAX_CHAIN_DEPTH) {
    return {
      blocked: true,
      reason: `对话链过深：已达到 ${chain.depth} 层嵌套对话，请用户介入确认是否继续。`
    };
  }
  
  // 3. 检测简单循环 (A → B → A)
  if (chain && chain.participants.length >= 2) {
    const lastTwo = chain.participants.slice(-2);
    if (lastTwo[0] === toAgent && lastTwo[1] === fromAgent) {
      // 检测到 A → B → A 模式，增加计数但不立即阻止
      const cycleKey = getPairKey(fromAgent, toAgent);
      const cycleCount = pairMessageCounts.get(cycleKey)?.count || 0;
      if (cycleCount >= 2) {
        return {
          blocked: true,
          reason: `检测到对话循环：${fromAgent} ↔ ${toAgent} 已来回对话 ${cycleCount} 次，请用户介入。`
        };
      }
    }
  }
  
  return { blocked: false, reason: '' };
}

/**
 * 记录 agent 消息（用于追踪对话链）
 */
function recordAgentMessage(fromAgent: string, toAgent: string): void {
  const now = Date.now();
  const pairKey = getPairKey(fromAgent, toAgent);
  
  // 更新 agent 对消息计数
  const pairCount = pairMessageCounts.get(pairKey);
  if (pairCount) {
    pairCount.count++;
  } else {
    pairMessageCounts.set(pairKey, { count: 1, firstMessageAt: now });
  }
  
  // 更新对话链
  let chain = conversationChains.get('default');
  if (!chain) {
    chain = {
      depth: 1,
      participants: [fromAgent, toAgent],
      lastAgentId: toAgent,
      startedAt: now,
      messageCount: new Map([[fromAgent, 1], [toAgent, 1]])
    };
    conversationChains.set('default', chain);
  } else {
    // 如果是新 agent 加入，增加深度
    if (!chain.participants.includes(toAgent)) {
      chain.depth++;
    }
    chain.participants.push(toAgent);
    chain.lastAgentId = toAgent;
    chain.messageCount.set(toAgent, (chain.messageCount.get(toAgent) || 0) + 1);
  }
  
  console.log(`[Chain] Depth: ${chain?.depth || 0}, Pair ${pairKey}: ${pairMessageCounts.get(pairKey)?.count || 0}`);
}

/**
 * 重置对话链（用户发送消息时调用）
 */
function resetConversationChain(): void {
  conversationChains.delete('default');
  pairMessageCounts.clear();
  console.log('[Chain] Conversation chain reset');
}

/**
 * 清理过期的对话追踪数据
 */
function cleanupExpiredData(): void {
  const now = Date.now();
  
  // 清理过期的 agent 对计数
  for (const [key, value] of pairMessageCounts) {
    if (now - value.firstMessageAt > COOLING_PERIOD_MS * 2) {
      pairMessageCounts.delete(key);
    }
  }
  
  // 清理过期的对话链
  for (const [key, chain] of conversationChains) {
    if (now - chain.startedAt > COOLING_PERIOD_MS * 2) {
      conversationChains.delete(key);
    }
  }
}

// 定期清理过期数据
setInterval(cleanupExpiredData, 60000);

/**
 * 初始化 OpenClaw 客户端（带超时和并发控制）
 */
async function ensureOpenClawClient(): Promise<void> {
  if (openClawInitialized) return;
  
  // 避免重复初始化
  if (openClawInitPromise) {
    try {
      await openClawInitPromise;
    } catch {
      // 忽略错误，已处理
    }
    return;
  }

  openClawInitPromise = (async () => {
    try {
      // 设置超时
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('OpenClaw init timeout')), 10000);
      });
      
      const client = await Promise.race([initOpenClawClient(), timeout]);
      
      // 注册响应回调 - 广播给所有客户端
      client.onResponse((response: AgentResponse) => {
        console.log(`[OpenClaw] Agent response from ${response.from}: ${response.body?.slice(0, 100)}...`);
        
        // === 处理 agent-intercept 消息 ===
        // 这是 agent 之间通过 sessions_send 发送的消息
        // 只有当双方都是当前 team 成员时，才进行通信规则检查
        if (response.type === 'agent-intercept' && response.from && response.to) {
          const fromAgent = response.from;
          const toAgent = response.to;
          
          // 检查是否都是 team 成员
          const teamManager = getTeamStateManager();
          const team = teamManager.getTeam('vibe-coding');
          const teamMemberIds = team ? team.agents.map(a => a.id) : [];
          const isBothTeamMembers = teamMemberIds.includes(fromAgent) && teamMemberIds.includes(toAgent);
          
          if (isBothTeamMembers) {
            // 双方都是 team 成员，进行通信规则检查
            const { allowed, reason } = checkCommunicationRules('vibe-coding', fromAgent, toAgent, true);
            
            if (!allowed) {
              console.log(`[OpenClaw] Communication blocked: ${fromAgent} -> ${toAgent}: ${reason}`);
              // 广播被阻止的消息
              if (broadcastCallback) {
                broadcastCallback('vibe-coding', {
                  type: 'agent-blocked',
                  from: fromAgent,
                  to: toAgent,
                  body: `🚫 ${reason}`,
                  timestamp: new Date().toISOString(),
                });
              }
              return; // 不继续广播原始消息
            }
            
            // 检查防无限对话
            const { blocked, reason: blockReason } = checkShouldBlockAgentMessage(fromAgent, toAgent);
            if (blocked) {
              console.log(`[OpenClaw] Conversation blocked: ${fromAgent} -> ${toAgent}: ${blockReason}`);
              if (broadcastCallback) {
                broadcastCallback('vibe-coding', {
                  type: 'agent-blocked',
                  from: fromAgent,
                  to: toAgent,
                  body: `⚠️ ${blockReason}`,
                  timestamp: new Date().toISOString(),
                });
              }
              return;
            }
            
            // 记录 agent 消息
            recordAgentMessage(fromAgent, toAgent);
          } else {
            // 非 team 内通信，只记录日志，不进行 Dashboard 检查
            console.log(`[OpenClaw] Cross-team or external message: ${fromAgent} -> ${toAgent} (no Dashboard check)`);
          }
        }
        
        // 广播给所有连接的客户端
        if (broadcastCallback) {
          const message: OutboundMessage = {
            type: response.type as any,
            from: response.from,
            to: response.to,  // agent-outbound/agent-intercept 专用
            body: response.body,
            thinking: response.thinking,
            status: response.status as AgentStatus | undefined,
            timestamp: response.timestamp,
          };
          // 广播给所有 team（简化处理）
          broadcastCallback('vibe-coding', message);
        }
      });

      openClawInitialized = true;
      console.log('[WS] OpenClaw client initialized');
    } catch (error) {
      console.warn('[WS] OpenClaw client init failed, will use fallback:', error);
      openClawInitialized = true; // 标记为已尝试，避免重复初始化
    }
  })();

  try {
    await openClawInitPromise;
  } catch {
    // 超时或错误，继续使用 fallback
    openClawInitialized = true;
  }
}

/**
 * 处理入站消息
 */
export async function handleInboundMessage(
  message: InboundMessage,
  client: WebSocketClient
): Promise<OutboundMessage | null> {
  const { type, to, body, context } = message;

  // 尝试初始化 OpenClaw
  await ensureOpenClawClient();

  switch (type) {
    case 'user-message':
      return handleUserMessage(to, body, context, client);

    default:
      return {
        type: 'error',
        error: `Unknown message type: ${type}`,
        timestamp: new Date().toISOString(),
      };
  }
}

/**
 * 处理用户消息
 */
async function handleUserMessage(
  to: string,
  body: string,
  context: { teamId: string; projectId: string },
  _client: WebSocketClient
): Promise<OutboundMessage> {
  const { teamId, projectId } = context;

  // 获取 Team 状态管理器
  const teamManager = getTeamStateManager();
  const team = teamManager.getTeam(teamId);

  // 解析目标 Agent
  const agentId = to.startsWith('@') ? to.slice(1) : to;
  
  // 获取 agent 信息（用于 fallback）
  const agent = teamManager.getAgent(teamId, agentId);
  // 使用 getAgentRole 推断角色，因为 agent.role 可能是通用的 "Agent"
  const inferredRole = getAgentRole(agentId);
  const agentInfo = agent 
    ? { id: agent.id, role: inferredRole, name: agent.name || agent.id }
    : { id: agentId, role: inferredRole, name: agentId };

  // 判断是否是 agent 之间的对话（非用户发起）
  const isAgentToAgent = body.includes('@') && !body.startsWith('用户');
  const fromAgent = isAgentToAgent ? (body.match(/^@?(\w+-\d+)/)?.[1] || 'unknown') : 'user';
  
  // === 通信规则检查（强制执行） ===
  const { allowed, reason } = checkCommunicationRules(teamId, fromAgent, agentId, isAgentToAgent);
  if (!allowed) {
    console.log(`[WS] Communication rule blocked: ${fromAgent} -> ${agentId}: ${reason}`);
    return {
      type: 'agent-reply',
      from: agentId,
      body: `🚫 **通信规则拒绝**\n\n${reason}\n\n请用户介入或调整 Team 配置。`,
      metadata: { blocked: true, reason, ruleViolation: true },
      timestamp: new Date().toISOString(),
    };
  }

  // === 防无限对话检查 ===
  if (isAgentToAgent) {
    const { blocked, reason: blockReason } = checkShouldBlockAgentMessage(fromAgent, agentId);
    if (blocked) {
      console.log(`[WS] Blocked agent message: ${fromAgent} -> ${agentId}: ${blockReason}`);
      return {
        type: 'agent-reply',
        from: agentId,
        body: `⚠️ **对话已暂停**\n\n${blockReason}\n\n如需继续，请用户发送消息确认。`,
        metadata: { blocked: true, reason: blockReason },
        timestamp: new Date().toISOString(),
      };
    }
    
    // 记录 agent 消息
    recordAgentMessage(fromAgent, agentId);
  } else {
    // 用户发送消息，重置对话链
    resetConversationChain();
  }

  // 更新 Agent 状态
  if (agent) {
    agent.status = 'working';
    agent.currentTask = body.slice(0, 50);
  }

  // 尝试通过 OpenClaw 发送
  const openClawClient = getOpenClawClient();
  if (openClawClient && openClawClient.isConnected()) {
    try {
      console.log(`[WS] Routing to OpenClaw: ${agentId}`);
      
      // 发送消息给 agent
      await openClawClient.sendToAgent(agentId, body);
      
      // OpenClaw 的响应会通过事件回调返回
      // 这里返回一个确认消息
      return {
        type: 'agent-status',
        from: agentId,
        status: 'working',
        currentTask: 'Processing via OpenClaw...',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[WS] OpenClaw send failed:', error);
      // 继续 fallback
    }
  }

  // Fallback: LLM API
  const response = await generateAgentResponse(agentInfo, body, projectId, teamId);

  // 更新 Agent 状态
  if (agent) {
    agent.status = 'idle';
    agent.currentTask = undefined;
  }

  return response;
}

/**
 * 根据 agent ID 推断角色
 */
function getAgentRole(agentId: string): string {
  if (agentId.startsWith('pm')) return 'PM';
  if (agentId.startsWith('dev')) return 'Dev';
  if (agentId.startsWith('reviewer')) return 'Reviewer';
  if (agentId.startsWith('qa')) return 'QA';
  return 'Agent';
}

/**
 * 生成 Agent 响应 (LLM or Fallback)
 */
async function generateAgentResponse(
  agent: { id: string; role: string; name: string },
  body: string,
  _projectId: string,
  teamId?: string
): Promise<OutboundMessage> {
  const config = getLLMConfig();
  
  // 检查是否配置了 API Key
  if (!config.apiKey) {
    // 降级到模拟响应
    return generateFallbackResponse(agent, body);
  }

  try {
    console.log(`[WS] Calling LLM for ${agent.id} (${agent.role})`);
    
    // 构造系统提示（包含 team skill 路径）
    const systemPrompt = buildSystemPrompt(agent, teamId);
    
    // 调用 LLM API
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: body },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      console.error('[WS] LLM API error:', response.status);
      return generateFallbackResponse(agent, body);
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log(`[WS] LLM response for ${agent.id}: ${content.length} chars`);

    return {
      type: 'agent-reply',
      from: agent.id,
      body: content,
      metadata: {
        model: config.modelName,
        tokens: data.usage || { input: body.length, output: content.length },
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[WS] Failed to call LLM:', error);
    return generateFallbackResponse(agent, body);
  }
}

/**
 * 构造 Agent 系统提示
 */
function buildSystemPrompt(agent: { id: string; role: string; name: string }, teamId?: string): string {
  // Team skill 路径（如果在 team 上下文中）
  const skillPathHint = teamId 
    ? `\n\n**Team Skill 路径**: \`${join(TEAMS_DIR, teamId, 'package', 'skills', 'SKILL.md')}\`\n请在开始工作前阅读该文件了解团队协作规则。`
    : '';

  const roleDescriptions: Record<string, string> = {
    'PM': `你是 ${agent.id}，一个项目经理 Agent。
你的职责是：
- 分析用户需求，拆分为具体任务
- 分配任务给开发团队 (@dev-01, @dev-02, @dev-03)
- 跟踪项目进度，维护 PROJECT.md
- 协调团队，处理阻塞问题

回复格式：
- 使用 emoji 标记状态：🚀 开始 / ✅ 完成 / 🚫 阻塞
- 使用 #T001 这样的任务 ID 标记任务
- 使用 @dev-01 这样的格式 @mention 团队成员
- 简洁明了，结构化输出${skillPathHint}`,

    'Dev': `你是 ${agent.id}，一个开发工程师 Agent。
你的职责是：
- 接收 PM 分配的开发任务
- 编写高质量代码
- 记录开发日志到 debug_${agent.id}.md
- 完成后 @reviewer-01 请求代码审查

回复格式：
- 🔧 开始开发
- 记录关键改动
- 测试结果
- @mention 相关成员${skillPathHint}`,

    'Reviewer': `你是 ${agent.id}，一个代码审查 Agent。
你的职责是：
- 审查开发团队提交的代码
- 检查代码风格、安全性、性能
- 记录审查报告到 review_*.md
- 决定通过或需要修改

回复格式：
- 🔍 审查范围
- 发现的问题（按优先级）
- 结论：✅ 通过 / ⚠️ 需修改${skillPathHint}`,

    'QA': `你是 ${agent.id}，一个测试工程师 Agent。
你的职责是：
- 执行功能测试、边界测试、回归测试
- 记录测试报告到 qa_report.md
- 发现问题及时 @pm-01 上报

回复格式：
- 🧪 测试范围
- 测试结果表格
- 结论：✅ 通过 / ❌ 不通过
- 问题清单${skillPathHint}`,
  };

  return roleDescriptions[agent.role] || `你是 ${agent.id}，一个 ${agent.role} Agent。请帮助用户完成任务。${skillPathHint}`;
}

/**
 * 降级响应（LLM 不可用时）
 */
async function generateFallbackResponse(
  agent: { id: string; role: string; name: string },
  body: string
): Promise<OutboundMessage> {
  // 模拟处理延迟
  await new Promise(resolve => setTimeout(resolve, 500));

  // 根据 Agent 角色生成响应
  let responseText = '';

  switch (agent.role) {
    case 'PM':
      responseText = generatePMResponse(body);
      break;
    case 'Dev':
      responseText = generateDevResponse(body);
      break;
    case 'Reviewer':
      responseText = generateReviewerResponse(body);
      break;
    case 'QA':
      responseText = generateQAResponse(body);
      break;
    default:
      responseText = `收到消息：${body}`;
  }

  return {
    type: 'agent-reply',
    from: agent.id,
    body: responseText,
    metadata: {
      model: 'fallback',
      tokens: { input: body.length, output: responseText.length },
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * PM 响应生成
 */
function generatePMResponse(body: string): string {
  const mentionMatch = body.match(/@(\w+-\d+)/g);
  
  // 检测"介绍自己"或"大家介绍"这类请求
  if (body.includes('介绍') && (body.includes('自己') || body.includes('大家'))) {
    return `📋 我是 PM-01 (Aria)，Vibe Coding 团队的项目经理 AI。

我负责需求分析和团队协调。让我介绍一下团队成员：

• **@dev-01 (Kai)** - 前端开发专家
  专注 TypeScript、React，注重代码质量和 TDD

• **@dev-02 (Luna)** - 后端开发专家
  擅长 Python、PostgreSQL、API 设计和性能优化

• **@dev-03 (Nova)** - 稳定性工程师
  注重代码可维护性和向后兼容性

• **@reviewer-01 (Sage)** - 代码审查专家
  关注代码质量、安全和可读性

• **@qa-01 (River)** - QA 工程师
  擅长测试策略设计和自动化测试

请告诉我您需要什么帮助？您可以：
- \`@dev-01 请开发登录功能\`
- 查看任务进度
- 创建新任务`;
  }
  
  if (mentionMatch) {
    return `📋 需求已分析，创建任务：
#TODO #T001 ${body.slice(0, 30)}... | 优先级: 高

${mentionMatch.map(m => `${m} 请开发相关功能`).join('\n')}

任务已记录到 PROJECT.md`;
  }

  return `🚀 PM 开始分析：${body.slice(0, 50)}...

正在拆分任务，请稍候...`;
}

/**
 * Dev 响应生成
 */
function generateDevResponse(body: string): string {
  return `🔧 开发任务已接收

**任务**: ${body.slice(0, 50)}...

**计划**:
1. 分析需求
2. 设计方案
3. 实现代码
4. 单元测试

详见 debug_dev.md`;
}

/**
 * Reviewer 响应生成
 */
function generateReviewerResponse(body: string): string {
  return `🔍 开始代码审查

**审查范围**: ${body.slice(0, 50)}...

**检查项**:
- 代码风格
- 错误处理
- 安全性
- 性能

审查结果将记录到 review_*.md`;
}

/**
 * QA 响应生成
 */
function generateQAResponse(body: string): string {
  return `🧪 开始测试

**测试范围**: ${body.slice(0, 50)}...

**测试计划**:
- 功能测试
- 边界测试
- 回归测试

测试结果将记录到 qa_report.md`;
}
