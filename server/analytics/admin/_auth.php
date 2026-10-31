<?php
/**
 * 后台公共入口：session 登录门、数据库连接、页面骨架。
 * 所有后台页面第一行 require 本文件。
 */

date_default_timezone_set('Asia/Shanghai');
session_name('wpstat'); // 必须在 session_start 之前
session_start();
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Content-Type: text/html; charset=utf-8');

$config = @include __DIR__ . '/../config.php';
if (!is_array($config) || empty($config['admin_hash'])) {
  echo '<h3>后台未配置：请先复制 config.example.php 为 config.php 并填写 admin_hash（用 hashgen.php 生成）。</h3>';
  exit;
}

// CSRF 令牌（会话级，供删除等破坏性操作校验）
if (empty($_SESSION['wpstat_csrf'])) {
  $_SESSION['wpstat_csrf'] = bin2hex(random_bytes(16));
}
$CSRF = $_SESSION['wpstat_csrf'];

// ---------- 登录门 ----------
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

if (isset($_GET['logout'])) { session_destroy(); header('Location: ./'); exit; }

// ---------- 数据库 ----------
try {
  $db = $config['db'];
  $pdo = new PDO(
    "mysql:host={$db['host']};dbname={$db['dbname']};charset={$db['charset']}",
    $db['user'],
    $db['pass'],
    array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION)
  );
} catch (PDOException $ex) { echo '<h3>数据库连接失败</h3>'; exit; }

// ---------- 公共助手 ----------
$h = function ($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); };

/** 页面骨架头部（$active: index/users/contents/log） */
function render_header($title, $active) {
  $h = $GLOBALS['h'];
  $CSRF = $GLOBALS['CSRF'];
  $nav = array(
    'index' => array('index.php', '概览'),
    'users' => array('users.php', '用户'),
    'contents' => array('contents.php', '内容库'),
    'log' => array('log.php', '事件日志'),
  );
  $navHtml = '';
  foreach ($nav as $key => $item) {
    $on = $key === $active ? ' class="on"' : '';
    $navHtml .= '<a' . $on . ' href="' . $item[0] . '">' . $item[1] . '</a>';
  }
  echo <<<HTML
<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>{$title} · 文排统计后台</title>
<style>
body{font-family:system-ui,"PingFang SC","Microsoft YaHei",sans-serif;background:#f6f7f9;margin:0;color:#1f2328}
.wrap{max-width:1020px;margin:0 auto;padding:24px 16px}
header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px}
h1{font-size:20px;margin:0}a{color:#2563eb;text-decoration:none}
nav a{margin-right:14px;padding:4px 12px;border-radius:6px;background:#fff;border:1px solid #d6d9de;font-size:13px}
nav a.on{background:#2563eb;color:#fff;border-color:#2563eb}
.ranges a{margin-left:8px;padding:3px 10px;border-radius:6px;background:#fff;border:1px solid #d6d9de;font-size:13px}
.ranges a.on{background:#2563eb;color:#fff;border-color:#2563eb}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px}
.card{background:#fff;border-radius:10px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.num{font-size:26px;font-weight:700}.label{font-size:13px;color:#6b7280;margin-top:2px}.sub{font-size:12px;color:#9ca3af;margin-top:2px}
.box{background:#fff;border-radius:10px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.06);margin-bottom:20px}
.box h2{font-size:15px;margin:0 0 12px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:7px 8px;border-bottom:1px solid #eef0f2;vertical-align:top}
th{color:#6b7280;font-weight:500}.num-td{text-align:right;font-variant-numeric:tabular-nums}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:640px){.two{grid-template-columns:1fr}}
.bar{height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden;margin-top:4px}
.bar i{display:block;height:100%;background:#2563eb}
.muted{color:#9ca3af}.btn-del{background:#c0392b;color:#fff;border:0;border-radius:6px;padding:5px 12px;font-size:13px;cursor:pointer}
pre.content{white-space:pre-wrap;word-break:break-word;background:#fafafa;border:1px solid #eef0f2;border-radius:8px;padding:14px;font-size:13px;max-height:60vh;overflow:auto}
.pager{margin-top:12px;font-size:13px}.pager a{margin-right:10px}
input.day,input.uidq{padding:4px 8px;border:1px solid #d6d9de;border-radius:6px;font-size:13px}
button.q{padding:5px 12px;border:0;border-radius:6px;background:#2563eb;color:#fff;font-size:13px;cursor:pointer}
</style></head><body><div class="wrap">
<header><h1>📊 文排统计后台</h1><nav>{$navHtml}<a href="?logout=1">退出</a></nav></header>
HTML;
}

function render_footer() { echo '</div></body></html>'; }
