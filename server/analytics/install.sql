-- 文排访问统计 · 数据库结构 v2（MySQL 5.7+ / MariaDB 10.2+，utf8mb4）
-- 执行方式二选一：
--   1. phpMyAdmin 里直接导入本文件（推荐）
--   2. 访问 install.php?token=安装令牌（见 config.php，装完必须删除 install.php）

-- 访问与行为事件表（只追加）
CREATE TABLE IF NOT EXISTS wp_visits (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event      VARCHAR(20)  NOT NULL DEFAULT 'pv',   -- 事件类型：pv/copy/theme/export_md
  uid        CHAR(32)     NOT NULL DEFAULT '',     -- 匿名访客 id（前端 localStorage 随机生成）
  fp         CHAR(16)     NOT NULL DEFAULT '',     -- 浏览器指纹哈希前16位（辅助区分用户）
  sid        CHAR(16)     NOT NULL DEFAULT '',     -- 会话 id（一次访问内的使用连续性）
  path       VARCHAR(190) NOT NULL DEFAULT '/',    -- 页面路径
  extra      VARCHAR(190) NOT NULL DEFAULT '',     -- 事件附属值：主题 id / 字数档位等
  ip_hash    CHAR(16)     NOT NULL DEFAULT '',     -- IP加盐哈希前16位（去重/防刷，不存原文）
  ua         VARCHAR(190) NOT NULL DEFAULT '',     -- User-Agent
  referer    VARCHAR(190) NOT NULL DEFAULT '',     -- 来源页
  day        DATE         NOT NULL,                -- 事件日期（报表按天聚合的索引键）
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_day (day),
  KEY idx_event_day (event, day),
  KEY idx_uid_day (uid, day),
  KEY idx_fp_day (fp, day),
  KEY idx_sid (sid),
  KEY idx_ip_time (ip_hash, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 用户内容库（用户显式触发的复制/导出动作附带的作品内容）
CREATE TABLE IF NOT EXISTS wp_contents (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  uid        CHAR(32)     NOT NULL DEFAULT '',     -- 匿名访客 id
  fp         CHAR(16)     NOT NULL DEFAULT '',     -- 浏览器指纹哈希前16位
  sid        CHAR(16)     NOT NULL DEFAULT '',     -- 会话 id
  event      VARCHAR(20)  NOT NULL DEFAULT 'copy', -- 触发动作：copy/export_md
  title      VARCHAR(200) NOT NULL DEFAULT '',     -- 内容首行标题（截断）
  char_len   INT UNSIGNED NOT NULL DEFAULT 0,      -- 字符数
  content    MEDIUMTEXT   NOT NULL,                -- 内容全文（上限 128KB，服务端裁剪）
  day        DATE         NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_day (day),
  KEY idx_uid_day (uid, day),
  KEY idx_event_day (event, day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
