/**
 * Deduplication Integration Tests
 *
 * Tests the integration of dedupe module with the webhook route
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { clearSeenDeliveries } from '../dedupe.js';

describe('Deduplication Integration', () => {
  let server;
  let baseUrl;

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

    // Import and use dedupe and verifier modules
    const { verifySignature } = await import('../verifier.js');
    const { hasDeliveryBeenSeen, markDeliveryAsSeen } = await import('../dedupe.js');

    // Webhook route with dedupe
    app.post('/webhook', async (request, reply) => {
      const signature = request.headers['x-hub-signature-256'];
      const eventType = request.headers['x-github-event'] || 'unknown';
      const deliveryId = request.headers['x-github-delivery'] || 'unknown';
      const secret = 'test-secret';

      // Verify signature
      const isValid = verifySignature(request.rawBody, signature, secret);
      if (!isValid) {
        return reply.code(401).send({ error: 'Invalid signature' });
      }

      // Dedupe check
      if (hasDeliveryBeenSeen(deliveryId)) {
        return reply.code(200).send({
          message: 'Duplicate, already processed',
          event: eventType,
          delivery: deliveryId
        });
      }

      markDeliveryAsSeen(deliveryId);

      return reply.code(202).send({
        message: 'Webhook accepted',
        event: eventType,
        delivery: deliveryId
      });
    });

    await app.listen({ port: 0 }); // Random port
    return app;
  }

  // Build server before tests
  async function getServer() {
    if (!server) {
      server = await buildServer();
      baseUrl = `http://localhost:${server.server.address().port}`;
    }
    return { server, baseUrl };
  }

  after(async () => {
    if (server) {
      await server.close();
    }
    clearSeenDeliveries();
  });

  it('should accept first webhook delivery', async () => {
    const { baseUrl } = await getServer();
    const deliveryId = '12345678-1234-1234-1234-123456789abc';
    const payload = { action: 'opened', issue: { number: 1 } };

    const response = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=' + crypto.createHmac('sha256', 'test-secret').update(JSON.stringify(payload)).digest('hex'),
        'X-GitHub-Event': 'issues',
        'X-GitHub-Delivery': deliveryId
      },
      body: JSON.stringify(payload)
    });

    assert.equal(response.status, 202);
    const data = await response.json();
    assert.equal(data.message, 'Webhook accepted');
    assert.equal(data.delivery, deliveryId);
  });

  it('should reject duplicate webhook delivery with 200', async () => {
    const { baseUrl } = await getServer();
    const deliveryId = '87654321-4321-4321-4321-cba987654321';
    const payload = { action: 'closed', issue: { number: 2 } };

    // First request
    const response1 = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=' + crypto.createHmac('sha256', 'test-secret').update(JSON.stringify(payload)).digest('hex'),
        'X-GitHub-Event': 'issues',
        'X-GitHub-Delivery': deliveryId
      },
      body: JSON.stringify(payload)
    });

    assert.equal(response1.status, 202);
    const data1 = await response1.json();
    assert.equal(data1.message, 'Webhook accepted');

    // Second request with same delivery ID
    const response2 = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=' + crypto.createHmac('sha256', 'test-secret').update(JSON.stringify(payload)).digest('hex'),
        'X-GitHub-Event': 'issues',
        'X-GitHub-Delivery': deliveryId
      },
      body: JSON.stringify(payload)
    });

    assert.equal(response2.status, 200);
    const data2 = await response2.json();
    assert.equal(data2.message, 'Duplicate, already processed');
    assert.equal(data2.delivery, deliveryId);
  });

  it('should process different delivery IDs separately', async () => {
    const { baseUrl } = await getServer();
    const payload = { action: 'opened', pull_request: { number: 1 } };

    const deliveryId1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const response1 = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=' + crypto.createHmac('sha256', 'test-secret').update(JSON.stringify(payload)).digest('hex'),
        'X-GitHub-Event': 'pull_request',
        'X-GitHub-Delivery': deliveryId1
      },
      body: JSON.stringify(payload)
    });

    assert.equal(response1.status, 202);

    const deliveryId2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const response2 = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=' + crypto.createHmac('sha256', 'test-secret').update(JSON.stringify(payload)).digest('hex'),
        'X-GitHub-Event': 'pull_request',
        'X-GitHub-Delivery': deliveryId2
      },
      body: JSON.stringify(payload)
    });

    assert.equal(response2.status, 202);
  });

  it('should handle unknown delivery ID gracefully', async () => {
    const { baseUrl } = await getServer();
    const deliveryId = 'unknown-delivery-id';
    const payload = { action: 'opened' };

    const response = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=' + crypto.createHmac('sha256', 'test-secret').update(JSON.stringify(payload)).digest('hex'),
        'X-GitHub-Event': 'issues',
        'X-GitHub-Delivery': deliveryId
      },
      body: JSON.stringify(payload)
    });

    // Should accept (unknown delivery ID is still processed)
    assert.equal(response.status, 202);
  });

  it('should not dedupe across different event types with same delivery ID', async () => {
    const { baseUrl } = await getServer();
    const deliveryId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

    // First event type
    const response1 = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=' + crypto.createHmac('sha256', 'test-secret').update(JSON.stringify({ action: 'opened' })).digest('hex'),
        'X-GitHub-Event': 'issues',
        'X-GitHub-Delivery': deliveryId
      },
      body: JSON.stringify({ action: 'opened' })
    });

    assert.equal(response1.status, 202);

    // Same delivery ID, different event type (should still be deduped)
    const response2 = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=' + crypto.createHmac('sha256', 'test-secret').update(JSON.stringify({ action: 'created' })).digest('hex'),
        'X-GitHub-Event': 'release',
        'X-GitHub-Delivery': deliveryId
      },
      body: JSON.stringify({ action: 'created' })
    });

    // Should be rejected as duplicate (delivery ID is unique across all events)
    assert.equal(response2.status, 200);
    const data2 = await response2.json();
    assert.equal(data2.message, 'Duplicate, already processed');
  });
});
