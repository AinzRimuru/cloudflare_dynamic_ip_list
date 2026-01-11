# 部署指南

本文档详细说明如何部署 Cloudflare Worker 动态 IP 白名单系统。

## 前置准备

1. Cloudflare 账号（免费版即可）
2. Node.js 18+ 和 npm
3. 一个已配置 Cloudflare Tunnel 的域名

---

## 步骤 1: 安装 Wrangler CLI

```bash
npm install -g wrangler
```

验证安装：

```bash
wrangler --version
```

---

## 步骤 2: 登录 Cloudflare

```bash
wrangler login
```

浏览器会打开 Cloudflare 授权页面，点击授权。

---

## 步骤 3: 创建 KV Namespace

```bash
wrangler kv:namespace create "IP_WHITELIST"
```

输出示例：

```
🌀 Creating namespace with title "iplist-worker-IP_WHITELIST"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "IP_WHITELIST", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
```

**记录返回的 `id`**，下一步会用到。

同时创建 preview namespace（可选）：

```bash
wrangler kv:namespace create "IP_WHITELIST" --preview
```

---

## 步骤 4: 创建 IP List

### 方式 A: 使用脚本

```bash
cd scripts
chmod +x create_list.sh
./create_list.sh
```

### 方式 B: 手动创建

1. 访问 Cloudflare Zero Trust 控制台
2. 进入 `Settings > Lists`
3. 点击 `Create list`
4. 配置如下：

   | 字段 | 值 |
   |------|-----|
   | Name | Dynamic IP Whitelist |
   | Type | IP |

5. 创建后，记录 URL 中的 List ID

### 方式 C: 使用 API

```bash
# 替换 YOUR_ACCOUNT_ID 和 YOUR_API_TOKEN
curl -X POST "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/gateway/lists" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dynamic IP Whitelist",
    "type": "ip"
  }'
```

**记录返回的 `result.id`**

---

## 步骤 5: 创建 Cloudflare Access Service Token

1. 进入 Cloudflare Dashboard → **Zero Trust**
2. 左侧菜单 → **Access** → **Service Auth**
3. 点击 **Create Service Token**
4. 填写信息：
   - **Name**: `IPList-Worker-Client`
   - **Duration**: 选择有效期
5. 保存后记录 **Service Token** 和 **Client ID**

---

## 步骤 6: 配置 Access Application

1. 进入 **Access** → **Applications**
2. 点击 **Add an application**
3. 填写配置：
   - **Name**: `IP List Worker`
   - **Session Duration**: 按需设置
4. 在 **Settings** 中：
   - **Path**: 你的 Worker URL
   - **Type**: 选择 **Self-Hosted** 或 **Public**
5. 在 **Policies** 中添加规则：
   - **Policy name**: `Service Token Only`
   - **Include**: 选择 **Service Token** → 选择你创建的 Token
   - **Action**: **Allow**
6. 保存发布

---

## 步骤 7: 配置 Wrangler

编辑 `config/wrangler.toml`：

```toml
name = "iplist-worker"
main = "src/worker.js"
compatibility_date = "2024-01-01"

[vars]
ACCOUNT_ID = "你的Account_ID"
LIST_ID = "你的List_ID"
EXPIRE_DAYS = "7"

[[kv_namespaces]]
binding = "IP_WHITELIST"
id = "步骤3中的KV_ID"
```

---

## 步骤 8: 设置 Secrets

```bash
# 设置 API Token
wrangler secret put API_TOKEN
# 粘贴你的Cloudflare API Token
```

---

## 步骤 9: 部署 Worker

```bash
# 在项目根目录
wrangler deploy
```

成功输出：

```
✨ Successfully published your Worker to
  https://iplist-worker.YOUR_SUBDOMAIN.workers.dev
```

---

## 步骤 10: 验证部署

```bash
# 测试健康检查
curl -H "CF-Access-Client-Id: <Client_ID>" \
     -H "CF-Access-Client-Secret: <Service_Token>" \
     https://iplist-worker.YOUR_SUBDOMAIN.workers.dev/health

# 测试 IP 注册
curl -X POST https://iplist-worker.YOUR_SUBDOMAIN.workers.dev \
  -H "CF-Access-Client-Id: <Client_ID>" \
  -H "CF-Access-Client-Secret: <Service_Token>"
```

预期返回：

```json
{
  "success": true,
  "ip": "xxx.xxx.xxx.xxx",
  "message": "IP registered successfully"
}
```

---

## 步骤 11: 配置 Access Policy

1. 访问 Cloudflare Zero Trust 控制台
2. 进入 `Access > Applications`
3. 选择你的应用或创建新应用
4. 添加 Policy：

   | Action | Rule type | Selector | Value |
   |--------|-----------|----------|-------|
   | Allow | Include | IP list | Dynamic IP Whitelist |

---

## 更新 Worker

当代码变更后，重新部署：

```bash
wrangler deploy
```

---

## 查看日志

```bash
# 实时日志
wrangler tail

# 查看最近的日志
wrangler tail --format pretty
```

---

## 删除 Worker

```bash
wrangler delete iplist-worker
```

同时记得清理：
- KV Namespace 中的数据
- Cloudflare IP List
- 相关的 Access Policy
