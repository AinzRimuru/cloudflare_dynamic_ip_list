#!/bin/bash

# Cloudflare IP List 创建脚本
# 用途: 创建用于动态 IP 白名单的 Gateway List

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 提示用户输入
echo -e "${YELLOW}=== Cloudflare IP List 创建脚本 ===${NC}"
echo ""

# 检查 API Token
if [ -z "$CF_API_TOKEN" ]; then
    echo -n "请输入 Cloudflare API Token: "
    read -r CF_API_TOKEN
fi

# 检查 Account ID
if [ -z "$CF_ACCOUNT_ID" ]; then
    echo -n "请输入 Account ID: "
    read -r CF_ACCOUNT_ID
fi

# 验证输入
if [ -z "$CF_API_TOKEN" ] || [ -z "$CF_ACCOUNT_ID" ]; then
    echo -e "${RED}错误: API Token 和 Account ID 不能为空${NC}"
    exit 1
fi

# List 名称
LIST_NAME="${1:-Dynamic IP Whitelist}"

echo ""
echo "创建 List:"
echo "  Account ID: $CF_ACCOUNT_ID"
echo "  List Name: $LIST_NAME"
echo ""

# 创建 List
RESPONSE=$(curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/gateway/lists" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"${LIST_NAME}\",
    \"type\": \"ip\",
    \"items\": []
  }")

# 解析响应
SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')

if [ "$SUCCESS" = "true" ]; then
    LIST_ID=$(echo "$RESPONSE" | jq -r '.result.id')
    echo -e "${GREEN}✓ List 创建成功!${NC}"
    echo ""
    echo "List 信息:"
    echo "  ID: $LIST_ID"
    echo "  Name: $(echo "$RESPONSE" | jq -r '.result.name')"
    echo ""
    echo "请将以下配置添加到 wrangler.toml:"
    echo ""
    echo -e "${GREEN}[vars]${NC}"
    echo -e "LIST_ID = \"${LIST_ID}\""
    echo ""
    echo "或设置环境变量:"
    echo -e "${YELLOW}export LIST_ID=${LIST_ID}${NC}"
else
    echo -e "${RED}✗ 创建失败${NC}"
    echo ""
    echo "错误信息:"
    echo "$RESPONSE" | jq -r '.errors[]?.message // "未知错误"'
    exit 1
fi
