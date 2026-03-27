/**
 * Teams Page Logic
 * Team 管理页面逻辑
 */

import { state, clearBuilderSlots, setEditingTeam, syncToStorage } from '../store.js';
import { TeamAPI, AgentAPI } from '../api.js';
import { AGENT_COLORS, ALL_SKILLS, AGENTS_DB, MY_TEAMS } from '../data/static-data.js';

// ─── Team Service Map ─────────────────────────────────────

const TEAM_SERVICE_MAP = {
  't1': '/teams/vibe-coding/dashboard.html',
  'vibe-coding': '/teams/vibe-coding/dashboard.html',
};

function updateTeamServiceMap(teamId) {
  if (!teamId) return;
  TEAM_SERVICE_MAP[teamId] = `/teams/${teamId}/dashboard.html`;
}

// ─── Init ────────────────────────────────────────────────

export async function initTeamsPage() {
  await loadTeamsFromServer();
  renderMyTeams();
  renderBuilderCanvas();
}

async function loadTeamsFromServer() {
  try {
    const teams = await TeamAPI.list();
    console.log('[Teams] Loaded teams:', teams);
    
    // 清空现有数据，全量从服务器加载
    MY_TEAMS.length = 0;
    
    if (!Array.isArray(teams)) {
      console.warn('[Teams] Invalid teams response');
      return;
    }
    
    for (const t of teams) {
      // 正确解析 manifest 中的 members
      // members 可能是对象数组 [{id: "pm-01", ...}] 或字符串数组 ["pm-01"]
      const rawMembers = t.members || t.manifest?.agents || [];
      const members = rawMembers.map(m => typeof m === 'string' ? m : m.id).filter(Boolean);
      
      MY_TEAMS.push({
        id: t.id,
        name: t.name || t.id,
        type: t.type || 'dev',
        icon: t.icon || '⬡',
        desc: t.description || t.manifest?.description || '',
        members,
        stats: { tasks: 0, done: 0, uptime: '-' },
        active: false,
        path: t.path || `teams/${t.id}`,
      });
      
      updateTeamServiceMap(t.id);
    }
    
    console.log('[Teams] Loaded', MY_TEAMS.length, 'teams from server');
  } catch (e) {
    console.warn('[Teams] Failed to load teams:', e);
  }
}

// ─── Render ────────────────────────────────────────────────

export function renderMyTeams() {
  const grid = document.getElementById('myTeamsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  
  MY_TEAMS.forEach(team => {
    const card = document.createElement('div');
    card.className = 'team-card' + (team.active ? ' active-team' : '');
    
    const membersHtml = team.members.slice(0,5).map(mid => {
      const ag = AGENTS_DB.find(a => a.id === mid);
      if (!ag) {
        const c = AGENT_COLORS.purple;
        return `<div class="member-ava" style="background:${c.bg};color:${c.color}">${mid.slice(0,2).toUpperCase()}</div>`;
      }
      const c = AGENT_COLORS[ag.colorKey];
      return `<div class="member-ava" style="background:${c.bg};color:${c.color}">${ag.short}</div>`;
    }).join('');
    
    const pathHint = `teams/${team.id}`;
    
    card.innerHTML = `
      <div class="team-card-header">
        <div class="team-icon" style="background:var(--bg4)">${team.icon}</div>
        <div class="team-meta">
          <div class="team-name">${team.name}</div>
          <div class="team-desc">${team.desc}</div>
        </div>
        ${team.active ? `<div style="width:7px;height:7px;border-radius:50%;background:var(--green);flex-shrink:0;margin-top:2px"></div>` : ''}
        <div class="team-delete-btn" onclick="event.stopPropagation(); window.deleteTeam('${team.id}')" title="删除 Team">✕</div>
      </div>
      <div class="team-card-body">
        <div class="team-members">${membersHtml}</div>
        <div class="team-stats">
          <div class="team-stat"><div class="stat-val" style="color:var(--accent)">${team.members.length}</div><div class="stat-label">成员</div></div>
          <div class="team-stat"><div class="stat-val">${team.stats.tasks}</div><div class="stat-label">任务</div></div>
          <div class="team-stat"><div class="stat-val" style="color:var(--green)">${team.stats.done}</div><div class="stat-label">完成</div></div>
        </div>
        <div class="team-path" onclick="window.copyToClipboard('${pathHint}')">📁 ${pathHint}</div>
      </div>
      <div class="team-actions">
        <button class="btn" onclick="event.stopPropagation(); window.editTeam('${team.id}')">编辑</button>
        <button class="btn btn-primary" onclick="event.stopPropagation(); window.launchTeam('${team.id}')">▶ 启动</button>
      </div>
    `;
    grid.appendChild(card);
  });

  // Add new team card
  const addCard = document.createElement('div');
  addCard.className = 'team-card';
  addCard.style.cssText = 'border-style:dashed;cursor:pointer;display:flex;align-items:center;justify-content:center;min-height:120px;';
  addCard.onclick = () => document.getElementById('newTeamName')?.focus();
  addCard.innerHTML = `<div style="text-align:center;color:var(--text3)"><div style="font-size:24px;margin-bottom:6px">+</div><div style="font-size:12px">创建新 Team</div></div>`;
  grid.appendChild(addCard);
}

// ─── Builder ────────────────────────────────────────────────

export function renderBuilderCanvas() {
  const canvas = document.getElementById('builderCanvas');
  if (!canvas) return;
  canvas.innerHTML = '';
  
  state.builderSlots.forEach(agId => {
    const ag = AGENTS_DB.find(a => a.id === agId);
    if (!ag) return;
    const c = AGENT_COLORS[ag.colorKey];
    
    const slot = document.createElement('div');
    slot.className = 'builder-slot';
    slot.innerHTML = `
      <div class="builder-slot-ava" style="background:${c.bg};color:${c.color}">
        ${ag.short}
        <div class="remove-x" onclick="window.toggleBuilderSlot('${agId}')">✕</div>
      </div>
      <div class="builder-slot-label">${agId}</div>
    `;
    canvas.appendChild(slot);
  });
  
  // Add button
  const addSlot = document.createElement('div');
  addSlot.className = 'builder-slot';
  addSlot.innerHTML = `
    <div class="builder-add-slot" onclick="window.openAgentPicker()">+</div>
    <div class="builder-slot-label" style="color:var(--text3)">添加成员</div>
  `;
  canvas.appendChild(addSlot);
}

// ─── Actions ────────────────────────────────────────────────

window.launchTeam = function(teamId) {
  const team = MY_TEAMS.find(t => t.id === teamId);
  const service = TEAM_SERVICE_MAP[teamId] || team?.service;
  
  if (!service) {
    if (window.showNotif) window.showNotif(`⚠ ${team?.name || teamId} 暂无关联的 Service 页面`);
    return;
  }
  
  if (window.showNotif) window.showNotif(`⚡ 正在启动 ${team?.name || teamId}…`);
  setTimeout(() => { window.location.href = service; }, 600);
};

window.editTeam = function(teamId) {
  const team = MY_TEAMS.find(t => t.id === teamId);
  if (!team) return;
  
  clearBuilderSlots();
  team.members.forEach(id => state.builderSlots.push(id));
  setEditingTeam(teamId);
  
  document.getElementById('newTeamName').value = team.name;
  document.getElementById('newTeamType').value = team.type;
  
  renderBuilderCanvas();
  
  // 加载 Team Skill
  window.loadTeamSkillForTeam(teamId);
  
  // 加载通信规则
  if (window.loadCommunicationRulesForTeam) {
    window.loadCommunicationRulesForTeam(teamId);
  }
  
  if (window.showNotif) window.showNotif(`编辑模式: ${team.name}`);
};

window.deleteTeam = async function(teamId) {
  if (!confirm(`确定要删除这个 Team 吗？`)) return;
  
  try {
    const data = await TeamAPI.delete(teamId);
    if (data.ok) {
      const idx = MY_TEAMS.findIndex(t => t.id === teamId);
      if (idx >= 0) MY_TEAMS.splice(idx, 1);
      delete TEAM_SERVICE_MAP[teamId];
      renderMyTeams();
      if (window.showNotif) window.showNotif(`✓ 已删除`);
    }
  } catch (e) {
    if (window.showNotif) window.showNotif(`⚠ 删除失败`, 'error');
  }
};

window.createTeam = async function() {
  const name = document.getElementById('newTeamName')?.value.trim();
  const type = document.getElementById('newTeamType')?.value;
  
  if (!name) {
    if (window.showNotif) window.showNotif('⚠ 请输入 Team 名称', 'warning');
    return;
  }
  if (state.builderSlots.length < 1) {
    if (window.showNotif) window.showNotif('⚠ 请至少添加 1 个 Agent', 'warning');
    return;
  }
  
  const icons = { dev:'🛠', research:'🔬', business:'💼', creative:'🎨', ops:'⚙️' };
  
  // Generate unique team ID
  let teamId = `team_${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 20)}`;
  let counter = 1;
  while (MY_TEAMS.find(t => t.id === teamId)) {
    teamId = `team_${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 20)}-${counter}`;
    counter++;
  }
  
  try {
    const data = await TeamAPI.create({
      id: teamId,
      name,
      type,
      icon: icons[type] || '⬡',
      description: `${state.builderSlots.length} 个 Agent 组成的 ${type} 团队`,
      members: [...state.builderSlots],
    });
    
    if (data.ok) {
      MY_TEAMS.push({
        id: teamId, name, type, icon: icons[type] || '⬡',
        desc: `${state.builderSlots.length} 个 Agent 组成的 ${type} 团队`,
        members: [...state.builderSlots],
        stats: { tasks: 0, done: 0, uptime: '-' },
        active: false,
        path: `teams/${teamId}`,
      });
      
      updateTeamServiceMap(teamId);
      clearBuilderSlots();
      document.getElementById('newTeamName').value = '';
      renderMyTeams();
      renderBuilderCanvas();
      
      if (window.showNotif) window.showNotif(`✓ Team "${name}" 创建成功`);
    } else {
      if (window.showNotif) window.showNotif(`⚠ 创建失败: ${data.error}`, 'error');
    }
  } catch (e) {
    if (window.showNotif) window.showNotif(`⚠ 创建失败`, 'error');
  }
};

window.toggleBuilderSlot = function(agId) {
  if (state.builderSlots.includes(agId)) {
    state.builderSlots = state.builderSlots.filter(id => id !== agId);
  } else {
    state.builderSlots.push(agId);
  }
  syncToStorage();
  renderBuilderCanvas();
};

window.openAgentPicker = function() {
  const modal = document.getElementById('agentPickerModal');
  if (modal) modal.classList.add('open');
  renderModalAgents('');
};

window.closeModal = function() {
  document.getElementById('agentPickerModal')?.classList.remove('open');
};

window.filterModalAgents = function(query) {
  renderModalAgents(query);
};

function renderModalAgents(query) {
  const body = document.getElementById('modalBody');
  if (!body) return;
  body.innerHTML = '';
  
  const filtered = AGENTS_DB.filter(ag =>
    ag.id.includes(query) || ag.role.toLowerCase().includes(query.toLowerCase())
  );
  
  filtered.forEach(ag => {
    const c = AGENT_COLORS[ag.colorKey];
    const inTeam = state.builderSlots.includes(ag.id);
    
    const row = document.createElement('div');
    row.className = 'modal-agent-row' + (inTeam ? ' selected' : '');
    row.onclick = () => { window.toggleBuilderSlot(ag.id); renderModalAgents(query); };
    row.innerHTML = `
      <div class="modal-agent-ava" style="background:${c.bg};color:${c.color}">${ag.short}</div>
      <div class="modal-agent-info">
        <div class="modal-agent-name">${ag.id}</div>
        <div class="modal-agent-desc">${ag.role} · ${ag.soul.model}</div>
      </div>
      <div class="check-circle">${inTeam ? '✓' : ''}</div>
    `;
    body.appendChild(row);
  });
}

window.copyToClipboard = function(text) {
  navigator.clipboard.writeText(text).then(() => {
    if (window.showNotif) window.showNotif(`✓ 已复制: ${text}`);
  });
};

// ─── Skill Editor ────────────────────────────────────────────────

/**
 * 加载 Team Skill
 */
window.loadTeamSkill = async function() {
  const teamId = state.editingTeamId;
  if (!teamId) {
    if (window.showNotif) window.showNotif('⚠ 请先选择要编辑的 Team', 'warning');
    return;
  }
  
  try {
    const res = await fetch(`/api/teams/${teamId}/skill`);
    const data = await res.json();
    
    if (data.ok) {
      const editor = document.getElementById('skillEditor');
      if (editor) {
        editor.value = data.content;
        updateSkillPreview();
      }
      if (window.showNotif) window.showNotif('✓ Skill 已加载');
    } else {
      if (window.showNotif) window.showNotif(`⚠ ${data.error || '加载失败'}`, 'warning');
    }
  } catch (e) {
    console.error('[Skill] Load error:', e);
    if (window.showNotif) window.showNotif('⚠ 加载失败', 'error');
  }
};

/**
 * 为特定 Team 加载 Skill（编辑模式）
 */
window.loadTeamSkillForTeam = async function(teamId) {
  try {
    const res = await fetch(`/api/teams/${teamId}/skill`);
    const data = await res.json();
    
    if (data.ok) {
      const editor = document.getElementById('skillEditor');
      if (editor) {
        editor.value = data.content;
        updateSkillPreview();
      }
      
      const pathHint = document.getElementById('skillPath');
      if (pathHint) {
        pathHint.textContent = data.path;
      }
    } else {
      // Team 没有 skill，使用默认模板
      const editor = document.getElementById('skillEditor');
      if (editor) {
        editor.value = `# Team Skill\n\n定义团队的协作规则和流程。\n\n## 角色分工\n\n（描述团队成员角色）\n\n## 工作流程\n\n（定义工作流程）\n`;
        updateSkillPreview();
      }
    }
  } catch (e) {
    console.error('[Skill] Load error:', e);
  }
};

/**
 * 保存 Team Skill
 */
window.saveTeamSkill = async function() {
  const teamId = state.editingTeamId;
  if (!teamId) {
    if (window.showNotif) window.showNotif('⚠ 请先选择要编辑的 Team', 'warning');
    return;
  }
  
  const content = document.getElementById('skillEditor')?.value;
  if (!content || !content.trim()) {
    if (window.showNotif) window.showNotif('⚠ Skill 内容不能为空', 'warning');
    return;
  }
  
  try {
    const res = await fetch(`/api/teams/${teamId}/skill`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    const data = await res.json();
    
    if (data.ok) {
      if (window.showNotif) window.showNotif('✓ Skill 已保存');
    } else {
      if (window.showNotif) window.showNotif(`⚠ ${data.error || '保存失败'}`, 'error');
    }
  } catch (e) {
    console.error('[Skill] Save error:', e);
    if (window.showNotif) window.showNotif('⚠ 保存失败', 'error');
  }
};

/**
 * 更新 Skill 预览
 */
window.updateSkillPreview = function() {
  const editor = document.getElementById('skillEditor');
  const preview = document.getElementById('skillPreview');
  
  if (!editor || !preview) return;
  
  const content = editor.value;
  
  // 简单的 Markdown 渲染
  let html = content
    .replace(/^### (.*$)/gim, '<h3 style="margin:12px 0 6px;font-size:14px;color:var(--text1)">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 style="margin:14px 0 8px;font-size:15px;color:var(--text1)">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 style="margin:16px 0 10px;font-size:17px;color:var(--text1)">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--bg3);padding:2px 4px;border-radius:3px;font-size:11px">$1</code>')
    .replace(/^- (.*$)/gim, '<li style="margin:2px 0 2px 16px">$1</li>')
    .replace(/^\| (.+) \|$/gim, (match, row) => {
      const cells = row.split(' | ').map(c => `<td style="padding:4px 8px;border:1px solid var(--border3)">${c}</td>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .replace(/\n/g, '<br>');
  
  preview.innerHTML = html;
};

// ─── Communication Rules Editor ────────────────────────────────────────────

// 默认通信规则
const DEFAULT_COMMUNICATION_RULES = {
  enabled: true,
  defaults: {
    receiveFrom: ["*"],
    sendTo: ["*"],
    allowAutoReply: false,
    replyCooldownMs: 30000,
    maxChainDepth: 3
  },
  agents: {},
  patterns: {}
};

// 当前编辑中的通信规则
let currentCommunicationRules = null;

/**
 * 渲染通信规则编辑器
 */
function renderCommunicationRulesEditor() {
  const container = document.getElementById('communicationRulesEditor');
  if (!container) return;
  
  const teamId = state.editingTeamId;
  if (!teamId) {
    container.innerHTML = `
      <div style="color:var(--text3);font-size:12px;padding:20px;text-align:center;background:var(--bg2);border-radius:6px">
        请先选择或创建一个 Team
      </div>
    `;
    return;
  }
  
  const team = MY_TEAMS.find(t => t.id === teamId);
  const members = team?.members || state.builderSlots || [];
  
  if (members.length === 0) {
    container.innerHTML = `
      <div style="color:var(--text3);font-size:12px;padding:20px;text-align:center;background:var(--bg2);border-radius:6px">
        请先添加 Team 成员
      </div>
    `;
    return;
  }
  
  // 确保有规则对象
  if (!currentCommunicationRules) {
    currentCommunicationRules = JSON.parse(JSON.stringify(DEFAULT_COMMUNICATION_RULES));
  }
  
  // 为每个成员生成规则配置 UI
  let html = `
    <div style="margin-bottom:16px;display:flex;align-items:center;gap:12px">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
        <input type="checkbox" id="commRulesEnabled" ${currentCommunicationRules.enabled ? 'checked' : ''} 
          onchange="toggleCommunicationRulesEnabled(this.checked)">
        <span style="font-size:13px">启用通信规则</span>
      </label>
    </div>
    
    <div style="margin-bottom:16px">
      <div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--text2)">默认规则（适用于未单独配置的 Agent）</div>
      ${renderDefaultRulesEditor()}
    </div>
    
    <div style="margin-bottom:16px">
      <div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--text2)">Agent 规则配置</div>
      <div style="display:flex;flex-direction:column;gap:8px">
  `;
  
  for (const agentId of members) {
    html += renderAgentRuleRow(agentId);
  }
  
  html += `</div></div>`;
  
  container.innerHTML = html;
}

/**
 * 渲染默认规则编辑器
 */
function renderDefaultRulesEditor() {
  const defaults = currentCommunicationRules?.defaults || DEFAULT_COMMUNICATION_RULES.defaults;
  
  return `
    <div style="display:flex;gap:16px;flex-wrap:wrap;background:var(--bg2);padding:12px;border-radius:6px">
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:11px;color:var(--text3)">allowAutoReply</span>
        <input type="checkbox" ${defaults.allowAutoReply ? 'checked' : ''} 
          onchange="updateDefaultRule('allowAutoReply', this.checked)">
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:11px;color:var(--text3)">maxChainDepth</span>
        <input type="number" value="${defaults.maxChainDepth || 3}" min="1" max="10" 
          style="width:50px;height:24px;font-size:12px;padding:2px 4px"
          onchange="updateDefaultRule('maxChainDepth', parseInt(this.value))">
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:11px;color:var(--text3)">冷却期(ms)</span>
        <input type="number" value="${defaults.replyCooldownMs || 30000}" min="5000" max="300000" step="5000"
          style="width:70px;height:24px;font-size:12px;padding:2px 4px"
          onchange="updateDefaultRule('replyCooldownMs', parseInt(this.value))">
      </div>
    </div>
  `;
}

/**
 * 渲染单个 Agent 规则行
 */
function renderAgentRuleRow(agentId) {
  const agentRule = currentCommunicationRules?.agents?.[agentId] || {};
  const ag = AGENTS_DB.find(a => a.id === agentId);
  const c = ag ? AGENT_COLORS[ag.colorKey] : AGENT_COLORS.purple;
  
  const receiveFrom = agentRule.receiveFrom || ['*'];
  const sendTo = agentRule.sendTo || ['*'];
  const allowAutoReply = agentRule.allowAutoReply ?? false;
  
  return `
    <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg2);border-radius:6px">
      <div class="builder-slot-ava" style="background:${c.bg};color:${c.color};width:32px;height:32px;font-size:12px;flex-shrink:0">
        ${agentId.slice(0, 2).toUpperCase()}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:500">${agentId}</div>
        <div style="font-size:10px;color:var(--text3)">${ag?.role || 'Agent'}</div>
      </div>
      
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:4px">
          <span style="font-size:10px;color:var(--text3)">接收自</span>
          <input type="text" value="${receiveFrom.join(', ')}" placeholder="user, pm-01, *"
            style="width:100px;height:24px;font-size:11px;padding:2px 6px"
            onchange="updateAgentRule('${agentId}', 'receiveFrom', this.value)">
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          <span style="font-size:10px;color:var(--text3)">发送给</span>
          <input type="text" value="${sendTo.join(', ')}" placeholder="pm-01, *"
            style="width:100px;height:24px;font-size:11px;padding:2px 6px"
            onchange="updateAgentRule('${agentId}', 'sendTo', this.value)">
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          <span style="font-size:10px;color:var(--text3)">自动回复</span>
          <input type="checkbox" ${allowAutoReply ? 'checked' : ''} 
            onchange="updateAgentRule('${agentId}', 'allowAutoReply', this.checked)">
        </div>
      </div>
    </div>
  `;
}

/**
 * 切换通信规则启用状态
 */
window.toggleCommunicationRulesEnabled = function(enabled) {
  if (currentCommunicationRules) {
    currentCommunicationRules.enabled = enabled;
  }
};

/**
 * 更新默认规则
 */
window.updateDefaultRule = function(key, value) {
  if (currentCommunicationRules && currentCommunicationRules.defaults) {
    currentCommunicationRules.defaults[key] = value;
  }
};

/**
 * 更新 Agent 规则
 */
window.updateAgentRule = function(agentId, key, value) {
  if (!currentCommunicationRules) return;
  if (!currentCommunicationRules.agents) {
    currentCommunicationRules.agents = {};
  }
  if (!currentCommunicationRules.agents[agentId]) {
    currentCommunicationRules.agents[agentId] = {};
  }
  
  // 处理数组类型的值
  if (key === 'receiveFrom' || key === 'sendTo') {
    const parts = value.split(',').map(s => s.trim()).filter(Boolean);
    currentCommunicationRules.agents[agentId][key] = parts.length > 0 ? parts : ['*'];
  } else {
    currentCommunicationRules.agents[agentId][key] = value;
  }
};

/**
 * 保存通信规则
 */
window.saveCommunicationRules = async function() {
  const teamId = state.editingTeamId;
  if (!teamId) {
    if (window.showNotif) window.showNotif('⚠ 请先选择要编辑的 Team', 'warning');
    return;
  }
  
  if (!currentCommunicationRules) {
    if (window.showNotif) window.showNotif('⚠ 没有要保存的规则', 'warning');
    return;
  }
  
  try {
    // 获取当前 manifest
    const res = await fetch(`/api/teams/${teamId}`);
    const teamData = await res.json();
    
    if (!teamData.ok) {
      if (window.showNotif) window.showNotif(`⚠ ${teamData.error || '获取 Team 失败'}`, 'error');
      return;
    }
    
    // 更新 manifest 中的 communication 字段
    const manifest = teamData.data?.manifest || {};
    manifest.communication = currentCommunicationRules;
    
    // 保存更新后的 manifest
    const saveRes = await fetch(`/api/teams/${teamId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifest })
    });
    const saveData = await saveRes.json();
    
    if (saveData.ok) {
      if (window.showNotif) window.showNotif('✓ 通信规则已保存');
    } else {
      if (window.showNotif) window.showNotif(`⚠ ${saveData.error || '保存失败'}`, 'error');
    }
  } catch (e) {
    console.error('[CommRules] Save error:', e);
    if (window.showNotif) window.showNotif('⚠ 保存失败', 'error');
  }
};

/**
 * 重置通信规则
 */
window.resetCommunicationRules = function() {
  currentCommunicationRules = JSON.parse(JSON.stringify(DEFAULT_COMMUNICATION_RULES));
  renderCommunicationRulesEditor();
  if (window.showNotif) window.showNotif('↺ 已重置为默认规则');
};

/**
 * 加载 Team 的通信规则
 */
async function loadCommunicationRules(teamId) {
  try {
    const res = await fetch(`/api/teams/${teamId}`);
    const data = await res.json();
    
    if (data.ok && data.data?.manifest?.communication) {
      currentCommunicationRules = data.data.manifest.communication;
    } else {
      currentCommunicationRules = JSON.parse(JSON.stringify(DEFAULT_COMMUNICATION_RULES));
    }
    
    renderCommunicationRulesEditor();
  } catch (e) {
    console.error('[CommRules] Load error:', e);
    currentCommunicationRules = JSON.parse(JSON.stringify(DEFAULT_COMMUNICATION_RULES));
    renderCommunicationRulesEditor();
  }
}

// 导出给 editTeam 使用
window.loadCommunicationRulesForTeam = loadCommunicationRules;
