/**
 * OpenTeam Studio - App Entry
 * 应用入口：初始化 + 页面路由
 */

import { state, loadFromStorage, syncToStorage } from './store.js';
import { initAgentStudio, renderAgentList, renderEditorFor, switchEtab } from './pages/agent-studio.js';
import { initTeamsPage, renderMyTeams } from './pages/teams-page.js';
import { initMarketPage } from './pages/market-page.js';
import { initChatPanel } from './chat-panel.js';

// ─── Init ────────────────────────────────────────────────

async function init() {
  // 加载保存的状态
  loadFromStorage();
  
  // 初始化各页面
  await initAgentStudio();
  await initTeamsPage();
  initMarketPage();
  
  // 初始化聊天面板（Agent 间消息监听）
  initChatPanel();
  
  console.log('[OpenTeam] App initialized');
}

// ─── Page Navigation ────────────────────────────────────────

window.showPage = function(pageId, tab, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + pageId)?.classList.add('active');
  
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  tab?.classList.add('active');
  
  if (pageId === 'teams') renderMyTeams();
};

// ─── Utils ────────────────────────────────────────────────

window.showNotif = function(msg, type = 'success') {
  const n = document.getElementById('notif');
  if (!n) return;
  
  document.getElementById('notifText').textContent = msg;
  n.className = 'notif show';
  if (type !== 'success') n.classList.add(type);
  
  clearTimeout(n._t);
  const displayTime = type === 'loading' ? 10000 : 3000 + Math.min(7000, Math.floor(msg.length / 50) * 1000);
  n._t = setTimeout(() => n.classList.remove('show'), displayTime);
  
  n.onclick = () => {
    clearTimeout(n._t);
    n.classList.remove('show');
  };
};

window.deployAll = function() {
  window.showNotif('⚡ 正在部署所有 Agents…');
};

window.exportSOUL = function() {
  window.showNotif('↓ 导出 SOUL.md');
};

window.openTestChat = function() {
  window.showNotif('打开测试对话窗口');
};

// ─── Keyboard ────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('agentPickerModal');
    if (modal?.classList.contains('open')) {
      window.closeModal();
      e.preventDefault();
    }
  }
});

// ─── Start ────────────────────────────────────────────────

init();
