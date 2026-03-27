/**
 * Vibe Coding Dashboard - Agent Components
 * Agent 相关组件
 */

(function() {
  'use strict';

  // === Agent Strip ===

  /**
   * 渲染 Agent 状态条
   */
  function renderAgentStrip() {
    if (typeof PROJECTS === 'undefined' || typeof STORE === 'undefined' || typeof AGENTS === 'undefined') return;
    
    const proj = PROJECTS[STORE.currentProject];
    const strip = document.getElementById('agentStrip');
    if (!strip) return;
    strip.innerHTML = '';
    
    AGENTS.forEach(ag => {
      const state = proj.agentStates[ag.id] || { status: 'idle', task: '空闲' };
      const agentStatus = STORE.getAgentStatus(ag.id);
      const isOffline = agentStatus.offline;
      const isMuted = agentStatus.muted;
      
      const card = document.createElement('div');
      card.className = 'agent-card status-' + state.status + (STORE.selectedAgentCard === ag.id ? ' selected' : '') + (isOffline ? ' offline' : '');
      card.id = 'agent-card-' + ag.id;
      card.onclick = (e) => { e.stopPropagation(); selectAgent(ag.id); };
      
      // 状态标签
      let statusTag = state.status === 'working' ? '⚡ working' : state.status === 'done' ? '✓ done' : state.status === 'blocked' ? '⊘ blocked' : '· idle';
      if (isOffline) statusTag = '🔕 离线';
      else if (isMuted) statusTag = '🔇 禁言';
      
      card.innerHTML = `
        <div class="agent-card-header">
          <div class="agent-avatar" style="background:${ag.bg};color:${ag.color}">${ag.short}</div>
          <span class="agent-name" style="color:${ag.color}">${ag.id}</span>
          <span class="agent-status-dot status-${state.status}"></span>
        </div>
        <div class="agent-card-body">
          <div class="agent-task">${state.task}</div>
          <span class="agent-tag">${statusTag}</span>
          <div class="agent-actions">
            <button class="agent-action-btn" onclick="event.stopPropagation(); openPrivateChat('${ag.id}')" title="私聊">💬</button>
            <button class="agent-action-btn ${isMuted ? 'active' : ''}" onclick="event.stopPropagation(); toggleAgentMuted('${ag.id}')" title="${isMuted ? '取消禁言' : '禁言'}">🔇</button>
            <button class="agent-action-btn ${isOffline ? 'active' : ''}" onclick="event.stopPropagation(); toggleAgentOffline('${ag.id}')" title="${isOffline ? '设为在线' : '设为离线'}">🔕</button>
          </div>
        </div>
      `;
      strip.appendChild(card);
    });
    
    // SVG container for collaboration lines
    if (!document.getElementById('collab-svg')) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = 'collab-svg';
      svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5';
      strip.style.position = 'relative';
      strip.appendChild(svg);
    }
  }

  /**
   * 选择 Agent
   */
  function selectAgent(agentId) {
    if (typeof STORE === 'undefined') return;
    STORE.selectedAgentCard = agentId;
    STORE.currentThinkingAgent = agentId;
    renderAgentStrip();
    if (typeof switchTab !== 'undefined') {
      if (STORE.currentTab !== 'thinking') switchTab('thinking');
      else if (typeof renderPanel !== 'undefined') renderPanel();
    }
  }

  // === Agent 状态控制 ===

  /**
   * 切换 agent 禁言状态
   */
  function toggleAgentMuted(agentId) {
    if (typeof STORE === 'undefined') return;
    const status = STORE.getAgentStatus(agentId);
    STORE.setAgentMuted(agentId, !status.muted);
    renderAgentStrip();
    if (typeof showNotif !== 'undefined') {
      showNotif(status.muted ? `${agentId} 已取消禁言` : `${agentId} 已禁言`);
    }
  }

  /**
   * 切换 agent 离线状态
   */
  function toggleAgentOffline(agentId) {
    if (typeof STORE === 'undefined') return;
    const status = STORE.getAgentStatus(agentId);
    STORE.setAgentOffline(agentId, !status.offline);
    renderAgentStrip();
    if (typeof showNotif !== 'undefined') {
      showNotif(status.offline ? `${agentId} 已上线` : `${agentId} 已离线`);
    }
  }

  // 导出
  window.AGENT_COMPONENTS = {
    renderAgentStrip,
    selectAgent,
    toggleAgentMuted,
    toggleAgentOffline,
  };

})();
