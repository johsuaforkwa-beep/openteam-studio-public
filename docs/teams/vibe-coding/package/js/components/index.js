/**
 * Vibe Coding Dashboard - Components Index
 * 组件模块入口
 * 
 * 统一导出各模块的接口，并设置全局函数
 */

(function() {
  'use strict';

  // 从各模块获取函数
  const CHAT = window.CHAT_COMPONENTS || {};
  const AGENT = window.AGENT_COMPONENTS || {};
  const FILE = window.FILE_COMPONENTS || {};
  const PANEL = window.PANEL_COMPONENTS || {};
  const PRIVATE_CHAT = window.PRIVATE_CHAT_COMPONENTS || {};

  // 统一导出 COMPONENTS 对象
  window.COMPONENTS = {
    // Chat
    renderChatMessages: CHAT.renderChatMessages,
    addChatMessage: CHAT.addChatMessage,
    updateStreamingMessage: CHAT.updateStreamingMessage,
    finalizeStreamingMessage: CHAT.finalizeStreamingMessage,
    
    // Agent
    renderAgentStrip: AGENT.renderAgentStrip,
    selectAgent: AGENT.selectAgent,
    
    // File
    renderFileTree: FILE.renderFileTree,
    openFile: FILE.openFile,
    copyProjectPath: FILE.copyProjectPath,
    
    // Panel
    switchTab: PANEL.switchTab,
    renderPanel: PANEL.renderPanel,
    
    // Private Chat
    renderPrivateChatMessages: PRIVATE_CHAT.renderPrivateChatMessages,
    addPrivateChatMessage: PRIVATE_CHAT.addPrivateChatMessage,
  };

  // 全局函数（保持向后兼容）
  // 这些函数被 HTML onclick 属性直接调用
  window.toggleThinkingHistory = function(agentId) {
    if (typeof THINKING === 'undefined') return;
    const thoughts = THINKING[agentId] || [];
    if (thoughts.length > 0) {
      thoughts[0].expanded = !thoughts[0].expanded;
      if (typeof renderPanel !== 'undefined') renderPanel();
    }
  };

  // 从各模块导出全局函数
  window.renderChatMessages = CHAT.renderChatMessages;
  window.addChatMessage = CHAT.addChatMessage;
  window.clearChatMessages = CHAT.clearChatMessages;
  window.renderAgentStrip = AGENT.renderAgentStrip;
  window.selectAgent = AGENT.selectAgent;
  window.toggleAgentMuted = AGENT.toggleAgentMuted;
  window.toggleAgentOffline = AGENT.toggleAgentOffline;
  window.renderFileTree = FILE.renderFileTree;
  window.openFile = FILE.openFile;
  window.switchTab = PANEL.switchTab;
  window.renderPanel = PANEL.renderPanel;
  window.openPrivateChat = PRIVATE_CHAT.openPrivateChat;
  window.closePrivateChat = PRIVATE_CHAT.closePrivateChat;
  window.sendPrivateChatMessage = PRIVATE_CHAT.sendPrivateChatMessage;
  window.handlePrivateChatKey = PRIVATE_CHAT.handlePrivateChatKey;

  console.log('[Components] Modules loaded successfully');

})();
