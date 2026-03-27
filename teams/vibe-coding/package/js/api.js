/**
 * Vibe Coding Dashboard - API
 * API 调用和 WebSocket
 */

const API_BASE = window.location.origin;
let ws = null;
let wsConnected = false;
let connectingToast = null;  // 保存连接中的 toast 引用

function connectWebSocket() {
  const teamId = STORE.TEAM_ID;
  const wsUrl = `${API_BASE.replace('http', 'ws')}/ws?teamId=${teamId}`;
  
  console.log('[VibeCoding] Connecting to', wsUrl);
  
  // 显示连接中状态
  connectingToast = showNotif('🔌 正在连接服务器...', 'loading');
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    wsConnected = true;
    console.log('[VibeCoding] WebSocket connected');
    
    // 关闭"连接中"的 toast
    if (connectingToast) {
      removeToast(connectingToast);
      connectingToast = null;
    }
    
    showNotif('✓ 已连接到服务器');
    
    // 更新连接状态指示器
    updateConnectionStatus(true);
  };
  
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      console.log('[VibeCoding] Received:', msg);
      handleServerMessage(msg);
    } catch (e) {
      console.error('[VibeCoding] Failed to parse message:', e);
    }
  };
  
  ws.onclose = (event) => {
    wsConnected = false;
    console.log('[VibeCoding] WebSocket disconnected:', event.code, event.reason);
    updateConnectionStatus(false);
    
    // 关闭"连接中"的 toast（如果还在显示）
    if (connectingToast) {
      removeToast(connectingToast);
      connectingToast = null;
    }
    
    // 3秒后重连
    setTimeout(connectWebSocket, 3000);
  };
  
  ws.onerror = (err) => {
    console.error('[VibeCoding] WebSocket error:', err);
    
    // 关闭"连接中"的 toast
    if (connectingToast) {
      removeToast(connectingToast);
      connectingToast = null;
    }
    
    showNotif('⚠ 服务器连接失败，请检查服务是否启动', 'error');
  };
}

function updateConnectionStatus(connected) {
  // 更新 UI 中的连接状态指示器
  const indicator = document.getElementById('connectionStatus');
  if (indicator) {
    indicator.className = connected ? 'connected' : 'disconnected';
    indicator.textContent = connected ? '●' : '○';
    indicator.title = connected ? '已连接' : '未连接';
  }
}

/**
 * 检查 agent 是否是当前 team 的成员
 */
function isTeamMember(agentId) {
  if (typeof AGENTS === 'undefined') return false;
  return AGENTS.some(a => a.id === agentId);
}

/**
 * 判断消息是否冗余（需要折叠）
 */
function isRedundantMessage(body) {
  // 冗余消息的特征：
  // 1. 自我介绍类消息
  // 2. 确认类消息（"收到"、"好的"等）
  // 3. 问候类消息
  
  const redundantPatterns = [
    /大家好[！！]?我是/,
    /很高兴认识你/,
    /收到[！！]?$/,
    /好的[！！]?$/,
    /明白了[！！]?$/,
    /请介绍一下你自己/,
  ];
  
  return redundantPatterns.some(p => p.test(body));
}

/**
 * 生成消息摘要
 */
function generateMessageSummary(body) {
  // 提取关键信息生成摘要
  const lines = body.split('\n').filter(l => l.trim());
  
  // 如果消息很短，直接返回
  if (body.length < 50) return body;
  
  // 提取第一行作为摘要
  const firstLine = lines[0] || body.slice(0, 50);
  return firstLine.length > 50 ? firstLine.slice(0, 50) + '...' : firstLine;
}

function handleServerMessage(msg) {
  console.log('[VibeCoding] Processing message:', msg.type, msg);
  
  if (msg.type === 'agent-reply' && msg.from && msg.body) {
    // 过滤非 team 成员的消息
    if (!isTeamMember(msg.from)) {
      console.log('[VibeCoding] Ignoring message from non-team member:', msg.from);
      return;
    }

    const tags = [];
    const tagMatch = msg.body.match(/#T\d+/g);
    if (tagMatch) tags.push(...tagMatch);
    
    const mentionMatch = msg.body.match(/@(\w+[-\d]*)/);
    if (mentionMatch) {
      showCollabLine(msg.from, mentionMatch[1], 1500);
    }
    
    // 清理流式消息占位符
    if (window.COMPONENTS) {
      COMPONENTS.finalizeStreamingMessage(msg.from, msg.body);
    }
    
    // 检查是否是私聊回复
    const privateTarget = STORE.privateChatAgent;
    if (privateTarget === msg.from && STORE.privateChatActive) {
      // 私聊消息，只显示在私聊窗口
      if (window.COMPONENTS && window.COMPONENTS.addPrivateChatMessage) {
        COMPONENTS.addPrivateChatMessage(msg.from, msg.body);
      }
    } else {
      // 群聊消息
      addChatMessage(msg.from, msg.body, tags);
    }
    
    updateAgentStatus(msg.from, 'idle', '');
    
    // 更新 Thinking 面板
    if (window.COMPONENTS && STORE.currentTab === 'thinking') {
      window.COMPONENTS.renderPanel();
    }
  } else if (msg.type === 'agent-thinking' || msg.type === 'agent:thinking') {
    const agentId = msg.agentId || msg.from;
    
    // 过滤非 team 成员的思考流
    if (!isTeamMember(agentId)) {
      console.log('[VibeCoding] Ignoring thinking from non-team member:', agentId);
      return;
    }
    
    // 优先使用 body 字段（OpenClaw 格式），然后是 text/content
    const thinking = msg.body || msg.text || msg.content || '';
    updateThinkingStream(agentId, thinking, msg.done);
    
    // 实时更新 Agent 状态
    updateAgentStatus(agentId, 'working', thinking.slice(0, 50) + '...');
    
    // 检查是否是私聊的思考流
    const privateTarget = STORE.privateChatAgent;
    if (privateTarget === agentId && STORE.privateChatActive) {
      // 私聊窗口不需要显示思考流，只显示最终回复
    } else {
      // 群聊窗口显示正在输入状态
      if (window.COMPONENTS) {
        COMPONENTS.updateStreamingMessage(agentId, thinking);
      }
    }
    
    // 更新 Thinking 面板
    if (STORE.currentTab === 'thinking') {
      window.COMPONENTS.renderPanel();
    }
  } else if (msg.type === 'agent-status') {
    if (msg.agentId && msg.status) {
      // 过滤非 team 成员的状态更新
      if (!isTeamMember(msg.agentId)) {
        return;
      }
      
      updateAgentStatus(msg.agentId, msg.status, msg.task || '');
      
      // 更新 Agent Strip
      if (window.COMPONENTS) {
        window.COMPONENTS.renderAgentStrip();
      }
    }
  } else if (msg.type === 'agent-intercept') {
    // Agent 发送给其他 Agent 的消息（完整透明度）
    // 显示完整的消息内容，让用户看到 agent 之间的通信
    if (msg.from && msg.to && msg.body) {
      const fromAgent = msg.from;
      const toAgent = msg.to;
      
      // 过滤非 team 成员
      if (!isTeamMember(fromAgent)) {
        return;
      }
      
      // 判断消息是否冗余（需要折叠）
      const isRedundant = isRedundantMessage(msg.body);
      
      if (isRedundant) {
        // 冗余消息：折叠显示，只显示摘要
        const summary = generateMessageSummary(msg.body);
        addChatMessage(fromAgent, `📤 → @${toAgent}: ${summary}`, ['intercept', 'collapsed'], msg.body);
      } else {
        // 重要消息：完整显示
        addChatMessage(fromAgent, `📤 → @${toAgent}\n\n${msg.body}`, ['intercept']);
      }
      
      // 显示协作线
      showCollabLine(fromAgent, toAgent, 2000);
      
      console.log(`[VibeCoding] Agent-intercept: ${fromAgent} → ${toAgent}`);
    }
  } else if (msg.type === 'agent-blocked') {
    // Agent 通信被阻止
    if (msg.from && msg.to) {
      addChatMessage('system', `🚫 ${msg.from} → @${msg.to}: ${msg.body}`, ['blocked']);
    }
  } else if (msg.type === 'agent-outbound') {
    // 旧格式，保持兼容
    if (msg.from && msg.to && msg.body) {
      const fromAgent = msg.from;
      const toAgent = msg.to;
      
      if (!isTeamMember(fromAgent)) {
        return;
      }
      
      const outboundText = `📤 → @${toAgent}`;
      addChatMessage(fromAgent, outboundText, ['outbound']);
      showCollabLine(fromAgent, toAgent, 2000);
    }
  } else if (msg.type === 'error') {
    showNotif(`⚠ 错误: ${msg.error}`);
    console.error('[VibeCoding] Server error:', msg.error);
  }
}

function sendToAgent(to, body, isPrivate = false) {
  if (!ws || wsConnected !== true) {
    showNotif('⚠ 未连接到服务器，请稍后重试', 'error');
    console.warn('[VibeCoding] WebSocket not connected, cannot send message');
    return false;
  }
  
  try {
    const mentionMatch = body.match(/@(\w+[-\d]*)/);
    const targetAgent = mentionMatch ? mentionMatch[1] : to;
    
    const message = {
      type: 'user-message',
      to: targetAgent,
      body: body,
      context: {
        teamId: STORE.TEAM_ID,
        projectId: STORE.currentProject,
        private: isPrivate
      },
      timestamp: new Date().toISOString()
    };
    
    ws.send(JSON.stringify(message));
    console.log('[VibeCoding] Sent message to', targetAgent, isPrivate ? '(private)' : '');
    return true;
  } catch (e) {
    console.error('[VibeCoding] Failed to send message:', e);
    showNotif('⚠ 发送失败: ' + e.message, 'error');
    return false;
  }
}

// 发送私聊消息
function sendPrivateMessage(to, body) {
  return sendToAgent(to, body, true);
}

async function loadFilesFromAPI() {
  try {
    const res = await fetch(`${API_BASE}/api/teams/${STORE.TEAM_ID}/files`);
    const data = await res.json();
    
    // 保存项目路径
    if (data.projectsPath) {
      STORE.projectsPath = data.projectsPath;
      console.log(`[VibeCoding] Projects path: ${data.projectsPath}`);
    }
    
    // 无论有无文件，都使用 API 返回的数据（清除静态假数据）
    const proj = PROJECTS[STORE.currentProject];
    proj.files = [];
    proj.tasks = [];  // 清除静态任务数据
    
    if (data.ok && data.files && data.files.length > 0) {
      proj.files.push({ name: 'projects', type: 'dir', path: 'projects' });
      
      data.files.forEach(f => {
        const parts = f.path.split('/');
        if (parts.length > 1) {
          let currentPath = '';
          for (let i = 0; i < parts.length - 1; i++) {
            const dirName = parts[i];
            const dirPath = currentPath ? `${currentPath}/${dirName}` : dirName;
            if (!proj.files.find(ff => ff.path === dirPath)) {
              proj.files.push({ name: dirName, type: 'dir', path: dirPath, indent: i });
            }
            currentPath = dirPath;
          }
        }
        proj.files.push({ name: f.name, path: f.path, type: f.type || 'md', indent: parts.length - 1 });
      });
      
      const projectMd = proj.files.find(f => f.name === 'PROJECT.md');
      if (projectMd) await loadFileContent(projectMd.path);
      
      console.log(`[VibeCoding] Loaded ${data.files.length} files from API`);
    } else {
      console.log('[VibeCoding] No files in project directory');
      // 显示空状态提示
      proj.files.push({ 
        name: '暂无文件', 
        type: 'empty', 
        path: null,
        indent: 0
      });
    }
  } catch (e) {
    console.warn('[VibeCoding] Failed to load files from API:', e);
  }
}

/**
 * 从 API 加载项目列表
 */
async function loadProjectsFromAPI() {
  try {
    const res = await fetch(`${API_BASE}/api/teams/${STORE.TEAM_ID}/projects`);
    const data = await res.json();
    
    if (data.ok && data.data && data.data.length > 0) {
      // 清除默认的假数据
      Object.keys(PROJECTS).forEach(key => delete PROJECTS[key]);
      
      // 添加从 API 加载的项目
      data.data.forEach(project => {
        PROJECTS[project.id] = {
          name: project.name || project.id,
          tasks: [],
          files: [],
          agentStates: Object.fromEntries(AGENTS.map(a => [a.id, { status: 'idle', task: '等待任务分配…' }]))
        };
      });
      
      // 设置第一个项目为当前项目
      const firstProjectId = data.data[0].id;
      STORE.currentProject = firstProjectId;
      
      console.log(`[VibeCoding] Loaded ${data.data.length} projects from API`);
      
      // 渲染项目 tabs
      renderProjectTabs();
      
      return data.data;
    } else {
      console.log('[VibeCoding] No projects found');
      return [];
    }
  } catch (e) {
    console.warn('[VibeCoding] Failed to load projects from API:', e);
    return [];
  }
}

/**
 * 渲染项目 tabs
 */
function renderProjectTabs() {
  const tabs = document.getElementById('projectTabs');
  if (!tabs) return;
  
  // 保留添加按钮
  const addBtn = tabs.querySelector('.proj-tab-add');
  tabs.innerHTML = '';
  
  // 添加项目 tabs
  Object.keys(PROJECTS).forEach(projectId => {
    const tab = document.createElement('div');
    tab.className = 'proj-tab' + (STORE.currentProject === projectId ? ' active' : '');
    tab.dataset.projectId = projectId;
    tab.innerHTML = `<span class="dot idle"></span><span>${projectId}</span><button class="proj-delete-btn" onclick="event.stopPropagation(); deleteProject('${projectId}')" title="删除项目">×</button>`;
    tab.onclick = function(e) { e.stopPropagation(); switchProject(projectId, this); };
    tabs.appendChild(tab);
  });
  
  // 重新添加按钮
  if (addBtn) {
    tabs.appendChild(addBtn);
  } else {
    const newAddBtn = document.createElement('div');
    newAddBtn.className = 'proj-tab-add';
    newAddBtn.onclick = addProject;
    newAddBtn.title = '新建项目';
    newAddBtn.textContent = '+';
    tabs.appendChild(newAddBtn);
  }
}

async function loadFileContent(path) {
  try {
    const res = await fetch(`${API_BASE}/api/teams/${STORE.TEAM_ID}/files/${path}`);
    const data = await res.json();
    if (data.ok && data.content) {
      STORE.fileContents[path] = data.content;
      if (path === 'PROJECT.md') parseProjectMd(data.content);
    }
  } catch (e) {
    console.warn('[VibeCoding] Failed to load file content:', e);
  }
}

function parseProjectMd(content) {
  const tasks = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const activeMatch = line.match(/#ACTIVE\s+(#\S+)\s+(.+?)\s*\|\s*优先级:\s*(\S+)\s*\|\s*(@\S+)/);
    if (activeMatch) {
      tasks.push({ id: activeMatch[1], title: activeMatch[2].trim(), status: 'active', assignee: activeMatch[4], priority: activeMatch[3] });
      continue;
    }
    const todoMatch = line.match(/#TODO\s+(#\S+)\s+(.+?)\s*\|\s*优先级:\s*(\S+)\s*\|\s*(@\S+)/);
    if (todoMatch) {
      tasks.push({ id: todoMatch[1], title: todoMatch[2].trim(), status: 'todo', assignee: todoMatch[4], priority: todoMatch[3] });
      continue;
    }
    const doneMatch = line.match(/#DONE\s+(#\S+)\s+(.+?)\s*\|\s*(@\S+)/);
    if (doneMatch) {
      tasks.push({ id: doneMatch[1], title: doneMatch[2].trim(), status: 'done', assignee: doneMatch[3], priority: '-' });
      continue;
    }
    const blockedMatch = line.match(/#BLOCKED\s+(#\S+)\s+(.+?)\s*\|\s*(@\S+)/);
    if (blockedMatch) {
      tasks.push({ id: blockedMatch[1], title: blockedMatch[2].trim(), status: 'blocked', assignee: blockedMatch[3], priority: '-' });
    }
  }
  
  if (tasks.length > 0) PROJECTS[STORE.currentProject].tasks = tasks;
}

// 导出
window.API = {
  connectWebSocket,
  sendToAgent,
  sendPrivateMessage,
  loadFilesFromAPI,
  loadProjectsFromAPI,
  loadFileContent,
  updateConnectionStatus,
  get wsConnected() { return wsConnected; },
};
