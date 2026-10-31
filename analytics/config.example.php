<?php
/**
 * 文排访问统计 · 配置文件
 * 部署步骤：
 *   1. 复制本文件为 config.php（与本文件同目录）
 *   2. 填写数据库连接、盐值、安装令牌、后台账号
 *   3. config.php 已被 .htaccess 禁止 Web 访问，且不进 git——密码只存在于服务器上
 */

return array(
  // 数据库连接（MySQL / MariaDB）
  'db' => array(
    'host'    => '127.0.0.1',
    'dbname'  => 'wenpai_stats',
    'user'    => 'root',
    'pass'    => '',
    'charset' => 'utf8mb4',
    'port'    => '3306',
  ),

  // IP 加盐哈希的盐（随机长字符串，换盐会破坏 UV 去重连续性，设好后不要改）
  'salt' => '请替换为随机长字符串',

  // 安装令牌：访问 install.php?token=xxx 时校验；安装完成后删除 install.php
  'install_token' => '请替换为随机字符串',

  // 后台管理登录（admin/index.php）
  // admin_hash 用 hashgen.php 生成：访问 /analytics/hashgen.php?pass=你的密码，
  // 把输出粘贴到这里，然后立刻删除 hashgen.php
  'admin_user' => 'admin',
  'admin_hash' => '', // password_hash() 生成的 bcrypt 串

  // 是否把用户复制/导出的作品内容存入数据库（wp_contents 表）
  // ⚠️ 注意：站点宣传语是「文章隐私零上传」，开启前请确认接受数据留存，
  //    并建议在页面隐私说明中注明「复制动作的内容会匿名留存用于产品分析」
  'capture_content' => true,

  // 单条内容体积上限（字节），超出截断
  'max_content_bytes' => 131072, // 128KB
);
