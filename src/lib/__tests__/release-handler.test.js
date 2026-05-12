/**
 * Release Handler Unit Tests
 *
 * Tests the release event handler with comprehensive coverage of:
 * - Input validation
 * - Supported actions (published, created)
 * - Unsupported actions (edited, deleted, prereleased, etc.)
 * - Placeholder handling for missing fields
 * - Assets handling and display
 * - Release name fallback logic
 * - Return value structure
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handleRelease } from '../handlers/release.js';

describe('Release Handler', () => {
  describe('Input Validation', () => {
    it('should throw error for null payload', async () => {
      await assert.rejects(
        async () => await handleRelease(null),
        { message: 'Invalid payload: expected object' }
      );
    });

    it('should throw error for undefined payload', async () => {
      await assert.rejects(
        async () => await handleRelease(undefined),
        { message: 'Invalid payload: expected object' }
      );
    });

    it('should throw error for non-object payload', async () => {
      await assert.rejects(
        async () => await handleRelease('string'),
        { message: 'Invalid payload: expected object' }
      );
    });

    it('should throw error for array payload', async () => {
      await assert.rejects(
        async () => await handleRelease([]),
        { message: 'Invalid payload: expected object' }
      );
    });

    it('should throw error for missing action field', async () => {
      await assert.rejects(
        async () => await handleRelease({
          release: { tag_name: 'v1.0.0' }
        }),
        { message: 'Invalid payload: missing or invalid action field' }
      );
    });

    it('should throw error for invalid action field', async () => {
      await assert.rejects(
        async () => await handleRelease({
          action: 123,
          release: { tag_name: 'v1.0.0' }
        }),
        { message: 'Invalid payload: missing or invalid action field' }
      );
    });

    it('should throw error for non-string action field', async () => {
      await assert.rejects(
        async () => await handleRelease({
          action: null,
          release: { tag_name: 'v1.0.0' }
        }),
        { message: 'Invalid payload: missing or invalid action field' }
      );
    });

    it('should throw error for missing release object', async () => {
      await assert.rejects(
        async () => await handleRelease({
          action: 'published'
        }),
        { message: 'Invalid payload: missing or invalid release object' }
      );
    });

    it('should throw error for null release object', async () => {
      await assert.rejects(
        async () => await handleRelease({
          action: 'published',
          release: null
        }),
        { message: 'Invalid payload: missing or invalid release object' }
      );
    });

    it('should throw error for undefined release object', async () => {
      await assert.rejects(
        async () => await handleRelease({
          action: 'published',
          release: undefined
        }),
        { message: 'Invalid payload: missing or invalid release object' }
      );
    });
  });

  describe('Supported Actions', () => {
    it('should format published action with assets', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'First Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: [
            { name: 'binary.zip', size: 1024 },
            { name: 'source.tar.gz', size: 2048 },
            { name: 'checksums.txt', size: 128 }
          ]
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, true);
      assert.strictEqual(result.event, 'release');
      assert.ok(result.message.includes('🚀 Release Published by @alice'));
      assert.ok(result.message.includes('First Release (v1.0.0)'));
      assert.ok(result.message.includes('Assets: 3 file(s)'));
      assert.ok(result.message.includes('🔗 https://github.com/user/repo/releases/tag/v1.0.0'));
    });

    it('should format published action without assets', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v2.0.0',
          name: 'Second Release',
          html_url: 'https://github.com/user/repo/releases/tag/v2.0.0',
          assets: []
        },
        sender: { login: 'bob' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, true);
      assert.ok(result.message.includes('🚀 Release Published by @bob'));
      assert.ok(result.message.includes('Second Release (v2.0.0)'));
      // Should not include assets line when no assets
      assert.ok(!result.message.includes('Assets:'));
      assert.ok(result.message.includes('🔗'));
    });

    it('should format created action', async () => {
      const payload = {
        action: 'created',
        release: {
          tag_name: 'v1.0.0-beta',
          name: 'Beta Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0-beta',
          assets: [
            { name: 'test-binary.zip', size: 512 }
          ]
        },
        sender: { login: 'charlie' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, true);
      assert.ok(result.message.includes('🚀 Release Created by @charlie'));
      assert.ok(result.message.includes('Beta Release (v1.0.0-beta)'));
      assert.ok(result.message.includes('Assets: 1 file(s)'));
    });

    it('should format message with correct structure', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: [{ name: 'file.zip', size: 1024 }]
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);
      const lines = result.message.split('\n');

      // Should have 4 lines when assets present
      assert.strictEqual(lines.length, 4);
      // Line 1: action label
      assert.ok(lines[0].includes('🚀 Release Published'));
      // Line 2: release info
      assert.ok(lines[1].includes('Release (v1.0.0)'));
      // Line 3: assets count
      assert.ok(lines[2].includes('Assets: 1 file(s)'));
      // Line 4: URL
      assert.ok(lines[3].startsWith('🔗'));
    });

    it('should format message without assets line when no assets', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);
      const lines = result.message.split('\n');

      // Should have 3 lines when no assets
      assert.strictEqual(lines.length, 3);
      // Line 1: action label
      assert.ok(lines[0].includes('🚀 Release Published'));
      // Line 2: release info
      assert.ok(lines[1].includes('Release (v1.0.0)'));
      // Line 3: URL (no assets line)
      assert.ok(lines[2].startsWith('🔗'));
    });

    it('should extract correct data structure', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Test Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: [{ name: 'file.zip', size: 1024 }]
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.data.action, 'published');
      assert.strictEqual(result.data.tagName, 'v1.0.0');
      assert.strictEqual(result.data.releaseName, 'Test Release');
      assert.strictEqual(result.data.author, 'alice');
      assert.strictEqual(result.data.assetsCount, 1);
      assert.strictEqual(result.data.releaseUrl, 'https://github.com/user/repo/releases/tag/v1.0.0');
    });
  });

  describe('Unsupported Actions', () => {
    it('should return processed: false for edited action', async () => {
      const payload = {
        action: 'edited',
        release: {
          tag_name: 'v1.0.0',
          name: 'Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, false);
      assert.ok(result.message.includes('Unsupported release action: edited'));
      assert.strictEqual(result.event, 'release');
    });

    it('should return processed: false for deleted action', async () => {
      const payload = {
        action: 'deleted',
        release: {
          tag_name: 'v1.0.0',
          name: 'Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, false);
      assert.ok(result.message.includes('Unsupported release action: deleted'));
    });

    it('should return processed: false for prereleased action', async () => {
      const payload = {
        action: 'prereleased',
        release: {
          tag_name: 'v1.0.0-beta',
          name: 'Prerelease',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0-beta',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, false);
      assert.ok(result.message.includes('Unsupported release action: prereleased'));
    });

    it('should return processed: false for unknown action', async () => {
      const payload = {
        action: 'unknown_action',
        release: {
          tag_name: 'v1.0.0',
          name: 'Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, false);
      assert.ok(result.message.includes('Unsupported release action: unknown_action'));
    });

    it('should log warning for unsupported action', async () => {
      // Mock console.warn to capture log output
      const warnings = [];
      const originalWarn = console.warn;
      console.warn = (...args) => {
        warnings.push(args.join(' '));
      };

      const payload = {
        action: 'edited',
        release: {
          tag_name: 'v1.0.0',
          name: 'Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: []
        },
        sender: { login: 'alice' }
      };

      await handleRelease(payload);

      // Restore console.warn
      console.warn = originalWarn;

      // Verify warning was logged
      assert.ok(warnings.some(w => w.includes('Unsupported release action: edited')));
    });

    it('should include data object for unsupported actions', async () => {
      const payload = {
        action: 'edited',
        release: {
          tag_name: 'v1.0.0',
          name: 'Test Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(typeof result.data, 'object');
      assert.strictEqual(result.data.action, 'edited');
      assert.strictEqual(result.data.tagName, 'v1.0.0');
      assert.strictEqual(result.data.releaseName, 'Test Release');
    });
  });

  describe('Placeholder Handling', () => {
    it('should use [No tag] placeholder for empty tag_name', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: '',
          name: 'Release',
          html_url: 'https://github.com/user/repo/releases/tag/',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.ok(result.message.includes('[No tag]'));
      assert.strictEqual(result.data.tagName, '[No tag]');
    });

    it('should use [No tag] placeholder for missing tag_name', async () => {
      const payload = {
        action: 'published',
        release: {
          name: 'Release',
          html_url: 'https://github.com/user/repo/releases/tag/',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.ok(result.message.includes('[No tag]'));
      assert.strictEqual(result.data.tagName, '[No tag]');
    });

    it('should use tag_name fallback when name is empty', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: '',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      // Should use tag_name as release name
      assert.ok(result.message.includes('v1.0.0 (v1.0.0)'));
      assert.strictEqual(result.data.releaseName, 'v1.0.0');
    });

    it('should use tag_name fallback when name is missing', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v2.0.0',
          html_url: 'https://github.com/user/repo/releases/tag/v2.0.0',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      // Should use tag_name as release name
      assert.ok(result.message.includes('v2.0.0 (v2.0.0)'));
      assert.strictEqual(result.data.releaseName, 'v2.0.0');
    });

    it('should use @unknown placeholder for null sender', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: []
        },
        sender: null
      };

      const result = await handleRelease(payload);

      assert.ok(result.message.includes('@unknown'));
      assert.strictEqual(result.data.author, 'unknown');
    });

    it('should use @unknown placeholder for undefined sender', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: []
        }
      };

      const result = await handleRelease(payload);

      assert.ok(result.message.includes('@unknown'));
      assert.strictEqual(result.data.author, 'unknown');
    });

    it('should skip URL line when html_url is null', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Release',
          html_url: null,
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      // Should not include URL line
      assert.ok(!result.message.includes('🔗'));
      assert.strictEqual(result.data.releaseUrl, null);
    });

    it('should skip URL line when html_url is missing', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Release',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      // Should not include URL line
      assert.ok(!result.message.includes('🔗'));
      assert.strictEqual(result.data.releaseUrl, null);
    });
  });

  describe('Assets Handling', () => {
    it('should display assets count when assets exist', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: [
            { name: 'file1.zip', size: 1024 },
            { name: 'file2.zip', size: 2048 }
          ]
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.ok(result.message.includes('Assets: 2 file(s)'));
      assert.strictEqual(result.data.assetsCount, 2);
    });

    it('should not display assets line when assets array is empty', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.ok(!result.message.includes('Assets:'));
      assert.strictEqual(result.data.assetsCount, 0);
    });

    it('should treat null assets as 0 count', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: null
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.ok(!result.message.includes('Assets:'));
      assert.strictEqual(result.data.assetsCount, 0);
    });

    it('should treat undefined assets as 0 count', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0'
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.ok(!result.message.includes('Assets:'));
      assert.strictEqual(result.data.assetsCount, 0);
    });

    it('should handle single asset correctly', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: [{ name: 'binary.zip', size: 1024 }]
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.ok(result.message.includes('Assets: 1 file(s)'));
      assert.strictEqual(result.data.assetsCount, 1);
    });

    it('should handle multiple assets correctly', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: [
            { name: 'file1.zip', size: 1024 },
            { name: 'file2.zip', size: 2048 },
            { name: 'file3.zip', size: 4096 },
            { name: 'file4.zip', size: 8192 },
            { name: 'file5.zip', size: 16384 }
          ]
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.ok(result.message.includes('Assets: 5 file(s)'));
      assert.strictEqual(result.data.assetsCount, 5);
    });
  });

  describe('Release Name Fallback', () => {
    it('should use release name when both name and tag_name exist', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'First Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.ok(result.message.includes('First Release (v1.0.0)'));
      assert.strictEqual(result.data.releaseName, 'First Release');
      assert.strictEqual(result.data.tagName, 'v1.0.0');
    });

    it('should use tag_name as fallback when name is empty', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v2.0.0',
          name: '',
          html_url: 'https://github.com/user/repo/releases/tag/v2.0.0',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.ok(result.message.includes('v2.0.0 (v2.0.0)'));
      assert.strictEqual(result.data.releaseName, 'v2.0.0');
    });

    it('should use tag_name as fallback when name is missing', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v3.0.0',
          html_url: 'https://github.com/user/repo/releases/tag/v3.0.0',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.ok(result.message.includes('v3.0.0 (v3.0.0)'));
      assert.strictEqual(result.data.releaseName, 'v3.0.0');
    });

    it('should use [No tag] for both when both are empty', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: '',
          name: '',
          html_url: 'https://github.com/user/repo/releases/tag/',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.ok(result.message.includes('[No tag] ([No tag])'));
      assert.strictEqual(result.data.releaseName, '[No tag]');
      assert.strictEqual(result.data.tagName, '[No tag]');
    });

    it('should use [No tag] for both when both are missing', async () => {
      const payload = {
        action: 'published',
        release: {
          html_url: 'https://github.com/user/repo/releases/tag/',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.ok(result.message.includes('[No tag] ([No tag])'));
      assert.strictEqual(result.data.releaseName, '[No tag]');
      assert.strictEqual(result.data.tagName, '[No tag]');
    });
  });

  describe('Return Value Structure', () => {
    it('should return processed: true for supported actions', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, true);
    });

    it('should return non-empty message string', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(typeof result.message, 'string');
      assert.ok(result.message.length > 0);
    });

    it('should return event type as release', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.event, 'release');
    });

    it('should return data object with all extracted fields', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Test Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: [
            { name: 'file1.zip', size: 1024 },
            { name: 'file2.zip', size: 2048 }
          ]
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(typeof result.data, 'object');
      assert.strictEqual(result.data.action, 'published');
      assert.strictEqual(result.data.tagName, 'v1.0.0');
      assert.strictEqual(result.data.releaseName, 'Test Release');
      assert.strictEqual(result.data.author, 'alice');
      assert.strictEqual(result.data.assetsCount, 2);
      assert.strictEqual(result.data.releaseUrl, 'https://github.com/user/repo/releases/tag/v1.0.0');
    });

    it('should include assetsCount in data object', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: [{ name: 'file.zip', size: 1024 }]
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.ok('assetsCount' in result.data);
      assert.strictEqual(typeof result.data.assetsCount, 'number');
    });
  });

  describe('Edge Cases', () => {
    it('should handle release name with special characters', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Release: "Feature X" & <Fix Y>',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.ok(result.message.includes('Release: "Feature X" & <Fix Y>'));
    });

    it('should handle tag_name with v prefix', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v2.5.0',
          name: 'Version 2.5',
          html_url: 'https://github.com/user/repo/releases/tag/v2.5.0',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.ok(result.message.includes('Version 2.5 (v2.5.0)'));
      assert.strictEqual(result.data.tagName, 'v2.5.0');
    });

    it('should handle tag_name without v prefix', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: '1.0.0',
          name: 'First Release',
          html_url: 'https://github.com/user/repo/releases/tag/1.0.0',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.ok(result.message.includes('First Release (1.0.0)'));
      assert.strictEqual(result.data.tagName, '1.0.0');
    });

    it('should handle very long release names', async () => {
      const longName = 'This is a very long release name that exceeds 100 characters and should not be truncated but should wrap naturally when displayed in the notification message for the user to read';
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: longName,
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      // Full name should be present
      assert.ok(result.message.includes(longName));
    });

    it('should handle release name with emoji characters', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: '🎉 Major Release 🚀',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: []
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.ok(result.message.includes('🎉 Major Release 🚀'));
    });

    it('should handle username with special characters', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: []
        },
        sender: { login: 'user-123_test' }
      };

      const result = await handleRelease(payload);

      assert.ok(result.message.includes('@user-123_test'));
    });

    it('should handle draft release', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v2.0.0-beta',
          name: 'Draft Release',
          html_url: 'https://github.com/user/repo/releases/tag/v2.0.0-beta',
          assets: [],
          draft: true
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.ok(result.message.includes('Draft Release (v2.0.0-beta)'));
      assert.strictEqual(result.data.releaseName, 'Draft Release');
    });

    it('should handle prerelease flag', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0-rc.1',
          name: 'Release Candidate 1',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0-rc.1',
          assets: [],
          prerelease: true
        },
        sender: { login: 'alice' }
      };

      const result = await handleRelease(payload);

      assert.ok(result.message.includes('Release Candidate 1 (v1.0.0-rc.1)'));
      assert.strictEqual(result.data.releaseName, 'Release Candidate 1');
    });
  });
});
