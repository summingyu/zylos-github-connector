/**
 * GitHub Webhook 签名验证模块
 *
 * 该模块提供 HMAC-SHA256 签名验证功能，用于验证传入的 GitHub webhook 请求
 * 是否确实来自 GitHub 且未被篡改。
 *
 * 安全注意事项：
 * - 始终使用 timingSafeEqual 进行签名比较，防止时序攻击
 * - 始终验证原始请求体的 HMAC，而非解析后的 JSON
 * - 切勿记录 webhook secret 或完整请求体到日志
 */

import crypto from 'crypto';

/**
 * 计算 HMAC-SHA256 签名
 *
 * @param {Buffer|string} rawBody - 原始请求体（必须是 Buffer 或字符串）
 * @param {string} secret - Webhook secret
 * @returns {string} 带有 'sha256=' 前缀的签名
 *
 * @example
 * const signature = computeHmac(rawBody, 'my-secret');
 * // 返回: 'sha256=abc123def456...'
 */
export function computeHmac(rawBody, secret) {
  if (!Buffer.isBuffer(rawBody)) {
    rawBody = Buffer.from(rawBody);
  }

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  return 'sha256=' + hmac.digest('hex');
}

/**
 * 验证 GitHub webhook 签名
 *
 * 使用常量时间比较来防止时序攻击。如果签名无效或格式错误，
 * 该函数将返回 false。
 *
 * @param {Buffer|string} rawBody - 原始请求体（必须是 Buffer 或字符串）
 * @param {string} signature - 来自 X-Hub-Signature-256 头的签名
 * @param {string} secret - Webhook secret
 * @returns {boolean} 签名是否有效
 *
 * @example
 * const isValid = verifySignature(
 *   req.rawBody,
 *   req.headers['x-hub-signature-256'],
 *   'my-secret'
 * );
 * if (!isValid) {
 *   return reply.code(401).send('Invalid signature');
 * }
 */
export function verifySignature(rawBody, signature, secret) {
  // 检查必需参数
  if (!rawBody || !signature || !secret) {
    return false;
  }

  // 验证签名格式（必须以 sha256= 开头）
  if (!signature.startsWith('sha256=')) {
    return false;
  }

  // 计算期望的签名
  const expectedSignature = computeHmac(rawBody, secret);

  // 使用常量时间比较来防止时序攻击
  // 这比普通的字符串相等比较更安全
  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(signature);

  // 长度不同则直接返回 false
  if (expected.length !== received.length) {
    return false;
  }

  // 常量时间比较
  return crypto.timingSafeEqual(expected, received);
}

/**
 * 从签名头中提取签名值
 *
 * @param {string} signatureHeader - X-Hub-Signature-256 头的值
 * @returns {string|null} 提取的签名值，如果格式无效则返回 null
 *
 * @example
 * const sig = extractSignature('sha256=abc123');
 * // 返回: 'sha256=abc123'
 */
export function extractSignature(signatureHeader) {
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    return null;
  }

  if (!signatureHeader.startsWith('sha256=')) {
    return null;
  }

  return signatureHeader;
}
