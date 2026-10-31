<?php
/** 后台 · 概览：汇总卡片 + 每日明细 + 设备占比 + 主题排行 + 来源排行 */
require __DIR__ . '/_auth.php';

$range = isset($_GET['range']) ? (string)$_GET['range'] : '30';
if (!preg_match('/^(7|30|90|365)$/', $range)) $range = '30';
$from = date('Y-m-d', strtotime("-{$range} days"));
$to = date('Y-m-d');

// 汇总卡片
$st = $pdo->prepare("SELECT COUNT(*) pv, COUNT(DISTINCT uid) uv, COUNT(DISTINCT fp) fpu, COUNT(DISTINCT sid) sessions
  FROM wp_visits WHERE event = ? AND day BETWEEN ? AND ?");
$st->execute(array('pv', $from, $to));
$totals = $st->fetch(PDO::FETCH_ASSOC) ?: array('pv' => 0, 'uv' => 0, 'fpu' => 0, 'sessions' => 0);

$st = $pdo->prepare('SELECT COUNT(*) FROM wp_visits WHERE event = ? AND day BETWEEN ? AND ?');
$countEvent = function ($e) use ($st, $from, $to) { $st->execute(array($e, $from, $to)); return (int)$st->fetchColumn(); };
$copies = $countEvent('copy');
$themeSwitches = $countEvent('theme');
$exports = $countEvent('export_md');

// 内容使用量
$st = $pdo->prepare('SELECT COUNT(*) c, COALESCE(SUM(char_len),0) chars, COUNT(DISTINCT uid) owners
  FROM wp_contents WHERE day BETWEEN ? AND ?');
$st->execute(array($from, $to));
$contentStats = $st->fetch(PDO::FETCH_ASSOC) ?: array('c' => 0, 'chars' => 0, 'owners' => 0);

// 每日明细
$st = $pdo->prepare("SELECT day, SUM(event='pv') pv, COUNT(DISTINCT CASE WHEN event='pv' THEN uid END) uv,
  COUNT(DISTINCT CASE WHEN event='pv' THEN sid END) sessions,
  SUM(event='copy') copies, SUM(event='theme') themes, SUM(event='export_md') exports
  FROM wp_visits WHERE day BETWEEN ? AND ? GROUP BY day ORDER BY day DESC");
$st->execute(array($from, $to));
$daily = $st->fetchAll(PDO::FETCH_ASSOC);

// 主题排行
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

$on7 = $h($range === '7' ? 'on' : '');
$on30 = $h($range === '30' ? 'on' : '');
$on90 = $h($range === '90' ? 'on' : '');
$on365 = $h($range === '365' ? 'on' : '');

render_header('概览', 'index');

echo '<div class="ranges" style="margin-bottom:16px"><span class="muted" style="font-size:13px">范围：</span>'
  . '<a class="' . $on7 . '" href="?range=7">7 天</a><a class="' . $on30 . '" href="?range=30">30 天</a>'
  . '<a class="' . $on90 . '" href="?range=90">90 天</a><a class="' . $on365 . '" href="?range=365">一年</a></div>';

echo '<div class="cards">';
echo $card('浏览量 PV', (int)$totals['pv']);
echo $card('访客数 UV', (int)$totals['uv'], '指纹去重 ' . (int)$totals['fpu']);
echo $card('会话数', (int)$totals['sessions'], '人均 ' . ($totals['uv'] > 0 ? round($totals['sessions'] / $totals['uv'], 1) : 0) . ' 次');
echo $card('一键复制', $copies, '内容 ' . $contentStats['c'] . ' 篇 / ' . round(((int)$contentStats['chars']) / 10000, 1) . ' 万字');
echo $card('主题切换', $themeSwitches, '人均 ' . ($totals['uv'] > 0 ? round($themeSwitches / $totals['uv'], 1) : 0) . ' 次');
echo $card('导出 MD', $exports);
echo '</div>';

echo '<div class="box"><h2>每日明细（' . $h($from) . ' ~ ' . $h($to) . '）</h2><table><tr><th>日期</th><th>PV</th><th>UV</th><th>会话</th><th>复制</th><th>主题切换</th><th>导出</th></tr>';
foreach ($daily as $r) {
  echo '<tr><td>' . $h($r['day']) . '</td><td class="num-td">' . (int)$r['pv'] . '</td><td class="num-td">' . (int)$r['uv'] . '</td><td class="num-td">' . (int)$r['sessions'] . '</td><td class="num-td">' . (int)$r['copies'] . '</td><td class="num-td">' . (int)$r['themes'] . '</td><td class="num-td">' . (int)$r['exports'] . '</td></tr>';
}
if (!count($daily)) echo '<tr><td colspan="7" class="muted">该范围内暂无数据</td></tr>';
echo '</table></div>';

$maxTheme = 1;
foreach ($topThemes as $t) $maxTheme = max($maxTheme, (int)$t['c']);
echo '<div class="two"><div class="box"><h2>主题使用排行</h2><table>';
foreach ($topThemes as $t) {
  $pct = round(100 * (int)$t['c'] / $maxTheme);
  echo '<tr><td>' . $h($t['extra']) . '</td><td class="num-td">' . (int)$t['c'] . '</td><td style="width:40%"><div class="bar"><i style="width:' . $pct . '%"></i></div></td></tr>';
}
if (!count($topThemes)) echo '<tr><td colspan="3" class="muted">暂无数据</td></tr>';
echo '</table></div>';

echo '<div class="box"><h2>来源排行 / 设备占比</h2><table>';
foreach ($topRefs as $r) {
  echo '<tr><td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' . $h($r['ref']) . '</td><td class="num-td">' . (int)$r['c'] . '</td></tr>';
}
if (!count($topRefs)) echo '<tr><td colspan="2" class="muted">暂无数据</td></tr>';
echo '</table><p style="font-size:13px;color:#6b7280">移动端占比 <b>' . $mobilePct . '%</b>　桌面端 <b>' . round(100 - $mobilePct, 1) . '%</b></p></div></div>';

render_footer();
