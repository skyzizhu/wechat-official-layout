<?php
/**
 * 数据清理（保留线上库体积可控）
 * 用法：prune.php?token=安装令牌&days=180   （默认保留 180 天）
 * 动作：删除 wp_visits 中早于 N 天的事件记录；wp_contents 内容表不受影响（可单独加 days_content）
 * 定时：主机面板定时任务 curl "https://wol.yourtools.xyz/analytics/prune.php?token=...&days=180"
 */
date_default_timezone_set('Asia/Shanghai');
header('Content-Type: text/plain; charset=utf-8');

$token = isset($_GET['token']) ? $_GET['token'] : '';
$days = isset($_GET['days']) ? (int)$_GET['days'] : 180;
if ($days < 30) $days = 30;

$config = @include __DIR__ . '/config.php';
if (!is_array($config)) { echo "缺少 config.php\n"; exit(1); }
if (!$token || !hash_equals((string)$config['install_token'], $token)) { echo "令牌错误\n"; http_response_code(403); exit(1); }

$db = $config['db'];
try {
  $pdo = new PDO(
    "mysql:host={$db['host']};dbname={$db['dbname']};charset={$db['charset']}",
    $db['user'],
    $db['pass'],
    array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION)
  );
  $st = $pdo->prepare('DELETE FROM wp_visits WHERE day < CURDATE() - INTERVAL ? DAY');
  $st->execute(array($days));
  echo "已删除 " . $st->rowCount() . " 条早于 {$days} 天的事件记录；内容表未清理。\n";
} catch (PDOException $ex) {
  echo "失败: " . $ex->getMessage() . "\n";
}
