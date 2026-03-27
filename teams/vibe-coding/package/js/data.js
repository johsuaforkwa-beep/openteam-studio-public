/**
 * Vibe Coding Dashboard - Data
 * 数据定义
 * 
 * 注意：这里是初始空状态，真实数据从 API 加载
 */

// Agent 列表（来自 manifest.json 的 team 成员定义）
// - muted: 禁言 - 不能发送消息到群聊
// - offline: 离线 - 不收听群聊消息，也不能发送
const AGENTS = [
  { id: 'pm-01',       role: 'PM',       color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', short: 'P1', muted: false, offline: false },
  { id: 'dev-01',      role: 'Dev',      color: '#5b8df5', bg: 'rgba(91,141,245,0.15)',  short: 'D1', muted: false, offline: false },
  { id: 'dev-02',      role: 'Dev',      color: '#3ecf8e', bg: 'rgba(62,207,142,0.15)',  short: 'D2', muted: false, offline: false },
  { id: 'dev-03',      role: 'Dev',      color: '#2dd4bf', bg: 'rgba(45,212,191,0.15)',  short: 'D3', muted: false, offline: false },
  { id: 'reviewer-01', role: 'Reviewer', color: '#f5a623', bg: 'rgba(245,166,35,0.15)', short: 'R1', muted: false, offline: false },
  { id: 'qa-01',       role: 'QA',       color: '#fb923c', bg: 'rgba(251,146,60,0.15)', short: 'Q1', muted: false, offline: false },
];

// 私聊消息存储 (agentId -> 消息数组)
const PRIVATE_CHATS = {};

// 获取当前 team 的成员 ID 列表
function getTeamMemberIds() {
  return AGENTS.map(a => a.id);
}

// 项目数据（初始为空，从 API 加载）
const PROJECTS = {
  alpha: {
    name: 'project-alpha',
    tasks: [],      // 从 PROJECT.md 解析
    files: [],      // 从 API 加载
    agentStates: {} // 运行时状态
  }
};

// 文件内容缓存（从 API 加载）
const FILE_CONTENTS = {};

// 聊天消息（运行时生成）
const MESSAGES = [];

// 思考记录（运行时生成）
const THINKING = {};

// 初始化 agentStates
AGENTS.forEach(ag => {
  PROJECTS.alpha.agentStates[ag.id] = { status: 'idle', task: '等待任务...' };
});
