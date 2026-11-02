<?php
/** 后台 · 用户：按 uid 聚合的访客列表 + 单用户详情（?uid=） */
require __DIR__ . '/_auth.php';

$uidFilter = isset($_GET['uid']) ? substr(preg_replace('/[^a-f0-9]/', '', strtolower((string)$_GET['uid'])), 0, 32) : '';

if ($uidFilter !== '') {
  // ---------- 单用户详情 ----------
  $st = $pdo->prepare("SELECT MIN(day) first_day, MAX(day) last_day, COUNT(*) visits,
    SUM(event='pv') pv, SUM(event='copy') copies, SUM(event='theme') themes, SUM(event='export_md') exports
    FROM wp_visits WHERE uid = ?");
  $st->execute(array($uidFilter));
  $u = $st->fetch(PDO::FETCH_ASSOC);
  if (!$u || (int)$u['visits'] === 0) { echo '用户不存在'; render_footer(); exit; }

  // 指纹集合
  $st = $pdo->prepare('SELECT DISTINCT fp FROM wp_visits WHERE uid = ? AND fp <> ""');
  $st->execute(array($uidFilter));
  $fps = array_map(function ($r) { return $r['fp']; }, $st->fetchAll(PDO::FETCH_ASSOC));

  // 内容
  $st = $pdo->prepare('SELECT id, day, event, title, char_len FROM wp_contents WHERE uid = ? ORDER BY id DESC LIMIT 20');
  $st->execute(array($uidFilter));
  $contents = $st->fetchAll(PDO::FETCH_ASSOC);

  // 最近事件
  $st = $pdo->prepare('SELECT created_at, event, extra, referer <> "" has_ref FROM wp_visits WHERE uid = ? ORDER BY id DESC LIMIT 30');
  $st->execute(array($uidFilter));
  $events = $st->fetchAll(PDO::FETCH_ASSOC);

  render_header('用户详情', 'users');
  echo '<p><a href="users.php">← 返回用户列表</a></p>';
  echo '<div class="cards">';
  echo '<div class="card"><div class="num">' . (int)$u['visits'] . '</div><div class="label">事件总数</div></div>';
  echo '<div class="card"><div class="num">' . (int)$u['pv'] . '</div><div class="label">浏览 PV</div></div>';
  echo '<div class="card"><div class="num">' . (int)$u['copies'] . '</div><div class="label">一键复制</div></div>';
  echo '<div class="card"><div class="num">' . count($contents) . '</div><div class="label">内容篇数（近20）</div></div>';
  echo '</div>';
  echo '<div class="box"><h2>身份</h2><table>';
  echo '<tr><td>uid</td><td><code>' . $h($uidFilter) . '</code></td></tr>';
  echo '<tr><td>指纹</td><td>' . (count($fps) ? implode('<br>', array_map(function ($f) use ($h) { return '<code>' . $h($f) . '</code>'; }, $fps)) : '<span class="muted">无</span>') . '</td></tr>';
  echo '<tr><td>首次 / 最近</td><td>' . $h($u['first_day']) . ' ~ ' . $h($u['last_day']) . '</td></tr>';
  echo '<tr><td>主题切换 / 导出</td><td class="num-td">' . (int)$u['themes'] . ' / ' . (int)$u['exports'] . '</td></tr>';
  echo '</table></div>';

  echo '<div class="box"><h2>内容（最近 20 篇）</h2><table><tr><th>日期</th><th>动作</th><th>标题</th><th>字数</th><th></th></tr>';
  foreach ($contents as $c) {
    echo '<tr><td>' . $h($c['day']) . '</td><td>' . $h($c['event']) . '</td><td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' . $h($c['title']) . '</td><td class="num-td">' . (int)$c['char_len'] . '</td><td><a href="content.php?id=' . (int)$c['id'] . '">查看</a></td></tr>';
  }
  if (!count($contents)) echo '<tr><td colspan="5" class="muted">无内容</td></tr>';
  echo '</table></div>';

  echo '<div class="box"><h2>最近事件（30 条）</h2><table><tr><th>时间</th><th>事件</th><th>附属</th><th>来源</th></tr>';
  foreach ($events as $ev) {
    echo '<tr><td>' . $h($ev['created_at']) . '</td><td>' . $h($ev['event']) . '</td><td>' . $h($ev['extra']) . '</td><td>' . ((int)$ev['has_ref'] === 1 ? '有' : '—') . '</td></tr>';
  }
  echo '</table></div>';

  render_footer();
  exit;
}

// ---------- 用户列表 ----------
$page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
$perPage = 20;
$offset = ($page - 1) * $perPage;

$st = $pdo->query('SELECT COUNT(DISTINCT uid) c FROM wp_visits WHERE uid <> ""');
$totalUsers = (int)$st->fetchColumn();
$totalPages = max(1, (int)ceil($totalUsers / $perPage));

$st = $pdo->prepare("SELECT uid, MAX(fp) fp, COUNT(*) events, SUM(event='pv') pv, SUM(event='copy') copies,
  MIN(day) first_day, MAX(day) last_day
  FROM wp_visits WHERE uid <> '' GROUP BY uid ORDER BY MAX(id) DESC LIMIT " . (int)$perPage . ' OFFSET ' . (int)$offset);
$st->execute();
$users = $st->fetchAll(PDO::FETCH_ASSOC);

render_header('用户', 'users');
echo '<div class="box"><h2>访客（按最近活跃排序，共 ' . $totalUsers . ' 位）</h2><table>';
echo '<tr><th>uid</th><th>指纹</th><th>事件</th><th>PV</th><th>复制</th><th>首次</th><th>最近</th><th></th></tr>';
foreach ($users as $u) {
  echo '<tr><td><code>' . $h(substr($u['uid'], 0, 12)) . '…</code></td>'
    . '<td><code>' . $h($u['fp']) . '</code></td>'
    . '<td class="num-td">' . (int)$u['events'] . '</td><td class="num-td">' . (int)$u['pv'] . '</td><td class="num-td">' . (int)$u['copies'] . '</td>'
    . '<td>' . $h($u['first_day']) . '</td><td>' . $h($u['last_day']) . '</td>'
    . '<td><a href="?uid=' . $h($u['uid']) . '">详情</a></td></tr>';
}
if (!count($users)) echo '<tr><td colspan="8" class="muted">暂无数据</td></tr>';
echo '</table>';
if ($totalPages > 1) {
  echo '<div class="pager">';
  if ($page > 1) echo '<a href="?page=' . ($page - 1) . '">上一页</a>';
  echo '第 ' . $page . ' / ' . $totalPages . ' 页';
  if ($page < $totalPages) echo '<a href="?page=' . ($page + 1) . '">下一页</a>';
  echo '</div>';
}
echo '</div>';
render_footer();
