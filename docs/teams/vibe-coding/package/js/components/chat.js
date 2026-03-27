/**
 * Vibe Coding Dashboard - Chat Components
 * 聊天相关组件
 */

(function() {
  'use strict';

  // === Chat ===

  /**
   * 渲染聊天消息列表
   */
  function renderChatMessages() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    container.innerHTML = '';
    
    // 获取当前 team 成员 ID 列表
    const teamMemberIds = typeof AGENTS !== 'undefined' ? AGENTS.map(a => a.id) : [];
    
    if (typeof MESSAGES === 'undefined') return;
    
    MESSAGES.forEach((m, index) => {
      // 过滤消息：只显示 team 成员和用户的消息
      if (m.agent !== 'user' && m.agent !== 'system' && !teamMemberIds.includes(m.agent)) {
        return; // 跳过非 team 成员的消息
      }
      
      const isCollapsed = m.tags && m.tags.includes('collapsed');
      const isBlocked = m.tags && m.tags.includes('blocked');
      const isIntercept = m.tags && m.tags.includes('intercept');
      
      const ag = (typeof AGENTS !== 'undefined' ? AGENTS.find(a => a.id === m.agent) : null) || { 
        id: m.agent, 
        bg: m.agent === 'user' ? 'rgba(91,141,245,0.15)' : (m.agent === 'system' ? 'rgba(255,193,7,0.15)' : 'var(--bg4)'), 
        color: m.agent === 'user' ? '#5b8df5' : (m.agent === 'system' ? '#ffc107' : 'var(--text2)'), 
        short: m.agent === 'user' ? 'U' : (m.agent === 'system' ? 'S' : m.agent.slice(0,2).toUpperCase()) 
      };
      
      const div = document.createElement('div');
      div.className = 'msg' + (isCollapsed ? ' msg-collapsed' : '') + (isBlocked ? ' msg-blocked' : '');
      
      // 折叠消息：添加展开按钮
      let collapsedContent = '';
      if (isCollapsed && m.fullContent) {
        collapsedContent = `
          <div class="msg-collapsed-hint" onclick="window.CHAT_COMPONENTS.toggleCollapsed(${index})">
            <span class="collapse-icon">▶</span>
            <span class="collapse-text">点击展开完整内容</span>
          </div>
          <div class="msg-full-content" id="msg-full-${index}" style="display:none;">
            ${formatMsgText(m.fullContent)}
          </div>
        `;
      }
      
      div.innerHTML = `
      <div class="msg-avatar" style="background:${ag.bg};color:${ag.color}">${ag.short}</div>
      <div class="msg-body">
        <div class="msg-meta">
          <span class="msg-sender" style="color:${ag.color}">${m.agent}</span>
          <span class="msg-time">${m.time}</span>
          ${m.tags.filter(t => !['intercept', 'collapsed', 'outbound'].includes(t)).map(t => `<span class="msg-tag">${t}</span>`).join('')}
          ${isIntercept ? '<span class="msg-tag msg-tag-intercept">agent间通信</span>' : ''}
        </div>
        <div class="msg-text">${formatMsgText(m.text)}</div>
        ${collapsedContent}
      </div>
    `;
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
  }
  
  /**
   * 切换折叠消息的展开/折叠状态
   */
  function toggleCollapsed(index) {
    const fullContent = document.getElementById(`msg-full-${index}`);
    const hint = fullContent?.previousElementSibling;
    
    if (fullContent && hint) {
      const isHidden = fullContent.style.display === 'none';
      fullContent.style.display = isHidden ? 'block' : 'none';
      hint.querySelector('.collapse-icon').textContent = isHidden ? '▼' : '▶';
      hint.querySelector('.collapse-text').textContent = isHidden ? '点击折叠' : '点击展开完整内容';
    }
  }

  /**
   * 格式化消息文本
   */
  function formatMsgText(text) {
    return text
      .replace(/\n/g, '<br>')
      .replace(/@(\w[\w-]*)/g, '<span class="mention">@$1</span>')
      .replace(/#(T\d+)/g, '<span class="mention">#$1</span>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  /**
   * 添加聊天消息
   * @param {string} agent - 发送者
   * @param {string} text - 消息文本
   * @param {string[]} tags - 标签数组
   * @param {string} fullContent - 可选，完整内容（用于折叠消息）
   */
  function addChatMessage(agent, text, tags = [], fullContent = null) {
    // 过滤非 team 成员
    const teamMemberIds = typeof AGENTS !== 'undefined' ? AGENTS.map(a => a.id) : [];
    if (agent !== 'user' && agent !== 'system' && !teamMemberIds.includes(agent)) {
      console.log('[Chat] Ignoring message from non-team member:', agent);
      return;
    }
    
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    if (typeof MESSAGES !== 'undefined') {
      MESSAGES.push({ agent, text, time, tags, fullContent });
    }
    renderChatMessages();
  }

  /**
   * 更新或创建流式消息（实时显示 agent 正在输入的内容）
   */
  function updateStreamingMessage(agentId, text) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    
    // 过滤非 team 成员
    const teamMemberIds = typeof AGENTS !== 'undefined' ? AGENTS.map(a => a.id) : [];
    if (!teamMemberIds.includes(agentId)) {
      console.log('[Chat] Ignoring streaming message from non-team member:', agentId);
      return;
    }
    
    // 查找或创建流式消息元素
    let streamEl = document.getElementById('streaming-' + agentId);
    
    if (!streamEl) {
      // 创建新的流式消息元素
      const ag = (typeof AGENTS !== 'undefined' ? AGENTS.find(a => a.id === agentId) : null) || { 
        id: agentId, 
        bg: 'var(--bg4)', 
        color: 'var(--text2)', 
        short: agentId.slice(0,2).toUpperCase() 
      };
      
      streamEl = document.createElement('div');
      streamEl.id = 'streaming-' + agentId;
      streamEl.className = 'msg streaming-msg';
      streamEl.innerHTML = `
        <div class="msg-avatar" style="background:${ag.bg};color:${ag.color}">${ag.short}</div>
        <div class="msg-body">
          <div class="msg-meta">
            <span class="msg-sender" style="color:${ag.color}">${agentId}</span>
            <span class="streaming-indicator">● 正在输入...</span>
          </div>
          <div class="msg-text streaming-text"></div>
        </div>
      `;
      container.appendChild(streamEl);
    }
    
    // 更新文本内容
    const textEl = streamEl.querySelector('.streaming-text');
    if (textEl) {
      textEl.innerHTML = formatMsgText(text);
    }
    
    // 滚动到底部
    container.scrollTop = container.scrollHeight;
  }

  /**
   * 完成流式消息（当收到 agent-reply 时调用）
   */
  function finalizeStreamingMessage(agentId, finalText) {
    const streamEl = document.getElementById('streaming-' + agentId);
    if (streamEl) {
      // 移除流式消息元素，让 addChatMessage 添加最终消息
      streamEl.remove();
    }
  }

  // === 清空消息 ===

  /**
   * 清空聊天消息
   */
  function clearChatMessages() {
    if (!confirm('确定要清空所有聊天记录吗？')) return;
    if (typeof MESSAGES !== 'undefined') {
      MESSAGES.length = 0;
    }
    renderChatMessages();
    if (typeof showNotif !== 'undefined') {
      showNotif('聊天记录已清空');
    }
  }

  // 导出
  window.CHAT_COMPONENTS = {
    renderChatMessages,
    formatMsgText,
    addChatMessage,
    updateStreamingMessage,
    finalizeStreamingMessage,
    clearChatMessages,
    toggleCollapsed,
  };

})();
