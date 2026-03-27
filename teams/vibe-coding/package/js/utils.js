/**
 * Vibe Coding Dashboard - Utils
 * 工具函数
 */

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function showNotif(msg, type = 'success', detail = null) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = { success: '✓', error: '✕', warning: '⚠', loading: '◐', info: 'ℹ' };
  const displayTime = Math.max(3000, 3000 + Math.min(7000, Math.floor(msg.length / 50) * 1000));
  
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || 'ℹ'}</div>
    <div class="toast-content">
      <div class="toast-message">${escHtml(msg)}</div>
      ${detail ? `<div class="toast-detail">${escHtml(detail)}</div>` : ''}
    </div>
    <button class="toast-close" title="关闭">✕</button>
    <div class="toast-progress" style="animation-duration: ${displayTime}ms"></div>
  `;
  
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.onclick = () => removeToast(toast);
  toast.onclick = (e) => { if (e.target === toast || e.target.classList.contains('toast-message')) removeToast(toast); };
  
  container.appendChild(toast);
  if (type !== 'loading') toast._timer = setTimeout(() => removeToast(toast), displayTime);
  
  return toast;
}

function removeToast(toast) {
  if (!toast || toast.classList.contains('hiding')) return;
  clearTimeout(toast._timer);
  toast.classList.add('hiding');
  setTimeout(() => toast.remove(), 200);
}

function loadTheme() {
  const savedTheme = localStorage.getItem('vibe-coding-theme');
  if (savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  
  if (newTheme === 'dark') {
    html.removeAttribute('data-theme');
  } else {
    html.setAttribute('data-theme', newTheme);
  }
  localStorage.setItem('vibe-coding-theme', newTheme);
  
  const btn = document.querySelector('.theme-toggle');
  if (btn) btn.textContent = newTheme === 'light' ? '🌙' : '🌓';
  
  showNotif(newTheme === 'light' ? '☀️ 亮色主题' : '🌙 暗色主题');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

function toggleRightPanel() {
  document.getElementById('rightPanel').classList.toggle('collapsed');
}

function getFileIcon(filename, type) {
  if (type === 'dir') return '📁';
  const ext = filename.split('.').pop().toLowerCase();
  const iconMap = { md: '📝', js: '📜', ts: '🔷', tsx: '⚛️', jsx: '⚛️', json: '📋', html: '🌐', css: '🎨', py: '🐍', go: '🐹', rs: '🦀', java: '☕', yaml: '⚙️', yml: '⚙️', sql: '🗃️', sh: '💻', env: '🔐' };
  return iconMap[ext] || '📄';
}

function renderMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/#ACTIVE/g, '<span class="tag-active">#ACTIVE</span>')
    .replace(/#TODO/g, '<span class="tag-todo">#TODO</span>')
    .replace(/#DONE/g, '<span class="tag-done">#DONE</span>')
    .replace(/#BLOCKED/g, '<span class="tag-blocked">#BLOCKED</span>');
}

// === 聊天输入框拖拽调整高度 ===
function initChatResize() {
  const handle = document.getElementById('chatResizeHandle');
  const inputArea = document.getElementById('chatInputArea');
  
  if (!handle || !inputArea) return;
  
  let startY = 0;
  let startHeight = 0;
  let isResizing = false;
  
  handle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startY = e.clientY;
    startHeight = inputArea.offsetHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const deltaY = startY - e.clientY; // 向上拖动增加高度
    const newHeight = Math.max(100, Math.min(window.innerHeight * 0.5, startHeight + deltaY));
    inputArea.style.height = newHeight + 'px';
  });
  
  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });
}

// 导出
window.UTILS = { escHtml, showNotif, removeToast, loadTheme, toggleTheme, toggleSidebar, toggleRightPanel, getFileIcon, renderMarkdown, initChatResize };
