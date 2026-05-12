#!/usr/bin/env node
/**
 * zylos-github-connector
 *
 * GitHub Webhook connector for Zylos AI Agent Platform
 */

import fastify from 'fastify';
import helmet from '@fastify/helmet';
import { getConfig, watchConfig, DATA_DIR, DEFAULT_CONFIG } from './lib/config.js';
import { verifySignature } from './lib/verifier.js';
import { hasDeliveryBeenSeen, markDeliveryAsSeen, seenDeliveries } from './lib/dedupe.js';
import {
  registerHandler,
  registerWildcardHandler,
  routeEvent
} from './lib/router.js';
import { extractEventMetadata } from './lib/event-parser.js';
import * as handlers from './lib/handlers/index.js';

// Initialize
console.log(`[github-connector] Starting...`);
console.log(`[github-connector] Data directory: ${DATA_DIR}`);

// Load configuration
let config = getConfig();
console.log(`[github-connector] Config loaded, enabled: ${config.enabled}`);

if (!config.enabled) {
  console.log(`[github-connector] Component disabled in config, exiting.`);
  process.exit(0);
}

// Update default config to include port, logging, and max payload size
DEFAULT_CONFIG.port = 3461;
DEFAULT_CONFIG.maxPayloadSize = '10mb';
DEFAULT_CONFIG.logging = {
  level: 'info',
  pretty: true
};

// Create Fastify instance with logger and body limit
// Convert string size (e.g., '10mb') to bytes
const maxPayloadSizeStr = config.maxPayloadSize || '10mb';
const parseSize = (size) => {
  if (typeof size === 'number') return size;
  const units = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
  const match = String(size).toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?$/);
  if (!match) return 10 * 1024 * 1024; // Default 10MB
  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';
  return Math.floor(value * (units[unit] || 1));
};
const maxPayloadSize = parseSize(maxPayloadSizeStr);

const fastifyOptions = {
  logger: {
    level: config.logging?.level || 'info',
    transport: config.logging?.pretty !== false
      ? { target: 'pino-pretty' }
      : undefined
  },
  bodyLimit: maxPayloadSize
};

const app = fastify(fastifyOptions);

// Register Helmet for security headers
await app.register(helmet);

// Register raw body parser for HMAC signature verification (critical for Phase 2)
app.addContentTypeParser('application/json', { parseAs: 'buffer' },
  (req, body, done) => {
    // Preserve raw body for HMAC verification in Phase 2
    req.rawBody = body;
    done(null, JSON.parse(body));
  }
);

// Watch for config changes
watchConfig((newConfig) => {
  app.log.info(`[github-connector] Config reloaded`);
  config = newConfig;
  if (!newConfig.enabled) {
    app.log.info(`[github-connector] Component disabled, stopping...`);
    shutdown();
  }
});

// Register event handlers (Phase 3)
registerHandler('push', handlers.handlePush);
registerHandler('issues', handlers.handleIssues);
registerHandler('issue_comment', handlers.handleIssueComment);
registerHandler('pull_request', handlers.handlePullRequest);
registerHandler('release', handlers.handleRelease);
registerWildcardHandler(handlers.handleUnsupported);

app.log.info('[github-connector] Event handlers registered');

// 定期清理旧的去重条目（WR-02 修复）
// 每 5 分钟清理一次超过 1 小时的条目，防止内存泄漏
const DEDUPE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 分钟
const DEDUPE_MAX_AGE = 60 * 60 * 1000; // 1 小时

const dedupeCleanupInterval = setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [id, timestamp] of seenDeliveries.entries()) {
    if (now - timestamp > DEDUPE_MAX_AGE) {
      seenDeliveries.delete(id);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    app.log.info({
      msg: 'Dedupe cleanup completed',
      cleanedCount,
      remainingCount: seenDeliveries.size
    });
  }
}, DEDUPE_CLEANUP_INTERVAL);

// 在关闭时清除清理定时器
process.on('beforeExit', () => {
  clearInterval(dedupeCleanupInterval);
});

// Health check route
app.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    service: 'github-connector',
    timestamp: new Date().toISOString()
  };
});

// Webhook receiving route
app.post('/webhook', async (request, reply) => {
  const signature = request.headers['x-hub-signature-256'];
  const metadata = extractEventMetadata(request.headers);
  const eventType = metadata.eventType;
  const deliveryId = metadata.deliveryId;

  // 检查配置中的 webhook secret
  if (!config.webhookSecret || config.webhookSecret === '') {
    app.log.error({
      msg: 'Webhook signature verification failed - secret not configured',
      event: eventType,
      delivery: deliveryId,
      hint: 'Set webhookSecret in config.json or GITHUB_WEBHOOK_SECRET environment variable'
    });
    return reply.code(500).send({
      error: 'Server configuration error',
      message: 'Webhook secret not configured'
    });
  }

  // 调试级别日志（仅开发模式）
  if (app.log.level === 'debug') {
    app.log.debug({
      msg: 'Webhook request received',
      event: eventType,
      delivery: deliveryId,
      signaturePresent: !!signature,
      signatureLength: signature ? signature.length : 0,
      bodySize: request.rawBody ? request.rawBody.length : 0,
      contentType: request.headers['content-type']
    });
  }

  // 验证签名（安全关键：必须在处理前验证）
  let isValid = false;
  let verificationError = null;

  try {
    isValid = verifySignature(request.rawBody, signature, config.webhookSecret);
  } catch (err) {
    verificationError = err.message;
    app.log.error({
      msg: 'Signature verification threw an exception',
      event: eventType,
      delivery: deliveryId,
      error: verificationError,
      signaturePresent: !!signature,
      bodySize: request.rawBody ? request.rawBody.length : 0
    });
    return reply.code(500).send({
      error: 'Verification error',
      message: 'Failed to verify webhook signature'
    });
  }

  // 处理验证失败
  if (!isValid) {
    app.log.warn({
      msg: 'Invalid webhook signature',
      event: eventType,
      delivery: deliveryId,
      signaturePresent: !!signature,
      signatureFormat: signature ? (signature.startsWith('sha256=') ? 'valid' : 'invalid') : 'missing'
    });

    // 调试级别的额外信息（不包含敏感数据）
    if (app.log.level === 'debug') {
      app.log.debug({
        msg: 'Signature verification failed - debug info',
        event: eventType,
        delivery: deliveryId,
        expectedSignatureLength: 71, // 'sha256=' + 64 hex chars
        receivedSignatureLength: signature ? signature.length : 0,
        bodySize: request.rawBody ? request.rawBody.length : 0
      });
    }

    return reply.code(401).send({ error: 'Invalid signature' });
  }

  // 签名验证成功，继续处理
  app.log.info({
    msg: 'Webhook verified and accepted',
    event: eventType,
    delivery: deliveryId
  });

  // 去重检查 - 防止重复处理相同的 delivery ID
  if (hasDeliveryBeenSeen(deliveryId)) {
    app.log.info({
      msg: 'Duplicate delivery ID, skipping processing',
      event: eventType,
      delivery: deliveryId
    });
    return reply.code(200).send({
      message: 'Duplicate, already processed',
      event: eventType,
      delivery: deliveryId
    });
  }

  // 标记为已处理
  markDeliveryAsSeen(deliveryId);

  // 解析 JSON 负载 (已被 Fastify 解析为 request.body)
  let payload;
  try {
    payload = request.body;

    // 调试级别日志（仅开发模式）
    if (app.log.level === 'debug') {
      app.log.debug({
        msg: 'Webhook payload parsed',
        event: eventType,
        delivery: deliveryId,
        payloadKeys: Object.keys(payload)
      });
    }
  } catch (err) {
    app.log.error({
      msg: 'Failed to parse webhook payload',
      event: eventType,
      delivery: deliveryId,
      error: err.message
    });
    return reply.code(400).send({ error: 'Invalid JSON payload' });
  }

  // 路由事件到处理程序
  try {
    const startTime = Date.now();
    const routeResult = await routeEvent(eventType, payload);
    const duration = Date.now() - startTime;

    // 记录路由结果
    app.log.info({
      msg: 'Event routed to handler',
      event: eventType,
      delivery: deliveryId,
      handled: routeResult.handled,
      duration: `${duration}ms`
    });

    return reply.code(202).send({
      message: 'Event processed',
      event: eventType,
      delivery: deliveryId,
      handled: routeResult.handled
    });
  } catch (err) {
    app.log.error({
      msg: 'Handler error',
      event: eventType,
      delivery: deliveryId,
      error: err.message
    });
    return reply.code(500).send({ error: 'Handler error' });
  }
});

// Main startup function
async function start() {
  try {
    const port = config.port || 3461;
    const host = '0.0.0.0';

    await app.listen({ port, host });

    app.log.info(`[github-connector] Server listening on http://${host}:${port}`);
    app.log.info(`[github-connector] Max payload size: ${maxPayloadSize}`);
    app.log.info(`[github-connector] Ready to receive GitHub webhooks`);
  } catch (err) {
    app.log.error(`[github-connector] Failed to start server: ${err.message}`);
    process.exit(1);
  }
}

// Graceful shutdown with timeout protection
let isShuttingDown = false;

async function shutdown() {
  if (isShuttingDown) {
    return; // Already shutting down
  }
  isShuttingDown = true;

  app.log.info(`[github-connector] Shutting down...`);

  // Force exit after 10 seconds if graceful shutdown fails
  const timeout = setTimeout(() => {
    app.log.warn(`[github-connector] Shutdown timeout, forcing exit`);
    process.exit(1);
  }, 10000);

  try {
    await app.close();
    app.log.info(`[github-connector] Server closed gracefully`);
    clearTimeout(timeout);
  } catch (err) {
    app.log.error(`[github-connector] Error during shutdown: ${err.message}`);
  }

  process.exit(0);
}

// Signal handlers
process.on('SIGINT', () => {
  app.log.info(`[github-connector] Received SIGINT`);
  shutdown();
});

process.on('SIGTERM', () => {
  app.log.info(`[github-connector] Received SIGTERM`);
  shutdown();
});

// Uncaught exception handler
process.on('uncaughtException', (err) => {
  app.log.error(`[github-connector] Uncaught exception: ${err.message}`);
  app.log.error(err.stack);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  app.log.error(`[github-connector] Unhandled rejection at ${promise}: ${reason}`);
  shutdown();
});

// Start the server
start().catch(err => {
  console.error(`[github-connector] Fatal error:`, err);
  process.exit(1);
});
