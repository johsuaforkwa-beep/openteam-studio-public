/**
 * Vibe Coding Dashboard - File Components
 * 文件树相关组件
 */

(function() {
  'use strict';

  // === File Tree ===

  let contextTarget = null;

  /**
   * 渲染文件树
   */
  function renderFileTree() {
    if (typeof PROJECTS === 'undefined' || typeof STORE === 'undefined') return;
    
    const proj = PROJECTS[STORE.currentProject];
    const tree = document.getElementById('fileTree');
    if (!tree) return;
    tree.innerHTML = '';
    
    const labelEl = document.getElementById('currentProjectLabel');
    if (labelEl) labelEl.textContent = STORE.currentProject;

    // 显示项目数据路径
    if (STORE.projectsPath) {
      const pathItem = document.createElement('div');
      pathItem.className = 'tree-item project-path-item';
      pathItem.style.cssText = 'padding:8px 12px;border-bottom:1px solid var(--border);margin-bottom:4px;cursor:pointer';
      pathItem.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;font-size:10px;color:var(--text3)">
          <span>📁</span>
          <span style="flex:1;font-family:var(--mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${STORE.projectsPath}">${STORE.projectsPath}</span>
          <span style="opacity:0.6;cursor:pointer;padding:2px 4px" onclick="event.stopPropagation();copyProjectPath()" title="复制路径">📋</span>
        </div>
      `;
      pathItem.onclick = () => copyProjectPath();
      tree.appendChild(pathItem);
    }

    proj.files.forEach(f => {
      const item = document.createElement('div');
      item.className = 'tree-item' + (f.path && STORE.currentFile === f.path ? ' active' : '');
      item.style.paddingLeft = (12 + (f.indent || 0) * 14) + 'px';

      // 空状态提示
      if (f.type === 'empty') {
        item.style.color = 'var(--text3)';
        item.style.fontStyle = 'italic';
        item.innerHTML = `<span class="icon">📭</span><span>${f.name}</span>`;
        tree.appendChild(item);
        return;
      }

      if (f.type === 'dir') {
        item.innerHTML = `<span class="icon">📁</span><span>${f.name}</span>`;
      } else {
        const icon = typeof UTILS !== 'undefined' ? UTILS.getFileIcon(f.name, 'file') : '📄';
        const badge = f.name === 'PROJECT.md' && proj.tasks.some(t => t.status === 'active') ? `<span class="badge active-badge">ACTIVE</span>` : '';
        item.innerHTML = `<span class="icon">${icon}</span><span>${f.name}</span>${badge}`;
        if (f.path) item.onclick = (e) => { e.stopPropagation(); openFile(f.path, f.name); };
      }
      item.oncontextmenu = (e) => { e.preventDefault(); showContextMenu(e, f); };
      tree.appendChild(item);
    });
  }

  /**
   * 复制项目路径到剪贴板
   */
  function copyProjectPath() {
    if (typeof STORE === 'undefined' || !STORE.projectsPath) return;
    navigator.clipboard.writeText(STORE.projectsPath).then(() => {
      if (typeof showNotif !== 'undefined') {
        showNotif('✓ 已复制路径: ' + STORE.projectsPath);
      }
    }).catch(() => {
      if (typeof showNotif !== 'undefined') {
        showNotif('⚠ 复制失败', 'error');
      }
    });
  }

  /**
   * 显示右键菜单
   */
  function showContextMenu(e, file) {
    contextTarget = file;
    const menu = document.getElementById('contextMenu');
    if (!menu) return;
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.classList.add('show');
    setTimeout(() => {
      document.onclick = (ev) => {
        if (!menu.contains(ev.target)) {
          menu.classList.remove('show');
          document.onclick = null;
        }
      };
    }, 0);
  }

  /**
   * 打开文件
   */
  async function openFile(path, name) {
    if (typeof STORE === 'undefined') return;
    STORE.currentFile = path;
    renderFileTree();
    if (typeof switchTab !== 'undefined') switchTab('editor');
    if (typeof API !== 'undefined' && !STORE.fileContents[path]) {
      await API.loadFileContent(path);
    }
    if (typeof renderPanel !== 'undefined') renderPanel();
  }

  // 导出
  window.FILE_COMPONENTS = {
    renderFileTree,
    copyProjectPath,
    showContextMenu,
    openFile,
  };

})();
