#!/usr/bin/env node
/**
 * GitHub Webhook 签名验证集成测试
 *
 * 该脚本发送各种测试请求来验证签名验证功能
 *
 * 使用方法:
 *   SERVER_URL=http://localhost:3461/webhook SECRET=my-secret node scripts/test-webhook.js
 */

import {
  GITHUB_EVENTS,
  generateTestPayload,
  computeSignature,
  generateDeliveryId,
  sendRequest,
  TestResults,
  formatTestCaseName,
  assertStatusCode
} from './lib/test-helpers.js';

// 从环境变量读取配置
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3461/webhook';
const SECRET = process.env.SECRET || 'test-webhook-secret';

// 创建测试结果汇总器
const results = new TestResults();

/**
 * 发送测试请求并验证响应
 */
async function testRequest(testName, requestConfig, expectedStatusCode, description = '') {
  console.log(`\n${testName}`);
  console.log(`预期状态码: ${expectedStatusCode}`);

  try {
    const response = await sendRequest(requestConfig);

    console.log(`实际状态码: ${response.statusCode}`);
    console.log(`响应体: ${response.body || '(空)'}`);

    const passed = response.statusCode === expectedStatusCode;
    results.add(
      testName,
      passed,
      passed ? description : `预期 ${expectedStatusCode}, 实际 ${response.statusCode}`
    );

    return response;
  } catch (error) {
    console.log(`✗ 请求失败: ${error.message}`);
    results.add(testName, false, `请求异常: ${error.message}`);
    return null;
  }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     GitHub Webhook 签名验证集成测试                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n配置:`);
  console.log(`  服务器: ${SERVER_URL}`);
  console.log(`  Secret: ${SECRET}`);
  console.log(`  时间: ${new Date().toISOString()}`);

  // ========================================
  // 测试组 1: 有效签名测试
  // ========================================
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('测试组 1: 有效签名测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 测试 1.1: 基本的有效签名
  const validPayload = generateTestPayload(GITHUB_EVENTS.PUSH);
  const validPayloadStr = JSON.stringify(validPayload);
  const validSignature = computeSignature(validPayloadStr, SECRET);

  await testRequest(
    formatTestCaseName('有效签名', '基本的 PUSH 事件'),
    {
      url: SERVER_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': GITHUB_EVENTS.PUSH,
        'X-GitHub-Delivery': generateDeliveryId('valid'),
        'X-Hub-Signature-256': validSignature
      },
      body: validPayloadStr
    },
    202,
    '服务器应该接受有效的签名'
  );

  // 测试 1.2: 不同的 GitHub 事件类型
  for (const eventType of [GITHUB_EVENTS.PULL_REQUEST, GITHUB_EVENTS.ISSUES, GITHUB_EVENTS.PING]) {
    const payload = generateTestPayload(eventType);
    const payloadStr = JSON.stringify(payload);
    const signature = computeSignature(payloadStr, SECRET);

    await testRequest(
      formatTestCaseName('有效签名', `${eventType} 事件`),
      {
        url: SERVER_URL,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': eventType,
          'X-GitHub-Delivery': generateDeliveryId('event'),
          'X-Hub-Signature-256': signature
        },
        body: payloadStr
      },
      202,
      '服务器应该接受有效的事件类型'
    );
  }

  // ========================================
  // 测试组 2: 无效签名测试
  // ========================================
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('测试组 2: 无效签名测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 测试 2.1: 完全无效的签名
  await testRequest(
    formatTestCaseName('无效签名', '随机签名值'),
    {
      url: SERVER_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': GITHUB_EVENTS.PUSH,
        'X-GitHub-Delivery': generateDeliveryId('invalid'),
        'X-Hub-Signature-256': 'sha256=invalid000000000000000000000000000000000000000000000000000000000000'
      },
      body: JSON.stringify(generateTestPayload())
    },
    401,
    '服务器应该拒绝无效的签名'
  );

  // 测试 2.2: 使用错误 secret 的签名
  const wrongSecretPayload = generateTestPayload();
  const wrongSignature = computeSignature(
    JSON.stringify(wrongSecretPayload),
    'wrong-secret'
  );

  await testRequest(
    formatTestCaseName('无效签名', '使用错误 secret'),
    {
      url: SERVER_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': GITHUB_EVENTS.PUSH,
        'X-GitHub-Delivery': generateDeliveryId('wrong-secret'),
        'X-Hub-Signature-256': wrongSignature
      },
      body: JSON.stringify(wrongSecretPayload)
    },
    401,
    '服务器应该拒绝使用错误 secret 的签名'
  );

  // 测试 2.3: 篡改的负载（签名与负载不匹配）
  const tamperedPayload = generateTestPayload();
  const tamperedPayloadStr = JSON.stringify(tamperedPayload);
  const originalSignature = computeSignature(tamperedPayloadStr, SECRET);
  tamperedPayload.action = 'tampered'; // 篡改负载

  await testRequest(
    formatTestCaseName('无效签名', '篡改的负载'),
    {
      url: SERVER_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': GITHUB_EVENTS.PUSH,
        'X-GitHub-Delivery': generateDeliveryId('tampered'),
        'X-Hub-Signature-256': originalSignature
      },
      body: JSON.stringify(tamperedPayload)
    },
    401,
    '服务器应该检测到负载被篡改'
  );

  // ========================================
  // 测试组 3: 格式错误测试
  // ========================================
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('测试组 3: 格式错误测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 测试 3.1: 缺少签名头
  await testRequest(
    formatTestCaseName('格式错误', '缺少签名头'),
    {
      url: SERVER_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': GITHUB_EVENTS.PUSH,
        'X-GitHub-Delivery': generateDeliveryId('no-sig')
        // 故意缺少 X-Hub-Signature-256
      },
      body: JSON.stringify(generateTestPayload())
    },
    401,
    '服务器应该拒绝缺少签名头的请求'
  );

  // 测试 3.2: 空签名头
  await testRequest(
    formatTestCaseName('格式错误', '空签名头'),
    {
      url: SERVER_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': GITHUB_EVENTS.PUSH,
        'X-GitHub-Delivery': generateDeliveryId('empty-sig'),
        'X-Hub-Signature-256': ''
      },
      body: JSON.stringify(generateTestPayload())
    },
    401,
    '服务器应该拒绝空签名头'
  );

  // 测试 3.3: 没有 sha256= 前缀的签名
  await testRequest(
    formatTestCaseName('格式错误', '缺少 sha256= 前缀'),
    {
      url: SERVER_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': GITHUB_EVENTS.PUSH,
        'X-GitHub-Delivery': generateDeliveryId('no-prefix'),
        'X-Hub-Signature-256': 'abc123def4567890123456789012345678901234567890123456789012345678'
      },
      body: JSON.stringify(generateTestPayload())
    },
    401,
    '服务器应该拒绝没有 sha256= 前缀的签名'
  );

  // 测试 3.4: 长度不正确的签名
  await testRequest(
    formatTestCaseName('格式错误', '长度不正确的签名'),
    {
      url: SERVER_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': GITHUB_EVENTS.PUSH,
        'X-GitHub-Delivery': generateDeliveryId('bad-length'),
        'X-Hub-Signature-256': 'sha256=tooshort'
      },
      body: JSON.stringify(generateTestPayload())
    },
    401,
    '服务器应该拒绝长度不正确的签名'
  );

  // ========================================
  // 测试组 4: 边界情况测试
  // ========================================
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('测试组 4: 边界情况测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 测试 4.1: 空负载
  const emptyPayload = '';
  const emptySignature = computeSignature(emptyPayload, SECRET);

  await testRequest(
    formatTestCaseName('边界情况', '空负载'),
    {
      url: SERVER_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': GITHUB_EVENTS.PING,
        'X-GitHub-Delivery': generateDeliveryId('empty'),
        'X-Hub-Signature-256': emptySignature
      },
      body: emptyPayload
    },
    202,
    '服务器应该接受空负载（如果签名有效）'
  );

  // 测试 4.2: 大负载
  const largePayload = {
    ...generateTestPayload(),
    largeField: 'x'.repeat(100000) // 100KB 数据
  };
  const largeSignature = computeSignature(JSON.stringify(largePayload), SECRET);

  await testRequest(
    formatTestCaseName('边界情况', '大负载 (100KB+)'),
    {
      url: SERVER_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': GITHUB_EVENTS.PUSH,
        'X-GitHub-Delivery': generateDeliveryId('large'),
        'X-Hub-Signature-256': largeSignature
      },
      body: JSON.stringify(largePayload)
    },
    202,
    '服务器应该处理大负载'
  );

  // 测试 4.3: Unicode 字符
  const unicodePayload = generateTestPayload(GITHUB_EVENTS.ISSUES, {
    title: '测试标题 🧪',
    body: '这是中文和 emoji 的测试 🚀🔒🔑'
  });
  const unicodeSignature = computeSignature(JSON.stringify(unicodePayload), SECRET);

  await testRequest(
    formatTestCaseName('边界情况', 'Unicode 字符'),
    {
      url: SERVER_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': GITHUB_EVENTS.ISSUES,
        'X-GitHub-Delivery': generateDeliveryId('unicode'),
        'X-Hub-Signature-256': unicodeSignature
      },
      body: JSON.stringify(unicodePayload)
    },
    202,
    '服务器应该正确处理 Unicode 字符'
  );

  // ========================================
  // 测试组 5: HTTP 方法测试
  // ========================================
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('测试组 5: HTTP 方法测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 测试 5.1: GET 请求（应该返回 404 或 405）
  await testRequest(
    formatTestCaseName('HTTP 方法', 'GET 请求'),
    {
      url: SERVER_URL,
      method: 'GET',
      headers: {},
      body: ''
    },
    404,
    '服务器应该拒绝 GET 请求'
  );

  // 测试 5.2: PUT 请求（应该返回 404 或 405）
  await testRequest(
    formatTestCaseName('HTTP 方法', 'PUT 请求'),
    {
      url: SERVER_URL,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(generateTestPayload())
    },
    404,
    '服务器应该拒绝 PUT 请求'
  );

  // ========================================
  // 打印测试结果汇总
  // ========================================
  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                     测试结果汇总                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  results.print();

  // 返回适当的退出码
  process.exit(results.getExitCode());
}

// 运行测试
runAllTests().catch((error) => {
  console.error('\n❌ 测试执行失败:', error);
  process.exit(1);
});
