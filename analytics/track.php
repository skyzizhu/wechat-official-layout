<?php
/**
 * 文排访问统计 · 上报接口（同域部署：wol.yourtools.xyz/analytics/track.php）
 *
 * 前端用法（图片信标，无 CORS/预检问题，微信 WebView 兼容）：
 *   new Image().src = '/analytics/track.php?e=pv&uid=..&fp=..&sid=..&p=%2F'
 *   new Image().src = '/analytics/track.php?e=copy&uid=..&x=字数档位'
 *
 * 设计要点：
 *   - 只追加：接口只 INSERT，不读不回显任何数据
 *   - IP 只存加盐哈希前 16 位（去重/防刷用，不存原文）
 *   - 限流：单 ip_hash 每分钟最多 20 条，超出静默丢弃
 *   - 任何参数不合法都静默丢弃并返回正常 gif（不给探测者任何信号）
 */

date_default_timezone_set('Asia/Shanghai');

// 1x1 透明 GIF（43 字节固定内容）
$GIF = base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');

$config = @include __DIR__ . '/config.php';
if (!is_array($config)) { http_response_code(500); header('Content-Type: image/gif'); echo $GIF; exit; }

// ---- 参数校验：一切不合法静默丢弃 ----
$EVENTS = array('pv', 'copy', 'theme', 'export_md');

$e = isset($_GET['e']) ? strtolower(trim($_GET['e'])) : '';
if (!in_array($e, $EVENTS, true)) { header('Content-Type: image/gif'); echo $GIF; exit; }

$hex = function ($v, $max) { return substr(preg_replace('/[^a-f0-9]/', '', strtolower((string)$v)), 0, $max); };
$uid = $hex(isset($_GET['uid']) ? $_GET['uid'] : '', 32);
if (strlen($uid) < 8) { header('Content-Type: image/gif'); echo $GIF; exit; }

$fp  = $hex(isset($_GET['fp']) ? $_GET['fp'] : '', 16);
$sid = $hex(isset($_GET['sid']) ? $_GET['sid'] : '', 16);

$p = isset($_GET['p']) ? mb_substr(trim((string)$_GET['p']), 0, 190) : '/';
if ($p === '') $p = '/';

$x = isset($_GET['x']) ? mb_substr(trim((string)$_GET['x']), 0, 64) : '';

$ua = isset($_SERVER['HTTP_USER_AGENT']) ? mb_substr(trim((string)$_SERVER['HTTP_USER_AGENT']), 0, 190) : '';
$ref = isset($_SERVER['HTTP_REFERER']) ? mb_substr(trim((string)$_SERVER['HTTP_REFERER']), 0, 190) : '';

// ---- IP 加盐哈希（兼容 CDN/反代取首个转发 IP）----
$ip = isset($_SERVER['HTTP_X_FORWARDED_FOR']) ? trim(explode(',', (string)$_SERVER['HTTP_X_FORWARDED_FOR'])[0]) : (isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '');
$ip_hash = substr(hash('sha256', $ip . '|' . (string)$config['salt']), 0, 16);

// ---- 写库 ----
try {
  $db = $config['db'];
  $pdo = new PDO(
    "mysql:host={$db['host']};dbname={$db['dbname']};charset={$db['charset']}",
    $db['user'],
    $db['pass'],
    array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION)
  );

  // 限流：该 ip_hash 最近 60 秒内超过 20 条则丢弃本次
  $st = $pdo->prepare('SELECT COUNT(*) FROM wp_visits WHERE ip_hash = ? AND created_at > NOW() - INTERVAL 60 SECOND');
  $st->execute(array($ip_hash));
  if ((int)$st->fetchColumn() <= 20) {
    $ins = $pdo->prepare('INSERT INTO wp_visits (event, uid, fp, sid, path, extra, ip_hash, ua, referer, day) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $ins->execute(array($e, $uid, $fp, $sid, $p, $x, $ip_hash, $ua, $ref, date('Y-m-d')));
  }
} catch (PDOException $ex) {
  // 统计失败不影响主站：静默
}

// ---- 无论成败都返回正常 gif ----
header('Content-Type: image/gif');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Access-Control-Allow-Origin: *');
echo $GIF;
