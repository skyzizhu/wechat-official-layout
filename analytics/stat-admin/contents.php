<?php
/** 后台 · 内容库：作品列表（分页/搜索）+ 详情 + 删除（CSRF 保护） */
require __DIR__ . '/_auth.php';

// 删除（破坏性操作：仅 POST + CSRF）
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delete_id'])) {
  if (!isset($_POST['csrf']) || !hash_equals($CSRF, (string)$_POST['csrf'])) {
    echo '<h3>CSRF 校验失败</h3>'; render_footer(); exit;
  }
  $delId = (int)$_POST['delete_id'];
  if ($delId > 0) {
    $st = $pdo->prepare('DELETE FROM wp_contents WHERE id = ?');
    $st->execute(array($delId));
  }
  header('Location: contents.php?page=1&deleted=' . $delId);
  exit;
}

$viewId = isset($_GET['view']) ? (int)$_GET['view'] : 0;
$page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
$perPage = 20;
$offset = ($page - 1) * $perPage;
$q = isset($_GET['q']) ? trim((string)$_GET['q']) : '';
// 筛选：动作 + 日期范围（全部白名单校验）
$fEvent = isset($_GET['f_event']) ? (string)$_GET['f_event'] : '';
if (!in_array($fEvent, array('copy', 'export_md'), true)) $fEvent = '';
$fFrom = isset($_GET['f_from']) ? (string)$_GET['f_from'] : '';
$fTo = isset($_GET['f_to']) ? (string)$_GET['f_to'] : '';
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fFrom)) $fFrom = '';
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fTo)) $fTo = '';
// 分页/详情跳转需要携带的筛选串
$carry = array();
if ($q !== '') $carry['q'] = $q;
if ($fEvent !== '') $carry['f_event'] = $fEvent;
if ($fFrom !== '') $carry['f_from'] = $fFrom;
if ($fTo !== '') $carry['f_to'] = $fTo;
$carryStr = http_build_query($carry);

if ($viewId > 0) {
  // ---------- 内容详情 ----------
  $st = $pdo->prepare('SELECT * FROM wp_contents WHERE id = ?');
  $st->execute(array($viewId));
  $c = $st->fetch(PDO::FETCH_ASSOC);
  if (!$c) { echo '内容不存在'; render_footer(); exit; }

  render_header('内容详情', 'contents');
  echo '<p><a href="contents.php?page=' . $page . ($carryStr !== '' ? '&' . $carryStr : '') . '">← 返回内容库</a></p>';
  echo '<div class="box"><h2>' . $h($c['title']) . '</h2><table>';
  echo '<tr><td>ID</td><td class="num-td">' . (int)$c['id'] . '</td></tr>';
  echo '<tr><td>动作 / 日期</td><td>' . $h($c['event']) . ' · ' . $h($c['day']) . ' ' . $h($c['created_at']) . '</td></tr>';
  echo '<tr><td>字数</td><td class="num-td">' . (int)$c['char_len'] . '</td></tr>';
  echo '<tr><td>uid / 指纹 / 会话</td><td><code>' . $h($c['uid']) . '</code> / <code>' . $h($c['fp']) . '</code> / <code>' . $h($c['sid']) . '</code>　<a href="users.php?uid=' . $h($c['uid']) . '">该用户详情</a></td></tr>';
  echo '</table></div>';
  echo '<div class="box"><h2>正文</h2><pre class="content">' . $h($c['content']) . '</pre>';
  echo '<form method="post" onsubmit="return confirm(\'确定删除这篇内容？\')">';
  echo '<input type="hidden" name="csrf" value="' . $h($CSRF) . '"><input type="hidden" name="delete_id" value="' . (int)$c['id'] . '">';
  echo '<button class="btn-del">删除这篇内容</button></form></div>';
  render_footer();
  exit;
}

// ---------- 列表（搜索 + 动作/日期筛选，全部参数化）----------
$conds = array();
$params = array();
if ($q !== '') {
  // 搜索：uid 前缀或标题/内容关键词
  $conds[] = '(uid LIKE ? OR title LIKE ? OR content LIKE ?)';
  $like = '%' . $q . '%';
  array_push($params, $like, $like, $like);
}
if ($fEvent !== '') { $conds[] = 'event = ?'; $params[] = $fEvent; }
if ($fFrom !== '') { $conds[] = 'day >= ?'; $params[] = $fFrom; }
if ($fTo !== '') { $conds[] = 'day <= ?'; $params[] = $fTo; }
$where = $conds ? 'WHERE ' . implode(' AND ', $conds) : '';

$stC = $pdo->prepare("SELECT COUNT(*) FROM wp_contents {$where}");
$stC->execute($params);
$total = (int)$stC->fetchColumn();
$totalPages = max(1, (int)ceil($total / $perPage));

$st = $pdo->prepare("SELECT id, day, event, uid, fp, title, char_len FROM wp_contents {$where} ORDER BY id DESC LIMIT " . (int)$perPage . ' OFFSET ' . (int)$offset);
$st->execute($params);
$rows = $st->fetchAll(PDO::FETCH_ASSOC);

render_header('内容库', 'contents');
echo '<div class="box"><h2>作品内容（共 ' . $total . ' 篇）</h2>';
echo '<form method="get" style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">'
  . '<input class="uidq" type="text" name="q" value="' . $h($q) . '" placeholder="按 uid / 标题 / 内容关键词搜索" style="width:240px">'
  . '<select name="f_event" class="uidq"><option value="">全部动作</option>'
  . '<option value="copy"' . ($fEvent === 'copy' ? ' selected' : '') . '>一键复制</option>'
  . '<option value="export_md"' . ($fEvent === 'export_md' ? ' selected' : '') . '>导出 MD</option></select>'
  . '<input class="uidq" type="date" name="f_from" value="' . $h($fFrom) . '">'
  . '<span class="muted">~</span>'
  . '<input class="uidq" type="date" name="f_to" value="' . $h($fTo) . '">'
  . '<button class="q">筛选</button></form>';
echo '<table><tr><th>ID</th><th>日期</th><th>动作</th><th>用户</th><th>标题</th><th>字数</th><th></th></tr>';
foreach ($rows as $r) {
  echo '<tr><td class="num-td">' . (int)$r['id'] . '</td><td>' . $h($r['day']) . '</td><td>' . $h($r['event']) . '</td>'
    . '<td><code>' . $h(substr($r['uid'], 0, 12)) . '…</code></td>'
    . '<td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' . $h($r['title']) . '</td>'
    . '<td class="num-td">' . (int)$r['char_len'] . '</td>'
    . '<td><a href="?view=' . (int)$r['id'] . '&page=' . $page . ($carryStr !== '' ? '&' . $carryStr : '') . '">查看</a></td></tr>';
}
if (!count($rows)) echo '<tr><td colspan="7" class="muted">暂无数据</td></tr>';
echo '</table>';
if ($totalPages > 1) {
  echo '<div class="pager">';
  if ($page > 1) echo '<a href="?page=' . ($page - 1) . ($carryStr !== '' ? '&' . $carryStr : '') . '">上一页</a>';
  echo '第 ' . $page . ' / ' . $totalPages . ' 页';
  if ($page < $totalPages) echo '<a href="?page=' . ($page + 1) . ($carryStr !== '' ? '&' . $carryStr : '') . '">下一页</a>';
  echo '</div>';
}
echo '</div>';
render_footer();
