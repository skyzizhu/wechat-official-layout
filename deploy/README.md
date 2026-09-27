# Radiant Maxwell - CentOS 服务器生产部署指南

本编辑器采用纯前端静态化输出架构（`output: 'export'`），不依赖特定 Node.js 运行时，在 CentOS（包含 CentOS 7 / 8 / 9 / Stream / Rocky Linux / AlmaLinux）上拥有极佳的兼容性与超高性能。

---

## 方案一：推荐方案（Nginx 静态托管 - 百万并发、极低内存）

### 1. 本地构建并上传部署（最推荐）
在您当前的 Mac 开发机上直接构建，将纯静态产物上传至 CentOS 服务器：

```bash
# 1. 在本地构建静态文件（耗时约 8~10 秒）
npm run build

# 2. 将生成的 out/ 目录一键上传至 CentOS 服务器（替换 your-server-ip）
rsync -avz --delete out/ root@your-server-ip:/usr/share/nginx/html/radiant-maxwell/
```

### 2. 在 CentOS 服务器上配置 Nginx
在 CentOS 上安装并配置 Nginx：

```bash
# 安装 Nginx（若未安装）
sudo yum install -y epel-release
sudo yum install -y nginx

# 复制项目中的配置文件至 /etc/nginx/conf.d/
sudo cp deploy/nginx.conf /etc/nginx/conf.d/radiant-maxwell.conf

# 测试配置并重载
sudo nginx -t
sudo systemctl reload nginx
```

---

## 方案二：CentOS 服务器一键在线构建与部署

若您希望在 CentOS 服务器上直接 `git pull` 并就地构建，项目已提供自动化脚本：

```bash
# 赋予执行权限并执行一键部署脚本
chmod +x deploy/centos-deploy.sh
./deploy/centos-deploy.sh
```

该脚本将自动：
1. 检查并安装 Node.js 20 LTS 与 Nginx；
2. 执行稳态 Webpack 构建（`npm run build`，规避 Turbopack Linux IPC 差异）；
3. 将静态文件同步到 Nginx 托管目录；
4. 优雅重载 Nginx。

---

## 方案三：Node / PM2 常驻服务（可选）

如果您希望以 Node.js 进程形式运行：

```bash
# 全局安装静态文件轻量服务工具
npm install -g serve pm2

# 使用 PM2 常驻托管 out 静态目录，监听 3000 端口
pm2 start "serve out -p 3000 -s" --name "radiant-maxwell"

# 设置开机自启
pm2 startup
pm2 save
```

---

## 方案四：Docker 容器化部署

```bash
# 构建镜像
docker build -t radiant-maxwell:latest .

# 启动容器
docker run -d --name radiant-maxwell -p 80:80 radiant-maxwell:latest
```
