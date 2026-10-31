<?php
/**
 * 文排访问统计 · 一次性安装器
 * 用法：把 config.example.php 复制为 config.php 并填好后，
 *      浏览器访问 install.php?token=你设置的安装令牌
 * 安全：输出执行结果后，必须立刻删除本文件（或用 .htaccess 禁止后再删）。
 */

date_default_timezone_set('Asia/Shanghai');
header('Content-Type: text/plain; charset=utf-8');

$token = isset($_GET['token']) ? $_GET['token'] : '';
$config = @include __DIR__ . '/config.php';
if (!is_array($config)) { echo "缺少 config.php（请从 config.example.php 复制并填写）\n"; exit(1); }
if (!$token || !hash_equals((string)$config['install_token'], $token)) { echo "令牌错误\n"; http_response_code(403); exit(1); }

$db = $config['db'];
try {
  $pdo = new PDO(
    "mysql:host={$db['host']};dbname={$db['dbname']};charset={$db['charset']}",
    $db['user'],
    $db['pass'],
    array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION)
  );
} catch (PDOException $e) {
  echo "数据库连接失败: " . $e->getMessage() . "\n";
  exit(1);
}

$sql = file_get_contents(__DIR__ . '/install.sql');
// 去掉注释行，按分号拆分逐条执行
$lines = array_filter(array_map('trim', explode("\n", $sql)), function ($l) {
  return $l !== '' && strpos($l, '--') !== 0;
});
$statements = array_filter(array_map('trim', explode(';', implode("\n", $lines))));
foreach ($statements as $stmt) {
  if ($stmt === '') continue;
  try {
    $pdo->exec($stmt);
    echo "OK: " . substr($stmt, 0, 60) . "...\n";
  } catch (PDOException $e) {
    echo "FAIL: " . $e->getMessage() . "\n";
    exit(1);
  }
}

// 验证
$row = $pdo->query("SHOW TABLES LIKE 'wp_visits'")->fetch();
echo $row ? "\n✅ 安装完成，wp_visits 表已就绪。\n" : "\n❌ 表未创建，请检查。\n";
echo "最后一步：立刻删除 install.php 与 hashgen.php！\n";
