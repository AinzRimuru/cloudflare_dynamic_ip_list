# iOS 快捷指令配置指南

本文档详细说明如何配置 iOS 快捷指令来实现 IP 自动上报。

---

## 快捷指令配置

### 创建快捷指令

1. 打开 iOS "快捷指令" App
2. 点击右上角 `+` 创建新快捷指令
3. 添加以下操作：

### 操作步骤

| 步骤 | 操作类型 | 配置 |
|------|---------|------|
| 1 | **获取 URL 内容** | 见下方详细配置 |

### "获取 URL 内容" 详细配置

```
URL: https://your-worker.workers.dev
请求头:
  CF-Access-Client-Id: your-client-id
  CF-Access-Client-Secret: your-service-token
  Content-Type: application/json
方法: POST
请求体: (留空，不需要)
```

### 完整操作列表

```
1. 获取 URL 内容
   ┌─────────────────────────────────────┐
   │ URL: https://your-worker.xxx...    │
   │ 方法: POST                          │
   │ 请求头:                             │
   │   CF-Access-Client-Id: xxx...       │
   │   CF-Access-Client-Secret: xxx...   │
   │   Content-Type: application/json    │
   └─────────────────────────────────────┘
```

如需重试，可将操作放入"重复"块中：

```
1. 重复 (次数: 3)
     │
     └── 获取 URL 内容 (配置同上)
```

---

## 自动化快捷指令

### 自动化触发方式

| 触发方式 | 说明 | 适用场景 |
|---------|------|---------|
| 时间 | 每天定时执行 | 定期保活 IP |
| Wi-Fi | 连接到指定 Wi-Fi | 到家/到公司自动更新 |
| 位置 | 到达/离开指定位置 | 基于地理位置触发 |
| NFC | 扫描 NFC 标签 | 手动触发更便捷 |
| 打开应用 | 打开指定应用时触发 | 使用特定应用时自动更新 |

### 设置时间自动化

1. 快捷指令 App → 自动化
2. 点击 `+` → 个人自动化
3. 选择 `日期/时间`
4. 设置：

   ```
   频率: 每天
   时间: 上午 6:00 (或你认为合适的时间)
   ```

5. 添加操作：选择上面创建的快捷指令

### 设置 Wi-Fi 自动化

```
触发条件: 连接到 Wi-Fi "你的家庭WiFi"
执行动作: 运行 "IP 上报" 快捷指令
```

### 设置位置自动化

```
触发条件: 到达 "家庭位置" / "公司位置"
执行动作: 运行 "IP 上报" 快捷指令
```

### 设置打开应用自动化

```
触发条件: 打开 "指定应用"
执行动作: 运行 "IP 上报" 快捷指令
```

常用应用推荐：
- **浏览器**：Safari、Chrome（每次上网时更新）
- **邮件**：邮件 App（发送邮件前确保 IP 有效）
- **社交**：微信、QQ（常用 App 保活）

---

## 快捷指令导入

你可以将以下 JSON 导入到快捷指令 App：

```json
{
  "WFWorkflowActions": [
    {
      "WFWorkflowActionIdentifier": "is.workflow.actions.downloadurl",
      "WFParameters": {
        "WFURL": "https://your-worker.workers.dev",
        "WFHTTPMethod": "POST",
        "WFRequestHeaders": {
          "Value": {
            "WFDictionaryFieldValueItems": [
              {
                "WFItemType": 0,
                "WFKey": {
                  "Value": {
                    "string": "CF-Access-Client-Id",
                    "attachmentsByRange": {}
                  },
                  "WFSerializationType": "WFTextTokenString"
                },
                "WFValue": {
                  "Value": {
                    "string": "your-client-id-here",
                    "attachmentsByRange": {}
                  },
                  "WFSerializationType": "WFTextTokenString"
                }
              },
              {
                "WFItemType": 0,
                "WFKey": {
                  "Value": {
                    "string": "CF-Access-Client-Secret",
                    "attachmentsByRange": {}
                  },
                  "WFSerializationType": "WFTextTokenString"
                },
                "WFValue": {
                  "Value": {
                    "string": "your-service-token-here",
                    "attachmentsByRange": {}
                  },
                  "WFSerializationType": "WFTextTokenString"
                }
              }
            ]
          },
          "WFSerializationType": "WFDictionaryFieldValue"
        }
      }
    }
  ],
  "WFWorkflowClientVersion": "2302.0.4",
  "WFWorkflowTypes": ["NCWidget", "WatchKit"]
}
```

> 注意：导入后需要修改 URL 和 Token

---

## 测试快捷指令

1. 手动运行快捷指令
2. 检查通知是否显示 IP 地址
3. 访问 `https://your-worker/debug` 验证 IP 已注册

---

## 故障排查

| 问题 | 可能原因 | 解决方法 |
|------|----------|----------|
| 403 Forbidden | Service Token 错误 | 检查 CF-Access 头格式 |
| 无响应 | Worker URL 错误 | 验证 Worker 部署 URL |
| 自动化不执行 | iOS 限制 | 确保 iOS 13+，手动运行一次 |
| IP 未生效 | Access Policy 未配置 | 检查 Zero Trust 配置 |

---

## 进阶技巧

### 1. 添加声音反馈

在 "显示通知" 前添加 "播放声音" 操作，选择提示音。

### 2. 保存结果到日志

使用 "添加到笔记" 操作，记录每次更新的时间和 IP。

### 3. 添加快捷指令到主屏幕

长按快捷指令 → 详细信息 → 添加到主屏幕

### 4. 从 Watch 触发

在 Apple Watch 上也可以运行此快捷指令。
