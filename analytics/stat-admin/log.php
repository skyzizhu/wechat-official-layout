<?php
/** 后台 · 事件日志：wp_visits 原始事件（分页 + 事件类型/用户/日期筛选 + 计数徽章 + 环境识别） */
require __DIR__ . '/_auth.php';

$page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
$perPage = 30;
$offset = ($page - 1) * $perPage;

$EVENTS = array('pv' => '浏览', 'copy' => '复制', 'theme' => '主题切换', 'export_md' => '导出MD');
$event = isset($_GET['event']) ? (string)$_GET['event'] : '';
if (!array_key_exists($event, $EVENTS)) $event = '';
$hex = function ($v, $max) { return substr(preg_replace('/[^a-f0-9]/', '', strtolower((string)$v)), 0, $max); };
$uid = $hex(isset($_GET['uid']) ? $_GET['uid'] : '', 32);
$fFrom = isset($_GET['f_from']) ? (string)$_GET['f_from'] : '';
$fTo = isset($_GET['f_to']) ? (string)$_GET['f_to'] : '';
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fFrom)) $fFrom = '';
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fTo)) $fTo = '';

// 基础筛选（用户 + 日期；事件计数徽章也基于它）
$conds = array();
$params = array();
if ($uid !== '') { $conds[] = 'uid = ?'; $params[] = $uid; }
if ($fFrom !== '') { $conds[] = 'day >= ?'; $params[] = $fFrom; }
if ($fTo !== '') { $conds[] = 'day <= ?'; $params[] = $fTo; }
$baseWhere = $conds ? 'WHERE ' . implode(' AND ', $conds) : '';

// 各事件类型计数（含「全部」），随用户/日期筛选联动
$counts = array('all' => 0);
$stC = $pdo->prepare("SELECT event, COUNT(*) c FROM wp_visits {$baseWhere} GROUP BY event");
$stC->execute($params);
foreach ($stC->fetchAll(PDO::FETCH_ASSOC) as $r) {
  $counts[$r['event']] = (int)$r['c'];
  $counts['all'] += (int)$r['c'];
}

// 列表（基础筛选 + 事件类型）
$condsList = $conds;
$paramsList = $params;
if ($event !== '') { $condsList[] = 'event = ?'; $paramsList[] = $event; }
$listWhere = $condsList ? 'WHERE ' . implode(' AND ', $condsList) : '';

$stC = $pdo->prepare("SELECT COUNT(*) FROM wp_visits {$listWhere}");
$stC->execute($paramsList);
$total = (int)$stC->fetchColumn();
$totalPages = max(1, (int)ceil($total / $perPage));

$st = $pdo->prepare("SELECT id, created_at, event, uid, fp, sid, path, extra, ua, referer <> '' has_ref
  FROM wp_visits {$listWhere} ORDER BY id DESC LIMIT " . (int)$perPage . ' OFFSET ' . (int)$offset);
$st->execute($paramsList);
$rows = $st->fetchAll(PDO::FETCH_ASSOC);

// 筛选携带串（翻页/徽章链接用，不含 event）
$carry = array();
if ($uid !== '') $carry['uid'] = $uid;
if ($fFrom !== '') $carry['f_from'] = $fFrom;
if ($fTo !== '') $carry['f_to'] = $fTo;
$baseCarry = http_build_query($carry);

render_header('事件日志', 'log');

echo '<div class="box"><h2>原始事件（共 ' . $total . ' 条）</h2>';

// 事件类型徽章（数字随用户/日期筛选联动）
echo '<div style="margin-bottom:10px;font-size:13px"><a class="' . ($event === '' ? 'on' : '') . '" style="' . ($event === '' ? '' : 'background:#fff;border:1px solid #d6d9de;padding:3px 10px;border-radius:6px') . '" href="?' . $baseCarry . '">全部 ' . $counts['all'] . '</a> ';
foreach ($EVENTS as $key => $label) {
  $on = $event === $key;
  $cnt = isset($counts[$key]) ? $counts[$key] : 0;
  echo '<a class="' . ($on ? 'on' : '') . '" style="' . ($on ? '' : 'background:#fff;border:1px solid #d6d9de;padding:3px 10px;border-radius:6px') . '" href="?' . ($baseCarry ? $baseCarry . '&' : '') . 'event=' . $key . '">' . $label . ' ' . $cnt . '</a> ';
}
echo '</div>';

// 用户 + 日期筛选表单
echo '<form method="get" style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">'
  . '<input class="uidq" type="text" name="uid" value="' . $h($uid) . '" placeholder="按 uid 精确筛选" style="width:220px">'
  . '<select name="event" class="uidq"><option value="">全部动作</option>';
foreach ($EVENTS as $key => $label) {
  echo '<option value="' . $key . '"' . ($event === $key ? ' selected' : '') . '>' . $label . '</option>';
}
echo '</select>'
  . '<input class="uidq" type="date" name="f_from" value="' . $h($fFrom) . '">'
  . '<span class="muted">~</span>'
  . '<input class="uidq" type="date" name="f_to" value="' . $h($fTo) . '">'
  . '<button class="q">筛选</button>'
  . ($uid !== '' ? '<a href="users.php?uid=' . $h($uid) . '">该用户详情</a>' : '')
  . '</form>';

echo '<div style="overflow-x:auto"><table style="min-width:760px"><tr><th>时间</th><th>事件</th><th>用户</th><th>指纹</th><th>会话</th><th>路径/附属</th><th>环境</th></tr>';
foreach ($rows as $r) {
  $isWx = stripos($r['ua'], 'MicroMessenger') !== false;
  $isMobile = preg_match('/Mobile|Android|iPhone|iPad/', $r['ua']) === 1;
  $env = $isWx ? '微信·' : '';
  $env .= $isMobile ? '移动' : '桌面';
  $extraHtml = $r['extra'] !== '' ? ' <span class="muted">' . $h($r['event'] === 'copy' ? length_label($r['extra']) : $r['extra']) . '</span>' : '';
  $fpShort = strlen($r['fp']) > 8 ? substr($r['fp'], 0, 8) . '…' : $r['fp'];
  $sidShort = strlen($r['sid']) > 8 ? substr($r['sid'], 0, 8) . '…' : $r['sid'];
  echo '<tr><td>' . $h($r['created_at']) . '</td><td>' . $h($EVENTS[$r['event']] ?? $r['event']) . '</td>'
    . '<td><a href="users.php?uid=' . $h($r['uid']) . '"><code>' . $h(substr($r['uid'], 0, 10)) . '…</code></a></td>'
    . '<td title="' . $h($r['fp']) . '"><code>' . $h($fpShort) . '</code></td>'
    . '<td title="' . $h($r['sid']) . '"><code>' . $h($sidShort) . '</code></td>'
    . '<td>' . $h($r['path']) . $extraHtml . '</td>'
    . '<td style="white-space:nowrap">' . $env . ($r['has_ref'] ? ' <span class="muted">有来源</span>' : '') . '</td></tr>';
}
if (!count($rows)) echo '<tr><td colspan="7" class="muted">当前筛选条件下暂无数据</td></tr>';
echo '</table></div>';
if ($totalPages > 1) {
  $evCarry = ($baseCarry ? $baseCarry . '&' : '') . ($event !== '' ? 'event=' . $event . '&' : '');
  echo '<div class="pager">';
  if ($page > 1) echo '<a href="?page=' . ($page - 1) . '&' . $evCarry . '">上一页</a>';
  echo '第 ' . $page . ' / ' . $totalPages . ' 页';
  if ($page < $totalPages) echo '<a href="?page=' . ($page + 1) . '&' . $evCarry . '">下一页</a>';
  echo '</div>';
}
echo '</div>';
render_footer();
