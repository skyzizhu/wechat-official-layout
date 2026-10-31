# 文排访问统计 · 部署文档（本地文件，不进 git）

> 本文件已被 .gitignore 排除：仓库（尤其公开仓库）不应出现后台结构与文件清单。部署凭本文件与 server/analytics/ 目录内的代码即可。


同域路径方案：接口与后台都是普通 PHP 文件，放到站点目录即生效，无需反代。

```
analytics/
├── track.php            统计接口（1px gif 信标，只写不读）
├── capture.php          内容入库接口（复制/导出时匿名留存作品全文，POST JSON）
├── admin/               后台管理（概览 / 用户 / 内容库 / 事件日志）
├── install.php          一次性安装器（建表；装完删除）
├── install.sql          建表 SQL（wp_visits 事件表 + wp_contents 内容表）
├── hashgen.php          后台密码哈希生成（用完删除）
├── config.example.php   配置模板（复制为 config.php 填写）
├── config.php           真实配置（自己创建，被 .htaccess 禁止访问，不进 git）
└── .htaccess            禁止 Web 访问 config / install.sql
```

## 部署步骤（约 10 分钟）

1. **上传**：把整个 `analytics/` 目录上传到站点根目录下
   （`wol.yourtools.xyz/analytics/`）

2. **建库**（二选一）：
   - phpMyAdmin：先创建/选择数据库 → 导入 `install.sql`（用 root/管理员账号导入——专用运行时账号无建表权限，属预期安全设计）
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

- [ ] **线上数据库用专用账号（不要 root）**，最小权限：
      ```sql
      CREATE USER 'wenpai_stat'@'localhost' IDENTIFIED BY '强密码';
      GRANT SELECT, INSERT, DELETE ON wenpai_stats.* TO 'wenpai_stat'@'localhost';
      FLUSH PRIVILEGES;
      ```
      （接口只需 SELECT+INSERT；后台删除内容需要 DELETE；拆双账号更稳）
- [ ] config.php 已被 .htaccess 拦截（浏览器访问 config.php 应 403）
- [ ] install.php / hashgen.php 已删除
- [ ] admin/ 已改名为不可猜路径
- [ ] 后台密码 ≥ 8 位；session 登录自带 5 次失败锁 15 分钟、Cookie HttpOnly+SameSite
- [x] robots.txt 已内置 `Disallow: /analytics/`（站点构建自带）；后台若改名，把新路径加进 `src/app/robots.ts` 的 disallow 并重新构建

## 数据维护

- 事件表清理（防无限增长）：定时任务执行
  `curl "https://你的域名/analytics/prune.php?token=安装令牌&days=180"`
  （删除早于 180 天的事件；内容表不受影响）
- 后台登录 Cookie 已加固：HttpOnly + SameSite=Strict + HTTPS 下自动 Secure

## 数据说明

- `wp_visits` 事件表只追加：IP 只存加盐哈希前 16 位，不存原文（合规）
- 身份识别三件套（全部匿名）：`uid`（localStorage 随机 id，回访稳定）、
  `fp`（浏览器指纹：UA/语言/时区/屏幕/canvas 绘制的 SHA-256 前 16 位，
  辅助识别清了缓存的同一浏览器）、`sid`（会话 id，标签页关闭即新会话）
- `wp_contents` 内容表：用户显式触发「复制 / 导出 MD」时匿名留存作品全文
  （`capture_content` 总开关可关；单篇上限 128KB 服务端截断；后台可查看/删除）
- ⚠️ 隐私提示：内容留存改变了「文章隐私零上传」的默认承诺——上线前请
  在站点隐私说明中注明「复制/导出动作的内容会匿名留存用于产品分析」，
  或将 `capture_content` 设为 false
- 事件：`pv` / `copy`（extra=字数档位）/ `theme`（extra=主题 id）/ `export_md`
- 后台报表按天聚合；单表 + 索引，日流量十万级以内无压力
