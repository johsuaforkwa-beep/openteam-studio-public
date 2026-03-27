/**
 * OpenTeam Studio - State Store
 * 全局状态管理 + localStorage 持久化
 */

// ─── State ─────────────────────────────────────────

export const state = {
  // 当前选中的 Agent ID
  currentAgentId: 'dev-01',
  
  // 当前选中的标签页
  currentEtab: 'soul',
  
  // Team Builder 中的成员
  builderSlots: [],
  
  // 已安装的 Team（商城）
  installedTeams: new Set(['m5']),
  
  // 正在编辑的 Team ID
  editingTeamId: null,
  
  // 从服务器加载的 Teams
  teamsFromServer: [],
};

// ─── Listeners ─────────────────────────────────────────

const listeners = new Map();

/**
 * 订阅状态变化
 */
export function subscribe(key, handler) {
  if (!listeners.has(key)) {
    listeners.set(key, []);
  }
  listeners.get(key).push(handler);
  
  // 返回取消订阅函数
  return () => {
    const arr = listeners.get(key);
    const idx = arr.indexOf(handler);
    if (idx >= 0) arr.splice(idx, 1);
  };
}

/**
 * 通知订阅者
 */
function notify(key) {
  const handlers = listeners.get(key) || [];
  handlers.forEach(h => h(state[key]));
}

// ─── Actions ─────────────────────────────────────────

/**
 * 设置当前 Agent
 */
export function setCurrentAgent(agentId) {
  state.currentAgentId = agentId;
  notify('currentAgentId');
  syncToStorage();
}

/**
 * 设置当前标签页
 */
export function setCurrentEtab(etab) {
  state.currentEtab = etab;
  notify('currentEtab');
  syncToStorage();
}

/**
 * 添加 Builder 成员
 */
export function addBuilderSlot(agentId) {
  if (!state.builderSlots.includes(agentId)) {
    state.builderSlots.push(agentId);
    notify('builderSlots');
    syncToStorage();
  }
}

/**
 * 移除 Builder 成员
 */
export function removeBuilderSlot(agentId) {
  state.builderSlots = state.builderSlots.filter(id => id !== agentId);
  notify('builderSlots');
  syncToStorage();
}

/**
 * 清空 Builder
 */
export function clearBuilderSlots() {
  state.builderSlots = [];
  notify('builderSlots');
  syncToStorage();
}

/**
 * 设置编辑中的 Team
 */
export function setEditingTeam(teamId) {
  state.editingTeamId = teamId;
  notify('editingTeamId');
}

/**
 * 安装 Team（商城）
 */
export function installTeam(teamId) {
  state.installedTeams.add(teamId);
  notify('installedTeams');
  syncToStorage();
}

/**
 * 卸载 Team（商城）
 */
export function uninstallTeam(teamId) {
  state.installedTeams.delete(teamId);
  notify('installedTeams');
  syncToStorage();
}

/**
 * 设置服务器 Teams
 */
export function setTeamsFromServer(teams) {
  state.teamsFromServer = teams;
  notify('teamsFromServer');
}

// ─── Storage Sync ─────────────────────────────────────────

const STORAGE_KEY = 'openteam_studio_state';

/**
 * 同步状态到 localStorage
 */
export function syncToStorage() {
  try {
    const data = {
      currentAgentId: state.currentAgentId,
      currentEtab: state.currentEtab,
      builderSlots: state.builderSlots,
      installedTeams: Array.from(state.installedTeams),
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[Store] Failed to sync:', e);
  }
}

/**
 * 从 localStorage 加载状态
 */
export function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    
    const data = JSON.parse(raw);
    
    // 只恢复 5 分钟内的状态
    if (Date.now() - data.timestamp > 5 * 60 * 1000) return;
    
    if (data.currentAgentId) state.currentAgentId = data.currentAgentId;
    if (data.currentEtab) state.currentEtab = data.currentEtab;
    if (data.builderSlots) state.builderSlots = data.builderSlots;
    if (data.installedTeams) state.installedTeams = new Set(data.installedTeams);
    
  } catch (e) {
    console.warn('[Store] Failed to load:', e);
  }
}

// 每 10 秒自动同步
setInterval(syncToStorage, 10000);
