<?php
/** 后台 · 概览：汇总卡片 + 每日明细 + 设备占比 + 主题排行 + 来源排行 */
require __DIR__ . '/_auth.php';

$range = isset($_GET['range']) ? (string)$_GET['range'] : '30';
if (!preg_match('/^(today|7|30|90|365)$/', $range)) $range = '30';
// today = 仅当天；其余为「近 N 天」滚动窗口
$from = $range === 'today' ? date('Y-m-d') : date('Y-m-d', strtotime("-{$range} days"));
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

$onToday = $h($range === 'today' ? 'on' : '');
$on7 = $h($range === '7' ? 'on' : '');
$on30 = $h($range === '30' ? 'on' : '');
$on90 = $h($range === '90' ? 'on' : '');
$on365 = $h($range === '365' ? 'on' : '');

render_header('概览', 'index');

// ---------- 今日常驻条：打开后台第一眼就是当天数据 ----------
$st = $pdo->prepare("SELECT COUNT(*) pv, COUNT(DISTINCT uid) uv FROM wp_visits WHERE event = 'pv' AND day = CURDATE()");
$st->execute();
$todayRow = $st->fetch(PDO::FETCH_ASSOC) ?: array('pv' => 0, 'uv' => 0);
$st = $pdo->prepare("SELECT COUNT(*) FROM wp_visits WHERE event = 'copy' AND day = CURDATE()");
$st->execute();
$todayCopies = (int)$st->fetchColumn();
$st = $pdo->prepare("SELECT COUNT(*) FROM (SELECT uid FROM wp_visits WHERE event = 'pv' GROUP BY uid HAVING MIN(day) = CURDATE()) t");
$st->execute();
$todayNew = (int)$st->fetchColumn();
echo '<div class="today-strip"><span class="t">今日</span>'
  . '<span>PV <b>' . (int)$todayRow['pv'] . '</b></span>'
  . '<span>访客 <b>' . (int)$todayRow['uv'] . '</b></span>'
  . '<span>复制 <b>' . $todayCopies . '</b></span>'
  . '<span>新增用户 <b>' . $todayNew . '</b></span>'
  . '</div>';

echo '<div class="ranges" style="margin-bottom:16px"><span class="muted" style="font-size:13px">范围：</span>'
  . '<a class="' . $onToday . '" href="?range=today">今日</a>'
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

// ---------- 每日趋势迷你柱状图（时间正序；纯 CSS，零依赖）----------
$chartDays = array_reverse($daily); // 库里倒序取出，图表需正序
$maxPv = 1;
foreach ($chartDays as $r) $maxPv = max($maxPv, (int)$r['pv']);
$maxUv = 1;
foreach ($chartDays as $r) $maxUv = max($maxUv, max(1, (int)$r['uv']));
echo '<div class="box"><h2>每日趋势</h2>';
echo '<div class="legend"><span><i style="background:#2563eb"></i>PV</span><span><i style="background:#93c5fd"></i>UV</span><span><i style="background:#10b981"></i>复制（同比例）</span></div>';
echo '<div class="chart">';
foreach ($chartDays as $r) {
  $pv = (int)$r['pv']; $uv = (int)$r['uv']; $cp = (int)$r['copies'];
  $pvH = round(100 * $pv / $maxPv); $uvH = round(100 * $uv / $maxPv); $cpH = round(100 * $cp / $maxPv);
  if ($pv > 0 && $pvH < 4) $pvH = 4;
  if ($uv > 0 && $uvH < 4) $uvH = 4;
  if ($cp > 0 && $cpH < 4) $cpH = 4;
  $tip = $r['day'] . '　PV ' . $pv . ' · UV ' . $uv . ' · 复制 ' . $cp;
  $label = substr($r['day'], 5); // MM-DD
  echo '<div class="col" title="' . $h($tip) . '"><div class="bars">'
    . '<div class="b pv" style="height:' . $pvH . '%"></div>'
    . '<div class="b uv" style="height:' . $uvH . '%"></div>'
    . '<div class="b cp" style="height:' . $cpH . '%"></div>'
    . '</div><span class="d">' . $h($label) . '</span></div>';
}
if (!count($chartDays)) echo '<div class="muted" style="font-size:13px">暂无数据</div>';
echo '</div></div>';

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
  $tName = theme_name($t['extra']);
  $tCell = $tName !== $t['extra'] ? $h($tName) . ' <span class="muted" style="font-size:11px">' . $h($t['extra']) . '</span>' : $h($t['extra']);
  echo '<tr><td>' . $tCell . '</td><td class="num-td">' . (int)$t['c'] . '</td><td style="width:40%"><div class="bar"><i style="width:' . $pct . '%"></i></div></td></tr>';
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
