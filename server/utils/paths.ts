/**
 * OpenTeam Studio - Path Configuration
 * 路径配置中心
 * 
 * 所有数据都在项目目录下，方便开发调试
 */

import { join } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

// 项目根目录
export const PROJECT_ROOT = fileURLToPath(new URL('../..', import.meta.url));

// 项目内的数据目录
export const TEAMS_DIR = join(PROJECT_ROOT, 'teams');

// OpenClaw agents 目录（保持不变，agents 是 OpenClaw 管理的）
export const OPENCLAW_DIR = join(homedir(), '.openclaw');
export const AGENTS_DIR = join(OPENCLAW_DIR, 'agents');

// LLM 配置文件路径（放在项目根目录）
export const LLM_CONFIG_PATH = join(PROJECT_ROOT, '.llm-config.json');
