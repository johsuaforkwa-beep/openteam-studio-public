/**
 * Vibe Coding Dashboard - Store
 * 状态管理
 */

const STORAGE_KEY = 'openteam_state';
const TEAM_ID = 'vibe-coding';

// 持久化存储键
const PERSIST_KEYS = {
  agentStatus: 'vibe_coding_agent_status',
  privateChats: 'vibe_coding_private_chats',
  chatInputHeight: 'vibe_coding_chat_input_height',
};

let currentProject = 'alpha';
let currentTab = 'thinking';
let currentThinkingAgent = 'dev-01';
let currentFile = null;
let fileContents = { ...FILE_CONTENTS };
let unsaved = {};
let selectedAgentCard = null;
let projectsPath = null;  // 项目数据存储路径

// 思考流状态
const thinkingStreams = {};

// 私聊窗口状态
let privateChatAgent = null;  // 当前打开的私聊窗口对应的 agent
let privateChatActive = false; // 私聊窗口是否激活（用于判断回复应该显示在哪里）
let chatInputHeight = 100;    // 聊天输入栏高度

// === 持久化存储函数 ===

/**
 * 从 localStorage 加载 agent 状态
 */
function loadAgentStatusFromStorage() {
  try {
    const saved = localStorage.getItem(PERSIST_KEYS.agentStatus);
    if (saved) {
      const statusMap = JSON.parse(saved);
      // 应用到 AGENTS 数组
      AGENTS.forEach(ag => {
        if (statusMap[ag.id]) {
          ag.muted = statusMap[ag.id].muted || false;
          ag.offline = statusMap[ag.id].offline || false;
        }
      });
    }
  } catch (e) {
    console.warn('[Store] Failed to load agent status:', e);
  }
}

/**
 * 保存 agent 状态到 localStorage
 */
function saveAgentStatusToStorage() {
  try {
    const statusMap = {};
    AGENTS.forEach(ag => {
      statusMap[ag.id] = { muted: ag.muted, offline: ag.offline };
    });
    localStorage.setItem(PERSIST_KEYS.agentStatus, JSON.stringify(statusMap));
  } catch (e) {
    console.warn('[Store] Failed to save agent status:', e);
  }
}

/**
 * 从 localStorage 加载私聊消息
 */
function loadPrivateChatsFromStorage() {
  try {
    const saved = localStorage.getItem(PERSIST_KEYS.privateChats);
    if (saved) {
      const chats = JSON.parse(saved);
      Object.assign(PRIVATE_CHATS, chats);
    }
  } catch (e) {
    console.warn('[Store] Failed to load private chats:', e);
  }
}

/**
 * 保存私聊消息到 localStorage
 */
function savePrivateChatsToStorage() {
  try {
    localStorage.setItem(PERSIST_KEYS.privateChats, JSON.stringify(PRIVATE_CHATS));
  } catch (e) {
    console.warn('[Store] Failed to save private chats:', e);
  }
}

// 初始化时加载持久化数据
loadAgentStatusFromStorage();
loadPrivateChatsFromStorage();

// 获取 agent 的禁言/离线状态
function getAgentStatus(agentId) {
  const agent = AGENTS.find(a => a.id === agentId);
  return {
    muted: agent?.muted || false,
    offline: agent?.offline || false
  };
}

// 设置 agent 的禁言状态
function setAgentMuted(agentId, muted) {
  const agent = AGENTS.find(a => a.id === agentId);
  if (agent) {
    agent.muted = muted;
    saveAgentStatusToStorage();
  }
}

// 设置 agent 的离线状态
function setAgentOffline(agentId, offline) {
  const agent = AGENTS.find(a => a.id === agentId);
  if (agent) {
    agent.offline = offline;
    saveAgentStatusToStorage();
  }
}

// 获取私聊消息
function getPrivateMessages(agentId) {
  if (!PRIVATE_CHATS[agentId]) PRIVATE_CHATS[agentId] = [];
  return PRIVATE_CHATS[agentId];
}

// 添加私聊消息
function addPrivateMessage(agentId, message) {
  if (!PRIVATE_CHATS[agentId]) PRIVATE_CHATS[agentId] = [];
  PRIVATE_CHATS[agentId].push(message);
  // 限制存储的消息数量（每个 agent 最多保留 100 条）
  if (PRIVATE_CHATS[agentId].length > 100) {
    PRIVATE_CHATS[agentId] = PRIVATE_CHATS[agentId].slice(-100);
  }
  savePrivateChatsToStorage();
}

function getStoreState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch(e) { return {}; }
}

function getActiveTeam() {
  const state = getStoreState();
  if (!state.activeTeamId || !state.teams) return null;
  return state.teams.find(t => t.id === state.activeTeamId) || null;
}

function syncAgentStatusToStore(agentId, status, task) {
  try {
    const state = getStoreState();
    if (!state.agents) return;
    const ag = state.agents.find(a => a.id === agentId);
    if (ag) { ag.status = status; if (task) ag.currentTask = task; }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch(e) {}
}

function backToStudio() {
  window.location.href = '/ui/studio.html#teams';
}

// 导出状态和函数
window.STORE = {
  get currentProject() { return currentProject; },
  set currentProject(v) { currentProject = v; },
  get currentTab() { return currentTab; },
  set currentTab(v) { currentTab = v; },
  get currentThinkingAgent() { return currentThinkingAgent; },
  set currentThinkingAgent(v) { currentThinkingAgent = v; },
  get currentFile() { return currentFile; },
  set currentFile(v) { currentFile = v; },
  get fileContents() { return fileContents; },
  set fileContents(v) { fileContents = v; },
  get unsaved() { return unsaved; },
  set unsaved(v) { unsaved = v; },
  get selectedAgentCard() { return selectedAgentCard; },
  set selectedAgentCard(v) { selectedAgentCard = v; },
  get thinkingStreams() { return thinkingStreams; },
  get projectsPath() { return projectsPath; },
  set projectsPath(v) { projectsPath = v; },
  get privateChatAgent() { return privateChatAgent; },
  set privateChatAgent(v) { privateChatAgent = v; },
  get privateChatActive() { return privateChatActive; },
  set privateChatActive(v) { privateChatActive = v; },
  get chatInputHeight() { return chatInputHeight; },
  set chatInputHeight(v) { chatInputHeight = v; },
  
  TEAM_ID,
  getStoreState,
  getActiveTeam,
  syncAgentStatusToStore,
  backToStudio,
  getAgentStatus,
  setAgentMuted,
  setAgentOffline,
  getPrivateMessages,
  addPrivateMessage,
};
