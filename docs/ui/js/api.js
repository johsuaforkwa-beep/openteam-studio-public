/**
 * OpenTeam Studio - API Client
 * 封装所有 fetch 调用
 */

const API_BASE = window.location.origin;

// ─── Agent API ─────────────────────────────────────────

export const AgentAPI = {
  /**
   * 列出所有 Agent
   */
  async list() {
    const res = await fetch(`${API_BASE}/api/agents`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  /**
   * 获取单个 Agent 详情
   */
  async get(id) {
    const res = await fetch(`${API_BASE}/api/agents/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  /**
   * 创建 Agent
   */
  async create(data) {
    const res = await fetch(`${API_BASE}/api/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  /**
   * 更新 Agent
   */
  async update(id, data) {
    const res = await fetch(`${API_BASE}/api/agents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  /**
   * 删除 Agent
   */
  async delete(id) {
    const res = await fetch(`${API_BASE}/api/agents/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};

// ─── Team API ─────────────────────────────────────────

export const TeamAPI = {
  /**
   * 列出所有 Team
   */
  async list() {
    const res = await fetch(`${API_BASE}/api/teams`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // API 返回 {ok: true, data: [...]}
    return data.data || data;
  },

  /**
   * 获取 Team 的 Agents
   */
  async getAgents(teamId) {
    const res = await fetch(`${API_BASE}/api/teams/${teamId}/agents`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  /**
   * 创建 Team
   */
  async create(data) {
    const res = await fetch(`${API_BASE}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  /**
   * 更新 Team
   */
  async update(id, data) {
    const res = await fetch(`${API_BASE}/api/teams/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  /**
   * 删除 Team
   */
  async delete(id) {
    const res = await fetch(`${API_BASE}/api/teams/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};

// ─── File API ─────────────────────────────────────────

export const FileAPI = {
  /**
   * 获取 Team 文件列表
   */
  async list(teamId) {
    const res = await fetch(`${API_BASE}/api/teams/${teamId}/files`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  /**
   * 获取文件内容
   */
  async get(teamId, filePath) {
    const res = await fetch(`${API_BASE}/api/teams/${teamId}/files/${filePath}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  /**
   * 写入文件
   */
  async write(teamId, filePath, content, isDirectory = false) {
    const res = await fetch(`${API_BASE}/api/teams/${teamId}/files/${filePath}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, isDirectory }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  /**
   * 删除文件
   */
  async delete(teamId, filePath) {
    const res = await fetch(`${API_BASE}/api/teams/${teamId}/files/${filePath}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  /**
   * 重命名文件
   */
  async rename(teamId, oldPath, newName) {
    const res = await fetch(`${API_BASE}/api/teams/${teamId}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPath, newName }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};

// ─── LLM API ─────────────────────────────────────────

export const LLMAPI = {
  /**
   * 获取 LLM 配置
   */
  async getConfig() {
    const res = await fetch(`${API_BASE}/api/llm-config`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  /**
   * 更新 LLM 配置
   */
  async setConfig(config) {
    const res = await fetch(`${API_BASE}/api/llm-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  /**
   * 发送消息到 LLM
   */
  async chat(messages, agent = null) {
    const res = await fetch(`${API_BASE}/api/llm-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, agent }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};

// ─── WebSocket ─────────────────────────────────────────

let ws = null;
let messageHandlers = [];

export const WS = {
  /**
   * 连接 WebSocket
   */
  connect(teamId, projectId) {
    if (ws) ws.close();
    
    const wsUrl = `${API_BASE.replace('http', 'ws')}/ws?teamId=${teamId}`;
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('[OpenTeam] WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      messageHandlers.forEach(handler => handler(msg));
    };
    
    ws.onclose = () => {
      console.log('[OpenTeam] WebSocket disconnected');
    };
    
    ws.onerror = (err) => {
      console.error('[OpenTeam] WebSocket error:', err);
    };
  },

  /**
   * 发送消息
   */
  send(to, body, context = {}) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    ws.send(JSON.stringify({
      type: 'user-message',
      to,
      body,
      context: { teamId: 'vibe-coding', projectId: 'default', ...context },
      timestamp: new Date().toISOString(),
    }));
    return true;
  },

  /**
   * 订阅消息
   */
  onMessage(handler) {
    messageHandlers.push(handler);
    return () => {
      messageHandlers = messageHandlers.filter(h => h !== handler);
    };
  },

  /**
   * 关闭连接
   */
  close() {
    if (ws) {
      ws.close();
      ws = null;
    }
  },
};
