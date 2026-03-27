/**
 * Marketplace Page Logic
 * 商城页面逻辑
 */

import { state, installTeam, uninstallTeam } from '../store.js';
import { MARKET_TEAMS } from '../data/static-data.js';

// ─── Init ────────────────────────────────────────────────

export function initMarketPage() {
  renderMarket();
}

// ─── Render ────────────────────────────────────────────────

function renderMarket() {
  const featured = MARKET_TEAMS.filter(t => t.featured);
  const all = MARKET_TEAMS;
  
  renderMarketGrid(document.getElementById('featuredGrid'), featured);
  renderMarketGrid(document.getElementById('allGrid'), all);
}

function renderMarketGrid(container, teams) {
  if (!container) return;
  container.innerHTML = '';
  
  teams.forEach(team => {
    const card = document.createElement('div');
    card.className = 'market-card' + (team.featured ? ' featured-card' : '');
    const isInstalled = state.installedTeams.has(team.id);
    
    card.innerHTML = `
      <div class="mc-banner" style="background:${team.bannerColor}22;border-bottom:2px solid ${team.bannerColor}44"></div>
      <div class="mc-body">
        <div class="mc-top">
          <div class="mc-icon" style="background:${team.bannerColor}18">${team.icon}</div>
          <div class="mc-meta">
            <div class="mc-name">${team.name}</div>
            <div class="mc-author">by @${team.author}</div>
          </div>
          <div class="mc-badges">
            ${team.badge ? `<span class="mc-badge" style="background:${team.badgeColor}18;color:${team.badgeColor}">${team.badge}</span>` : ''}
          </div>
        </div>
        <div class="mc-desc">${team.desc}</div>
        <div class="mc-members-row">
          ${team.members.map(m => `
            <div class="mc-member-chip">
              <div class="mc-member-dot" style="background:${m.bg};color:${m.color}">${m.short}</div>
              <span class="mc-member-name">${m.name}</span>
            </div>
          `).join('')}
        </div>
        <div class="tags-row">
          ${(team.tags||[]).map(t => `<span class="tag-chip" style="font-size:10px;padding:2px 6px">${t}</span>`).join('')}
        </div>
      </div>
      <div class="mc-footer">
        <span class="mc-stat">⭐ ${team.rating}</span>
        <span class="mc-stat">↓ ${team.installs.toLocaleString()}</span>
        <span class="mc-stat">★ ${team.stars.toLocaleString()}</span>
        <span class="mc-spacer"></span>
        <button class="mc-install-btn ${isInstalled ? 'installed' : ''}" onclick="window.installMarketTeam('${team.id}', this)">
          ${isInstalled ? '✓ 已安装' : '安装 Team'}
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

// ─── Actions ────────────────────────────────────────────────

window.installMarketTeam = function(teamId, btn) {
  if (state.installedTeams.has(teamId)) {
    uninstallTeam(teamId);
    btn.className = 'mc-install-btn';
    btn.textContent = '安装 Team';
    if (window.showNotif) window.showNotif('已卸载 Team');
  } else {
    installTeam(teamId);
    btn.className = 'mc-install-btn installed';
    btn.textContent = '✓ 已安装';
    const team = MARKET_TEAMS.find(t => t.id === teamId);
    if (window.showNotif) window.showNotif(`✓ ${team?.name || teamId} 已安装`);
  }
};

window.filterCat = function(cat, el) {
  document.querySelectorAll('.market-cat').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  
  const filtered = cat === 'all' ? MARKET_TEAMS :
    cat === 'featured' ? MARKET_TEAMS.filter(t => t.featured) :
    cat === 'new' ? [...MARKET_TEAMS].slice(-4) :
    cat === 'popular' ? [...MARKET_TEAMS].sort((a,b) => b.installs-a.installs).slice(0,5) :
    MARKET_TEAMS.filter(t => t.cat === cat);
  
  renderMarketGrid(document.getElementById('featuredGrid'), filtered.filter(t => t.featured));
  renderMarketGrid(document.getElementById('allGrid'), filtered);
};

window.searchMarket = function(query) {
  const filtered = query
    ? MARKET_TEAMS.filter(t => t.name.includes(query) || t.desc.includes(query) || (t.tags||[]).some(tag => tag.includes(query)))
    : MARKET_TEAMS;
  renderMarketGrid(document.getElementById('featuredGrid'), filtered.filter(t => t.featured));
  renderMarketGrid(document.getElementById('allGrid'), filtered);
};

window.sortMarket = function(by, btn) {
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  const sorted = [...MARKET_TEAMS].sort((a,b) =>
    by === 'popular' ? b.installs - a.installs :
    by === 'new' ? b.id.localeCompare(a.id) :
    b.rating - a.rating
  );
  renderMarketGrid(document.getElementById('featuredGrid'), sorted.filter(t => t.featured));
  renderMarketGrid(document.getElementById('allGrid'), sorted);
};
