# Cloudflare Worker 动态 IP 白名单系统

## 概述

通过 Cloudflare Worker 实现动态 IP 白名单管理，iOS 快捷指令定期上报当前 IP，自动更新 Cloudflare Access Policy 的 IP 列表。IP 会根据最后更新时间自动过期（默认 7 天）。

## 架构图

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  iOS 快捷指令   │────────▶│ Cloudflare Worker│────────▶│  Cloudflare KV  │
│  (定时上报)     │   Token │  (验证+更新)      │   存储  │  (IP+时间戳)    │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                      │
                                      ▼
                              ┌──────────────────┐
                              │ Cloudflare List  │
                              │  (IP 白名单)      │
                              └──────────────────┘
                                      │
                                      ▼
                              ┌──────────────────┐
                              │ Access Policy    │
                              │  (引用 List)      │
                              └──────────────────┘
```

## 功能特性

| 功能 | 说明 |
|------|------|
| Access 认证 | 通过 Cloudflare Access Service Token 认证 |
| 自动过期 | 7 天未更新的 IP 自动清理 |
| 即时生效 | IP 更新后立即同步到 Cloudflare List |
| 跨设备 | 支持多设备同时注册 |
| 调试接口 | 可查看当前注册的 IP 列表 |

## 快速开始

1. [部署 Worker](#1-部署-worker)
2. [配置环境变量](#2-配置环境变量)
3. [配置 iOS 快捷指令](#3-配置-ios-快捷指令)
4. [配置 Access Policy](#4-配置-access-policy)

## 目录结构

```
iplist_worker/
├── README.md           # 本文档
├── src/
│   ├── worker.js       # Worker 主代码
│   └── worker_debug.js # 带调试端点的版本
├── config/
│   ├── wrangler.toml   # Cloudflare Worker 配置
│   └── example.env     # 环境变量示例
├── docs/
│   ├── deployment.md   # 部署指南
│   ├── shortcuts.md    # iOS 快捷指令配置
│   └── api.md          # API 文档
└── scripts/
    ├── create_list.sh  # 创建 IP List 脚本
    └── get_info.sh     # 获取 Account ID 脚本
```

## 1. 部署 Worker

### 前置要求

- Node.js 18+
- npm 或 yarn
- Cloudflare 账号
- Cloudflare API Token

### 安装依赖

```bash
npm install wrangler -g
```

### 登录 Cloudflare

```bash
wrangler login
```

### 部署

```bash
cd D:\nazarick\iplist_worker
wrangler deploy
```

## 2. 配置环境变量

在 Worker Dashboard 或 `wrangler.toml` 中配置以下变量：

| 变量名 | 类型 | 说明 |
|--------|------|------|
| `ACCOUNT_ID` | Variable | Cloudflare Account ID |
| `LIST_ID` | Variable | IP List ID |
| `API_TOKEN` | Secret | Cloudflare API Token |
| `EXPIRE_DAYS` | Variable | IP 过期天数（默认 7） |

绑定 KV Namespace:

| Binding name | KV Namespace |
|--------------|-------------|
| `IP_WHITELIST` | IP_WHITELIST |

## 3. 配置 Cloudflare Access

### 3.1 创建 Service Token

1. 进入 Cloudflare Dashboard → **Zero Trust**
2. 左侧菜单 → **Access** → **Service Auth**
3. 点击 **Create Service Token**
4. 填写信息并保存，记录生成的 **Service Token** 和 **Client ID**

### 3.2 配置 Access Policy

1. 进入 **Access** → **Applications**
2. 添加新应用，配置你的 Worker 路由
3. 添加 Policy：
   - 选择 **Service Token** → 你创建的 Token
   - Action: **Allow**

### 3.3 客户端请求方式

```bash
curl -H "CF-Access-Client-Id: <Client_ID>" \
     -H "CF-Access-Client-Secret: <Service_Token>" \
     https://your-worker.workers.dev
```

## 4. 配置 iOS 快捷指令

详见 [docs/shortcuts.md](docs/shortcuts.md)

## 5. 配置 Access Policy

在 Zero Trust 控制台配置 Access Policy 引用动态 IP 列表：

| Action | Rule type | Selector | Value |
|--------|-----------|----------|-------|
| Allow | Include | IP list | Dynamic IP Whitelist |

## 安全建议

1. **使用 Service Token**：通过 Cloudflare Access 进行认证
2. **定期轮换 Token**：建议每 90 天更换
3. **启用 HTTPS**：Worker 自动支持
4. **限制 API Token 权限**：仅授予 Gateway List 编辑权限

## 故障排查

| 问题 | 可能原因 | 解决方法 |
|------|----------|----------|
| 401 Unauthorized | Service Token 错误 | 检查 CF-Access 头 |
| IP 未更新 | List ID 错误 | 验证 LIST_ID 配置 |
| 过期 IP 未清理 | KV 读取失败 | 检查 KV 绑定 |

## 许可证

MIT License
