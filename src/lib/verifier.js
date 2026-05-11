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
 * 该函数不会抛出异常 - 所有错误都通过返回 false 处理。
 *
 * @param {Buffer|string} rawBody - 原始请求体（必须是 Buffer 或字符串）
 * @param {string} signature - 来自 X-Hub-Signature-256 头的签名
 * @param {string} secret - Webhook secret
 * @returns {boolean} 签名是否有效
 * @throws {Error} 如果参数类型无效或 HMAC 计算失败
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
  // 参数类型验证（会抛出异常）
  if (rawBody !== null && rawBody !== undefined && typeof rawBody !== 'string' && !Buffer.isBuffer(rawBody)) {
    throw new Error('rawBody must be a string or Buffer');
  }

  if (signature !== null && signature !== undefined && typeof signature !== 'string') {
    throw new Error('signature must be a string');
  }

  if (secret !== null && secret !== undefined && typeof secret !== 'string') {
    throw new Error('secret must be a string');
  }

  // 检查必需参数（返回 false，不抛出异常）
  if (!rawBody || !signature || !secret) {
    return false;
  }

  // 检查 secret 是否为空字符串
  if (secret === '') {
    return false;
  }

  // 验证签名格式（必须以 sha256= 开头）
  if (!signature.startsWith('sha256=')) {
    return false;
  }

  // 计算期望的签名（可能抛出异常）
  let expectedSignature;
  try {
    expectedSignature = computeHmac(rawBody, secret);
  } catch (err) {
    throw new Error(`HMAC computation failed: ${err.message}`);
  }

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

/**
 * 获取签名验证的调试信息（不包含敏感数据）
 *
 * 用于日志记录和调试，不会暴露 webhook secret 或签名内容。
 *
 * @param {Buffer|string} rawBody - 原始请求体
 * @param {string} signature - 签名头
 * @param {string} secret - Webhook secret（仅用于检查存在性）
 * @returns {Object} 调试信息对象
 *
 * @example
 * const debugInfo = getSignatureDebugInfo(rawBody, signature, secret);
 * console.log('Signature debug:', debugInfo);
 * // 输出: { bodySize: 1234, signaturePresent: true, signatureLength: 71, ... }
 */
export function getSignatureDebugInfo(rawBody, signature, secret) {
  return {
    bodySize: rawBody ? (Buffer.isBuffer(rawBody) ? rawBody.length : Buffer.byteLength(rawBody)) : 0,
    signaturePresent: !!signature,
    signatureLength: signature ? signature.length : 0,
    signatureFormat: signature ? (signature.startsWith('sha256=') ? 'sha256' : 'unknown') : 'missing',
    secretPresent: !!secret,
    secretLength: secret ? secret.length : 0,
    expectedSignatureLength: 71 // 'sha256=' + 64 hex chars
  };
}
