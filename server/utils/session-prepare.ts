/**
 * Agent Session 准备逻辑
 * 为 Agent 准备 Team Skill（通过 symlink）
 */

import { mkdir, rm, symlink, access } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * 为 Agent 准备 Team Skill
 * 
 * 流程：
 * 1. 清理旧的 skills 目录
 * 2. 创建新的 skills 目录
 * 3. 创建 symlink 指向 Team 的 skills 目录
 * 
 * @param agentId Agent ID
 * @param teamId Team ID
 * @param teamsDir Teams 目录路径（项目根目录/teams）
 */
export async function prepareAgentForTeam(
  agentId: string,
  teamId: string,
  teamsDir: string
): Promise<{ ok: boolean; error?: string; path?: string }> {
  try {
    // OpenClaw agent workspace 目录
    const openclawDir = join(homedir(), '.openclaw');
    const agentSkillsDir = join(openclawDir, 'agents', agentId, 'skills');
    
    // Team skills 目录
    const teamSkillsDir = join(teamsDir, teamId, 'package', 'skills');
    
    // 检查 Team skills 目录是否存在
    if (!existsSync(teamSkillsDir)) {
      console.warn(`[Session Prepare] Team skills dir not found: ${teamSkillsDir}`);
      // 创建空的 skills 目录（避免错误）
      await mkdir(teamSkillsDir, { recursive: true });
    }

    // 清理旧的 skills 目录
    if (existsSync(agentSkillsDir)) {
      await rm(agentSkillsDir, { recursive: true, force: true });
    }

    // 创建 agent skills 目录的父目录
    const agentSkillsParent = join(openclawDir, 'agents', agentId);
    if (!existsSync(agentSkillsParent)) {
      await mkdir(agentSkillsParent, { recursive: true });
    }

    // 创建 skills 目录
    await mkdir(agentSkillsDir, { recursive: true });

    // 创建 symlink
    const symlinkPath = join(agentSkillsDir, teamId);
    await symlink(teamSkillsDir, symlinkPath, 'junction');
    
    console.log(`[Session Prepare] Created symlink: ${symlinkPath} → ${teamSkillsDir}`);
    
    return {
      ok: true,
      path: symlinkPath
    };
  } catch (error) {
    console.error('[Session Prepare] Error:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 切换 Agent 的 Team
 * 更新 symlink 指向新的 Team
 * 
 * @param agentId Agent ID
 * @param oldTeamId 旧 Team ID（可选）
 * @param newTeamId 新 Team ID
 * @param teamsDir Teams 目录路径
 */
export async function switchAgentTeam(
  agentId: string,
  newTeamId: string,
  teamsDir: string,
  oldTeamId?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const openclawDir = join(homedir(), '.openclaw');
    const agentSkillsDir = join(openclawDir, 'agents', agentId, 'skills');
    
    // 如果指定了旧 Team，删除旧 symlink
    if (oldTeamId) {
      const oldSymlink = join(agentSkillsDir, oldTeamId);
      if (existsSync(oldSymlink)) {
        await rm(oldSymlink, { force: true });
      }
    }
    
    // 创建新的 symlink
    const teamSkillsDir = join(teamsDir, newTeamId, 'package', 'skills');
    const newSymlink = join(agentSkillsDir, newTeamId);
    
    // 确保 Team skills 目录存在
    if (!existsSync(teamSkillsDir)) {
      await mkdir(teamSkillsDir, { recursive: true });
    }
    
    // 确保 agent skills 目录存在
    if (!existsSync(agentSkillsDir)) {
      await mkdir(agentSkillsDir, { recursive: true });
    }
    
    // 创建 symlink
    await symlink(teamSkillsDir, newSymlink, 'junction');
    
    console.log(`[Session Prepare] Switched team: ${oldTeamId || 'none'} → ${newTeamId}`);
    
    return { ok: true };
  } catch (error) {
    console.error('[Session Prepare] Switch error:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
