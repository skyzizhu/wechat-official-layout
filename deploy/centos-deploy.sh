#!/usr/bin/env bash
# ====================================================================
# Radiant Maxwell - CentOS 一键自动化构建与部署脚本
# 适用系统：CentOS 7 / 8 / 9 / CentOS Stream / Rocky Linux / AlmaLinux
# ====================================================================

set -e

echo "🚀 [1/4] 检查并更新部署环境..."

# 检查 Node.js 环境
if ! command -v node &> /dev/null; then
    echo "⚠️ 未检测到 Node.js，正在通过 NodeSource 安装 Node.js 20 LTS..."
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo yum install -y nodejs
fi

echo "✅ Node.js 版本: $(node -v)"
echo "✅ NPM 版本: $(npm -v)"

# 检查 Nginx
if ! command -v nginx &> /dev/null; then
    echo "⚠️ 未检测到 Nginx，正在安装 Nginx..."
    sudo yum install -y epel-release || true
    sudo yum install -y nginx
    sudo systemctl enable nginx
    sudo systemctl start nginx
fi

echo "📦 [2/4] 安装项目依赖..."
npm install

echo "🔨 [3/4] 执行跨平台稳态 Webpack 静态构建..."
# 使用 Webpack 引擎构建，彻底杜绝 Turbopack 在 Linux glibc 上的兼容性问题
npm run build

echo "📂 [4/4] 同步构建产物至 Nginx 目录..."
DEPLOY_DIR="/usr/share/nginx/html/radiant-maxwell"
sudo mkdir -p "$DEPLOY_DIR"
sudo rm -rf "$DEPLOY_DIR/*"
sudo cp -r out/* "$DEPLOY_DIR/"

# 配置 Nginx 虚拟主机
if [ ! -f /etc/nginx/conf.d/radiant-maxwell.conf ]; then
    echo "⚙️ 部署 Nginx 配置文件..."
    sudo cp deploy/nginx.conf /etc/nginx/conf.d/radiant-maxwell.conf
fi

echo "🔄 重载 Nginx 服务..."
sudo nginx -t
sudo systemctl reload nginx

echo "🎉 部署完成！请访问服务器 IP 或所配置的域名体验微信排版编辑器。"
