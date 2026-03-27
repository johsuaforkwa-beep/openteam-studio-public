/**
 * Chat Panel - Agent 间消息实时显示
 * 监听 WebSocket，显示 agent-intercept 和 agent-blocked 消息
 */

import { AGENT_COLORS, AGENTS_DB } from './data/static-data.js';

// ─── State ────────────────────────────────────────────────

let ws = null;
let isConnected = false;
let reconnectTimer = null;
let messages = [];
const MAX_MESSAGES = 100;

// ─── Init ────────────────────────────────────────────────

export function initChatPanel() {
  renderChatPanel();
  connectWebSocket();
}

// ─── WebSocket ────────────────────────────────────────────

function connectWebSocket() {
  if (ws) {
    ws.close();
    ws = null;
  }

  const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  // 获取当前 teamId（从 URL 参数或默认值）
  const urlParams = new URLSearchParams(location.search);
  const teamId = urlParams.get('teamId') || 'vibe-coding';
  const wsUrl = `${wsProtocol}//${location.host}/ws?teamId=${teamId}`;

  console.log('[ChatPanel] Connecting to', wsUrl);

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[ChatPanel] WebSocket connected');
      isConnected = true;
      updateConnectionStatus(true);
      
      // 清除重连定时器
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch (e) {
        console.warn('[ChatPanel] Failed to parse message:', e);
      }
    };

    ws.onclose = () => {
      console.log('[ChatPanel] WebSocket closed');
      isConnected = false;
      updateConnectionStatus(false);
      
      // 5秒后重连
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          if (!isConnected) {
            connectWebSocket();
          }
        }, 5000);
      }
    };

    ws.onerror = (err) => {
      console.error('[ChatPanel] WebSocket error:', err);
    };
  } catch (e) {
    console.error('[ChatPanel] Failed to create WebSocket:', e);
  }
}

// ─── Message Handling ─────────────────────────────────────

function handleMessage(msg) {
  // 只处理 agent 相关消息
  if (!msg.type || !msg.type.startsWith('agent-')) return;
  
  // agent-intercept: agent 间消息
  // agent-blocked: 被阻止的消息
  // agent-thinking: 思考中
  // agent-reply: 回复
  // agent-status: 状态更新
  
  console.log('[ChatPanel] Received:', msg.type, msg.from, '->', msg.to);
  
  // 添加到消息列表
  addMessage(msg);
  
  // 更新 UI
  renderMessages();
  
  // 更新 agent 状态
  if (msg.type === 'agent-status') {
    updateAgentStatus(msg.from, msg.status);
  }
}

function addMessage(msg) {
  messages.push({
    ...msg,
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: msg.timestamp || new Date().toISOString(),
  });
  
  // 限制消息数量
  if (messages.length > MAX_MESSAGES) {
    messages = messages.slice(-MAX_MESSAGES);
  }
}

// ─── Render ───────────────────────────────────────────────

function renderChatPanel() {
  const container = document.getElementById('chatPanel');
  if (!container) return;
  
  container.innerHTML = `
    <div class="chat-header">
      <span class="chat-title">💬 Agent 对话</span>
      <div class="chat-status">
        <span class="status-dot" id="chatStatusDot"></span>
        <span id="chatStatusText">连接中...</span>
      </div>
      <button class="chat-clear-btn" onclick="window.clearChatMessages()" title="清空消息">🗑</button>
    </div>
    <div class="chat-messages" id="chatMessages">
      <div class="chat-empty">等待 Agent 消息...</div>
    </div>
  `;
}

function renderMessages() {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  
  if (messages.length === 0) {
    container.innerHTML = '<div class="chat-empty">等待 Agent 消息...</div>';
    return;
  }
  
  container.innerHTML = messages.map(msg => renderMessage(msg)).join('');
  
  // 滚动到底部
  container.scrollTop = container.scrollHeight;
}

function renderMessage(msg) {
  const fromAgent = AGENTS_DB.find(a => a.id === msg.from);
  const toAgent = AGENTS_DB.find(a => a.id === msg.to);
  
  const fromColor = fromAgent ? AGENT_COLORS[fromAgent.colorKey] : AGENT_COLORS.purple;
  const toColor = toAgent ? AGENT_COLORS[toAgent.colorKey] : AGENT_COLORS.purple;
  
  const time = new Date(msg.timestamp).toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });
  
  // 根据消息类型渲染不同样式
  switch (msg.type) {
    case 'agent-intercept':
      return `
        <div class="chat-msg chat-msg-intercept">
          <div class="chat-msg-header">
            <span class="chat-msg-from" style="background:${fromColor.bg};color:${fromColor.color}">${msg.from?.slice(0, 2).toUpperCase() || '??'}</span>
            <span class="chat-msg-arrow">→</span>
            <span class="chat-msg-to" style="background:${toColor.bg};color:${toColor.color}">${msg.to?.slice(0, 2).toUpperCase() || '??'}</span>
            <span class="chat-msg-time">${time}</span>
          </div>
          <div class="chat-msg-body">${escapeHtml(msg.body?.slice(0, 500) || '')}</div>
        </div>
      `;
      
    case 'agent-blocked':
      return `
        <div class="chat-msg chat-msg-blocked">
          <div class="chat-msg-header">
            <span class="chat-msg-from" style="background:${fromColor.bg};color:${fromColor.color}">${msg.from?.slice(0, 2).toUpperCase() || '??'}</span>
            <span class="chat-msg-arrow blocked">✕</span>
            <span class="chat-msg-to" style="background:${toColor.bg};color:${toColor.color}">${msg.to?.slice(0, 2).toUpperCase() || '??'}</span>
            <span class="chat-msg-time">${time}</span>
          </div>
          <div class="chat-msg-body blocked">${escapeHtml(msg.body || '消息被阻止')}</div>
        </div>
      `;
      
    case 'agent-thinking':
      return `
        <div class="chat-msg chat-msg-thinking">
          <div class="chat-msg-header">
            <span class="chat-msg-from" style="background:${fromColor.bg};color:${fromColor.color}">${msg.from?.slice(0, 2).toUpperCase() || '??'}</span>
            <span class="chat-msg-label">💭 思考中</span>
            <span class="chat-msg-time">${time}</span>
          </div>
          ${msg.thinking ? `<div class="chat-msg-thinking-body">${escapeHtml(msg.thinking?.slice(0, 300) || '')}</div>` : ''}
        </div>
      `;
      
    case 'agent-reply':
      return `
        <div class="chat-msg chat-msg-reply">
          <div class="chat-msg-header">
            <span class="chat-msg-from" style="background:${fromColor.bg};color:${fromColor.color}">${msg.from?.slice(0, 2).toUpperCase() || '??'}</span>
            <span class="chat-msg-label">💬 回复</span>
            <span class="chat-msg-time">${time}</span>
          </div>
          <div class="chat-msg-body">${escapeHtml(msg.body?.slice(0, 500) || '')}</div>
        </div>
      `;
      
    case 'agent-status':
      const statusIcon = msg.status === 'active' ? '🟢' : msg.status === 'idle' ? '⚪' : '🔴';
      return `
        <div class="chat-msg chat-msg-status">
          <span class="chat-msg-from" style="background:${fromColor.bg};color:${fromColor.color}">${msg.from?.slice(0, 2).toUpperCase() || '??'}</span>
          <span class="chat-msg-status-text">${statusIcon} ${msg.status || 'unknown'}</span>
          <span class="chat-msg-time">${time}</span>
        </div>
      `;
      
    default:
      return `
        <div class="chat-msg">
          <div class="chat-msg-header">
            <span class="chat-msg-type">${msg.type}</span>
            <span class="chat-msg-time">${time}</span>
          </div>
          <div class="chat-msg-body">${escapeHtml(JSON.stringify(msg, null, 2)?.slice(0, 300) || '')}</div>
        </div>
      `;
  }
}

// ─── Helpers ────────────────────────────────────────────────

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateConnectionStatus(connected) {
  const dot = document.getElementById('chatStatusDot');
  const text = document.getElementById('chatStatusText');
  
  if (dot) {
    dot.className = 'status-dot' + (connected ? ' connected' : '');
  }
  if (text) {
    text.textContent = connected ? '已连接' : '未连接';
  }
}

function updateAgentStatus(agentId, status) {
  const ag = AGENTS_DB.find(a => a.id === agentId);
  if (ag) {
    ag.status = status;
    // 触发 UI 更新（如果有的话）
    if (window.renderAgentList) {
      window.renderAgentList();
    }
  }
}

// ─── Global Actions ────────────────────────────────────────

window.clearChatMessages = function() {
  messages = [];
  renderMessages();
};

// ─── Export ────────────────────────────────────────────────

export { messages, isConnected };
