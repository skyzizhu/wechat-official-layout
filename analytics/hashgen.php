<?php
/**
 * 后台密码哈希生成器（一次性工具）
 * 用法：浏览器访问 hashgen.php?pass=你的后台密码，复制输出到 config.php 的 admin_hash。
 * ⚠️ 用完立刻删除本文件！
 */
if (!isset($_GET['pass']) || strlen((string)$_GET['pass']) < 6) {
  echo '用法：hashgen.php?pass=你的密码（至少 6 位）';
  exit;
}
header('Content-Type: text/plain; charset=utf-8');
echo password_hash((string)$_GET['pass'], PASSWORD_DEFAULT) . "\n删除本文件！\n";
