/**
 * Cloudflare Worker - 动态 IP 白名单系统
 *
 * 功能：
 * - IP 注册与更新
 * - 自动清理过期 IP (默认 7 天)
 * - 同步到 Cloudflare List
 *
 * 认证由 Cloudflare Access 层处理
 */

// ============================================
// 配置 (通过环境变量覆盖)
// ============================================

const CONFIG = {
  // Cloudflare API 配置
  ACCOUNT_ID: '', // 从环境变量读取
  LIST_ID: '', // 从环境变量读取
  API_TOKEN: '', // 从环境变量读取

  // 过期配置
  EXPIRE_DAYS: 7, // IP 过期天数

  // KV 绑定名
  KV_NAMESPACE: 'IP_WHITELIST',

  // 允许的域名（空表示允许所有）
  ALLOWED_HOSTS: [], // 例如: ['iplist.your-domain.com']
};

// ============================================
// 主处理函数
// ============================================

export default {
  /**
   * 处理 HTTP 请求
   * @param {Request} request - 传入请求
   * @param {Env} env - 环境变量和绑定
   * @param {ExecutionContext} ctx - 执行上下文
   * @returns {Response}
   */
  async fetch(request, env, ctx) {
    // 从环境变量加载配置
    loadConfig(env);

    // 路由处理
    const url = new URL(request.url);

    // 域名白名单检查
    const allowedHosts = env.ALLOWED_HOSTS ? JSON.parse(env.ALLOWED_HOSTS) : CONFIG.ALLOWED_HOSTS;
    if (allowedHosts.length > 0 && !allowedHosts.includes(url.hostname)) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return corsResponse();
    }

    const path = url.pathname;

    if (path === '/debug' || path === '/list') {
      return handleDebug(request, env);
    }

    if (path === '/health') {
      return jsonResponse({ status: 'ok', timestamp: Date.now() });
    }

    // 默认处理 IP 注册
    if (request.method === 'POST') {
      return handleRegister(request, env, ctx);
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);
  },
};

// ============================================
// 请求处理器
// ============================================

/**
 * 处理 IP 注册请求
 */
async function handleRegister(request, env, ctx) {
  // 获取客户端 IP
  const clientIP = getClientIP(request);
  if (!clientIP) {
    return jsonResponse({ error: 'Cannot determine client IP' }, 400);
  }

  try {
    // 在后台执行更新（不阻塞响应）
    ctx.waitUntil(updateIPWhitelist(env, clientIP));

    return jsonResponse({
      success: true,
      ip: clientIP,
      message: 'IP registered successfully',
      expires_in: `${env.EXPIRE_DAYS || CONFIG.EXPIRE_DAYS} days`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return jsonResponse({
      error: 'Internal server error',
      message: error.message,
    }, 500);
  }
}

/**
 * 处理调试/列表请求
 */
async function handleDebug(_request, env) {
  try {
    const expireDays = parseInt(env.EXPIRE_DAYS || CONFIG.EXPIRE_DAYS);
    const expireTime = Date.now() - (expireDays * 24 * 60 * 60 * 1000);

    const allKeys = await env.IP_WHITELIST.list();
    const ipInfo = {};
    let validCount = 0;
    let expiredCount = 0;

    for (const key of allKeys.keys) {
      const timestamp = await env.IP_WHITELIST.get(key.name);
      const lastUpdate = parseInt(timestamp);
      const isExpired = lastUpdate <= expireTime;

      ipInfo[key.name] = {
        last_update: new Date(lastUpdate).toISOString(),
        expires: new Date(lastUpdate + expireDays * 24 * 60 * 60 * 1000).toISOString(),
        status: isExpired ? 'expired' : 'active',
      };

      if (isExpired) {
        expiredCount++;
      } else {
        validCount++;
      }
    }

    return jsonResponse({
      total: allKeys.keys.length,
      valid: validCount,
      expired: expiredCount,
      expire_days: expireDays,
      ips: ipInfo,
    });
  } catch (error) {
    return jsonResponse({
      error: 'Failed to retrieve IP list',
      message: error.message,
    }, 500);
  }
}

// ============================================
// 核心逻辑
// ============================================

/**
 * 更新 IP 白名单
 * - 注册/更新当前 IP
 * - 清理过期 IP
 * - 同步到 Cloudflare List
 */
async function updateIPWhitelist(env, clientIP) {
  const expireDays = parseInt(env.EXPIRE_DAYS || CONFIG.EXPIRE_DAYS);
  const expireTime = Date.now() - (expireDays * 24 * 60 * 60 * 1000);
  const now = Date.now();

  // 1. 更新当前 IP 的时间戳
  await env.IP_WHITELIST.put(clientIP, now.toString());

  // 2. 获取所有键并过滤过期 IP
  const allKeys = await env.IP_WHITELIST.list();
  const validIPs = new Set();  // 使用 Set 避免重复

  // 先添加当前 IP（确保当前 IP 一定会被包含）
  validIPs.add(clientIP);

  for (const key of allKeys.keys) {
    const timestamp = await env.IP_WHITELIST.get(key.name);
    if (timestamp) {
      const lastUpdate = parseInt(timestamp);
      if (lastUpdate > expireTime) {
        validIPs.add(key.name);
      } else {
        // 删除过期的 IP
        await env.IP_WHITELIST.delete(key.name);
      }
    }
  }

  // 3. 同步到 Cloudflare List
  await syncToCloudflareList(env, Array.from(validIPs));
}

/**
 * 同步 IP 列表到 Cloudflare
 */
async function syncToCloudflareList(env, IPs) {
  const accountId = env.ACCOUNT_ID || CONFIG.ACCOUNT_ID;
  const listId = env.LIST_ID || CONFIG.LIST_ID;
  const apiToken = env.API_TOKEN || CONFIG.API_TOKEN;

  // 验证必需的配置
  if (!accountId || !listId || !apiToken) {
    console.error(`Missing config: ACCOUNT_ID=${!!accountId}, LIST_ID=${!!listId}, API_TOKEN=${!!apiToken}`);
    throw new Error(`Missing config: ACCOUNT_ID=${!!accountId}, LIST_ID=${!!listId}, API_TOKEN=${!!apiToken}`);
  }

  // 如果没有有效 IP，不发送空数组（Cloudflare 不接受空 items）
  if (IPs.length === 0) {
    console.log('No valid IPs to sync, skipping API call');
    return;
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/gateway/lists/${listId}`;

  // 先获取当前 List 中的所有 IP
  const existingResponse = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiToken}`,
    },
  });

  if (!existingResponse.ok) {
    const error = await existingResponse.text();
    console.error(`Failed to get existing list: ${existingResponse.status} ${error}`);
    throw new Error(`Failed to get existing list: ${existingResponse.status} ${error}`);
  }

  const existingData = await existingResponse.json();
  const existingIPs = new Set(existingData.result?.items?.map(item => item.value) || []);

  // 找出需要添加的新 IP（不重复添加）
  const newIPs = IPs.filter(ip => !existingIPs.has(ip));

  if (newIPs.length === 0) {
    console.log('All IPs already exist in the list, skipping update');
    return;
  }

  // 使用 append 模式只添加新 IP
  const appendItems = newIPs.map(ip => ({ value: ip, description: 'Auto-added' }));
  const requestBody = {
    append: appendItems,
  };

  console.log(`Adding ${newIPs.length} new IPs to Cloudflare List: ${listId} (total: ${IPs.length})`);
  console.log(`New IPs: ${newIPs.join(', ')}`);
  console.log(`Request body: ${JSON.stringify(requestBody)}`);

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Cloudflare API error: ${response.status} ${error}`);
    throw new Error(`Cloudflare API error: ${response.status} ${error}`);
  }

  const result = await response.json();
  console.log(`Cloudflare API success: ${JSON.stringify(result)}`);
  return result;
}

// ============================================
// 工具函数
// ============================================

/**
 * 获取客户端真实 IP
 */
function getClientIP(request) {
  // 优先使用 CF-Connecting-IP (Cloudflare 提供的真实 IP)
  const cfIP = request.headers.get('CF-Connecting-IP');
  if (cfIP) return cfIP;

  // 备用: X-Forwarded-For
  const xff = request.headers.get('X-Forwarded-For');
  if (xff) return xff.split(',')[0].trim();

  // 最后备用: X-Real-IP
  const xri = request.headers.get('X-Real-IP');
  if (xri) return xri;

  return null;
}

/**
 * 从环境变量加载配置
 */
function loadConfig(env) {
  if (env.ACCOUNT_ID) CONFIG.ACCOUNT_ID = env.ACCOUNT_ID;
  if (env.LIST_ID) CONFIG.LIST_ID = env.LIST_ID;
  if (env.API_TOKEN) CONFIG.API_TOKEN = env.API_TOKEN;
  if (env.EXPIRE_DAYS) CONFIG.EXPIRE_DAYS = env.EXPIRE_DAYS;
  if (env.ALLOWED_HOSTS) CONFIG.ALLOWED_HOSTS = JSON.parse(env.ALLOWED_HOSTS);
}

/**
 * CORS 响应
 */
function corsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * JSON 响应
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
