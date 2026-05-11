/**
 * End-to-End Integration Tests
 *
 * Tests the complete webhook processing pipeline:
 * Signature verification → Deduplication → Routing → Handler execution
 */

import { describe, it, after, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { clearSeenDeliveries } from '../dedupe.js';
import { clearHandlers } from '../router.js';

describe('End-to-End Integration Tests', () => {
  let server;
  let baseUrl;
  let deliveryCounter = 0;

  // Helper to build test server
  async function buildServer() {
    const fastify = (await import('fastify')).default;
    const helmet = (await import('@fastify/helmet')).default;

    const app = fastify({
      logger: false
    });

    await app.register(helmet);

    // Raw body parser
    app.addContentTypeParser('application/json', { parseAs: 'buffer' },
      (req, body, done) => {
        req.rawBody = body;
        done(null, JSON.parse(body));
      }
    );

    // Import modules
    const { verifySignature } = await import('../verifier.js');
    const { hasDeliveryBeenSeen, markDeliveryAsSeen } = await import('../dedupe.js');
    const { registerHandler, registerWildcardHandler, routeEvent } = await import('../router.js');
    const handlers = await import('../handlers/index.js');

    // Clear state
    clearSeenDeliveries();
    clearHandlers();

    // Register handlers
    registerHandler('push', handlers.handlePush);
    registerHandler('issues', handlers.handleIssues);
    registerHandler('pull_request', handlers.handlePullRequest);
    registerWildcardHandler(handlers.handleUnsupported);

    // Webhook route with complete pipeline
    app.post('/webhook', async (request, reply) => {
      const signature = request.headers['x-hub-signature-256'];
      const eventType = request.headers['x-github-event'] || 'unknown';
      const deliveryId = request.headers['x-github-delivery'] || 'unknown';
      const secret = 'test-secret';

      // 1. Verify signature
      const isValid = verifySignature(request.rawBody, signature, secret);
      if (!isValid) {
        return reply.code(401).send({ error: 'Invalid signature' });
      }

      // 2. Dedupe check
      if (hasDeliveryBeenSeen(deliveryId)) {
        return reply.code(200).send({
          message: 'Duplicate, already processed',
          event: eventType,
          delivery: deliveryId
        });
      }

      markDeliveryAsSeen(deliveryId);

      // 3. Parse payload (already parsed by Fastify)
      const payload = request.body;

      // 4. Route event
      try {
        const routeResult = await routeEvent(eventType, payload);

        return reply.code(202).send({
          message: 'Event processed',
          event: eventType,
          delivery: deliveryId,
          handled: routeResult.handled
        });
      } catch (err) {
        return reply.code(500).send({ error: 'Handler error' });
      }
    });

    await app.listen({ port: 0 });
    return app;
  }

  before(async () => {
    server = await buildServer();
    baseUrl = `http://localhost:${server.server.address().port}`;
  });

  after(async () => {
    if (server) {
      await server.close();
    }
  });

  // Helper to generate unique delivery ID
  function getDeliveryId() {
    return `test-delivery-${++deliveryCounter}`;
  }

  // Helper to send webhook
  async function sendWebhook(eventType, payload) {
    const response = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=' + crypto.createHmac('sha256', 'test-secret').update(JSON.stringify(payload)).digest('hex'),
        'X-GitHub-Event': eventType,
        'X-GitHub-Delivery': getDeliveryId()
      },
      body: JSON.stringify(payload)
    });

    return {
      status: response.status,
      data: await response.json()
    };
  }

  it('should process complete pipeline for push event', async () => {
    const payload = {
      ref: 'refs/heads/main',
      repository: { full_name: 'test/repo' },
      pusher: { name: 'testuser' }
    };

    const result = await sendWebhook('push', payload);

    assert.equal(result.status, 202);
    assert.equal(result.data.message, 'Event processed');
    assert.equal(result.data.event, 'push');
    assert.equal(result.data.handled, true);
  });

  it('should process complete pipeline for issues event', async () => {
    const payload = {
      action: 'opened',
      issue: { number: 42, title: 'Bug found' },
      repository: { full_name: 'test/repo' }
    };

    const result = await sendWebhook('issues', payload);

    assert.equal(result.status, 202);
    assert.equal(result.data.message, 'Event processed');
    assert.equal(result.data.event, 'issues');
    assert.equal(result.data.handled, true);
  });

  it('should process complete pipeline for pull_request event', async () => {
    const payload = {
      action: 'opened',
      pull_request: { number: 10, title: 'Add new feature' },
      repository: { full_name: 'test/repo' }
    };

    const result = await sendWebhook('pull_request', payload);

    assert.equal(result.status, 202);
    assert.equal(result.data.message, 'Event processed');
    assert.equal(result.data.event, 'pull_request');
    assert.equal(result.data.handled, true);
  });

  it('should route unsupported events to wildcard handler', async () => {
    const payload = {
      action: 'created',
      repository: { full_name: 'test/repo' }
    };

    const result = await sendWebhook('custom_event', payload);

    assert.equal(result.status, 202);
    assert.equal(result.data.message, 'Event processed');
    assert.equal(result.data.event, 'custom_event');
    assert.equal(result.data.handled, true);
  });

  it('should reject webhook with invalid signature', async () => {
    const payload = { action: 'test' };

    const response = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=invalid_signature',
        'X-GitHub-Event': 'push',
        'X-GitHub-Delivery': getDeliveryId()
      },
      body: JSON.stringify(payload)
    });

    assert.equal(response.status, 401);
    const data = await response.json();
    assert.equal(data.error, 'Invalid signature');
  });

  it('should detect duplicate delivery IDs', async () => {
    const payload = { ref: 'refs/heads/main' };
    const deliveryId = 'duplicate-test-delivery';

    // First request
    const response1 = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=' + crypto.createHmac('sha256', 'test-secret').update(JSON.stringify(payload)).digest('hex'),
        'X-GitHub-Event': 'push',
        'X-GitHub-Delivery': deliveryId
      },
      body: JSON.stringify(payload)
    });

    assert.equal(response1.status, 202);
    assert.equal((await response1.json()).message, 'Event processed');

    // Second request with same delivery ID
    const response2 = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=' + crypto.createHmac('sha256', 'test-secret').update(JSON.stringify(payload)).digest('hex'),
        'X-GitHub-Event': 'push',
        'X-GitHub-Delivery': deliveryId
      },
      body: JSON.stringify(payload)
    });

    assert.equal(response2.status, 200);
    assert.equal((await response2.json()).message, 'Duplicate, already processed');
  });

  it('should handle multiple different events correctly', async () => {
    const events = [
      { type: 'push', payload: { ref: 'refs/heads/feature' } },
      { type: 'issues', payload: { action: 'closed', issue: { number: 1 } } },
      { type: 'pull_request', payload: { action: 'merged', pull_request: { number: 5 } } },
      { type: 'release', payload: { action: 'published', release: { tag_name: 'v1.0.0' } } }
    ];

    for (const event of events) {
      const result = await sendWebhook(event.type, event.payload);
      assert.equal(result.status, 202);
      assert.equal(result.data.event, event.type);
      assert.equal(result.data.handled, true);
    }
  });
});
