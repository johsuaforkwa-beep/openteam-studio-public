/**
 * Vibe Coding Dashboard - Private Chat Components
 * 私聊相关组件
 */

(function() {
  'use strict';

  // === 私聊功能 ===

  /**
   * 打开私聊窗口
   */
  function openPrivateChat(agentId) {
    if (typeof AGENTS === 'undefined' || typeof STORE === 'undefined') return;
    
    const agent = AGENTS.find(a => a.id === agentId);
    if (!agent) return;
    
    STORE.privateChatAgent = agentId;
    STORE.privateChatActive = true;
    
    // 检查是否已存在私聊窗口
    let chatModal = document.getElementById('privateChatModal');
    if (!chatModal) {
      chatModal = document.createElement('div');
      chatModal.id = 'privateChatModal';
      chatModal.className = 'private-chat-modal';
      document.body.appendChild(chatModal);
    }
    
    chatModal.innerHTML = `
      <div class="private-chat-header">
        <div class="private-chat-title">
          <div class="agent-avatar" style="background:${agent.bg};color:${agent.color};width:24px;height:24px;font-size:11px">${agent.short}</div>
          <span style="color:${agent.color};font-weight:600">${agent.id}</span>
          <span style="color:var(--text3);font-size:11px">私聊</span>
        </div>
        <button class="private-chat-close" onclick="closePrivateChat()">×</button>
      </div>
      <div class="private-chat-messages" id="privateChatMessages"></div>
      <div class="private-chat-input-area">
        <div class="private-chat-input-wrap">
          <input type="text" class="private-chat-input" id="privateChatInput" placeholder="发送私聊消息..." onkeydown="handlePrivateChatKey(event)">
          <button class="send-btn" onclick="sendPrivateChatMessage()">↑</button>
        </div>
      </div>
    `;
    
    chatModal.classList.add('show');
    renderPrivateChatMessages(agentId);
    
    // 聚焦输入框
    setTimeout(() => {
      document.getElementById('privateChatInput')?.focus();
    }, 100);
  }

  /**
   * 关闭私聊窗口
   */
  function closePrivateChat() {
    const chatModal = document.getElementById('privateChatModal');
    if (chatModal) {
      chatModal.classList.remove('show');
    }
    if (typeof STORE !== 'undefined') {
      STORE.privateChatActive = false;
    }
  }

  /**
   * 渲染私聊消息
   */
  function renderPrivateChatMessages(agentId) {
    const container = document.getElementById('privateChatMessages');
    if (!container || typeof STORE === 'undefined') return;
    container.innerHTML = '';
    
    const messages = STORE.getPrivateMessages(agentId);
    const formatMsgText = window.CHAT_COMPONENTS?.formatMsgText || ((t) => t);
    
    if (messages.length === 0) {
      container.innerHTML = '<div style="text-align:center;color:var(--text3);padding:20px;font-size:12px">暂无私聊记录</div>';
      return;
    }
    
    messages.forEach(m => {
      const isUser = m.sender === 'user';
      const div = document.createElement('div');
      div.className = 'private-msg' + (isUser ? ' user' : '');
      div.innerHTML = `
        <div class="private-msg-bubble">${formatMsgText(m.text)}</div>
        <div class="private-msg-time">${m.time}</div>
      `;
      container.appendChild(div);
    });
    
    container.scrollTop = container.scrollHeight;
  }

  /**
   * 发送私聊消息
   */
  function sendPrivateChatMessage() {
    const input = document.getElementById('privateChatInput');
    if (!input || typeof STORE === 'undefined' || typeof API === 'undefined') return;
    
    const text = input.value.trim();
    if (!text) return;
    
    const agentId = STORE.privateChatAgent;
    if (!agentId) return;
    
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    
    // 添加用户消息
    STORE.addPrivateMessage(agentId, { sender: 'user', text, time });
    renderPrivateChatMessages(agentId);
    
    input.value = '';
    
    // 发送到服务器（如果已连接）- 使用私聊模式
    if (API.wsConnected) {
      API.sendPrivateMessage(agentId, text);
    }
  }

  /**
   * 处理私聊输入键盘事件
   */
  function handlePrivateChatKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendPrivateChatMessage();
    }
  }

  /**
   * 添加私聊消息（agent 回复）
   */
  function addPrivateChatMessage(agentId, text) {
    if (typeof STORE === 'undefined') return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    STORE.addPrivateMessage(agentId, { sender: agentId, text, time });
    
    // 如果当前正在与该 agent 私聊，更新显示
    if (STORE.privateChatAgent === agentId) {
      renderPrivateChatMessages(agentId);
    }
  }

  // 导出
  window.PRIVATE_CHAT_COMPONENTS = {
    openPrivateChat,
    closePrivateChat,
    renderPrivateChatMessages,
    sendPrivateChatMessage,
    handlePrivateChatKey,
    addPrivateChatMessage,
  };

})();
