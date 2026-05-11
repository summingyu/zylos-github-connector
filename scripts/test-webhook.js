#!/usr/bin/env node
/**
 * 测试 GitHub Webhook 签名验证
 *
 * 用于验证签名验证功能是否正常工作
 */

import crypto from 'crypto';
import http from 'http';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3461/webhook';
const SECRET = process.env.SECRET || 'test-webhook-secret';

/**
 * 计算 HMAC-SHA256 签名
 */
function computeSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return 'sha256=' + hmac.digest('hex');
}

/**
 * 发送测试 webhook 请求
 */
function sendWebhook(signature, event = 'push', delivery = 'test-123') {
  const payload = JSON.stringify({
    action: 'test',
    repository: {
      name: 'test-repo',
      owner: { name: 'test-owner' }
    }
  });

  return new Promise((resolve, reject) => {
    const url = new URL(SERVER_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 3461,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'X-GitHub-Event': event,
        'X-GitHub-Delivery': delivery,
        'X-Hub-Signature-256': signature
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * 运行测试
 */
async function runTests() {
  console.log('🧪 GitHub Webhook 签名验证测试\n');
  console.log(`服务器: ${SERVER_URL}`);
  console.log(`Secret: ${SECRET}\n`);

  // 测试 1: 有效签名
  console.log('测试 1: 有效签名');
  const validPayload = JSON.stringify({ test: 'data' });
  const validSignature = computeSignature(validPayload, SECRET);
  try {
    const result = await sendWebhook(validSignature);
    console.log(`✓ 状态码: ${result.statusCode}`);
    console.log(`  响应: ${result.body}`);
    console.log(`  预期: 202 Accepted`);
  } catch (err) {
    console.log(`✗ 错误: ${err.message}`);
  }

  console.log('\n---\n');

  // 测试 2: 无效签名
  console.log('测试 2: 无效签名');
  const invalidSignature = 'sha256=invalid000000000000000000000000000000000000000000000000000000000000';
  try {
    const result = await sendWebhook(invalidSignature);
    console.log(`✓ 状态码: ${result.statusCode}`);
    console.log(`  响应: ${result.body}`);
    console.log(`  预期: 401 Unauthorized`);
  } catch (err) {
    console.log(`✗ 错误: ${err.message}`);
  }

  console.log('\n---\n');

  // 测试 3: 缺少签名头
  console.log('测试 3: 缺少签名头');
  try {
    const result = await sendWebhook('');
    const result2 = await sendWebhook(undefined);
    console.log(`✓ 状态码: ${result2.statusCode}`);
    console.log(`  响应: ${result2.body}`);
    console.log(`  预期: 401 Unauthorized`);
  } catch (err) {
    console.log(`✗ 错误: ${err.message}`);
  }

  console.log('\n---\n');

  // 测试 4: 错误格式的签名（不带 sha256= 前缀）
  console.log('测试 4: 错误格式的签名（不带 sha256= 前缀）');
  const malformedSignature = 'abc123def456';
  try {
    const result = await sendWebhook(malformedSignature);
    console.log(`✓ 状态码: ${result.statusCode}`);
    console.log(`  响应: ${result.body}`);
    console.log(`  预期: 401 Unauthorized`);
  } catch (err) {
    console.log(`✗ 错误: ${err.message}`);
  }

  console.log('\n---\n');

  // 测试 5: 使用错误 secret 的签名
  console.log('测试 5: 使用错误 secret 的签名');
  const wrongSecretPayload = JSON.stringify({ test: 'data' });
  const wrongSignature = computeSignature(wrongSecretPayload, 'wrong-secret');
  try {
    const result = await sendWebhook(wrongSignature);
    console.log(`✓ 状态码: ${result.statusCode}`);
    console.log(`  响应: ${result.body}`);
    console.log(`  预期: 401 Unauthorized`);
  } catch (err) {
    console.log(`✗ 错误: ${err.message}`);
  }

  console.log('\n✅ 测试完成');
}

runTests().catch(console.error);
