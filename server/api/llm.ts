/**
 * LLM API 路由
 * /api/llm-config, /api/llm-chat
 * 
 * 配置存储在项目目录 .llm-config.json
 */

import { IncomingMessage, ServerResponse } from 'http';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { success, error, sendJson } from '../utils/response.js';
import { LLM_CONFIG_PATH } from '../utils/paths.js';

export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  modelName: string;
}

// 默认配置
let llmConfig: LLMConfig = {
  baseUrl: 'http://35.220.164.252:3888/v1',
  apiKey: '',
  modelName: 'qwen3.5-397b-a17b',
};

/**
 * 确保配置目录存在
 */
function ensureConfigDir(): void {
  const configDir = dirname(LLM_CONFIG_PATH);
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
}

/**
 * 加载 LLM 配置
 */
export function loadLLMConfig(_teamsDir?: string): LLMConfig {
  if (existsSync(LLM_CONFIG_PATH)) {
    try {
      const content = readFileSync(LLM_CONFIG_PATH, 'utf-8');
      llmConfig = { ...llmConfig, ...JSON.parse(content) };
    } catch (e) {
      console.warn('[LLM] Failed to load config, using defaults');
    }
  }
  return llmConfig;
}

/**
 * 保存 LLM 配置
 */
export function saveLLMConfig(config: Partial<LLMConfig>): LLMConfig {
  ensureConfigDir();
  llmConfig = { ...llmConfig, ...config };
  writeFileSync(LLM_CONFIG_PATH, JSON.stringify(llmConfig, null, 2), 'utf-8');
  return llmConfig;
}

/**
 * 获取当前配置（给其他模块用）
 */
export function getLLMConfig(): LLMConfig {
  return { ...llmConfig };
}

/**
 * 处理 LLM 相关 API 请求
 */
export async function handleLLMRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  _teamsDir: string
): Promise<boolean> {
  const url = req.url || '/';
  const method = req.method || 'GET';

  // GET /api/llm-config - 获取配置
  if (url === '/api/llm-config' && method === 'GET') {
    await handleGetLLMConfig(req, res);
    return true;
  }

  // POST /api/llm-config - 更新配置
  if (url === '/api/llm-config' && method === 'POST') {
    await handleSetLLMConfig(req, res);
    return true;
  }

  // POST /api/llm-chat - 发送消息
  if (url === '/api/llm-chat' && method === 'POST') {
    await handleLLMChat(req, res);
    return true;
  }

  return false;
}

/**
 * GET /api/llm-config
 */
async function handleGetLLMConfig(
  _req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const config = loadLLMConfig();
    // 掩码 API Key
    const maskedConfig = {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey ? `${config.apiKey.slice(0, 8)}...${config.apiKey.slice(-4)}` : '',
      modelName: config.modelName,
      hasApiKey: !!config.apiKey,
    };
    sendJson(res, 200, success(maskedConfig));
  } catch (err) {
    console.error('[API] Failed to get LLM config:', err);
    sendJson(res, 500, error(String(err)));
  }
}

/**
 * POST /api/llm-config
 */
async function handleSetLLMConfig(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const body = await readBody(req);
    const config = JSON.parse(body) as Partial<LLMConfig>;
    
    // 如果 apiKey 被掩码，保留原值
    if (!config.apiKey || config.apiKey.includes('...')) {
      const existing = loadLLMConfig();
      config.apiKey = existing.apiKey;
    }
    
    const updated = saveLLMConfig(config);
    console.log(`[API] Updated LLM config: ${updated.baseUrl}, model=${updated.modelName}`);
    
    sendJson(res, 200, success({
      baseUrl: updated.baseUrl,
      modelName: updated.modelName,
      hasApiKey: !!updated.apiKey,
    }));
  } catch (err) {
    console.error('[API] Failed to set LLM config:', err);
    sendJson(res, 500, error(String(err)));
  }
}

/**
 * POST /api/llm-chat
 */
async function handleLLMChat(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const body = await readBody(req);
    const { messages, agent } = JSON.parse(body);
    
    const config = loadLLMConfig();
    
    if (!config.apiKey) {
      sendJson(res, 400, error('LLM API key not configured'));
      return;
    }

    console.log(`[LLM] Sending request to ${config.modelName}`);

    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LLM] API error:', errorText);
      sendJson(res, response.status, error(`LLM API error: ${response.status}`));
      return;
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log(`[LLM] Response received, ${content.length} chars`);
    
    sendJson(res, 200, success({
      content,
      model: config.modelName,
      usage: data.usage,
    }));
  } catch (err) {
    console.error('[API] Failed to call LLM:', err);
    sendJson(res, 500, error(String(err)));
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}
