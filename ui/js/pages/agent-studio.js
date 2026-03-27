/**
 * Agent Studio Page Logic
 * Agent 工坊页面逻辑
 */

import { state, setCurrentAgent, setCurrentEtab, syncToStorage, loadFromStorage } from '../store.js';
import { AgentAPI } from '../api.js';
import { AGENT_COLORS, ALL_SKILLS, AGENTS_DB } from '../data/static-data.js';

// ─── Init ────────────────────────────────────────────────

export async function initAgentStudio() {
  // 加载已保存的状态
  loadFromStorage();
  
  // 显示 loading
  renderAgentListLoading();
  
  // 加载服务器上的 Agent
  await loadAgentsFromServer();
  
  // 渲染 UI
  renderAgentList();
  renderEditorFor(state.currentAgentId);
}

async function loadAgentsFromServer() {
  try {
    const response = await AgentAPI.list();
    console.log('[AgentStudio] Loaded agents response:', response);
    
    // 清空现有数据，全量从服务器加载
    AGENTS_DB.length = 0;
    
    // API 返回格式: { ok: true, data: [...] }
    const agents = response.data || response;
    if (!Array.isArray(agents)) {
      console.warn('[AgentStudio] Invalid agents response:', response);
      return;
    }
    
    const colorKeys = Object.keys(AGENT_COLORS);
    
    for (const a of agents) {
      // 解析 SOUL.md 内容
      const soul = a.soul || getDefaultSoul();
      const role = soul.role || a.soul?.role || 'Agent';
      
      // 分配颜色
      const colorKey = colorKeys[AGENTS_DB.length % colorKeys.length];
      
      AGENTS_DB.push({
        id: a.id,
        name: a.id,
        role: role,
        colorKey,
        short: a.id.slice(0, 2).toUpperCase(),
        soul: {
          identity: soul.identity || '',
          personality: soul.personality || '',
          mission: soul.mission || '',
          communication: soul.communication || '',
          constraints: soul.constraints || '',
          traits: soul.traits || [],
          language: soul.language || 'zh-CN',
          model: soul.model || 'claude-sonnet-4-6',
          temperature: soul.temperature || 0.7,
        },
        skills: soul.skills || [],
        enabledSkills: soul.skills || [],
        status: 'idle',
        workspace: 'default',
        teamId: a.teamId,
        path: a.path,
      });
    }
    
    console.log('[AgentStudio] Loaded', AGENTS_DB.length, 'agents from server');
  } catch (e) {
    console.warn('[AgentStudio] Failed to load agents:', e);
  }
}

function getDefaultSoul() {
  return {
    identity: '', personality: '', mission: '', communication: '', constraints: '',
    traits: [], language: 'zh-CN', temperature: 0.7,
  };
}

// ─── Agent List ──────────────────────────────────────────

function renderAgentListLoading() {
  const list = document.getElementById('agentList');
  if (!list) return;
  list.innerHTML = `
    <div class="loading-overlay">
      <div class="loading-spinner"></div>
      <span>加载 Agents...</span>
    </div>
  `;
}

export function renderAgentList() {
  const list = document.getElementById('agentList');
  if (!list) return;
  
  list.innerHTML = '';
  
  AGENTS_DB.forEach(ag => {
    const c = AGENT_COLORS[ag.colorKey];
    const item = document.createElement('div');
    item.className = 'agent-item' + (ag.id === state.currentAgentId ? ' active' : '');
    item.dataset.agentId = ag.id;
    
    item.addEventListener('click', (e) => {
      if (e.target.closest('.delete-agent-btn')) return;
      setCurrentAgent(ag.id);
      renderAgentList();
      renderEditorFor(ag.id);
    });
    
    const pathHint = ag.teamId ? `~/${ag.teamId}/agents/${ag.id}` : '';
    item.innerHTML = `
      <div class="agent-ava" style="background:${c.bg};color:${c.color}">${ag.short}</div>
      <div class="agent-info">
        <div class="agent-item-name">${ag.id}</div>
        <div class="agent-item-role" title="${pathHint}">${ag.role} · ${ag.workspace || ag.teamId || 'default'}</div>
      </div>
      <div class="agent-online ${ag.status === 'active' ? 'online-active' : 'online-idle'}"></div>
      <div class="delete-agent-btn" onclick="event.stopPropagation(); window.deleteAgent('${ag.id}')" title="删除 Agent">✕</div>
    `;
    list.appendChild(item);
  });
}

// ─── Editor ──────────────────────────────────────────────

export function renderEditorFor(agentId) {
  const ag = AGENTS_DB.find(a => a.id === agentId);
  if (!ag) return;
  
  const c = AGENT_COLORS[ag.colorKey];
  const nameEl = document.getElementById('editorAgentName');
  if (nameEl) {
    nameEl.innerHTML = `
      <span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${c.bg};border:1px solid ${c.color};vertical-align:middle;margin-right:6px"></span>
      ${ag.id}
      <span style="font-size:12px;font-weight:400;color:var(--text2);margin-left:8px">${ag.role}</span>
    `;
  }
  
  renderEditorContent(state.currentEtab, ag);
}

function renderEditorContent(tab, ag) {
  const body = document.getElementById('editorBody');
  if (!body) return;
  body.innerHTML = '';
  
  if (tab === 'soul') renderSoulTab(body, ag);
  else if (tab === 'skills') renderSkillsTab(body, ag);
  else if (tab === 'config') renderConfigTab(body, ag);
  else if (tab === 'memory') renderMemoryTab(body, ag);
  
  renderPreview(ag);
}

export function switchEtab(tab, el, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  
  setCurrentEtab(tab);
  
  document.querySelectorAll('.etab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  else {
    const tabs = document.querySelectorAll('.etab');
    const idx = ['soul','skills','config','memory'].indexOf(tab);
    if (tabs[idx]) tabs[idx].classList.add('active');
  }
  
  const ag = AGENTS_DB.find(a => a.id === state.currentAgentId);
  if (ag) renderEditorContent(tab, ag);
}

// ─── Tab Renderers ─────────────────────────────────────────

function renderSoulTab(body, ag) {
  body.style.overflow = 'hidden';
  body.style.display = 'flex';
  body.style.flexDirection = 'column';
  body.style.flex = '1';

  const grid = document.createElement('div');
  grid.className = 'soul-sections';
  grid.style.flex = '1';

  const sections = [
    { key: 'identity', icon: '👤', title: '身份 Identity', rows: 3 },
    { key: 'personality', icon: '🧠', title: '个性 Personality', rows: 3 },
    { key: 'mission', icon: '🎯', title: '使命 Mission', rows: 3 },
    { key: 'communication', icon: '💬', title: '沟通方式 Communication', rows: 3 },
    { key: 'constraints', icon: '⛔', title: '约束 Constraints', rows: 3 },
    { key: 'traits', icon: '🏷', title: '特征标签 Traits', rows: null },
  ];

  sections.forEach(s => {
    const sec = document.createElement('div');
    sec.className = 'soul-section';
    if (s.key === 'traits') {
      const tags = ag.soul.traits || [];
      sec.innerHTML = `
        <div class="soul-section-header"><span class="soul-section-icon">${s.icon}</span><span class="soul-section-title">${s.title}</span></div>
        <div class="soul-section-body">
          <div class="tags-row" id="traits-row">
            ${tags.map((t,i) => `<div class="tag-chip">${escapeHtml(t)}<span class="x" onclick="window.removeTrait(${i})">✕</span></div>`).join('')}
          </div>
          <div class="tag-input-row">
            <input type="text" id="newTraitInput" placeholder="输入新标签..." maxlength="30" onkeydown="if(event.key==='Enter'){event.preventDefault();window.addTraitFromInput();}">
            <button class="btn" onclick="event.stopPropagation();event.preventDefault();window.addTraitFromInput();" style="padding:5px 10px;font-size:11px">添加</button>
          </div>
        </div>
      `;
    } else {
      sec.innerHTML = `
        <div class="soul-section-header"><span class="soul-section-icon">${s.icon}</span><span class="soul-section-title">${s.title}</span></div>
        <div class="soul-section-body">
          <textarea class="soul-input" rows="${s.rows}" oninput="window.updateSoul('${s.key}', this.value)">${escapeHtml(ag.soul[s.key] || '')}</textarea>
        </div>
      `;
    }
    grid.appendChild(sec);
  });

  body.appendChild(grid);
}

function renderSkillsTab(body, ag) {
  body.style.overflow = 'auto';
  body.style.padding = '16px';
  body.style.display = 'block';

  body.innerHTML = `
    <div style="font-size:12px;color:var(--text2);margin-bottom:14px">选择此 Agent 可使用的 OpenClaw Skills。</div>
    <div class="skill-list">
      ${ALL_SKILLS.map(sk => {
        const isEnabled = ag.enabledSkills.includes(sk.id);
        return `
          <div class="skill-item ${isEnabled ? 'enabled' : ''}">
            <div class="skill-dot" style="background:${sk.color}"></div>
            <div class="skill-name">${sk.name}</div>
            <div style="font-size:10px;color:var(--text2);flex:1">${sk.desc}</div>
            <label class="skill-toggle">
              <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="window.toggleSkill('${sk.id}', this.checked, this)">
              <span class="slider"></span>
            </label>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderConfigTab(body, ag) {
  body.style.overflow = 'auto';
  body.style.padding = '16px';
  body.style.display = 'block';

  const config = {
    model: ag.soul.model,
    temperature: parseFloat(ag.soul.temperature),
    language: ag.soul.language,
    workspace: ag.workspace,
    skills: ag.enabledSkills,
  };

  body.innerHTML = `
    <div class="config-grid">
      <div class="config-card">
        <div class="config-card-title">模型配置</div>
        <div class="field"><div class="field-label">LLM 模型</div>
          <select class="soul-input" onchange="window.updateConfig('model', this.value)">
            <option ${ag.soul.model === 'claude-sonnet-4-6' ? 'selected':''}>claude-sonnet-4-6</option>
            <option ${ag.soul.model === 'claude-opus-4-6' ? 'selected':''}>claude-opus-4-6</option>
            <option>gpt-4o</option>
            <option>deepseek-r2</option>
          </select>
        </div>
        <div class="field"><div class="field-label">Temperature</div>
          <input class="soul-input" type="number" min="0" max="1" step="0.05" value="${ag.soul.temperature}" oninput="window.updateConfig('temperature', this.value)">
        </div>
      </div>
      <div class="config-card">
        <div class="config-card-title">运行时配置</div>
        <div class="field"><div class="field-label">Workspace</div>
          <input class="soul-input" value="${ag.workspace}" oninput="window.updateConfig('workspace', this.value)">
        </div>
      </div>
    </div>
    <div style="padding:0 16px">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:var(--text3);margin-bottom:8px">openclaw.json 预览</div>
      <pre style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);padding:12px;font-family:var(--mono);font-size:11px;color:var(--text2);overflow-x:auto">${JSON.stringify(config, null, 2)}</pre>
    </div>
  `;
}

function renderMemoryTab(body, ag) {
  body.style.overflow = 'auto';
  body.style.padding = '16px';
  body.style.display = 'block';

  body.innerHTML = `
    <div style="font-size:12px;color:var(--text2);margin-bottom:14px">OpenClaw 将记忆存储为 Markdown 文件</div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);margin-bottom:10px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border);background:var(--bg3)">
        <span style="font-family:var(--mono);font-size:11px;color:var(--accent)">MEMORY.md</span>
      </div>
      <div style="padding:10px 12px;font-family:var(--mono);font-size:11px;color:var(--text2);line-height:1.6;white-space:pre-wrap">${ag.soul.identity.slice(0, 100)}...</div>
    </div>
  `;
}

// ─── Preview ─────────────────────────────────────────────

function renderPreview(ag) {
  const c = AGENT_COLORS[ag.colorKey];
  const previewEl = document.getElementById('agentPreview');
  if (!previewEl) return;

  previewEl.innerHTML = `
    <div class="agent-card-preview">
      <div class="acp-top">
        <div class="acp-ava" style="background:${c.bg};color:${c.color}">${ag.short}</div>
        <div class="acp-meta">
          <div class="acp-name">${ag.id}</div>
          <div class="acp-role" style="color:${c.color}">${ag.role} · ${ag.soul.model}</div>
        </div>
      </div>
      <div class="acp-body">
        <div class="acp-row"><div class="acp-label">身份</div><div class="acp-value">${ag.soul.identity.slice(0,60)}…</div></div>
        <div class="acp-row"><div class="acp-label">使命</div><div class="acp-value">${ag.soul.mission.slice(0,60)}…</div></div>
        <div class="acp-row"><div class="acp-label">Skills</div><div class="acp-value">${ag.enabledSkills.map(s => `<span class="acp-tag">${s}</span>`).join('')}</div></div>
      </div>
    </div>
  `;

  // Generate SOUL.md raw
  const soul = ag.soul;
  const raw = `---
id: ${ag.id}
role: ${ag.role}
model: ${soul.model}
temperature: ${soul.temperature}
---
# Identity
${soul.identity}
# Personality
${soul.personality}
# Mission
${soul.mission}`;

  const rawEl = document.getElementById('soulRaw');
  if (rawEl) rawEl.textContent = raw;
}

// ─── Actions ─────────────────────────────────────────────

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 暴露到全局（供 HTML onclick 调用）
window.updateSoul = function(key, value) {
  const ag = AGENTS_DB.find(a => a.id === state.currentAgentId);
  if (ag) {
    ag.soul[key] = value;
    renderPreview(ag);
    syncToStorage();
  }
};

window.updateConfig = function(key, value) {
  const ag = AGENTS_DB.find(a => a.id === state.currentAgentId);
  if (!ag) return;
  if (key === 'model' || key === 'temperature' || key === 'language') {
    ag.soul[key] = value;
  } else {
    ag[key] = value;
  }
  renderPreview(ag);
  syncToStorage();
};

window.toggleSkill = function(skillId, enabled, checkboxEl) {
  const ag = AGENTS_DB.find(a => a.id === state.currentAgentId);
  if (!ag) return;
  
  if (enabled) {
    if (!ag.enabledSkills.includes(skillId)) {
      ag.enabledSkills.push(skillId);
    }
  } else {
    ag.enabledSkills = ag.enabledSkills.filter(s => s !== skillId);
  }
  
  if (checkboxEl) {
    const skillItem = checkboxEl.closest('.skill-item');
    if (skillItem) {
      skillItem.classList.toggle('enabled', enabled);
    }
  }
  
  renderPreview(ag);
  syncToStorage();
};

window.addTraitFromInput = function() {
  const input = document.getElementById('newTraitInput');
  if (!input) return;
  
  const t = input.value.trim();
  if (!t) return;
  
  const ag = AGENTS_DB.find(a => a.id === state.currentAgentId);
  if (!ag) return;
  
  if (!ag.soul.traits) ag.soul.traits = [];
  ag.soul.traits.push(t);
  
  input.value = '';
  renderEditorContent(state.currentEtab, ag);
  renderPreview(ag);
  syncToStorage();
};

window.removeTrait = function(i) {
  const ag = AGENTS_DB.find(a => a.id === state.currentAgentId);
  if (ag) {
    ag.soul.traits.splice(i, 1);
    renderEditorContent(state.currentEtab, ag);
    syncToStorage();
  }
};

window.saveAgent = async function() {
  const ag = AGENTS_DB.find(a => a.id === state.currentAgentId);
  if (!ag) return;
  
  const agentData = {
    id: ag.id,
    name: ag.name || ag.id,
    role: ag.role,
    teamId: ag.teamId || 'default',
    soul: ag.soul,
    skills: ag.enabledSkills || [],
    model: ag.soul.model || 'claude-sonnet-4-6',
  };
  
  try {
    // 判断是创建还是更新
    // 如果 agent 已有 path（从服务器加载的），说明是更新
    const isUpdate = ag.path && ag.path.includes('.openclaw/agents');
    
    let data;
    if (isUpdate) {
      // 更新已有 agent
      data = await AgentAPI.update(ag.id, agentData);
    } else {
      // 创建新 agent
      data = await AgentAPI.create(agentData);
    }
    
    if (data.ok) {
      ag.teamId = data.agent?.teamId || 'default';
      ag.path = data.path || ag.path;
      if (window.showNotif) window.showNotif(`✓ ${ag.id} 已保存`);
      renderAgentList();
    } else {
      if (window.showNotif) window.showNotif(`⚠ 保存失败: ${data.error}`, 'error');
    }
  } catch (e) {
    if (window.showNotif) window.showNotif(`⚠ 保存失败: ${e.message}`, 'error');
  }
};

window.deleteAgent = async function(agentId) {
  if (!confirm(`确定要删除 Agent "${agentId}" 吗？`)) return;
  
  try {
    const data = await AgentAPI.delete(agentId);
    if (data.ok) {
      const idx = AGENTS_DB.findIndex(a => a.id === agentId);
      if (idx >= 0) AGENTS_DB.splice(idx, 1);
      
      if (state.currentAgentId === agentId) {
        state.currentAgentId = AGENTS_DB[0]?.id || null;
      }
      
      renderAgentList();
      if (state.currentAgentId) renderEditorFor(state.currentAgentId);
      if (window.showNotif) window.showNotif(`✓ 已删除 ${agentId}`);
    }
  } catch (e) {
    if (window.showNotif) window.showNotif(`⚠ 删除失败`, 'error');
  }
};

window.switchEtab = switchEtab;
