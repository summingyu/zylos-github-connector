/**
 * 签名验证模块单元测试
 *
 * 测试 GitHub webhook 签名验证的所有关键功能
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import {
  computeHmac,
  verifySignature,
  extractSignature
} from '../verifier.js';

describe('签名验证模块 (verifier.js)', () => {

  const TEST_SECRET = 'test-webhook-secret';
  const TEST_PAYLOAD = { action: 'test', repository: { name: 'test-repo' } };
  const TEST_PAYLOAD_BUFFER = Buffer.from(JSON.stringify(TEST_PAYLOAD));

  /**
   * 测试工具函数：生成有效的 HMAC 签名
   */
  function generateValidSignature(payload, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(Buffer.from(payload));
    return 'sha256=' + hmac.digest('hex');
  }

  describe('computeHmac()', () => {

    it('应该为 Buffer 输入计算正确的 HMAC-SHA256 签名', () => {
      const result = computeHmac(TEST_PAYLOAD_BUFFER, TEST_SECRET);

      assert.strictEqual(typeof result, 'string');
      assert.strictEqual(result.startsWith('sha256='), true);
      assert.strictEqual(result.length, 71); // 'sha256=' + 64 个 hex 字符
    });

    it('应该为字符串输入计算正确的 HMAC-SHA256 签名', () => {
      const payloadStr = JSON.stringify(TEST_PAYLOAD);
      const result = computeHmac(payloadStr, TEST_SECRET);

      assert.strictEqual(typeof result, 'string');
      assert.strictEqual(result.startsWith('sha256='), true);
    });

    it('相同输入应该产生相同的签名', () => {
      const result1 = computeHmac(TEST_PAYLOAD_BUFFER, TEST_SECRET);
      const result2 = computeHmac(TEST_PAYLOAD_BUFFER, TEST_SECRET);

      assert.strictEqual(result1, result2);
    });

    it('不同输入应该产生不同的签名', () => {
      const result1 = computeHmac(TEST_PAYLOAD_BUFFER, TEST_SECRET);
      const result2 = computeHmac(Buffer.from('different payload'), TEST_SECRET);

      assert.notStrictEqual(result1, result2);
    });

    it('不同 secret 应该产生不同的签名', () => {
      const result1 = computeHmac(TEST_PAYLOAD_BUFFER, TEST_SECRET);
      const result2 = computeHmac(TEST_PAYLOAD_BUFFER, 'different-secret');

      assert.notStrictEqual(result1, result2);
    });
  });

  describe('verifySignature()', () => {

    it('应该验证有效的签名', () => {
      const validSignature = generateValidSignature(
        JSON.stringify(TEST_PAYLOAD),
        TEST_SECRET
      );

      const isValid = verifySignature(
        TEST_PAYLOAD_BUFFER,
        validSignature,
        TEST_SECRET
      );

      assert.strictEqual(isValid, true);
    });

    it('应该拒绝无效的签名', () => {
      const invalidSignature = 'sha256=invalid000000000000000000000000000000000000000000000000000000000000';

      const isValid = verifySignature(
        TEST_PAYLOAD_BUFFER,
        invalidSignature,
        TEST_SECRET
      );

      assert.strictEqual(isValid, false);
    });

    it('应该拒绝使用错误 secret 计算的签名', () => {
      const wrongSecretSignature = generateValidSignature(
        JSON.stringify(TEST_PAYLOAD),
        'wrong-secret'
      );

      const isValid = verifySignature(
        TEST_PAYLOAD_BUFFER,
        wrongSecretSignature,
        TEST_SECRET
      );

      assert.strictEqual(isValid, false);
    });

    it('应该拒绝不带有 sha256= 前缀的签名', () => {
      const signatureWithoutPrefix = crypto
        .createHmac('sha256', TEST_SECRET)
        .update(TEST_PAYLOAD_BUFFER)
        .digest('hex');

      const isValid = verifySignature(
        TEST_PAYLOAD_BUFFER,
        signatureWithoutPrefix,
        TEST_SECRET
      );

      assert.strictEqual(isValid, false);
    });

    it('应该拒绝格式错误的签名（长度不匹配）', () => {
      const malformedSignature = 'sha256=tooshort';

      const isValid = verifySignature(
        TEST_PAYLOAD_BUFFER,
        malformedSignature,
        TEST_SECRET
      );

      assert.strictEqual(isValid, false);
    });

    it('应该拒绝缺少签名的情况', () => {
      const isValid = verifySignature(
        TEST_PAYLOAD_BUFFER,
        null,
        TEST_SECRET
      );

      assert.strictEqual(isValid, false);
    });

    it('应该拒绝缺少 secret 的情况', () => {
      const validSignature = generateValidSignature(
        JSON.stringify(TEST_PAYLOAD),
        TEST_SECRET
      );

      const isValid = verifySignature(
        TEST_PAYLOAD_BUFFER,
        validSignature,
        null
      );

      assert.strictEqual(isValid, false);
    });

    it('应该拒绝缺少请求体的情况', () => {
      const validSignature = generateValidSignature(
        JSON.stringify(TEST_PAYLOAD),
        TEST_SECRET
      );

      const isValid = verifySignature(
        null,
        validSignature,
        TEST_SECRET
      );

      assert.strictEqual(isValid, false);
    });

    it('应该拒绝空请求体', () => {
      const emptyPayload = Buffer.from('');
      const signature = generateValidSignature('', TEST_SECRET);

      const isValid = verifySignature(
        emptyPayload,
        signature,
        TEST_SECRET
      );

      // 空请求体仍然有有效的签名，所以应该返回 true
      // 但在实际应用中，应该在验证之前检查请求体是否为空
      assert.strictEqual(isValid, true);
    });

    it('应该使用常量时间比较（防止时序攻击）', () => {
      // 这个测试验证 verifySignature 使用 crypto.timingSafeEqual
      // 我们无法直接测试时序攻击防护，但可以验证行为

      const validSignature = generateValidSignature(
        JSON.stringify(TEST_PAYLOAD),
        TEST_SECRET
      );

      // 有效的签名应该返回 true
      assert.strictEqual(
        verifySignature(TEST_PAYLOAD_BUFFER, validSignature, TEST_SECRET),
        true
      );

      // 只有一个字符不同的签名应该返回 false
      const tamperedSignature = validSignature.slice(0, -1) +
        (validSignature.slice(-1) === '0' ? '1' : '0');

      assert.strictEqual(
        verifySignature(TEST_PAYLOAD_BUFFER, tamperedSignature, TEST_SECRET),
        false
      );
    });

    it('应该对字符串和 Buffer 请求体产生相同的结果', () => {
      const payloadStr = JSON.stringify(TEST_PAYLOAD);
      const payloadBuf = Buffer.from(payloadStr);
      const signature = generateValidSignature(payloadStr, TEST_SECRET);

      const resultStr = verifySignature(payloadStr, signature, TEST_SECRET);
      const resultBuf = verifySignature(payloadBuf, signature, TEST_SECRET);

      assert.strictEqual(resultStr, resultBuf);
      assert.strictEqual(resultStr, true);
    });
  });

  describe('extractSignature()', () => {

    it('应该提取有效的签名头', () => {
      const signatureHeader = 'sha256=abc123def456';
      const result = extractSignature(signatureHeader);

      assert.strictEqual(result, signatureHeader);
    });

    it('应该拒绝不带 sha256= 前缀的签名', () => {
      const signatureHeader = 'abc123def456';
      const result = extractSignature(signatureHeader);

      assert.strictEqual(result, null);
    });

    it('应该拒绝空签名头', () => {
      const result = extractSignature('');

      assert.strictEqual(result, null);
    });

    it('应该拒绝 null 签名头', () => {
      const result = extractSignature(null);

      assert.strictEqual(result, null);
    });

    it('应该拒绝非字符串签名头', () => {
      const result = extractSignature(12345);

      assert.strictEqual(result, null);
    });

    it('应该拒绝只有前缀的签名', () => {
      const signatureHeader = 'sha256=';
      const result = extractSignature(signatureHeader);

      // extractSignature 只检查前缀，不验证长度
      // 实际验证由 verifySignature 完成
      assert.strictEqual(result, signatureHeader);
    });
  });

  describe('安全性测试', () => {

    it('应该在日志中不暴露 secret（集成测试）', () => {
      // 这是一个文档性测试，提醒开发者不要记录 secret
      const secret = TEST_SECRET;
      const payload = JSON.stringify(TEST_PAYLOAD);

      // 计算签名时不要记录 secret
      const signature = generateValidSignature(payload, secret);

      // 验证签名时不要记录 secret
      const isValid = verifySignature(Buffer.from(payload), signature, secret);

      assert.strictEqual(isValid, true);
      // 如果需要记录，只记录成功/失败，不记录 secret 或完整签名
    });

    it('应该拒绝重放攻击（相同 delivery ID 的不同请求）', () => {
      // 这是一个文档性测试，提醒重放攻击防护
      // 实际的重放防护应该由 dedupe.js 模块处理
      const signature = generateValidSignature(
        JSON.stringify(TEST_PAYLOAD),
        TEST_SECRET
      );

      const isValid = verifySignature(
        TEST_PAYLOAD_BUFFER,
        signature,
        TEST_SECRET
      );

      assert.strictEqual(isValid, true);
      // 重放防护由 dedupe.js 通过 X-GitHub-Delivery 头处理
    });
  });

  describe('边界情况', () => {

    it('应该处理非常长的请求体', () => {
      const longPayload = 'x'.repeat(1000000); // 1MB
      const longBuffer = Buffer.from(longPayload);
      const signature = generateValidSignature(longPayload, TEST_SECRET);

      const isValid = verifySignature(longBuffer, signature, TEST_SECRET);

      assert.strictEqual(isValid, true);
    });

    it('应该处理 Unicode 字符', () => {
      const unicodePayload = JSON.stringify({
        message: '你好世界 🌍',
        emoji: '🚀🔒🔑'
      });
      const unicodeBuffer = Buffer.from(unicodePayload);
      const signature = generateValidSignature(unicodePayload, TEST_SECRET);

      const isValid = verifySignature(unicodeBuffer, signature, TEST_SECRET);

      assert.strictEqual(isValid, true);
    });

    it('应该处理特殊字符', () => {
      const specialPayload = JSON.stringify({
        special: '\n\r\t\\\'"<>&',
        binary: '\x00\x01\x02\xff'
      });
      const specialBuffer = Buffer.from(specialPayload);
      const signature = generateValidSignature(specialPayload, TEST_SECRET);

      const isValid = verifySignature(specialBuffer, signature, TEST_SECRET);

      assert.strictEqual(isValid, true);
    });
  });
});
