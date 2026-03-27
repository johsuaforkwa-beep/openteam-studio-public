/**
 * OpenTeam Studio - Static Data
 * 内置数据：Agent 颜色、Agent 列表、Skills、Teams、Market Teams
 */

// Agent 颜色配置
export const AGENT_COLORS = {
  purple: { color: '#b08af5', bg: 'rgba(176,138,245,0.18)' },
  blue:   { color: '#6c8ef5', bg: 'rgba(108,142,245,0.18)' },
  green:  { color: '#38d68a', bg: 'rgba(56,214,138,0.18)' },
  teal:   { color: '#30cbb8', bg: 'rgba(48,203,184,0.18)' },
  amber:  { color: '#f0a930', bg: 'rgba(240,169,48,0.18)' },
  coral:  { color: '#f07050', bg: 'rgba(240,112,80,0.18)' },
  pink:   { color: '#e870b0', bg: 'rgba(232,112,176,0.18)' },
  red:    { color: '#f06060', bg: 'rgba(240,96,96,0.18)' },
};

// 所有可用 Skills
export const ALL_SKILLS = [
  { id: 'shell', name: 'shell-exec', desc: '执行终端命令', color: '#38d68a' },
  { id: 'files', name: 'file-ops', desc: '读写本地文件', color: '#6c8ef5' },
  { id: 'browser', name: 'browser-ctrl', desc: '控制浏览器 (CDP)', color: '#f0a930' },
  { id: 'github', name: 'github-mcp', desc: 'GitHub 仓库操作', color: '#b08af5' },
  { id: 'web-search', name: 'web-search', desc: '联网搜索', color: '#30cbb8' },
  { id: 'database', name: 'db-query', desc: '数据库查询', color: '#f07050' },
  { id: 'calendar', name: 'cal-events', desc: '日历和提醒', color: '#e870b0' },
  { id: 'email', name: 'email-send', desc: '发送邮件', color: '#f06060' },
  { id: 'slack', name: 'slack-bot', desc: 'Slack 消息', color: '#6c8ef5' },
  { id: 'notion', name: 'notion-sync', desc: 'Notion 页面读写', color: '#b08af5' },
];

// Agent 数据库 - 从 ~/.openclaw/agents/ 加载
// 初始化为空，由 loadAgentsFromServer() 填充
export const AGENTS_DB = [];

// 我的 Teams - 从 ~/.openteam/teams/ 加载
// 初始化为空，由 loadTeamsFromServer() 填充
export const MY_TEAMS = [];

// 商城 Teams
export const MARKET_TEAMS = [
  {
    id: 'm1', name: 'YC 创业团队', cat: 'business', featured: true, icon: '🚀',
    author: 'steipete', stars: 2841, installs: 1204, rating: 4.9,
    desc: '模拟 YC 创业公司的全职能团队：CEO · CFO · CTO · Marketing · Legal。适合产品验证和 MVP 快速迭代。',
    badge: '精选', badgeColor: '#f0a930', bannerColor: '#f0a930',
    members: [
      { short: 'CE', color: '#f0a930', bg: 'rgba(240,169,48,0.18)', name: 'ceo-01' },
      { short: 'CT', color: '#6c8ef5', bg: 'rgba(108,142,245,0.18)', name: 'cto-01' },
      { short: 'MK', color: '#e870b0', bg: 'rgba(232,112,176,0.18)', name: 'mkt-01' },
      { short: 'LG', color: '#30cbb8', bg: 'rgba(48,203,184,0.18)', name: 'legal-01' },
    ],
    tags: ['商业', 'MVP', '创业', '决策'],
    installed: false,
  },
  {
    id: 'm2', name: '学术研究团队', cat: 'research', featured: true, icon: '🔬',
    author: 'academiai_lab', stars: 1573, installs: 892, rating: 4.8,
    desc: '文献综述 · 数据收集 · 统计分析 · 论文撰写。支持 arXiv、PubMed 自动检索，自动生成参考文献。',
    badge: '热门', badgeColor: '#f06060', bannerColor: '#6c8ef5',
    members: [
      { short: 'RE', color: '#6c8ef5', bg: 'rgba(108,142,245,0.18)', name: 'researcher-01' },
      { short: 'ST', color: '#38d68a', bg: 'rgba(56,214,138,0.18)', name: 'stat-01' },
      { short: 'WR', color: '#b08af5', bg: 'rgba(176,138,245,0.18)', name: 'writer-01' },
    ],
    tags: ['学术', '论文', '数据分析', 'arXiv'],
    installed: false,
  },
  {
    id: 'm3', name: 'DevOps 自动化团队', cat: 'ops', featured: true, icon: '⚙️',
    author: 'infra_claw', stars: 987, installs: 543, rating: 4.7,
    desc: '监控告警 · CI/CD 管理 · 日志分析 · 自动扩缩容。接入 k8s + Prometheus + Grafana。',
    badge: '新上线', badgeColor: '#38d68a', bannerColor: '#38d68a',
    members: [
      { short: 'MO', color: '#f06060', bg: 'rgba(240,96,96,0.18)', name: 'monitor-01' },
      { short: 'CI', color: '#38d68a', bg: 'rgba(56,214,138,0.18)', name: 'cicd-01' },
      { short: 'SC', color: '#30cbb8', bg: 'rgba(48,203,184,0.18)', name: 'scale-01' },
    ],
    tags: ['k8s', 'DevOps', '监控', 'CI/CD'],
    installed: false,
  },
  {
    id: 'm4', name: '内容营销团队', cat: 'creative', featured: false, icon: '✍️',
    author: 'contentclaw', stars: 734, installs: 421, rating: 4.6,
    desc: '内容策略 · SEO 写作 · 社交媒体 · 数据复盘。每周自动产出博客、推文和邮件营销内容。',
    badge: null, bannerColor: '#e870b0',
    members: [
      { short: 'ST', color: '#e870b0', bg: 'rgba(232,112,176,0.18)', name: 'strategy-01' },
      { short: 'WR', color: '#b08af5', bg: 'rgba(176,138,245,0.18)', name: 'writer-01' },
      { short: 'SE', color: '#f0a930', bg: 'rgba(240,169,48,0.18)', name: 'seo-01' },
    ],
    tags: ['内容', 'SEO', '营销', '社交媒体'],
    installed: false,
  },
  {
    id: 'm5', name: '法律尽调团队', cat: 'business', featured: false, icon: '⚖️',
    author: 'legalclaw_pro', stars: 612, installs: 234, rating: 4.5,
    desc: '合同审查 · 风险评估 · 合规检查。支持上传合同 PDF，自动标注风险条款并生成摘要报告。',
    badge: null, bannerColor: '#f07050',
    members: [
      { short: 'LW', color: '#f07050', bg: 'rgba(240,112,80,0.18)', name: 'lawyer-01' },
      { short: 'CM', color: '#30cbb8', bg: 'rgba(48,203,184,0.18)', name: 'compliance-01' },
    ],
    tags: ['法律', '合规', '合同', '风险'],
    installed: true,
  },
  {
    id: 'm6', name: '股票量化团队', cat: 'business', featured: false, icon: '📈',
    author: 'quantclaw', stars: 1891, installs: 677, rating: 4.4,
    desc: '行情数据采集 · 因子研究 · 策略回测 · 仓位管理。接入 Yahoo Finance 和 Tushare。',
    badge: '热门', badgeColor: '#f06060', bannerColor: '#38d68a',
    members: [
      { short: 'QT', color: '#38d68a', bg: 'rgba(56,214,138,0.18)', name: 'quant-01' },
      { short: 'RS', color: '#6c8ef5', bg: 'rgba(108,142,245,0.18)', name: 'research-01' },
      { short: 'RM', color: '#f06060', bg: 'rgba(240,96,96,0.18)', name: 'riskm-01' },
    ],
    tags: ['量化', '股票', '回测', '因子'],
    installed: false,
  },
  {
    id: 'm7', name: '教育辅导团队', cat: 'education', featured: false, icon: '📚',
    author: 'edu_ai', stars: 445, installs: 312, rating: 4.7,
    desc: '个性化学习路径 · 知识点讲解 · 习题生成 · 学习进度追踪。支持高中数学和编程课程。',
    badge: '新上线', badgeColor: '#38d68a', bannerColor: '#b08af5',
    members: [
      { short: 'TT', color: '#b08af5', bg: 'rgba(176,138,245,0.18)', name: 'tutor-01' },
      { short: 'QZ', color: '#6c8ef5', bg: 'rgba(108,142,245,0.18)', name: 'quiz-01' },
    ],
    tags: ['教育', '辅导', '学习', '数学'],
    installed: false,
  },
  {
    id: 'm8', name: '游戏开发团队', cat: 'creative', featured: false, icon: '🎮',
    author: 'gameclaw', stars: 889, installs: 503, rating: 4.6,
    desc: '游戏设计 · 关卡策划 · Unity 脚本 · 音效资产管理。从 GDD 到可玩 Demo 全流程自动化。',
    badge: null, bannerColor: '#f07050',
    members: [
      { short: 'GD', color: '#f07050', bg: 'rgba(240,112,80,0.18)', name: 'gamedesign-01' },
      { short: 'DV', color: '#6c8ef5', bg: 'rgba(108,142,245,0.18)', name: 'dev-01' },
      { short: 'ART', color: '#e870b0', bg: 'rgba(232,112,176,0.18)', name: 'artist-01' },
    ],
    tags: ['游戏', 'Unity', '设计', '创意'],
    installed: false,
  },
];
