# 文排访问统计 · Apache + PHP 部署包

同域路径方案：接口与后台都是普通 PHP 文件，放到站点目录即生效，无需反代。

```
analytics/
├── track.php            统计接口（1px gif 信标，只写不读）
├── admin/index.php      后台管理（登录 + 报表）
├── install.php          一次性安装器（建表；装完删除）
├── install.sql          建表 SQL（也可用 phpMyAdmin 直接导入）
├── hashgen.php          后台密码哈希生成（用完删除）
├── config.example.php   配置模板（复制为 config.php 填写）
├── config.php           真实配置（自己创建，被 .htaccess 禁止访问，不进 git）
└── .htaccess            禁止 Web 访问 config / install.sql
```

## 部署步骤（约 10 分钟）

1. **上传**：把整个 `analytics/` 目录上传到站点根目录下
   （`wol.yourtools.xyz/analytics/`）

2. **建库**（二选一）：
   - phpMyAdmin：先创建/选择数据库 → 导入 `install.sql`
   - 或浏览器访问 `https://wol.yourtools.xyz/analytics/install.php?token=安装令牌`

3. **配置**：在服务器上 `cp config.example.php config.php`，填写：
   - `db.*`：MySQL 连接（主机一般为 localhost；数据库需已存在并有该用户权限）
   - `salt`：随机长字符串（如 `openssl rand -hex 16` 生成；设好后不要改）
   - `install_token`：随机字符串
   - `admin_user` / `admin_hash`：访问一次 `hashgen.php?pass=你的密码` 生成哈希粘贴进来

4. **删除一次性文件**：`install.php`、`hashgen.php`（必须删！）

5. **后台改名（推荐）**：把 `admin/` 目录改名为不可猜的路径（如 `wp-stat-9x2k/`），
   日常访问 `https://wol.yourtools.xyz/wp-stat-9x2k/`

6. **验证接口**：浏览器访问
   `https://wol.yourtools.xyz/analytics/track.php?e=pv&uid=abcdef1234567890&p=/`
   应看到一个透明小点；后台「今日」应出现 1 条 PV。

7. **前端接线**：网站代码里的埋点见 `src/lib/analytics.ts`（本仓库），
   接口路径默认 `/analytics/track.php` 同域直连，构建部署后自动生效。

## 安全清单

- [ ] config.php 已被 .htaccess 拦截（浏览器访问 config.php 应 403）
- [ ] install.php / hashgen.php 已删除
- [ ] admin/ 已改名为不可猜路径
- [ ] 后台密码 ≥ 8 位；session 登录自带 5 次失败锁 15 分钟
- [ ] robots.txt 可加一行 `Disallow: /analytics/`（可选）

## 数据说明

- 一张表 `wp_visits` 只追加；IP 只存加盐哈希前 16 位，不存原文（合规）
- 事件：`pv`（页面浏览）/ `copy`（一键复制，extra=字数档位）/ `theme`（主题切换，
  extra=主题 id）/ `export_md`（导出 MD）
- 后台报表按天聚合，7/30/90/365 天切换；单表 + 4 个索引，日流量十万级以内无压力
