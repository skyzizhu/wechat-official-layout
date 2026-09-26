<?php
/**
 * AI 转发代理（部署到你的服务器，配合「文排」的 AI 排版功能）
 *
 * 作用：浏览器无法自定义 User-Agent，而 AgentRouter 网关只放行 Agent 客户端。
 * 本脚本在服务端补齐 Agent 特征头（claude-cli UA + x-app: cli）后转发请求。
 *
 * 部署步骤：
 *   1. 将本文件上传到服务器网站目录（建议放到不易被猜到的路径，如 /ai-x7k2.php）
 *   2. 修改下方 AI_API_KEY 为你的 AgentRouter 密钥
 *   3. 修改下方 SHARED_TOKEN 为一个随机字符串（如 openssl rand -hex 16 生成）
 *   4. 在「文排」的 AI 设置中：接口地址填本文件的实际 URL，API Key 填第 3 步的令牌
 *
 * 安全提示：
 *   - SHARED_TOKEN 必须设置，否则任何人都能用你的额度
 *   - 服务器需安装 PHP cURL 扩展（多数环境自带）
 */

// ===== 配置区 =====
const AI_API_KEY   = '在这里填入你的 AgentRouter 密钥';   // sk-Poq 开头
const SHARED_TOKEN = '在这里填入一个随机令牌';            // 与前端 AI 设置中的 API Key 保持一致

const AI_UPSTREAM   = 'https://agentrouter.org/v1/chat/completions';
const AI_USER_AGENT = 'claude-cli/2.1.75 (external, cli)';
const AI_EXTRA_HEADERS = [
    'x-app: cli',
];
// ===================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// 浏览器跨域预检
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => ['message' => 'Method Not Allowed']]);
    exit;
}

// 共享令牌校验：前端 AI 设置中的 API Key 即此令牌
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
$token = preg_replace('/^Bearer\s+/i', '', $auth);
if (SHARED_TOKEN !== '' && !hash_equals(SHARED_TOKEN, $token)) {
    http_response_code(401);
    echo json_encode(['error' => ['message' => 'proxy token invalid']]);
    exit;
}

$body = file_get_contents('php://input');
if ($body === false || trim($body) === '') {
    http_response_code(400);
    echo json_encode(['error' => ['message' => 'empty body']]);
    exit;
}

$ch = curl_init(AI_UPSTREAM);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => array_merge([
        'Content-Type: application/json',
        'Authorization: Bearer ' . AI_API_KEY,
        'User-Agent: ' . AI_USER_AGENT,
    ], AI_EXTRA_HEADERS),
    CURLOPT_POSTFIELDS     => $body,
    CURLOPT_TIMEOUT        => 180,
]);

$response = curl_exec($ch);
$status   = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if ($response === false) {
    http_response_code(502);
    echo json_encode(['error' => ['message' => 'upstream error: ' . curl_error($ch)]]);
    curl_close($ch);
    exit;
}

curl_close($ch);
http_response_code($status);
echo $response;
