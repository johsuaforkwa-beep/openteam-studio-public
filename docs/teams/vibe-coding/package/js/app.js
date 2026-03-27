/**
 * Vibe Coding Dashboard - App
 * 主应用逻辑
 */

// === Agent Status ===
function updateAgentStatus(agentId, newStatus, task) {
  const proj = PROJECTS[STORE.currentProject];
  if (!proj.agentStates[agentId]) proj.agentStates[agentId] = { status: 'idle', task: '' };
  proj.agentStates[agentId].status = newStatus;
  proj.agentStates[agentId].task = task;
  STORE.syncAgentStatusToStore(agentId, newStatus, task);
  
  const card = document.getElementById('agent-card-' + agentId);
  if (card) {
    card.className = 'agent-card status-' + newStatus + (STORE.selectedAgentCard === agentId ? ' selected' : '');
    const taskEl = card.querySelector('.agent-task');
    if (taskEl) taskEl.textContent = task;
    const tagEl = card.querySelector('.agent-tag');
    if (tagEl) tagEl.textContent = newStatus === 'working' ? '⚡ working' : newStatus === 'done' ? '✓ done' : newStatus === 'blocked' ? '⊘ blocked' : '· idle';
  }
}

function updateThinkingStream(agentId, text, done = false) {
  const streams = STORE.thinkingStreams;
  if (!streams[agentId]) streams[agentId] = { text: '', done: false };
  streams[agentId].text = text;
  streams[agentId].done = done;
  
  if (done && text) {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    if (!THINKING[agentId]) THINKING[agentId] = [];
    THINKING[agentId].unshift({ time, text, expanded: false });
  }
}

// === Chat ===
function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  const tags = text.match(/#T\d+/g) || [];
  
  // 立即显示用户消息
  COMPONENTS.addChatMessage('user', text, tags);
  input.value = '';
  input.style.height = 'auto';

  const mentionMatch = text.match(/@(\w+[-\d]*)/);
  const targetAgent = mentionMatch ? mentionMatch[1] : 'pm-01';
  
  if (API.wsConnected) {
    API.sendToAgent(targetAgent, text);
  } else {
    // 未连接时，所有消息都给 pm-01 模拟响应
    console.log('[sendMessage] WebSocket not connected, using fallback for:', text);
    setTimeout(() => {
      // 生成模拟响应
      const response = generateFallbackResponse(text);
      COMPONENTS.addChatMessage('pm-01', response, tags);
    }, 500);
  }
}

/**
 * 生成未连接时的模拟响应
 */
function generateFallbackResponse(text) {
  if (text.includes('介绍') || text.includes('自我介绍')) {
    return `📋 我是 PM-01，Vibe Coding 团队的项目经理 AI。

我负责需求分析和团队协调。当前团队成员：

• @dev-01 (Kai) - 前端开发专家
• @dev-02 (Luna) - 后端开发专家  
• @dev-03 (Nova) - 稳定性工程师
• @reviewer-01 (Sage) - 代码审查专家
• @qa-01 (River) - QA 工程师

请告诉我您需要什么帮助？您可以：
- @dev-01 请开发登录功能
- 查看任务进度
- 创建新任务`;
  }
  
  if (text.includes('进度') || text.includes('状态')) {
    return `📊 当前项目进度：

#ACTIVE #T001 登录模块 | @dev-01 开发中
#ACTIVE #T002 注册模块 | @dev-02 开发中
#TODO #T003 个人中心 | @dev-03 待开始

需要详细状态请 @ 对应成员。`;
  }
  
  return `收到消息：${text}

⚠️ 当前未连接到服务器，请检查：
1. 服务是否启动 (npm run dev)
2. 网络连接是否正常

您可以尝试 @pm-01 或 @dev-01 进行对话。`;
}

function handleInputKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// === File Actions ===
async function saveFile() {
  if (!STORE.currentFile) return;
  const ta = document.getElementById('mdTextarea');
  if (!ta) return;
  
  const content = ta.value;
  const btn = document.querySelector('.file-save-btn');
  if (btn) { btn.textContent = '保存中...'; btn.disabled = true; }
  
  try {
    const res = await fetch(`${window.location.origin}/api/teams/${TEAM_ID}/files/${STORE.currentFile}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (data.ok) {
      STORE.unsaved[STORE.currentFile] = false;
      showNotif(`已保存 ${STORE.currentFile}`);
      COMPONENTS.renderPanel();
    } else showNotif('保存失败', 'error', data.error);
  } catch (e) {
    showNotif('保存失败', 'error', e.message);
  }
  if (btn) { btn.textContent = '保存'; btn.disabled = false; }
}

function insertMd(before, after) {
  const ta = document.getElementById('mdTextarea');
  if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  ta.setRangeText(before + ta.value.slice(s, e) + after, s, e, 'end');
  ta.dispatchEvent(new Event('input'));
}

async function contextAction(action) {
  document.getElementById('contextMenu').classList.remove('show');
  if (!contextTarget) return;
  const f = contextTarget;
  
  if (action === 'open' && f.path && f.type !== 'dir') await COMPONENTS.openFile(f.path, f.name);
  else if (action === 'delete' && f.path && confirm(`确定删除 ${f.name}？`)) {
    await fetch(`${window.location.origin}/api/teams/${TEAM_ID}/files/${f.path}`, { method: 'DELETE' });
    showNotif(`已删除 ${f.name}`);
    STORE.currentFile = null;
    await API.loadFilesFromAPI();
    COMPONENTS.renderFileTree();
    COMPONENTS.renderPanel();
  }
}

// === Project ===
async function switchProject(projectId, el) {
  if (!PROJECTS[projectId]) return false;
  STORE.currentProject = projectId;
  STORE.currentFile = null;
  document.querySelectorAll('.proj-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  COMPONENTS.renderAgentStrip();
  COMPONENTS.renderFileTree();
  COMPONENTS.renderPanel();
  showNotif(`切换到 ${projectId}`);
  return false;
}

/**
 * 创建新项目
 * 调用后端 API 在 teams/{teamId}/projects/ 下创建项目目录
 */
async function addProject() {
  const name = prompt('项目名称：');
  if (!name) return;

  try {
    const res = await fetch(`${window.location.origin}/api/teams/${TEAM_ID}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    
    const data = await res.json();
    
    if (data.ok && data.data) {
      const project = data.data;
      const projectId = project.id;
      
      // 添加到本地 PROJECTS 对象
      PROJECTS[projectId] = { 
        name, 
        tasks: [], 
        files: [{ name: 'PROJECT.md', path: 'PROJECT.md', type: 'md' }], 
        agentStates: Object.fromEntries(AGENTS.map(a => [a.id, { status: 'idle', task: '等待任务分配…' }])) 
      };
      STORE.fileContents['PROJECT.md_' + projectId] = `# PROJECT.md — ${name}\n\n## 待开始 #TODO\n\n（暂无任务）`;
      
      // 创建 tab
      const tabs = document.getElementById('projectTabs');
      const btn = tabs.querySelector('.proj-tab-add');
      const tab = document.createElement('div');
      tab.className = 'proj-tab';
      tab.dataset.projectId = projectId;
      tab.innerHTML = `<span class="dot idle"></span><span>${projectId}</span><button class="proj-delete-btn" onclick="event.stopPropagation(); deleteProject('${projectId}')" title="删除项目">×</button>`;
      tab.onclick = function(e) { e.stopPropagation(); switchProject(projectId, this); };
      tabs.insertBefore(tab, btn);
      
      switchProject(projectId, tab);
      showNotif(`项目 "${name}" 已创建`);
      
      // 重新加载文件列表
      await API.loadFilesFromAPI();
      COMPONENTS.renderFileTree();
    } else {
      showNotif('创建失败: ' + (data.error || '未知错误'), 'error');
    }
  } catch (e) {
    console.error('[addProject] Error:', e);
    showNotif('创建失败: ' + e.message, 'error');
  }
}

/**
 * 删除项目
 * 调用后端 API 删除项目目录
 */
async function deleteProject(projectId) {
  if (!confirm(`确定删除项目 "${projectId}"？此操作不可恢复。`)) return;
  
  try {
    const res = await fetch(`${window.location.origin}/api/teams/${TEAM_ID}/projects/${projectId}`, {
      method: 'DELETE'
    });
    
    const data = await res.json();
    
    if (data.ok) {
      // 从本地 PROJECTS 移除
      delete PROJECTS[projectId];
      
      // 移除 tab
      const tab = document.querySelector(`.proj-tab[data-project-id="${projectId}"]`);
      if (tab) tab.remove();
      
      // 如果删除的是当前项目，切换到第一个可用项目
      if (STORE.currentProject === projectId) {
        const remainingProjects = Object.keys(PROJECTS);
        if (remainingProjects.length > 0) {
          const firstTab = document.querySelector('.proj-tab');
          if (firstTab) switchProject(firstTab.dataset.projectId || remainingProjects[0], firstTab);
        }
      }
      
      // 重新加载文件列表
      await API.loadFilesFromAPI();
      COMPONENTS.renderFileTree();
      COMPONENTS.renderPanel();
      
      showNotif(`项目 "${projectId}" 已删除`);
    } else {
      showNotif('删除失败: ' + (data.error || '未知错误'), 'error');
    }
  } catch (e) {
    console.error('[deleteProject] Error:', e);
    showNotif('删除失败: ' + e.message, 'error');
  }
}

// === Collaboration Animation ===
function showCollabLine(fromId, toId, duration = 1500) {
  const strip = document.getElementById('agentStrip');
  const svg = document.getElementById('collab-svg');
  const fromCard = document.getElementById('agent-card-' + fromId);
  const toCard = document.getElementById('agent-card-' + toId);
  if (!strip || !svg || !fromCard || !toCard) return;
  
  const stripRect = strip.getBoundingClientRect();
  const fromRect = fromCard.getBoundingClientRect();
  const toRect = toCard.getBoundingClientRect();
  
  const x1 = fromRect.left + fromRect.width / 2 - stripRect.left;
  const y1 = fromRect.top + fromRect.height / 2 - stripRect.top;
  const x2 = toRect.left + toRect.width / 2 - stripRect.left;
  const y2 = toRect.top + toRect.height / 2 - stripRect.top;
  
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', `M ${x1} ${y1} C ${x1 + 50} ${(y1+y2)/2}, ${x2 - 50} ${(y1+y2)/2}, ${x2} ${y2}`);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'var(--accent)');
  path.setAttribute('stroke-width', '2');
  path.style.strokeDasharray = '100';
  path.style.animation = `linePulse ${duration}ms ease-in-out`;
  
  svg.appendChild(path);
  setTimeout(() => path.remove(), duration);
}

// === Settings ===
function openSettings() { loadLLMSettings(); document.getElementById('settingsModal').classList.add('show'); }
function closeSettings() { document.getElementById('settingsModal').classList.remove('show'); }

async function loadLLMSettings() {
  try {
    const res = await fetch(`${window.location.origin}/api/llm-config`);
    const data = await res.json();
    if (data.ok) {
      document.getElementById('llmBaseUrl').value = data.data.baseUrl || '';
      document.getElementById('llmModelName').value = data.data.modelName || '';
      const apiKeyInput = document.getElementById('llmApiKey');
      apiKeyInput.value = data.data.hasApiKey ? '••••••••••••••••' : '';
      apiKeyInput.dataset.hasKey = data.data.hasApiKey ? 'true' : 'false';
      updateLLMStatus(data.data.hasApiKey ? 'configured' : 'not-configured');
    }
  } catch (e) { updateLLMStatus('error'); }
}

async function saveLLMSettings() {
  const baseUrl = document.getElementById('llmBaseUrl').value.trim();
  const apiKey = document.getElementById('llmApiKey').value.trim();
  const modelName = document.getElementById('llmModelName').value.trim();
  const apiKeyInput = document.getElementById('llmApiKey');
  const apiKeyToSend = (apiKeyInput.dataset.hasKey === 'true' && apiKey.includes('•')) ? undefined : apiKey;
  
  try {
    const res = await fetch(`${window.location.origin}/api/llm-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl, apiKey: apiKeyToSend, modelName }),
    });
    const data = await res.json();
    if (data.ok) { showNotif('LLM 设置已保存'); closeSettings(); }
    else showNotif('保存失败', 'error', data.error);
  } catch (e) { showNotif('保存失败', 'error', e.message); }
}

async function testLLMConnection() {
  updateLLMStatus('testing');
  try {
    const res = await fetch(`${window.location.origin}/api/llm-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello, reply with OK' }] }),
    });
    const data = await res.json();
    if (data.ok) { showNotif('连接成功！'); updateLLMStatus('connected'); }
    else showNotif('连接失败', 'error', data.error);
  } catch (e) { showNotif('连接失败', 'error', e.message); }
}

function updateLLMStatus(status) {
  const el = document.getElementById('llmStatus');
  const textEl = document.getElementById('llmStatusText');
  el.classList.remove('connected', 'error');
  if (status === 'configured' || status === 'connected') { el.classList.add('connected'); textEl.textContent = '已配置'; }
  else if (status === 'testing') textEl.textContent = '测试中...';
  else if (status === 'error') { el.classList.add('error'); textEl.textContent = '连接失败'; }
  else textEl.textContent = '未配置';
}

// === Team Switcher ===
async function switchTeam(teamId) {
  if (teamId === TEAM_ID) return;
  
  // 保存当前 Team ID（用于后续操作）
  const oldTeamId = TEAM_ID;
  
  showNotif(`切换到 Team: ${teamId}...`);
  
  // 更新 UI
  const selector = document.getElementById('teamSelector');
  if (selector) selector.value = teamId;
  
  const label = document.getElementById('activeTeamLabel');
  if (label) {
    const teamNames = {
      'vibe-coding': '⬡ vibe<span style="font-weight:400;color:var(--text2)">-coding</span>',
      'research-team': '🔬 research<span style="font-weight:400;color:var(--text2)">-team</span>',
      'business-team': '💼 business<span style="font-weight:400;color:var(--text2)">-team</span>'
    };
    label.innerHTML = teamNames[teamId] || teamId;
  }
  
  // 可选：准备 agent session（如果有 agent ID）
  // 这需要知道当前用户的 agent ID
  // const agentId = getCurrentAgentId(); // 需要实现
  // if (agentId) {
  //   await prepareAgentSession(agentId, oldTeamId, teamId);
  // }
  
  showNotif(`已切换到 ${teamId}`);
}

/**
 * 准备当前 Session
 * 为当前 agent 准备 team skill
 */
async function prepareCurrentSession() {
  // 获取当前 agent ID（从某个地方获取，例如 store 或用户输入）
  // 这里暂时硬编码用于演示
  const agentId = STORE.currentAgentId || 'dev-01';
  const teamId = TEAM_ID;
  
  showNotif(`准备 Session: ${agentId} @ ${teamId}...`);
  
  try {
    const res = await fetch(`${window.location.origin}/api/agents/${agentId}/prepare-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId })
    });
    
    const data = await res.json();
    if (data.ok) {
      showNotif(`✓ Session 已准备: ${data.path}`);
    } else {
      showNotif(`⚠ 准备失败: ${data.error}`, 'error');
    }
  } catch (e) {
    showNotif('⚠ 网络错误', 'error');
  }
}

/**
 * 为 agent 准备 session
 */
async function prepareAgentSession(agentId, oldTeamId, newTeamId) {
  try {
    const res = await fetch(`${window.location.origin}/api/agents/${agentId}/switch-team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldTeamId, newTeamId })
    });
    
    const data = await res.json();
    if (data.ok) {
      console.log(`[Team] Switched ${agentId} from ${oldTeamId} to ${newTeamId}`);
    } else {
      console.error('[Team] Switch failed:', data.error);
    }
  } catch (e) {
    console.error('[Team] Switch error:', e);
  }
}

// === Init ===
async function init() {
  try {
    loadTheme();
    const activeTeam = STORE.getActiveTeam();
    if (activeTeam) {
      const label = document.getElementById('activeTeamLabel');
      if (label) label.innerHTML = `${activeTeam.icon || '⬡'} <span style="font-weight:400;color:var(--text2)">${activeTeam.name}</span>`;
    }
    
    COMPONENTS.renderChatMessages();
    
    // 加载项目列表
    await API.loadProjectsFromAPI();
    
    await API.loadFilesFromAPI();
    COMPONENTS.renderFileTree();
    COMPONENTS.renderAgentStrip();
    COMPONENTS.renderPanel();
    API.connectWebSocket();
    
    // 初始化输入框拖拽
    if (window.UTILS && window.UTILS.initChatResize) {
      window.UTILS.initChatResize();
    }
  } catch (e) {
    console.error('[app.js] init error:', e);
  }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (STORE.currentFile && STORE.unsaved[STORE.currentFile]) saveFile(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); toggleSidebar(); }
});

// Expose global functions for onclick handlers (must be before init())
window.sendMessage = sendMessage;
window.handleInputKey = handleInputKey;
window.autoResize = autoResize;
window.saveFile = saveFile;
window.insertMd = insertMd;
window.contextAction = contextAction;
window.switchProject = switchProject;
window.addProject = addProject;
window.deleteProject = deleteProject;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.saveLLMSettings = saveLLMSettings;
window.testLLMConnection = testLLMConnection;
window.toggleTheme = toggleTheme;
window.toggleSidebar = toggleSidebar;
window.toggleRightPanel = toggleRightPanel;
window.backToStudio = STORE.backToStudio;
window.switchTeam = switchTeam;
window.prepareCurrentSession = prepareCurrentSession;

// Expose for API callbacks
window.updateAgentStatus = updateAgentStatus;
window.updateThinkingStream = updateThinkingStream;
window.showCollabLine = showCollabLine;
window.showNotif = showNotif;
window.addChatMessage = COMPONENTS.addChatMessage;

// Start
console.log('[app.js] Starting initialization...');
init();
console.log('[app.js] Initialization complete, sendMessage:', typeof window.sendMessage);
