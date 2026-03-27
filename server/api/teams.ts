/**
 * Team API 路由
 * GET/POST/PUT/DELETE /api/teams
 * 
 * Team 实例存储在项目目录 teams/
 * Team 只引用 agent IDs，不定义 agent 细节（agent 定义在 ~/.openclaw/agents/）
 */

import { IncomingMessage, ServerResponse } from 'http';
import { existsSync, mkdirSync, writeFileSync, readdirSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { success, error, sendJson } from '../utils/response.js';
import { validateTeamId } from '../utils/validation.js';
import { TEAMS_DIR, AGENTS_DIR } from '../utils/paths.js';
import type { TeamManifest } from '../../core/types/index.js';

export interface TeamCreateRequest {
  id: string;
  name: string;
  type: 'dev' | 'research' | 'business' | 'creative' | 'ops';
  icon: string;
  description: string;
  members: string[];  // agent IDs（引用 ~/.openclaw/agents/ 下的 agent）
  template?: string;  // 来源模板 ID（可选）
}

/**
 * Team 更新请求 - 支持更新 manifest 的任意字段
 */
export interface TeamUpdateRequest {
  name?: string;
  type?: 'dev' | 'research' | 'business' | 'creative' | 'ops';
  icon?: string;
  description?: string;
  members?: string[];
  template?: string;
  manifest?: Partial<TeamManifest>;  // 直接更新 manifest 的任意字段
}

/**
 * 确保目录存在
 */
function ensureDirs(): void {
  if (!existsSync(TEAMS_DIR)) {
    mkdirSync(TEAMS_DIR, { recursive: true });
  }
}

/**
 * 处理 Team 相关 API 请求
 */
export async function handleTeamRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  _teamsDir: string  // 不再使用
): Promise<boolean> {
  const url = req.url || '/';
  const method = req.method || 'GET';

  // GET /api/teams - 列出所有 Team
  if (url === '/api/teams' && method === 'GET') {
    await handleListTeams(req, res);
    return true;
  }

  // POST /api/teams - 创建 Team
  if (url === '/api/teams' && method === 'POST') {
    await handleCreateTeam(req, res);
    return true;
  }

  // Projects API: GET/POST /api/teams/:teamId/projects
  const projectsMatch = url.match(/^\/api\/teams\/([^\/]+)\/projects$/);
  if (projectsMatch) {
    const teamId = projectsMatch[1];
    if (method === 'GET') {
      await handleListProjects(req, res, teamId);
      return true;
    }
    if (method === 'POST') {
      await handleCreateProject(req, res, teamId);
      return true;
    }
  }

  // DELETE /api/teams/:teamId/projects/:projectId - 删除项目
  const projectDeleteMatch = url.match(/^\/api\/teams\/([^\/]+)\/projects\/([^\/]+)$/);
  if (projectDeleteMatch && method === 'DELETE') {
    const [, teamId, projectId] = projectDeleteMatch;
    await handleDeleteProject(req, res, teamId, projectId);
    return true;
  }

  // Status API: GET /api/teams/:teamId/status
  const statusMatch = url.match(/^\/api\/teams\/([^\/]+)\/status$/);
  if (statusMatch && method === 'GET') {
    const teamId = statusMatch[1];
    await handleGetTeamStatus(req, res, teamId);
    return true;
  }

  // Team 单资源操作
  const teamMatch = url.match(/^\/api\/teams\/([^\/]+)$/);
  if (teamMatch) {
    const teamId = teamMatch[1];
    
    if (method === 'DELETE') {
      await handleDeleteTeam(req, res, teamId);
      return true;
    }
    if (method === 'PUT') {
      await handleUpdateTeam(req, res, teamId);
      return true;
    }
    if (method === 'GET') {
      await handleGetTeam(req, res, teamId);
      return true;
    }
  }

  return false;
}

/**
 * GET /api/teams - 列出所有 Team
 */
async function handleListTeams(
  _req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    ensureDirs();

    const teams: any[] = [];
    
    const teamDirs = readdirSync(TEAMS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const teamId of teamDirs) {
      // 优先查找 package/manifest.json，然后是根目录
      let manifestPath = join(TEAMS_DIR, teamId, 'package', 'manifest.json');
      if (!existsSync(manifestPath)) {
        manifestPath = join(TEAMS_DIR, teamId, 'manifest.json');
      }
      
      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        teams.push({
          id: teamId,
          name: manifest.name || teamId,
          type: manifest.type || 'dev',
          icon: manifest.icon || '⬡',
          description: manifest.description || '',
          members: manifest.agents || [],
          template: manifest.template,
          manifest,
          path: join(TEAMS_DIR, teamId),
        });
      }
    }

    sendJson(res, 200, success(teams));
  } catch (err) {
    console.error('[API] Failed to list teams:', err);
    sendJson(res, 500, error(String(err)));
  }
}

/**
 * GET /api/teams/:id - 获取单个 Team
 */
async function handleGetTeam(
  _req: IncomingMessage,
  res: ServerResponse,
  teamId: string
): Promise<void> {
  try {
    ensureDirs();

    const teamDir = join(TEAMS_DIR, teamId);
    
    // 优先查找 package/manifest.json，然后是根目录
    let manifestPath = join(teamDir, 'package', 'manifest.json');
    if (!existsSync(manifestPath)) {
      manifestPath = join(teamDir, 'manifest.json');
    }

    if (!existsSync(manifestPath)) {
      sendJson(res, 404, error('Team not found'));
      return;
    }

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

    sendJson(res, 200, success({
      id: teamId,
      name: manifest.name || teamId,
      type: manifest.type || 'dev',
      icon: manifest.icon || '⬡',
      description: manifest.description || '',
      members: manifest.agents || [],
      template: manifest.template,
      manifest,
      path: teamDir,
    }));
  } catch (err) {
    console.error('[API] Failed to get team:', err);
    sendJson(res, 500, error(String(err)));
  }
}

/**
 * POST /api/teams - 创建 Team
 * 
 * Team 只引用 agent IDs，不创建 SOUL.md
 * agent 定义在 ~/.openclaw/agents/ 下
 */
async function handleCreateTeam(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    ensureDirs();

    const body = await readBody(req);
    const teamRequest = JSON.parse(body) as TeamCreateRequest;

    const validationError = validateTeamId(teamRequest.id);
    if (validationError) {
      sendJson(res, 400, error(validationError));
      return;
    }

    if (!teamRequest.name) {
      sendJson(res, 400, error('Team name is required'));
      return;
    }

    // 验证所有 agent 都存在
    for (const agentId of teamRequest.members) {
      const agentDir = join(AGENTS_DIR, agentId);
      if (!existsSync(agentDir)) {
        sendJson(res, 400, error(`Agent not found: ${agentId}`));
        return;
      }
    }

    // 创建 Team 目录
    const teamDir = join(TEAMS_DIR, teamRequest.id);
    mkdirSync(teamDir, { recursive: true });
    mkdirSync(join(teamDir, 'projects'), { recursive: true });

    // 生成 manifest.json
    const manifest = generateTeamManifest(teamRequest);
    writeFileSync(join(teamDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

    console.log(`[API] Created team: ${teamRequest.name} (${teamRequest.id})`);
    console.log(`[API] Team members: ${teamRequest.members.join(', ')}`);
    
    sendJson(res, 201, success({
      id: teamRequest.id,
      name: teamRequest.name,
      path: teamDir,
      members: teamRequest.members,
    }));
  } catch (err) {
    console.error('[API] Failed to create team:', err);
    sendJson(res, 500, error(String(err)));
  }
}

/**
 * DELETE /api/teams/:id - 删除 Team
 */
async function handleDeleteTeam(
  _req: IncomingMessage,
  res: ServerResponse,
  teamId: string
): Promise<void> {
  try {
    ensureDirs();

    const teamDir = join(TEAMS_DIR, teamId);
    if (existsSync(teamDir)) {
      rmSync(teamDir, { recursive: true });
      console.log(`[API] Deleted team: ${teamId}`);
    }
    sendJson(res, 200, success({ id: teamId }));
  } catch (err) {
    console.error('[API] Failed to delete team:', err);
    sendJson(res, 500, error(String(err)));
  }
}

/**
 * PUT /api/teams/:id - 更新 Team
 * 支持更新 manifest 的任意字段
 */
async function handleUpdateTeam(
  req: IncomingMessage,
  res: ServerResponse,
  teamId: string
): Promise<void> {
  try {
    ensureDirs();

    const teamDir = join(TEAMS_DIR, teamId);
    // 优先查找 package/manifest.json
    let manifestPath = join(teamDir, 'package', 'manifest.json');
    if (!existsSync(manifestPath)) {
      manifestPath = join(teamDir, 'manifest.json');
    }

    if (!existsSync(manifestPath)) {
      sendJson(res, 404, error('Team not found'));
      return;
    }

    const body = await readBody(req);
    const teamRequest = JSON.parse(body) as TeamUpdateRequest;

    // 验证新成员是否存在
    if (teamRequest.members) {
      for (const agentId of teamRequest.members) {
        const agentDir = join(AGENTS_DIR, agentId);
        if (!existsSync(agentDir)) {
          sendJson(res, 400, error(`Agent not found: ${agentId}`));
          return;
        }
      }
    }

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as TeamManifest;

    // 更新顶级字段
    if (teamRequest.name) manifest.name = teamRequest.name;
    if (teamRequest.type) manifest.type = teamRequest.type;
    if (teamRequest.icon) manifest.icon = teamRequest.icon;
    if (teamRequest.description) manifest.description = teamRequest.description;
    if (teamRequest.template) manifest.template = teamRequest.template;
    
    // 更新成员列表（只引用，不创建文件）
    if (teamRequest.members) {
      manifest.agents = teamRequest.members;
    }

    // 直接更新 manifest 的任意字段（如 communication, workflow 等）
    if (teamRequest.manifest) {
      for (const [key, value] of Object.entries(teamRequest.manifest)) {
        (manifest as any)[key] = value;
      }
    }

    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`[API] Updated team: ${teamId}`);

    sendJson(res, 200, success({
      id: teamId,
      name: manifest.name,
      members: manifest.agents,
      manifest,
    }));
  } catch (err) {
    console.error('[API] Failed to update team:', err);
    sendJson(res, 500, error(String(err)));
  }
}

/**
 * 生成 Team manifest
 * 
 * 只包含 agent IDs，不定义 agent 细节
 */
function generateTeamManifest(team: TeamCreateRequest): TeamManifest {
  return {
    id: team.id,
    name: team.name,
    type: team.type,
    icon: team.icon,
    description: team.description,
    template: team.template,
    
    // 只引用 agent IDs
    agents: team.members,
    
    workflow: {
      entry: team.members[0] || 'unknown',
      phases: [
        { name: '分析', agent: team.members[0], output: 'PROJECT.md', tag: '#TODO' },
        { name: '开发', agents: team.members.slice(1), output: 'debug_{agent}.md', parallel: true },
        { name: '完成', agent: team.members[0], action: 'mark-done' },
      ],
      transitions: [
        { from: team.members[0], to: team.members.slice(1), trigger: 'mention' },
      ],
    },
    
    config: {
      defaultModel: 'claude-sonnet-4-6',
      tools: { dev: ['shell', 'files', 'github'] },
      filePatterns: { project: 'PROJECT.md', debug: 'debug_{agent}.md' },
    },
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

/**
 * GET /api/teams/:teamId/projects - 列出 Team 的所有项目
 */
async function handleListProjects(
  _req: IncomingMessage,
  res: ServerResponse,
  teamId: string
): Promise<void> {
  try {
    ensureDirs();

    const teamDir = join(TEAMS_DIR, teamId);
    const projectsDir = join(teamDir, 'projects');

    if (!existsSync(projectsDir)) {
      mkdirSync(projectsDir, { recursive: true });
      sendJson(res, 200, success([]));
      return;
    }

    const projects: any[] = [];
    const projectDirs = readdirSync(projectsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const projectId of projectDirs) {
      projects.push({
        id: projectId,
        name: projectId,
        teamId,
        path: join(projectsDir, projectId),
        createdAt: new Date().toISOString(),
      });
    }

    sendJson(res, 200, success(projects));
  } catch (err) {
    console.error('[API] Failed to list projects:', err);
    sendJson(res, 500, error(String(err)));
  }
}

/**
 * POST /api/teams/:teamId/projects - 创建项目
 * 项目 ID 基于名称生成（slugify），便于识别和管理
 */
async function handleCreateProject(
  req: IncomingMessage,
  res: ServerResponse,
  teamId: string
): Promise<void> {
  try {
    ensureDirs();

    const teamDir = join(TEAMS_DIR, teamId);
    if (!existsSync(teamDir)) {
      sendJson(res, 404, error('Team not found'));
      return;
    }

    const body = await readBody(req);
    const { name } = JSON.parse(body);

    if (!name) {
      sendJson(res, 400, error('Project name is required'));
      return;
    }

    // 基于名称生成项目 ID（slugify）
    // 移除特殊字符，转小写，空格转连字符
    const baseId = name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')     // 移除非单词字符
      .replace(/\s+/g, '-')          // 空格转连字符
      .replace(/-+/g, '-')           // 多个连字符合并
      .replace(/^-|-$/g, '');        // 移除首尾连字符

    // 确保 ID 唯一（如果已存在则添加后缀）
    let projectId = baseId || `project-${Date.now()}`;
    const projectsDir = join(teamDir, 'projects');
    
    if (!existsSync(projectsDir)) {
      mkdirSync(projectsDir, { recursive: true });
    }

    // 如果项目 ID 已存在，添加时间戳后缀
    if (existsSync(join(projectsDir, projectId))) {
      projectId = `${projectId}-${Date.now()}`;
    }

    const projectPath = join(projectsDir, projectId);

    mkdirSync(projectPath, { recursive: true });

    // 创建初始 PROJECT.md
    const projectMd = `# PROJECT.md — ${name}

## 进行中 #ACTIVE

（暂无任务）

## 待开始 #TODO

（暂无任务）

## 已完成 #DONE

（暂无任务）
`;
    writeFileSync(join(projectPath, 'PROJECT.md'), projectMd, 'utf-8');

    console.log(`[API] Created project: ${name} (${projectId}) in team ${teamId}`);

    sendJson(res, 201, success({
      id: projectId,
      name,
      teamId,
      path: projectPath,
      createdAt: new Date().toISOString(),
    }));
  } catch (err) {
    console.error('[API] Failed to create project:', err);
    sendJson(res, 500, error(String(err)));
  }
}

/**
 * DELETE /api/teams/:teamId/projects/:projectId - 删除项目
 */
async function handleDeleteProject(
  _req: IncomingMessage,
  res: ServerResponse,
  teamId: string,
  projectId: string
): Promise<void> {
  try {
    ensureDirs();

    const teamDir = join(TEAMS_DIR, teamId);
    const projectPath = join(teamDir, 'projects', projectId);

    if (!existsSync(projectPath)) {
      sendJson(res, 404, error('Project not found'));
      return;
    }

    rmSync(projectPath, { recursive: true });
    console.log(`[API] Deleted project: ${projectId} in team ${teamId}`);

    sendJson(res, 200, success({ id: projectId, teamId }));
  } catch (err) {
    console.error('[API] Failed to delete project:', err);
    sendJson(res, 500, error(String(err)));
  }
}

/**
 * GET /api/teams/:teamId/status - 获取 Team Agent 状态
 * 返回模拟状态，供前端轮询使用
 */
async function handleGetTeamStatus(
  _req: IncomingMessage,
  res: ServerResponse,
  teamId: string
): Promise<void> {
  try {
    ensureDirs();

    const teamDir = join(TEAMS_DIR, teamId);
    const manifestPath = join(teamDir, 'manifest.json');

    if (!existsSync(manifestPath)) {
      // Team 不存在，返回默认 vibe-coding 模板 agents
      const defaultAgents = [
        { id: 'pm-01', status: 'idle', task: '等待任务分配' },
        { id: 'dev-01', status: 'idle', task: '等待任务分配' },
        { id: 'dev-02', status: 'idle', task: '等待任务分配' },
        { id: 'dev-03', status: 'idle', task: '等待任务分配' },
        { id: 'reviewer-01', status: 'idle', task: '等待任务分配' },
        { id: 'qa-01', status: 'idle', task: '等待任务分配' },
      ];
      sendJson(res, 200, success({ agents: defaultAgents }));
      return;
    }

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    const agentIds = manifest.agents || [];

    // 返回所有 agent 的状态（模拟，实际应用中应该从状态管理器获取）
    const agents = agentIds.map((id: string) => ({
      id,
      status: 'idle',
      task: '等待任务分配',
    }));

    sendJson(res, 200, success({ agents }));
  } catch (err) {
    console.error('[API] Failed to get team status:', err);
    sendJson(res, 500, error(String(err)));
  }
}
