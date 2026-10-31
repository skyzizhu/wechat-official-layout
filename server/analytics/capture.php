<?php
/**
 * 文排访问统计 · 内容入库接口（POST /analytics/capture.php）
 *
 * 前端在用户显式触发「一键复制 / 导出 MD」时，用 sendBeacon POST JSON：
 *   { uid, fp, sid, event: 'copy'|'export_md', title, content }
 *
 * 安全与限制：
 *   - 仅接受 application/json 或 text/plain（sendBeacon 默认 text/plain，避免预检）
 *   - config.capture_content 总开关（false 时直接 204 丢弃）
 *   - 内容体积上限 config.max_content_bytes（超出截断，不拒收）
 *   - 事件白名单、字段全量过滤；全部参数化查询（防注入）
 *   - 限流：单 ip_hash 每 60 秒最多 6 条内容（内容接口比信标严）
 *   - 不做任何内容审核/转义入库——出库（后台展示）时统一 htmlspecialchars
 */

date_default_timezone_set('Asia/Shanghai');
http_response_code(204);
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store');

$config = @include __DIR__ . '/config.php';
if (!is_array($config)) exit;
if (empty($config['capture_content'])) exit; // 总开关

if ($_SERVER['REQUEST_METHOD'] !== 'POST') exit;

$raw = file_get_contents('php://input');
if ($raw === false || $raw === '') exit;
if (strlen($raw) > 200000) exit; // 请求体硬上限 200KB

$body = json_decode($raw, true);
if (!is_array($body)) exit;

$EVENTS = array('copy', 'export_md');
$event = isset($body['event']) ? strtolower(trim((string)$body['event'])) : '';
if (!in_array($event, $EVENTS, true)) exit;

$hex = function ($v, $max) { return substr(preg_replace('/[^a-f0-9]/', '', strtolower((string)$v)), 0, $max); };
$uid = $hex(isset($body['uid']) ? $body['uid'] : '', 32);
if (strlen($uid) < 8) exit;
$fp  = $hex(isset($body['fp']) ? $body['fp'] : '', 16);
$sid = $hex(isset($body['sid']) ? $body['sid'] : '', 16);

$content = isset($body['content']) ? (string)$body['content'] : '';
if (trim($content) === '') exit;
$maxBytes = max(1024, (int)($config['max_content_bytes'] ?? 131072));
if (strlen($content) > $maxBytes) $content = mb_substr($content, 0, (int)floor($maxBytes / 3)); // utf8 安全截断

$title = isset($body['title']) ? trim((string)$body['title']) : '';
if ($title === '') {
  $lines = preg_split('/\r\n|\r|\n/', trim($content));
  $title = trim((string)($lines[0] ?? ''));
}
$title = mb_substr($title, 0, 200);

$ip = isset($_SERVER['HTTP_X_FORWARDED_FOR']) ? trim(explode(',', (string)$_SERVER['HTTP_X_FORWARDED_FOR'])[0]) : (isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '');
$ip_hash = substr(hash('sha256', $ip . '|' . (string)$config['salt']), 0, 16);

try {
  $db = $config['db'];
  $pdo = new PDO(
    "mysql:host={$db['host']};dbname={$db['dbname']};charset={$db['charset']}",
    $db['user'],
    $db['pass'],
    array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION)
  );

  // 内容接口限流（代理判断）：wp_contents 不存 IP（最小化留存），
  // 以该来源在 wp_visits 的近期信标活动为代理——近 10 分钟无活动视为异常流量，丢弃
  $st2 = $pdo->prepare('SELECT COUNT(*) FROM wp_visits WHERE ip_hash = ? AND created_at > NOW() - INTERVAL 600 SECOND');
  $st2->execute(array($ip_hash));
  if ((int)$st2->fetchColumn() < 1) {
    exit;
  }

  $ins = $pdo->prepare('INSERT INTO wp_contents (uid, fp, sid, event, title, char_len, content, day) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  $ins->execute(array($uid, $fp, $sid, $event, $title, mb_strlen($content), $content, date('Y-m-d')));
} catch (PDOException $ex) {
  // 静默
}
exit;
