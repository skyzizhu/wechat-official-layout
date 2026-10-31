<?php
/** 后台 · 增长/留存：新增用户、活跃（DAU/WAU/MAU）、周级留存 cohort 表 */
require __DIR__ . '/_auth.php';

$today = date('Y-m-d');

// ---------- 身份底表：uid => 首次访问日（新用户的「出生日期」）----------
$firstRows = $pdo->query("SELECT uid, MIN(day) fd FROM wp_visits WHERE event = 'pv' GROUP BY uid")->fetchAll(PDO::FETCH_ASSOC);
$firstDay = array();
$totalUsers = count($firstRows);
foreach ($firstRows as $r) $firstDay[$r['uid']] = $r['fd'];

// ---------- 活跃底表：近 60 天 uid => 活跃日集合 ----------
$since = date('Y-m-d', strtotime('-60 days'));
$st = $pdo->prepare("SELECT uid, GROUP_CONCAT(DISTINCT day) days FROM wp_visits
  WHERE event = 'pv' AND day >= ? GROUP BY uid");
$st->execute(array($since));
$activeDays = array();
foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
  $activeDays[$r['uid']] = explode(',', $r['days']);
}

// ---------- 活跃指标 ----------
$countActive = function ($days) use ($activeDays, $today) {
  $min = date('Y-m-d', strtotime("-{$days} days"));
  $c = 0;
  foreach ($activeDays as $days2) {
    foreach ($days2 as $d) { if ($d >= $min && $d <= $today) { $c++; break; } }
  }
  return $c;
};
$dau = $countActive(0); // 今日活跃（日历当天）
$wau = $countActive(7);
$mau = $countActive(30);
$newToday = 0; $newThisWeek = 0;
$weekStart = date('Y-m-d', strtotime('monday this week'));
foreach ($firstDay as $fd) {
  if ($fd === $today) $newToday++;
  if ($fd >= $weekStart) $newThisWeek++;
}

// ---------- 每日新增 + 新增占 DAU 比例（近 30 天）----------
$st = $pdo->prepare("SELECT day, COUNT(DISTINCT uid) dau FROM wp_visits
  WHERE event = 'pv' AND day >= ? GROUP BY day ORDER BY day DESC");
$st->execute(array(date('Y-m-d', strtotime('-30 days'))));
$daily = $st->fetchAll(PDO::FETCH_ASSOC);
$newPerDay = array();
foreach ($firstDay as $fd) { $newPerDay[$fd] = ($newPerDay[$fd] ?? 0) + 1; }

// ---------- 周级留存 cohort（最近 6 周，W1~W4 回访率）----------
// 分群：按首次访问所在周的周一起始
$cohorts = array(); // weekStart => array('label', 'users'=>[uid,...])
foreach ($firstRows as $r) {
  $ws = date('Y-m-d', strtotime('monday this week', strtotime($r['fd'])));
  if (!isset($cohorts[$ws])) $cohorts[$ws] = array();
  $cohorts[$ws][] = $r['uid'];
}
krsort($cohorts);
$cohorts = array_slice($cohorts, 0, 6, true); // 最近 6 个分群

// 回访判定：该 uid 的活跃日落在对应偏移周内
$retention = array(); // weekStart => [new, w1..w4 counts]
foreach ($cohorts as $ws => $uids) {
  $row = array('new' => count(array_unique($uids)));
  for ($k = 1; $k <= 4; $k++) {
    $wsStart = date('Y-m-d', strtotime($ws . " +" . ($k * 7) . " days"));
    $wsEnd = date('Y-m-d', strtotime($wsStart . ' +6 days'));
    $c = 0;
    foreach ($uids as $u) {
      $days = isset($activeDays[$u]) ? $activeDays[$u] : array();
      foreach ($days as $d) { if ($d >= $wsStart && $d <= $wsEnd) { $c++; break; } }
    }
    $row['w' . $k] = $c;
  }
  $retention[$ws] = $row;
}

$h = $GLOBALS['h'];
render_header('增长/留存', 'growth');

echo '<div class="cards">';
echo '<div class="card"><div class="num">' . $totalUsers . '</div><div class="label">总用户数</div><div class="sub">按首次访问去重</div></div>';
echo '<div class="card"><div class="num">' . $newToday . '</div><div class="label">今日新增</div></div>';
echo '<div class="card"><div class="num">' . $newThisWeek . '</div><div class="label">本周新增</div></div>';
echo '<div class="card"><div class="num">' . $dau . '</div><div class="label">今日活跃 DAU</div></div>';
echo '<div class="card"><div class="num">' . $wau . '</div><div class="label">周活 WAU</div><div class="sub">滚动 7 天去重</div></div>';
echo '<div class="card"><div class="num">' . $mau . '</div><div class="label">月活 MAU</div><div class="sub">滚动 30 天去重</div></div>';
echo '</div>';

echo '<div class="box"><h2>每日新增用户（近 30 天，新增占当日 DAU 比例）</h2><table><tr><th>日期</th><th>新增用户</th><th>当日 DAU</th><th>新增占比</th></tr>';
foreach ($daily as $r) {
  $d = $r['day'];
  $n = isset($newPerDay[$d]) ? $newPerDay[$d] : 0;
  $dauN = (int)$r['dau'];
  $pct = $dauN > 0 ? round(100 * $n / $dauN, 1) : 0;
  echo '<tr><td>' . $h($d) . '</td><td class="num-td">' . $n . '</td><td class="num-td">' . $dauN . '</td><td class="num-td">' . $pct . '%</td></tr>';
}
if (!count($daily)) echo '<tr><td colspan="4" class="muted">暂无数据</td></tr>';
echo '</table></div>';

echo '<div class="box"><h2>周级留存（按首次访问周分群，W1~W4 = 之后第 1~4 周回访率）</h2>';
echo '<table><tr><th>分群周</th><th>新增用户</th><th>W1</th><th>W2</th><th>W3</th><th>W4</th></tr>';
foreach ($retention as $ws => $row) {
  // 未走完的观察周显示「—」（尚未到期，不是 0%）
  $cells = '';
  for ($k = 1; $k <= 4; $k++) {
    $wEnd = date('Y-m-d', strtotime($ws . ' +' . ($k * 7 + 6) . ' days'));
    if (strtotime($wEnd) > time()) { $cells .= '<td class="muted">—</td>'; continue; }
    $pct = $row['new'] > 0 ? round(100 * $row['w' . $k] / $row['new'], 1) : 0;
    $cells .= '<td class="num-td">' . $pct . '% <span class="muted">(' . $row['w' . $k] . ')</span></td>';
  }
  echo '<tr><td>' . $h($ws) . ' 那周</td><td class="num-td">' . $row['new'] . '</td>' . $cells . '</tr>';
}
if (!count($retention)) echo '<tr><td colspan="6" class="muted">暂无数据</td></tr>';
echo '</table><p class="muted" style="font-size:12px;margin:10px 0 0">留存只统计最近 60 天内的活跃记录；括号内为回访人数。</p></div>';

render_footer();
