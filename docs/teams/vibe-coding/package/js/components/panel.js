/**
 * Vibe Coding Dashboard - Panel Components
 * 面板相关组件
 */

(function() {
  'use strict';

  // === Panel ===

  /**
   * 切换标签页
   */
  function switchTab(tab) {
    if (typeof STORE === 'undefined') return false;
    STORE.currentTab = tab;
    document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tab)?.classList.add('active');
    renderPanel();
    return false;
  }

  /**
   * 渲染面板
   */
  function renderPanel() {
    if (typeof STORE === 'undefined') return;
    const body = document.getElementById('panelBody');
    if (!body) return;
    body.innerHTML = '';
    if (STORE.currentTab === 'thinking') renderThinkingPanel(body);
    else if (STORE.currentTab === 'editor') renderEditorPanel(body);
    else if (STORE.currentTab === 'board') renderBoardPanel(body);
  }

  /**
   * 渲染思考面板
   */
  function renderThinkingPanel(body) {
    if (typeof PROJECTS === 'undefined' || typeof STORE === 'undefined' || typeof AGENTS === 'undefined') return;
    
    body.style.cssText = 'overflow:hidden;display:flex;flex-direction:column';
    body.innerHTML = `<div style="padding:8px 10px;border-bottom:1px solid var(--border);font-size:11px;color:var(--text2);display:flex;justify-content:space-between;align-items:center">
      <span>🧠 Agent 实时状态</span>
      <span style="font-size:10px;color:var(--text3)" id="lastUpdateTime">--</span>
    </div>`;
    const panel = document.createElement('div');
    panel.className = 'thinking-panel';
    panel.style.cssText = 'flex:1;overflow-y:auto;padding:10px';
    
    const proj = PROJECTS[STORE.currentProject];
    const streams = STORE.thinkingStreams || {};
    
    AGENTS.forEach(ag => {
      const state = proj.agentStates[ag.id] || { status: 'idle', task: '空闲' };
      const thoughts = typeof THINKING !== 'undefined' ? (THINKING[ag.id] || []) : [];
      const liveStream = streams[ag.id];
      
      // 状态颜色映射
      const statusColors = {
        'working': 'var(--accent)',
        'done': 'var(--green)',
        'blocked': 'var(--red)',
        'idle': 'var(--text3)'
      };
      const statusColor = statusColors[state.status] || statusColors['idle'];
      
      // 状态标签
      const statusLabels = {
        'working': '⚡ 工作中',
        'done': '✓ 已完成',
        'blocked': '⊘ 阻塞',
        'idle': '· 空闲'
      };
      const statusLabel = statusLabels[state.status] || '· 空闲';
      
      // 优先显示实时思考流，然后是历史记录，最后是状态任务
      let displayText = state.task;
      let isStreaming = false;
      
      if (liveStream && liveStream.text && !liveStream.done) {
        displayText = liveStream.text;
        isStreaming = true;
      } else if (thoughts.length > 0) {
        displayText = thoughts[0].text;
      }
      
      const escHtml = typeof UTILS !== 'undefined' && UTILS.escHtml ? UTILS.escHtml : (t) => t;
      
      const section = document.createElement('div');
      section.className = 'thinking-entry';
      section.style.marginBottom = '10px';
      section.dataset.agentId = ag.id;
      section.innerHTML = `
        <div class="thinking-header" style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <div class="agent-avatar" style="width:20px;height:20px;border-radius:5px;background:${ag.bg};color:${ag.color};font-size:10px;display:flex;align-items:center;justify-content:center;font-weight:600">${ag.short}</div>
          <span style="font-size:12px;color:${ag.color};font-weight:600">${ag.id}</span>
          <span style="font-size:10px;color:var(--text3)">${ag.role}</span>
          <span class="agent-status-dot status-${state.status}" style="margin-left:2px;width:8px;height:8px;border-radius:50%;background:${statusColor}"></span>
          <span style="font-size:10px;color:${statusColor};font-weight:500">${statusLabel}</span>
          <div style="margin-left:auto;display:flex;gap:4px">
            <button class="thinking-action-btn" onclick="event.stopPropagation();openPrivateChat('${ag.id}')" title="私聊">💬</button>
            <button class="thinking-action-btn" onclick="event.stopPropagation();toggleAgentMuted('${ag.id}')" title="禁言">🔇</button>
            <button class="thinking-action-btn" onclick="event.stopPropagation();toggleAgentOffline('${ag.id}')" title="离线">🔕</button>
          </div>
        </div>
        <div class="thinking-stream" style="background:var(--bg2);border-radius:6px;padding:8px 10px;border:1px solid var(--border)">
          <div class="thinking-stream-content" style="font-size:11px;color:var(--text2);line-height:1.5;white-space:pre-wrap;word-break:break-all;font-family:var(--mono)">${isStreaming ? '▊ ' : ''}${escHtml(displayText.slice(0, 300))}${displayText.length > 300 ? '...' : ''}</div>
          ${isStreaming ? '<div style="font-size:9px;color:var(--accent);margin-top:4px">● 实时思考中...</div>' : ''}
        </div>
        ${thoughts.length > 1 ? `<div style="font-size:9px;color:var(--text3);margin-top:4px;cursor:pointer" onclick="toggleThinkingHistory('${ag.id}')">📄 ${thoughts.length} 条历史记录</div>` : ''}
      `;
      panel.appendChild(section);
    });
    body.appendChild(panel);
    
    // 更新时间戳
    const timeEl = document.getElementById('lastUpdateTime');
    if (timeEl) {
      const now = new Date();
      timeEl.textContent = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    }
  }

  /**
   * 渲染编辑器面板
   */
  function renderEditorPanel(body) {
    if (typeof STORE === 'undefined') return;
    body.style.cssText = 'overflow:hidden;display:flex;flex-direction:column';
    if (!STORE.currentFile) { body.innerHTML = `<div class="empty-state"><div class="empty-icon">◇</div><div class="empty-text">从左侧选择文件</div></div>`; return; }
    
    const content = STORE.fileContents[STORE.currentFile] || `# ${STORE.currentFile}\n\n（文件内容待加载）`;
    const isUnsaved = STORE.unsaved[STORE.currentFile];
    const escHtml = typeof UTILS !== 'undefined' && UTILS.escHtml ? UTILS.escHtml : (t) => t;
    
    body.innerHTML = `
      <div class="file-editor-header">
        <span class="file-breadcrumb">${STORE.currentFile}</span>
        ${isUnsaved ? '<span class="file-unsaved">● 未保存</span>' : ''}
        <button class="file-save-btn" onclick="saveFile()">保存</button>
      </div>
      <div class="editor-toolbar">
        <button class="toolbar-btn" onclick="insertMd('**','**')">B</button>
        <button class="toolbar-btn" onclick="insertMd('*','*')" style="font-style:italic">I</button>
        <button class="toolbar-btn" onclick="insertMd('\`','\`')">code</button>
        <button class="toolbar-btn" onclick="insertMd('#ACTIVE ','')">A</button>
        <button class="toolbar-btn" onclick="insertMd('#TODO ','')">T</button>
        <button class="toolbar-btn" onclick="insertMd('#DONE ','')">✓</button>
      </div>
      <div class="code-editor-area">
        <textarea class="md-textarea" id="mdTextarea">${escHtml(content)}</textarea>
      </div>
    `;
    
    const textarea = document.getElementById('mdTextarea');
    if (textarea) {
      textarea.oninput = function() {
        STORE.fileContents[STORE.currentFile] = this.value;
        STORE.unsaved[STORE.currentFile] = true;
      };
    }
  }

  /**
   * 渲染看板面板
   */
  function renderBoardPanel(body) {
    if (typeof PROJECTS === 'undefined' || typeof STORE === 'undefined') return;
    body.style.cssText = 'overflow:hidden;display:flex;flex-direction:column';
    const proj = PROJECTS[STORE.currentProject];
    const order = ['active','blocked','todo','done'];
    const labels = { active: '#ACTIVE', todo: '#TODO', done: '#DONE', blocked: '#BLOCKED' };
    
    body.innerHTML = `<div style="padding:8px 10px;border-bottom:1px solid var(--border);font-size:11px;color:var(--text2)">📋 PROJECT.md 任务看板</div>`;
    const board = document.createElement('div');
    board.className = 'task-board';
    
    order.forEach(status => {
      const tasks = proj.tasks.filter(t => t.status === status);
      if (!tasks.length) return;
      board.innerHTML += `<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text3);font-weight:600;margin:6px 0 4px">${labels[status]}</div>`;
      tasks.forEach(task => {
        board.innerHTML += `
          <div class="task-card" onclick="switchTab('editor');STORE.currentFile='PROJECT.md';renderPanel();">
            <div class="task-card-top">
              <span class="task-id">${task.id}</span>
              <span class="task-title">${task.title}</span>
              <span class="status-badge badge-${status}">${status}</span>
            </div>
            <div class="task-meta">
              <span class="task-assignee">${task.assignee}</span>
              <span class="task-priority">P: ${task.priority}</span>
            </div>
          </div>
        `;
      });
    });
    body.appendChild(board);
  }

  // 导出
  window.PANEL_COMPONENTS = {
    switchTab,
    renderPanel,
    renderThinkingPanel,
    renderEditorPanel,
    renderBoardPanel,
  };

})();
