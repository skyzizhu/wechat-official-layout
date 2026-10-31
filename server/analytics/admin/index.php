<?php
/**
 * 文排访问统计 · 后台管理（同域部署：wol.yourtools.xyz/admin/）
 *
 * 登录：session + bcrypt（config.php 的 admin_user / admin_hash），
 *       密码哈希用 hashgen.php 生成（用完删除）。
 * 登录失败 5 次锁定 15 分钟（session 级）。
 * 报表：按日期范围聚合 wp_visits——每日 PV/UV、事件分布、主题排行、
 *       来源排行、设备占比。全部参数化查询。
 */

date_default_timezone_set('Asia/Shanghai');
session_start();
header('Content-Type: text/html; charset=utf-8');

$config = @include __DIR__ . '/../config.php';
if (!is_array($config) || empty($config['admin_hash'])) {
  echo '<h3>后台未配置：请先复制 config.example.php 为 config.php 并填写 admin_hash（用 hashgen.php 生成）。</h3>';
  exit;
}

// ---------- 登录处理 ----------
$authed = !empty($_SESSION['wpstat_auth']);
$failCount = isset($_SESSION['wpstat_fails']) ? (int)$_SESSION['wpstat_fails'] : 0;
$lockedUntil = isset($_SESSION['wpstat_lock_until']) ? (int)$_SESSION['wpstat_lock_until'] : 0;

if (!$authed) {
  if ($lockedUntil > time()) {
    echo '<h3>尝试次数过多，已锁定 ' . ceil(($lockedUntil - time()) / 60) . ' 分钟。</h3>';
    exit;
  }
  if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['user'], $_POST['pass'])) {
    $okUser = hash_equals((string)$config['admin_user'], (string)$_POST['user']);
    $okPass = password_verify((string)$_POST['pass'], (string)$config['admin_hash']);
    if ($okUser && $okPass) {
      session_regenerate_id(true);
      $_SESSION['wpstat_auth'] = true;
      unset($_SESSION['wpstat_fails'], $_SESSION['wpstat_lock_until']);
      $authed = true;
    } else {
      $failCount++;
      $_SESSION['wpstat_fails'] = $failCount;
      if ($failCount >= 5) {
        $_SESSION['wpstat_lock_until'] = time() + 900;
        echo '<h3>尝试次数过多，已锁定 15 分钟。</h3>';
        exit;
      }
      $loginError = '账号或密码错误（第 ' . $failCount . ' 次）';
    }
  }
}

if (!$authed) {
  $e = isset($loginError) ? htmlspecialchars($loginError, ENT_QUOTES, 'UTF-8') : '';
  echo <<<HTML
<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>文排统计 · 登录</title>
<style>body{font-family:system-ui,sans-serif;background:#f6f7f9;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}
.card{background:#fff;border-radius:12px;padding:32px 40px;box-shadow:0 2px 12px rgba(0,0,0,.08);width:280px}
h1{font-size:18px;margin:0 0 20px}input{width:100%;box-sizing:border-box;padding:9px 10px;margin-bottom:12px;border:1px solid #d6d9de;border-radius:8px;font-size:14px}
button{width:100%;padding:10px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-size:14px;cursor:pointer}
.err{color:#c0392b;font-size:12px;margin:-4px 0 10px}</style></head><body>
<div class="card"><h1>📊 文排统计后台</h1>
<form method="post"><input name="user" placeholder="账号" required><input name="pass" type="password" placeholder="密码" required>
<div class="err">{$e}</div><button>登录</button></form></div></body></html>
HTML;
  exit;
}

// ---------- 已登录：加载数据 ----------
if (isset($_GET['logout'])) { session_destroy(); header('Location: ./'); exit; }

$db = $config['db'];
try {
  $pdo = new PDO(
    "mysql:host={$db['host']};dbname={$db['dbname']};charset={$db['charset']}",
    $db['user'],
    $db['pass'],
    array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION)
  );
} catch (PDOException $ex) { echo '<h3>数据库连接失败</h3>'; exit; }

// 日期范围（白名单天数或合法日期）
$range = isset($_GET['range']) ? (string)$_GET['range'] : '30';
if (!preg_match('/^(7|30|90|365)$/', $range)) $range = '30';
$from = date('Y-m-d', strtotime("-{$range} days"));
$to = date('Y-m-d');

// 汇总卡片
$st = $pdo->prepare('SELECT COUNT(*) pv, COUNT(DISTINCT uid) uv FROM wp_visits WHERE event = ? AND day BETWEEN ? AND ?');
$st->execute(array('pv', $from, $to));
$totals = $st->fetch(PDO::FETCH_ASSOC) ?: array('pv' => 0, 'uv' => 0);

$st = $pdo->prepare("SELECT COUNT(*) c FROM wp_visits WHERE event = ? AND day BETWEEN ? AND ?");
$st->execute(array('copy', $from, $to));
$copies = (int)$st->fetchColumn();
$st->execute(array('theme', $from, $to));
$themeSwitches = (int)$st->fetchColumn();
$st->execute(array('export_md', $from, $to));
$exports = (int)$st->fetchColumn();

// 每日明细
$st = $pdo->prepare("SELECT day, SUM(event='pv') pv, COUNT(DISTINCT CASE WHEN event='pv' THEN uid END) uv,
  SUM(event='copy') copies, SUM(event='theme') themes, SUM(event='export_md') exports
  FROM wp_visits WHERE day BETWEEN ? AND ? GROUP BY day ORDER BY day DESC");
$st->execute(array($from, $to));
$daily = $st->fetchAll(PDO::FETCH_ASSOC);

// 主题排行（event=theme 的 extra=主题 id；另统计各主题的 copy 转化）
$st = $pdo->prepare("SELECT extra, COUNT(*) c, COUNT(DISTINCT uid) uv FROM wp_visits
  WHERE event = 'theme' AND day BETWEEN ? AND ? AND extra <> '' GROUP BY extra ORDER BY c DESC LIMIT 12");
$st->execute(array($from, $to));
$topThemes = $st->fetchAll(PDO::FETCH_ASSOC);

// 来源排行
$st = $pdo->prepare("SELECT IF(referer='','(直接访问)',referer) ref, COUNT(*) c FROM wp_visits
  WHERE event = 'pv' AND day BETWEEN ? AND ? GROUP BY ref ORDER BY c DESC LIMIT 10");
$st->execute(array($from, $to));
$topRefs = $st->fetchAll(PDO::FETCH_ASSOC);

// 设备占比
$st = $pdo->prepare("SELECT SUM(ua REGEXP 'Mobile|Android|iPhone|iPad') mobile, COUNT(*) total
  FROM wp_visits WHERE event = 'pv' AND day BETWEEN ? AND ?");
$st->execute(array($from, $to));
$device = $st->fetch(PDO::FETCH_ASSOC) ?: array('mobile' => 0, 'total' => 1);
$mobilePct = $device['total'] > 0 ? round(100 * $device['mobile'] / $device['total'], 1) : 0;

$card = function ($label, $value, $sub = '') {
  $s = $sub !== '' ? "<div class=\"sub\">{$sub}</div>" : '';
  return "<div class=\"card\"><div class=\"num\">{$value}</div><div class=\"label\">{$label}</div>{$s}</div>";
};
$h = function ($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); };

// heredoc 内不能调用函数，高亮类先算好
$on7 = $h($range === '7' ? 'on' : '');
$on30 = $h($range === '30' ? 'on' : '');
$on90 = $h($range === '90' ? 'on' : '');
$on365 = $h($range === '365' ? 'on' : '');

echo <<<HTML
<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>文排统计后台</title>
<style>
body{font-family:system-ui,"PingFang SC","Microsoft YaHei",sans-serif;background:#f6f7f9;margin:0;color:#1f2328}
.wrap{max-width:960px;margin:0 auto;padding:24px 16px}
header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
h1{font-size:20px;margin:0}a{color:#2563eb;text-decoration:none}
.ranges a{margin-left:8px;padding:3px 10px;border-radius:6px;background:#fff;border:1px solid #d6d9de;font-size:13px}
.ranges a.on{background:#2563eb;color:#fff;border-color:#2563eb}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px}
.card{background:#fff;border-radius:10px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.num{font-size:26px;font-weight:700}.label{font-size:13px;color:#6b7280;margin-top:2px}.sub{font-size:12px;color:#9ca3af;margin-top:2px}
.box{background:#fff;border-radius:10px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.06);margin-bottom:20px}
.box h2{font-size:15px;margin:0 0 12px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:7px 8px;border-bottom:1px solid #eef0f2}
th{color:#6b7280;font-weight:500}.num-td{text-align:right;font-variant-numeric:tabular-nums}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:640px){.two{grid-template-columns:1fr}}
.bar{height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden;margin-top:4px}
.bar i{display:block;height:100%;background:#2563eb}
</style></head><body><div class="wrap">
<header><h1>📊 文排统计后台</h1>
<div class="ranges">
<a class="{$on7}" href="?range=7">7 天</a>
<a class="{$on30}" href="?range=30">30 天</a>
<a class="{$on90}" href="?range=90">90 天</a>
<a class="{$on365}" href="?range=365">一年</a>
<a href="?logout=1">退出</a></div></header>
HTML;

echo '<div class="cards">';
echo $card('浏览量 PV', (int)$totals['pv']);
echo $card('访客数 UV', (int)$totals['uv']);
echo $card('一键复制', $copies, '核心转化行为');
echo $card('主题切换', $themeSwitches, '人均 ' . ($totals['uv'] > 0 ? round($themeSwitches / $totals['uv'], 1) : 0) . ' 次');
echo $card('导出 MD', $exports);
echo '</div>';

echo '<div class="box"><h2>每日明细（' . $h($from) . ' ~ ' . $h($to) . '）</h2><table><tr><th>日期</th><th>PV</th><th>UV</th><th>复制</th><th>主题切换</th><th>导出</th></tr>';
foreach ($daily as $r) {
  echo '<tr><td>' . $h($r['day']) . '</td><td class="num-td">' . (int)$r['pv'] . '</td><td class="num-td">' . (int)$r['uv'] . '</td><td class="num-td">' . (int)$r['copies'] . '</td><td class="num-td">' . (int)$r['themes'] . '</td><td class="num-td">' . (int)$r['exports'] . '</td></tr>';
}
if (!count($daily)) echo '<tr><td colspan="6" style="color:#9ca3af">该范围内暂无数据</td></tr>';
echo '</table></div>';

$maxTheme = 0;
foreach ($topThemes as $t) $maxTheme = max($maxTheme, (int)$t['c']);
echo '<div class="two"><div class="box"><h2>主题使用排行</h2><table>';
foreach ($topThemes as $t) {
  $pct = $maxTheme > 0 ? round(100 * (int)$t['c'] / $maxTheme) : 0;
  echo '<tr><td>' . $h($t['extra']) . '</td><td class="num-td">' . (int)$t['c'] . '</td><td style="width:40%"><div class="bar"><i style="width:' . $pct . '%"></i></div></td></tr>';
}
if (!count($topThemes)) echo '<tr><td colspan="3" style="color:#9ca3af">暂无数据</td></tr>';
echo '</table></div>';

echo '<div class="box"><h2>来源排行 / 设备占比</h2><table>';
foreach ($topRefs as $r) {
  echo '<tr><td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' . $h($r['ref']) . '</td><td class="num-td">' . (int)$r['c'] . '</td></tr>';
}
if (!count($topRefs)) echo '<tr><td colspan="2" style="color:#9ca3af">暂无数据</td></tr>';
echo '</table><p style="font-size:13px;color:#6b7280">移动端占比 <b>' . $mobilePct . '%</b>　桌面端 <b>' . round(100 - $mobilePct, 1) . '%</b></p></div></div>';

echo '</div></body></html>';
