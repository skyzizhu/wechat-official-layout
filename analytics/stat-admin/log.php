<?php
/** 后台 · 事件日志：wp_visits 原始事件（分页 + 事件类型筛选） */
require __DIR__ . '/_auth.php';

$page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
$perPage = 30;
$offset = ($page - 1) * $perPage;

$event = isset($_GET['event']) ? (string)$_GET['event'] : '';
$EVENTS = array('pv', 'copy', 'theme', 'export_md');
$where = '';
$params = array();
if (in_array($event, $EVENTS, true)) {
  $where = 'WHERE event = ?';
  $params = array($event);
}

$stC = $pdo->prepare("SELECT COUNT(*) FROM wp_visits {$where}");
$stC->execute($params);
$total = (int)$stC->fetchColumn();
$totalPages = max(1, (int)ceil($total / $perPage));

$st = $pdo->prepare("SELECT id, created_at, event, uid, fp, sid, path, extra, ua, referer <> '' has_ref
  FROM wp_visits {$where} ORDER BY id DESC LIMIT " . (int)$perPage . ' OFFSET ' . (int)$offset);
$st->execute($params);
$rows = $st->fetchAll(PDO::FETCH_ASSOC);

render_header('事件日志', 'log');

$evLinks = '<a class="' . ($event === '' ? 'on' : '') . '" href="?">全部</a> ';
foreach ($EVENTS as $ev) {
  $on = $event === $ev ? 'on' : '';
  $evLinks .= '<a class="' . $on . '" href="?event=' . $ev . '">' . $ev . '</a> ';
}
echo '<div class="box"><h2>原始事件（共 ' . $total . ' 条）</h2><div style="margin-bottom:12px;font-size:13px">' . $evLinks . '</div>';
echo '<table><tr><th>时间</th><th>事件</th><th>用户</th><th>指纹</th><th>会话</th><th>路径/附属</th><th>UA/来源</th></tr>';
foreach ($rows as $r) {
  $uaShort = preg_match('/Mobile|Android|iPhone|iPad/', $r['ua']) ? '📱' : '🖥';
  echo '<tr><td>' . $h($r['created_at']) . '</td><td>' . $h($r['event']) . '</td>'
    . '<td><a href="users.php?uid=' . $h($r['uid']) . '"><code>' . $h(substr($r['uid'], 0, 10)) . '…</code></a></td>'
    . '<td><code>' . $h($r['fp']) . '</code></td><td><code>' . $h($r['sid']) . '</code></td>'
    . '<td>' . $h($r['path']) . ($r['extra'] !== '' ? ' <span class="muted">' . $h($r['extra']) . '</span>' : '') . '</td>'
    . '<td>' . $uaShort . ((int)$r['has_ref'] === 1 ? ' <span class="muted">有来源</span>' : '') . '</td></tr>';
}
if (!count($rows)) echo '<tr><td colspan="7" class="muted">暂无数据</td></tr>';
echo '</table>';
if ($totalPages > 1) {
  echo '<div class="pager">';
  if ($page > 1) echo '<a href="?page=' . ($page - 1) . '&event=' . $h($event) . '">上一页</a>';
  echo '第 ' . $page . ' / ' . $totalPages . ' 页';
  if ($page < $totalPages) echo '<a href="?page=' . ($page + 1) . '&event=' . $h($event) . '">下一页</a>';
  echo '</div>';
}
echo '</div>';
render_footer();
