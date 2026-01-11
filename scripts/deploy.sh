#!/bin/bash

# 快速部署脚本
# 用途: 自动化部署 Worker 到 Cloudflare

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}=== Cloudflare Worker 部署脚本 ===${NC}"
echo ""

# 检查 wrangler
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}错误: 未找到 wrangler CLI${NC}"
    echo "请运行: npm install -g wrangler"
    exit 1
fi

echo -e "${GREEN}✓ wrangler 已安装${NC}"
echo ""

# 检查登录状态
echo -e "${BLUE}检查 Cloudflare 登录状态...${NC}"
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}需要登录 Cloudflare${NC}"
    wrangler login
else
    echo -e "${GREEN}✓ 已登录${NC}"
    USER_INFO=$(wrangler whoami)
    echo "  用户: $(echo "$USER_INFO" | jq -r '.Result.User.Email')"
fi
echo ""

# 部署
echo -e "${BLUE}部署 Worker...${NC}"
wrangler deploy

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ 部署成功!${NC}"
    echo ""
    echo "下一步:"
    echo "  1. 运行: curl https://your-worker.workers.dev/health"
    echo "  2. 配置 iOS 快捷指令 (参考 docs/shortcuts.md)"
    echo "  3. 配置 Access Policy 引用 IP List"
else
    echo ""
    echo -e "${RED}✗ 部署失败${NC}"
    echo "请检查配置文件和错误信息"
    exit 1
fi
