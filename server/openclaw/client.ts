/**
 * OpenClaw Gateway Client
 * 
 * 连接 OpenClaw Gateway，提供 agent session 管理
 */

import WebSocket from 'ws';
import { randomUUID } from 'crypto';
import type { AgentStatus } from '../../core/types/index.js';

// === Types ===

export interface GatewayConfig {
  url: string;          // e.g. ws://127.0.0.1:18789
  token?: string;       // Gateway auth token
}

interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;  // GatewayClientId
    version: string;
    platform: string;
    mode: string;  // GatewayClientMode
  };
  role: 'operator' | 'node';
  scopes: string[];
  auth: { token?: string };
  locale: string;
  userAgent: string;
}

interface GatewayRequest {
  type: 'req';
  id: string;
  method: string;
  params: Record<string, any>;
}

interface GatewayResponse {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: any;
  error?: { message: string; details?: any };
}

interface GatewayEvent {
  type: 'event';
  event: string;
  payload: any;
  seq?: number;
}

type GatewayMessage = GatewayRequest | GatewayResponse | GatewayEvent;

interface AgentSession {
  sessionKey: string;
  agentId: string;
  status: 'spawning' | 'running' | 'idle' | 'error';
  createdAt: Date;
}

export interface AgentResponse {
  type: 'agent-reply' | 'agent-thinking' | 'agent-status' | 'agent-outbound' | 'agent-intercept' | 'error';
  from: string;
  to?: string;            // 目标 agentId (agent-outbound/agent-intercept 专用)
  body?: string;
  thinking?: string;      // 思考内容（折叠显示）
  status?: AgentStatus | string;  // 支持多种状态格式
  error?: string;
  timestamp: string;
}

// === OpenClawClient ===

export class OpenClawClient {
  private config: GatewayConfig;
  private ws: WebSocket | null = null;
  private connected: boolean = false;
  private pendingRequests: Map<string, { resolve: Function; reject: Function }> = new Map();
  private agentSessions: Map<string, AgentSession> = new Map();
  private responseCallbacks: ((response: AgentResponse) => void)[] = [];
  private eventCallbacks: ((event: GatewayEvent) => void)[] = [];

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  /**
   * 连接到 Gateway
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[OpenClaw] Connecting to ${this.config.url}...`);

      this.ws = new WebSocket(this.config.url, {
        headers: {
          'Origin': process.env.OPENCLAW_STUDIO_ORIGIN || `http://localhost:${process.env.PORT || '3456'}`,
        },
      });

      // 等待 challenge
      let challengeReceived = false;

      this.ws.on('message', (data: WebSocket.RawData) => {
        try {
          const msg = JSON.parse(data.toString()) as GatewayMessage;
          this.handleMessage(msg);

          // 收到 challenge 后发送 connect
          if (!challengeReceived && msg.type === 'event' && msg.event === 'connect.challenge') {
            challengeReceived = true;
            this.sendConnect(msg.payload, resolve, reject);
          }
        } catch (e) {
          console.error('[OpenClaw] Failed to parse message:', e);
        }
      });

      this.ws.on('open', () => {
        console.log('[OpenClaw] WebSocket opened, waiting for challenge...');
      });

      this.ws.on('error', (err) => {
        console.error('[OpenClaw] WebSocket error:', err.message);
        if (!this.connected) reject(err);
      });

      this.ws.on('close', () => {
        console.log('[OpenClaw] WebSocket closed');
        this.connected = false;
      });

      // 超时处理
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  /**
   * 发送 connect 请求
   */
  private sendConnect(
    challenge: { nonce: string; ts: number },
    resolve: () => void,
    reject: (err: Error) => void
  ): void {
    const connectParams: ConnectParams = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'openclaw-control-ui',  // 必须是有效的 GatewayClientId
        version: '0.1.0',
        platform: process.platform,
        mode: 'ui',                  // 必须是有效的 GatewayClientMode
      },
      role: 'operator',
      scopes: ['operator.read', 'operator.write', 'operator.admin'],
      auth: { token: this.config.token },
      locale: 'zh-CN',
      userAgent: 'OpenTeam-Studio/0.1.0',
    };

    this.sendRequest('connect', connectParams)
      .then((res) => {
        if (res.ok) {
          this.connected = true;
          console.log('[OpenClaw] Connected successfully');
          resolve();
        } else {
          console.error('[OpenClaw] Connect failed:', res.error);
          reject(new Error(`Connect failed: ${res.error?.message || 'Unknown error'}`));
        }
      })
      .catch((err) => {
        console.error('[OpenClaw] Connect error:', err);
        reject(err);
      });
  }

  /**
   * 处理 Gateway 消息
   */
  private handleMessage(msg: GatewayMessage): void {
    if (msg.type === 'res') {
      // 响应
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);
        pending.resolve(msg);
      }
    } else if (msg.type === 'event') {
      // 事件
      console.log(`[OpenClaw] Event: ${msg.event}`, JSON.stringify(msg.payload || {}).slice(0, 200));
      
      // 记录完整事件用于调试
      if (msg.event === 'agent' || msg.event === 'chat') {
        console.log(`[OpenClaw] Full ${msg.event} event:`, JSON.stringify(msg.payload || {}));
      }
      
      // 处理 agent 相关事件
      // OpenClaw Gateway 发送的事件格式:
      // - "agent" - agent 状态更新、thinking、response 等
      // - "chat" - 对话消息
      if (msg.event === 'agent') {
        this.handleAgentEvent(msg.payload);
      } else if (msg.event === 'chat') {
        this.handleChatEvent(msg.payload);
      } else if (msg.event === 'agent.response' || msg.event === 'agent.reply') {
        this.handleAgentResponse(msg.payload);
      } else if (msg.event === 'agent.thinking') {
        this.handleAgentThinking(msg.payload);
      }

      // 通知事件回调
      this.eventCallbacks.forEach(cb => cb(msg));
    }
  }

  /**
   * 处理 agent 事件 (OpenClaw 主要事件格式)
   */
  private handleAgentEvent(payload: any): void {
    // agent 事件可能包含多种类型的数据
    // 检查 payload 结构
    if (!payload) return;
    
    // OpenClaw agent 事件格式:
    // { sessionKey: "agent:pm-01:main", stream: "assistant", data: { text: "...", delta: "..." } }
    // sessionKey 格式: agent:<agentId>:<sessionName>
    
    const from = this.extractAgentId(payload.sessionKey);
    
    // 检查是否有工具调用（sessions_send 等）- 透明度关键
    if (payload.data?.toolCalls || payload.toolCalls) {
      this.handleToolCalls(from, payload.data?.toolCalls || payload.toolCalls);
    }
    
    // 检查是否有 data.text 字段（流式响应）
    if (payload.data?.text) {
      const isThinking = payload.stream === 'assistant';
      const response: AgentResponse = {
        type: isThinking ? 'agent-thinking' : 'agent-reply',
        from: from,
        body: payload.data.text,
        timestamp: new Date().toISOString(),
      };
      this.responseCallbacks.forEach(cb => cb(response));
      return;
    }
    
    // 检查是否有 message 或 content 字段（完整响应）
    if (payload.message || payload.content) {
      const content = payload.message?.content || payload.content || '';
      // 如果 content 是数组，提取文本
      let body = '';
      if (Array.isArray(content)) {
        body = content.map((c: any) => c.text || c).join('');
      } else {
        body = content;
      }
      
      const response: AgentResponse = {
        type: 'agent-reply',
        from: from,
        body: body,
        timestamp: new Date().toISOString(),
      };
      this.responseCallbacks.forEach(cb => cb(response));
    }
    
    // 检查是否有 thinking 字段（实时思考）
    if (payload.thinking) {
      const response: AgentResponse = {
        type: 'agent-thinking',
        from: from,
        body: payload.thinking,
        timestamp: new Date().toISOString(),
      };
      this.responseCallbacks.forEach(cb => cb(response));
    }
    
    // 检查状态变更
    if (payload.status || payload.data?.phase) {
      const response: AgentResponse = {
        type: 'agent-status',
        from: from,
        status: payload.status || payload.data?.phase,
        body: payload.task || payload.statusText || '',
        timestamp: new Date().toISOString(),
      };
      this.responseCallbacks.forEach(cb => cb(response));
    }
  }
  
  /**
   * 处理工具调用 - 实现透明度
   * 检测 sessions_send 等工具调用并广播完整消息内容
   */
  private handleToolCalls(from: string, toolCalls: any[]): void {
    if (!toolCalls || !Array.isArray(toolCalls)) return;
    
    for (const toolCall of toolCalls) {
      // 检测 sessions_send 工具调用
      if (toolCall.name === 'sessions_send' || toolCall.function?.name === 'sessions_send') {
        const args = toolCall.arguments || toolCall.function?.arguments || {};
        const targetSession = args.sessionKey || args.label || 'unknown';
        const message = args.message || '';
        
        // 提取目标 agentId（sessionKey 格式: agent:xxx:main）
        const targetAgentId = this.extractAgentId(targetSession);
        
        // 广播完整的消息内容（agent-intercept 类型）
        // 这让 Dashboard 能够看到并检查所有 agent 间通信
        const response: AgentResponse = {
          type: 'agent-intercept',
          from: from,
          to: targetAgentId,
          body: message,
          timestamp: new Date().toISOString(),
        };
        this.responseCallbacks.forEach(cb => cb(response));
        
        console.log(`[OpenClaw] Agent-intercept: ${from} → ${targetAgentId}: ${message.slice(0, 50)}...`);
      }
    }
  }

  /**
   * 处理 chat 事件
   */
  private handleChatEvent(payload: any): void {
    // chat 事件包含对话消息
    if (!payload) return;
    
    const from = this.extractAgentId(payload.sessionKey);
    const message = payload.message || payload;
    
    // 检查是否有 assistant 消息
    if (message.role === 'assistant' && message.content) {
      // 提取文本内容
      let body = '';
      if (Array.isArray(message.content)) {
        body = message.content.map((c: any) => c.text || c).join('');
      } else {
        body = message.content;
      }
      
      // 只在 state 为 "final" 时发送完整响应
      if (payload.state === 'final') {
        const response: AgentResponse = {
          type: 'agent-reply',
          from: from,
          body: body,
          timestamp: new Date().toISOString(),
        };
        this.responseCallbacks.forEach(cb => cb(response));
      } else if (payload.state === 'delta') {
        // 流式更新
        const response: AgentResponse = {
          type: 'agent-thinking',
          from: from,
          body: body,
          timestamp: new Date().toISOString(),
        };
        this.responseCallbacks.forEach(cb => cb(response));
      }
    } else if (payload.state === 'final') {
      // chat 事件只有 state: "final"，需要获取历史记录
      // 这可能是因为 OpenClaw Gateway 的版本不同
      // 在 final 状态下，获取最近的对话历史
      this.fetchChatHistory(payload.sessionKey, from);
    }
  }

  /**
   * 获取对话历史
   */
  private async fetchChatHistory(sessionKey: string, from: string): Promise<void> {
    try {
      const response = await this.sendRequest('chat.history', {
        sessionKey: sessionKey,
        limit: 1,
      });
      
      if (response.ok && response.payload?.messages?.length > 0) {
        // 获取最后一条 assistant 消息
        const messages = response.payload.messages;
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          if (msg.role === 'assistant') {
            let body = '';
            const content = msg.content;
            
            if (typeof content === 'string') {
              body = content;
            } else if (Array.isArray(content)) {
              body = content.map((c: any) => {
                if (typeof c === 'string') return c;
                if (c.text) return c.text;
                return '';
              }).join('');
            } else if (content && typeof content === 'object') {
              // 可能是 { text: "..." } 或类似结构
              body = content.text || JSON.stringify(content);
            }
            
            if (body) {
              const agentResponse: AgentResponse = {
                type: 'agent-reply',
                from: from,
                body: body,
                timestamp: new Date().toISOString(),
              };
              this.responseCallbacks.forEach(cb => cb(agentResponse));
              console.log(`[OpenClaw] Got reply from history for ${from}: ${body.slice(0, 50)}...`);
            }
            break;
          }
        }
      }
    } catch (error) {
      console.error('[OpenClaw] Failed to fetch chat history:', error);
    }
  }

  /**
   * 从 sessionKey 提取 agentId
   * sessionKey 格式: agent:<agentId>:<sessionName>
   * 例如: agent:pm-01:main → pm-01
   */
  private extractAgentId(sessionKey: string | undefined): string {
    if (!sessionKey) return 'unknown';
    const parts = sessionKey.split(':');
    // agent:pm-01:main → parts = ['agent', 'pm-01', 'main']
    if (parts.length >= 2 && parts[0] === 'agent') {
      return parts[1];
    }
    return sessionKey;
  }

  /**
   * 处理 agent 响应
   */
  private handleAgentResponse(payload: any): void {
    const response: AgentResponse = {
      type: 'agent-reply',
      from: payload.agentId || payload.from || 'unknown',
      body: payload.body || payload.text || '',
      timestamp: new Date().toISOString(),
    };

    this.responseCallbacks.forEach(cb => cb(response));
  }

  /**
   * 处理 agent thinking
   */
  private handleAgentThinking(payload: any): void {
    const response: AgentResponse = {
      type: 'agent-thinking',
      from: payload.agentId || payload.from || 'unknown',
      body: payload.text || payload.content || '',
      timestamp: new Date().toISOString(),
    };

    this.responseCallbacks.forEach(cb => cb(response));
  }

  /**
   * 发送请求
   */
  private sendRequest(method: string, params: Record<string, any>): Promise<GatewayResponse> {
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const req: GatewayRequest = {
        type: 'req',
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, { resolve, reject });

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(req));
      } else {
        this.pendingRequests.delete(id);
        reject(new Error('WebSocket not connected'));
      }

      // 超时
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  /**
   * 发送消息给 agent (通过 chat.send)
   * 
   * OpenClaw sessionKey 格式: agent:<agentId>:<mainKey>
   * 例如: agent:pm-01:main
   */
  async sendToAgent(agentId: string, message: string): Promise<void> {
    console.log(`[OpenClaw] Sending message to ${agentId}: ${message.slice(0, 50)}...`);

    // 构造正确的 sessionKey: agent:<agentId>:main
    // OpenClaw 的 sessionKey 格式是 agent:<agentId>:<sessionName>
    // 使用 "main" 作为默认 sessionName
    const sessionKey = `agent:${agentId}:main`;

    // 使用 chat.send 方法发送消息给指定 agent
    const response = await this.sendRequest('chat.send', {
      sessionKey: sessionKey,
      message: message,
      idempotencyKey: `${agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });

    if (!response.ok) {
      console.error('[OpenClaw] chat.send failed:', response.error);
      throw new Error(`Failed to send message: ${response.error?.message || 'Unknown error'}`);
    }

    console.log(`[OpenClaw] Message sent to ${agentId} (sessionKey: ${sessionKey})`);
  }

  /**
   * 注册响应回调
   */
  onResponse(callback: (response: AgentResponse) => void): void {
    this.responseCallbacks.push(callback);
  }

  /**
   * 注册事件回调
   */
  onEvent(callback: (event: GatewayEvent) => void): void {
    this.eventCallbacks.push(callback);
  }

  /**
   * 获取连接状态
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.agentSessions.clear();
    this.pendingRequests.clear();
  }
}

// === Singleton ===

let clientInstance: OpenClawClient | null = null;

export function getOpenClawClient(): OpenClawClient | null {
  return clientInstance;
}

export async function initOpenClawClient(config?: GatewayConfig): Promise<OpenClawClient> {
  if (clientInstance) {
    return clientInstance;
  }

  const defaultConfig: GatewayConfig = {
    url: process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789',
    token: process.env.OPENCLAW_GATEWAY_TOKEN,
  };

  clientInstance = new OpenClawClient(config || defaultConfig);
  await clientInstance.connect();
  
  return clientInstance;
}
