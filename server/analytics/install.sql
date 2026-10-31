-- 文排访问统计 · 数据库结构（MySQL 5.7+ / MariaDB 10.2+，utf8mb4）
-- 执行方式二选一：
--   1. phpMyAdmin 里直接导入本文件（推荐）
--   2. 访问 install.php?token=安装令牌（见 config.php，装完必须删除 install.php）

CREATE TABLE IF NOT EXISTS wp_visits (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event      VARCHAR(20)  NOT NULL DEFAULT 'pv',   -- 事件类型：pv/copy/theme/export_md
  uid        CHAR(32)     NOT NULL DEFAULT '',     -- 匿名访客 id（前端 localStorage 随机生成）
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
  KEY idx_ip_time (ip_hash, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
