/**
 * OpenTeam Studio - WebSocket Server
 * WebSocket 服务主入口
 * 
 * 目录结构：
 * - Agent 定义：~/.openclaw/agents/
 * - Team 实例：项目目录/teams/
 * 
 * 路由：
 * - /teams/{teamId}/* → 项目目录/teams/{teamId}/
 */

// 加载环境变量（必须在其他 import 之前）
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: dirname(fileURLToPath(import.meta.url)) + '/../.env' });

import { WebSocketServer, WebSocket, RawData } from 'ws';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { randomUUID } from 'crypto';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, extname } from 'path';
import type { WebSocketClient, InboundMessage, OutboundMessage } from '../core/types/index.js';
import { getTeamStateManager } from '../core/store/team-state.js';
import { handleInboundMessage, setBroadcastCallback } from './ws-handler.js';
import { handleApiRequest, loadLLMConfig, setBroadcastCallback as setApiBroadcastCallback } from './api/index.js';
import { TEAMS_DIR, PROJECT_ROOT } from './utils/paths.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

export interface ServerOptions {
  port: number;
}

export class OpenTeamServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private port: number;

  constructor(options: ServerOptions) {
    this.port = options.port;
  }

  /**
   * 处理 HTTP 请求
   */
  private async handleHttpRequest(
    req: IncomingMessage, 
    res: ServerResponse, 
    teams: any[]
  ): Promise<void> {
    // API 路由
    const handled = await handleApiRequest(req, res, '');
    if (handled) return;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = req.url || '/';

    // Health check
    if (url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        ok: true, 
        clients: this.clients.size,
        teams: teams.length,
        teamsDir: TEAMS_DIR,
      }));
      return;
    }

    // Teams API (legacy)
    if (url === '/api/teams') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(teams));
      return;
    }

    // Team Agents API (legacy)
    const agentsMatch = url.match(/^\/api\/teams\/([^\/]+)\/agents$/);
    if (agentsMatch) {
      const teamId = agentsMatch[1];
      const teamManager = getTeamStateManager();
      const agents = teamManager.getTeamAgents(teamId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(agents));
      return;
    }

    // 静态文件服务
    this.serveStatic(url, res);
  }

  /**
   * 静态文件服务
   * 
   * 路由规则：
   * - /ui/* → 项目目录/ui/
   * - /teams/{teamId}/* → 项目目录/teams/{teamId}/
   */
  private serveStatic(url: string, res: ServerResponse): void {
    // 根路径重定向到 studio
    if (url === '/' || url === '') {
      res.writeHead(302, { 'Location': '/ui/studio.html' });
      res.end();
      return;
    }

    let filePath: string;

    // UI 文件 → 项目目录/ui/
    if (url.startsWith('/ui/')) {
      filePath = join(PROJECT_ROOT, url);
    }
    // Team 实例文件 → 项目目录/teams/
    else if (url.startsWith('/teams/')) {
      filePath = this.resolveTeamPath(url);
    }
    // 其他文件（兼容旧路径）
    else {
      filePath = join(PROJECT_ROOT, 'ui', url);
    }

    // 安全检查：防止路径遍历攻击
    if (!filePath.startsWith(PROJECT_ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    // 检查文件是否存在
    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    // 读取并返回文件
    try {
      const content = readFileSync(filePath);
      const ext = extname(filePath);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      
      res.setHeader('Content-Type', contentType);
      res.writeHead(200);
      res.end(content);
    } catch (error) {
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  }

  /**
   * 解析 Team 文件路径
   * 
   * 路径结构：
   * - /teams/{teamId}/package/* → 静态文件 (dashboard.html, js/, css/)
   * - /teams/{teamId}/projects/* → 项目运行数据
   * - /teams/{teamId}/* → 自动查找 package/ 目录（兼容旧路径）
   */
  private resolveTeamPath(url: string): string {
    // 解析 /teams/{teamId}/{file}
    const match = url.match(/^\/teams\/([^\/]+)\/(.+)$/);
    if (!match) {
      return join(TEAMS_DIR, url.replace('/teams/', ''));
    }

    const teamId = match[1];
    const file = match[2];

    // 如果路径已经包含 package/ 或 projects/，直接使用
    if (file.startsWith('package/') || file.startsWith('projects/')) {
      return join(TEAMS_DIR, teamId, file);
    }

    // 否则自动查找 package/ 目录（兼容旧路径）
    return join(TEAMS_DIR, teamId, 'package', file);
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    // 初始化 Team 状态管理
    const teamManager = getTeamStateManager();
    const teams = await teamManager.discoverTeams();
    console.log(`[Server] Discovered ${teams.length} teams`);
    console.log(`[Server] Teams directory: ${TEAMS_DIR}`);

    // 初始化 LLM 配置
    loadLLMConfig();

    // 设置广播回调 - 将 OpenClaw 响应广播给所有客户端
    setBroadcastCallback((teamId: string, message: OutboundMessage) => {
      this.broadcast(teamId, message);
    });
    
    // 设置测试 API 的广播回调
    setApiBroadcastCallback((teamId: string, message: OutboundMessage) => {
      this.broadcast(teamId, message);
    });

    // 创建 HTTP server
    const server = createServer((req, res) => {
      this.handleHttpRequest(req, res, teams);
    });

    // 创建 WebSocket server
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    return new Promise((resolve, reject) => {
      server.listen(this.port, () => {
        console.log('');
        console.log('╔═══════════════════════════════════════════╗');
        console.log('║       OpenTeam Studio - Ready!            ║');
        console.log('╚═══════════════════════════════════════════╝');
        console.log('');
        console.log(`🚀 Studio UI:    http://localhost:${this.port}/ui/studio.html`);
        console.log(`📁 Teams:        http://localhost:${this.port}/teams/vibe-coding/package/dashboard.html`);
        console.log(`📡 WebSocket:    ws://localhost:${this.port}/ws`);
        console.log(`❤️  Health:       http://localhost:${this.port}/health`);
        console.log('');
        resolve();
      });
      server.on('error', reject);
    });
  }

  /**
   * 处理新连接
   */
  private handleConnection(ws: WebSocket, req: import('http').IncomingMessage): void {
    const clientId = randomUUID();
    const url = new URL(req.url || '/', `http://localhost:${this.port}`);
    const teamId = url.searchParams.get('teamId') || 'default';
    const projectId = url.searchParams.get('projectId') || undefined;

    const client: WebSocketClient = {
      id: clientId,
      teamId,
      projectId,
      ws,
      connectedAt: new Date().toISOString(),
    };

    this.clients.set(clientId, client);
    console.log(`[WS] Client connected: ${clientId} (team=${teamId})`);

    // 发送欢迎消息 + Team Skill 路径
    const skillPath = join(TEAMS_DIR, teamId, 'package', 'skills', 'SKILL.md');
    this.sendToClient(client, {
      type: 'session-init',
      teamId,
      teamSkillPath: skillPath,
      message: `Team skill location: ${skillPath}`,
      timestamp: new Date().toISOString(),
    });

    ws.on('message', (data: RawData) => {
      this.handleMessage(client, data);
    });

    ws.on('close', () => {
      this.clients.delete(clientId);
      console.log(`[WS] Client disconnected: ${clientId}`);
    });

    ws.on('error', (error) => {
      console.error(`[WS] Client error ${clientId}:`, error.message);
      this.clients.delete(clientId);
    });
  }

  /**
   * 处理消息
   */
  private async handleMessage(client: WebSocketClient, data: RawData): Promise<void> {
    try {
      const message = JSON.parse(data.toString()) as InboundMessage;
      console.log(`[WS] Message from ${client.id}:`, message.type);

      // 处理消息
      const response = await handleInboundMessage(message, client);
      
      if (response) {
        this.sendToClient(client, response);
      }
    } catch (error) {
      console.error(`[WS] Failed to handle message:`, error);
      this.sendToClient(client, {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 发送消息给客户端
   */
  sendToClient(client: WebSocketClient, message: OutboundMessage): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  /**
   * 广播消息给 Team 所有客户端
   */
  broadcast(teamId: string, message: OutboundMessage, excludeClientId?: string): void {
    for (const [id, client] of this.clients) {
      if (client.teamId === teamId && id !== excludeClientId) {
        this.sendToClient(client, message);
      }
    }
  }

  /**
   * 获取连接的客户端数量
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

// 启动服务
const PORT = parseInt(process.env.PORT || '3456', 10);

const server = new OpenTeamServer({
  port: PORT,
});

server.start().then(() => {
  console.log(`[Server] Ready at http://localhost:${PORT}`);
}).catch((error) => {
  console.error('[Server] Failed to start:', error);
  process.exit(1);
});
