# API 文档

Cloudflare Worker 动态 IP 白名单系统 API 接口文档。

---

## 基础信息

| 项目 | 值 |
|------|-----|
| Base URL | `https://your-worker.workers.dev` |
| 认证方式 | Cloudflare Access Service Token |
| Content-Type | `application/json` |

---

## 请求头

所有请求必须包含 Cloudflare Access 头：

```
CF-Access-Client-Id: YOUR_CLIENT_ID
CF-Access-Client-Secret: YOUR_SERVICE_TOKEN
```

---

## 端点列表

### 1. 注册/更新 IP

**更新当前客户端 IP 到白名单**

```
POST /
```

**请求头：**

| Header | 类型 | 必需 | 说明 |
|--------|------|------|------|
| CF-Access-Client-Id | string | ✅ | Access Client ID |
| CF-Access-Client-Secret | string | ✅ | Access Service Token |

**请求体：** 无需

**响应示例：**

```json
{
  "success": true,
  "ip": "1.2.3.4",
  "message": "IP registered successfully",
  "expires_in": "7 days",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**错误响应：**

```json
{
  "error": "Unauthorized"
}
```

**状态码：**

| Code | 说明 |
|------|------|
| 200 | 成功 |
| 401 | Token 无效 |
| 400 | 无法获取 IP |
| 405 | 方法不允许 |
| 500 | 服务器错误 |

---

### 2. 查看 IP 列表（调试）

**获取当前所有已注册的 IP 及其状态**

```
GET /debug
GET /list
```

**请求头：**

| Header | 类型 | 必需 | 说明 |
|--------|------|------|------|
| CF-Access-Client-Id | string | ✅ | Access Client ID |
| CF-Access-Client-Secret | string | ✅ | Access Service Token |

**响应示例：**

```json
{
  "total": 3,
  "valid": 2,
  "expired": 1,
  "expire_days": 7,
  "ips": {
    "1.2.3.4": {
      "last_update": "2024-01-15T10:00:00.000Z",
      "expires": "2024-01-22T10:00:00.000Z",
      "status": "active"
    },
    "5.6.7.8": {
      "last_update": "2024-01-10T08:00:00.000Z",
      "expires": "2024-01-17T08:00:00.000Z",
      "status": "expired"
    }
  }
}
```

**字段说明：**

| 字段 | 说明 |
|------|------|
| total | 总 IP 数 |
| valid | 有效 IP 数 |
| expired | 过期 IP 数 |
| expire_days | 过期天数配置 |
| ips | IP 详情对象 |
| ips.*.last_update | 最后更新时间 |
| ips.*.expires | 过期时间 |
| ips.*.status | 状态: `active` 或 `expired` |

---

### 3. 健康检查

**检查 Worker 运行状态**

```
GET /health
```

**无需认证**

**响应示例：**

```json
{
  "status": "ok",
  "timestamp": 1705317000000
}
```

---

## cURL 示例

### 注册 IP

```bash
curl -X POST https://your-worker.workers.dev \
  -H "CF-Access-Client-Id: YOUR_CLIENT_ID" \
  -H "CF-Access-Client-Secret: YOUR_SERVICE_TOKEN"
```

### 查看列表

```bash
curl https://your-worker.workers.dev/debug \
  -H "CF-Access-Client-Id: YOUR_CLIENT_ID" \
  -H "CF-Access-Client-Secret: YOUR_SERVICE_TOKEN"
```

### 健康检查

```bash
curl -H "CF-Access-Client-Id: YOUR_CLIENT_ID" \
     -H "CF-Access-Client-Secret: YOUR_SERVICE_TOKEN" \
     https://your-worker.workers.dev/health
```

---

## 错误码

| HTTP Code | 错误类型 | 说明 |
|-----------|---------|------|
| 401 | Unauthorized | Token 缺失或无效 |
| 400 | Bad Request | 无法获取客户端 IP |
| 405 | Method Not Allowed | 使用了不支持的 HTTP 方法 |
| 500 | Internal Server Error | 服务器内部错误 |

---

## IP 获取逻辑

Worker 按以下优先级获取客户端 IP：

1. `CF-Connecting-IP` - Cloudflare 提供的真实 IP
2. `X-Forwarded-For` - 第一个 IP
3. `X-Real-IP` - 直接 IP

---

## 过期机制

1. 每次更新 IP 时，都会记录当前时间戳
2. 同时清理超过 `EXPIRE_DAYS` 天未更新的 IP
3. 过期时间基于最后更新时间计算，而非首次注册时间

**示例：**

| 时间 | 事件 |
|------|------|
| Day 0 | 首次注册 IP 1.2.3.4 |
| Day 5 | 更新 IP 1.2.3.4，过期时间延长至 Day 12 |
| Day 13 | IP 已过期，被清理 |

---

## 安全建议

1. **始终使用 HTTPS** - Worker 自动支持
2. **保护 Service Token** - 不要在日志中打印
3. **定期轮换 Token** - 建议每 90 天更换
4. **限制 API Token 权限** - 只授予 Gateway List 编辑权限
5. **使用 Cloudflare Access** - 在边缘进行认证，未授权请求无法到达 Worker
