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

---

## 方案二：Apache 静态托管

仓库已内置 `public/.htaccess`（构建时自动复制到 `out/`），包含与 Nginx 方案对等的缓存与压缩策略：

- HTML / txt **禁止缓存**（发版后浏览器立即拉新页面，避免"拉了代码线上还是旧版"）
- `_next/static` 带哈希 JS/CSS 一年期永久缓存（immutable）
- 图片/字体 30 天缓存、Gzip 压缩、404 页面

### 启用要点

1. 将 `out/` 内容部署到 Apache 站点目录（如 `/var/www/html/radiant-maxwell/`），`.htaccess` 必须位于该目录
2. 站点目录需允许覆盖配置（`AllowOverride All`），否则 .htaccess 不生效。编辑 `/etc/httpd/conf/httpd.conf`：

```apache
<Directory "/var/www/html/radiant-maxwell">
    AllowOverride All
</Directory>
```

```bash
systemctl reload httpd
```

3. 若无法修改 AllowOverride，可把 .htaccess 内容直接写入该站点的 VirtualHost 配置段

---

---

## SEO 检查清单（Google 收录）

构建产物已内置完整 SEO 基础设施（`src/app/layout.tsx` 统一配置）：

- ✅ 完整 title / description / keywords（含核心关键词：公众号排版、微信排版工具等）
- ✅ canonical、OpenGraph、Twitter Card、JSON-LD 结构化数据（WebApplication）
- ✅ `robots.txt`、`sitemap.xml`、`manifest.webmanifest`（静态导出自动生成）
- ✅ 品牌化 OG 分享图（1200×630，`public/og-image.png`）
- ✅ 预渲染 HTML 含完整正文（Google 无需执行 JS 即可索引）

### 上线后必做

1. **改域名**：`src/lib/site.ts` 中的 `SITE_URL` 改为实际线上域名（canonical/OG/sitemap 均引用它），重新构建
2. **提交搜索引擎**：Google Search Console 添加资源并验证，提交 `https://你的域名/sitemap.xml`
3. **确认服务器**：`robots.txt` 与 `sitemap.xml` 可直接访问
4. **验证结构化数据**：Google Rich Results Test 测试首页，确认 WebApplication 无告警
