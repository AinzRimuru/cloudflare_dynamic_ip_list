#!/bin/bash

# Cloudflare 账户信息查询脚本
# 用途: 获取 Account ID 和现有的 Lists

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Cloudflare 账户信息查询 ===${NC}"
echo ""

# 检查 API Token
if [ -z "$CF_API_TOKEN" ]; then
    echo -n "请输入 Cloudflare API Token: "
    read -s -r CF_API_TOKEN
    echo ""
fi

if [ -z "$CF_API_TOKEN" ]; then
    echo -e "${RED}错误: API Token 不能为空${NC}"
    exit 1
fi

echo -e "${BLUE}1. 获取账户信息...${NC}"

ACCOUNTS_RESPONSE=$(curl -s -X GET \
  "https://api.cloudflare.com/client/v4/accounts" \
  -H "Authorization: Bearer ${CF_API_TOKEN}")

SUCCESS=$(echo "$ACCOUNTS_RESPONSE" | jq -r '.success // false')

if [ "$SUCCESS" != "true" ]; then
    echo -e "${RED}✗ 获取账户信息失败${NC}"
    echo "请检查 API Token 权限"
    exit 1
fi

echo -e "${GREEN}✓ 账户信息获取成功${NC}"
echo ""

# 显示账户列表
echo -e "${BLUE}可用账户:${NC}"
echo "$ACCOUNTS_RESPONSE" | jq -r '.result[] | "  - \(.name) (ID: \(.id))"'
echo ""

# 获取第一个账户 ID（默认）
FIRST_ACCOUNT_ID=$(echo "$ACCOUNTS_RESPONSE" | jq -r '.result[0].id')

echo -e "${YELLOW}使用账户: $FIRST_ACCOUNT_ID${NC}"
echo ""

# 获取现有的 Lists
echo -e "${BLUE}2. 获取现有的 IP Lists...${NC}"

LISTS_RESPONSE=$(curl -s -X GET \
  "https://api.cloudflare.com/client/v4/accounts/${FIRST_ACCOUNT_ID}/gateway/lists" \
  -H "Authorization: Bearer ${CF_API_TOKEN}")

echo -e "${GREEN}✓ Lists 获取成功${NC}"
echo ""

# 显示 Lists
LIST_COUNT=$(echo "$LISTS_RESPONSE" | jq -r '.result | length')

if [ "$LIST_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}没有找到现有的 Gateway Lists${NC}"
    echo "运行 ./create_list.sh 来创建新的 List"
else
    echo -e "${BLUE}现有的 Gateway Lists:${NC}"
    echo "$LISTS_RESPONSE" | jq -r '.result[] | select(.type == "ip") | "  - \(.name) (ID: \(.id), 条目数: \(.item_count // 0))"'
    echo ""
fi

echo ""
echo -e "${GREEN}配置信息:${NC}"
echo "  ACCOUNT_ID=$FIRST_ACCOUNT_ID"
echo ""
echo "请将上述信息添加到你的配置文件中。"
