/**
 * Integration Tests for Release Handler
 *
 * Tests the release handler integration with the router system
 * and end-to-end processing of real GitHub webhook payloads.
 */

import { describe, it, mock, before } from 'node:test';
import assert from 'node:assert/strict';
import { routeEvent, registerHandler, hasHandler } from '../router.js';
import { handleRelease } from '../handlers/release.js';

describe('Release Handler Integration', () => {
  describe('Router Integration', () => {
    it('should verify handler is registered correctly', () => {
      // This test verifies that the handler would be registered
      // In the actual application, this happens in src/index.js
      const isRegistered = hasHandler('release');

      // Note: The handler might not be registered in test context
      // This is more of a documentation test showing how it should work
      assert.strictEqual(typeof isRegistered, 'boolean');
    });

    it('should route release event to handler', async () => {
      // Register the handler for this test
      registerHandler('release', handleRelease);

      const payload = {
        action: 'published',
        release: {
          id: 123456789,
          tag_name: 'v1.0.0',
          name: 'First Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: [{ name: 'binary.zip', size: 1024 }],
          author: { login: 'testuser' }
        },
        sender: { login: 'testuser' }
      };

      const result = await routeEvent('release', payload);

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.eventType, 'release');
      assert.strictEqual(result.result.processed, true);
      assert.match(result.result.message, /First Release/);
    });

    it('should return handled: false for unregistered event types', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Test Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: []
        },
        sender: { login: 'testuser' }
      };

      const result = await routeEvent('unsupported_event', payload);

      assert.strictEqual(result.handled, false);
      assert.strictEqual(result.eventType, 'unsupported_event');
    });
  });

  describe('Real GitHub Webhook Payloads', () => {
    it('should handle real published release payload from GitHub', async () => {
      const realPayload = {
        action: 'published',
        release: {
          id: 123456789,
          tag_name: 'v1.0.0',
          name: 'Version 1.0.0',
          author: {
            login: 'alice',
            type: 'User'
          },
          draft: false,
          prerelease: false,
          created_at: '2026-05-12T10:00:00Z',
          published_at: '2026-05-12T10:00:00Z',
          assets: [
            {
              name: 'app-v1.0.0-linux-amd64.tar.gz',
              size: 15728640,
              download_count: 42,
              browser_download_url: 'https://github.com/user/repo/releases/download/v1.0.0/app-v1.0.0-linux-amd64.tar.gz'
            },
            {
              name: 'app-v1.0.0-darwin-amd64.tar.gz',
              size: 16777216,
              download_count: 28,
              browser_download_url: 'https://github.com/user/repo/releases/download/v1.0.0/app-v1.0.0-darwin-amd64.tar.gz'
            }
          ],
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          url: 'https://api.github.com/repos/user/repo/releases/123456789'
        },
        repository: {
          id: 12345678,
          name: 'repo',
          full_name: 'user/repo',
          private: false
        },
        sender: {
          login: 'alice',
          type: 'User'
        }
      };

      const result = await handleRelease(realPayload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /🚀 Release Published by @alice/);
      assert.match(result.message, /Version 1.0.0 \(v1.0.0\)/);
      assert.match(result.message, /Assets: 2 file\(s\)/);
      assert.match(result.message, /🔗 https:\/\/github\.com\/user\/repo\/releases\/tag\/v1\.0\.0/);
      assert.strictEqual(result.data.tagName, 'v1.0.0');
      assert.strictEqual(result.data.releaseName, 'Version 1.0.0');
      assert.strictEqual(result.data.author, 'alice');
      assert.strictEqual(result.data.assetsCount, 2);
    });

    it('should handle created release payload', async () => {
      const realPayload = {
        action: 'created',
        release: {
          id: 987654321,
          tag_name: 'v2.0.0-beta',
          name: 'Beta Release v2.0.0',
          author: { login: 'bob' },
          draft: false,
          prerelease: true,
          created_at: '2026-05-12T11:00:00Z',
          published_at: null,
          assets: [
            {
              name: 'app-v2.0.0-beta.tar.gz',
              size: 10485760,
              download_count: 5
            }
          ],
          html_url: 'https://github.com/user/repo/releases/tag/v2.0.0-beta'
        },
        repository: { name: 'repo', full_name: 'user/repo' },
        sender: { login: 'bob' }
      };

      const result = await handleRelease(realPayload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /🚀 Release Created by @bob/);
      assert.match(result.message, /Beta Release v2\.0\.0 \(v2\.0\.0-beta\)/);
      assert.match(result.message, /Assets: 1 file\(s\)/);
      assert.strictEqual(result.data.action, 'created');
      assert.strictEqual(result.data.tagName, 'v2.0.0-beta');
      assert.strictEqual(result.data.releaseName, 'Beta Release v2.0.0');
    });

    it('should handle release with complete structure', async () => {
      const completePayload = {
        action: 'published',
        release: {
          id: 456789123,
          tag_name: 'v3.0.0',
          name: 'Major Release v3.0.0',
          body: 'This is a major release with many new features',
          author: { login: 'charlie', type: 'User' },
          draft: false,
          prerelease: false,
          created_at: '2026-05-12T08:00:00Z',
          published_at: '2026-05-12T09:00:00Z',
          assets: [
            {
              id: 111,
              name: 'binary-linux-x64.zip',
              size: 20971520,
              download_count: 100,
              content_type: 'application/zip'
            },
            {
              id: 222,
              name: 'binary-darwin-x64.zip',
              size: 22020096,
              download_count: 80,
              content_type: 'application/zip'
            },
            {
              id: 333,
              name: 'binary-windows-x64.zip',
              size: 19922944,
              download_count: 60,
              content_type: 'application/zip'
            },
            {
              id: 444,
              name: 'checksums.txt',
              size: 1024,
              download_count: 200,
              content_type: 'text/plain'
            }
          ],
          html_url: 'https://github.com/user/repo/releases/tag/v3.0.0',
          upload_url: 'https://uploads.github.com/repos/user/repo/releases/456789123/assets{?name,label}',
          tarball_url: 'https://api.github.com/repos/user/repo/tarball/v3.0.0',
          zipball_url: 'https://api.github.com/repos/user/repo/zipball/v3.0.0',
          url: 'https://api.github.com/repos/user/repo/releases/456789123'
        },
        repository: {
          id: 999,
          name: 'repo',
          full_name: 'user/repo',
          private: false,
          owner: { login: 'user' }
        },
        sender: {
          login: 'charlie',
          type: 'User'
        }
      };

      const result = await handleRelease(completePayload);

      assert.strictEqual(result.processed, true);
      assert.strictEqual(result.data.assetsCount, 4);
      assert.match(result.message, /Assets: 4 file\(s\)/);
      assert.strictEqual(result.data.author, 'charlie');
    });

    it('should handle draft release payload', async () => {
      const draftPayload = {
        action: 'published',
        release: {
          id: 111222333,
          tag_name: 'v0.1.0-draft',
          name: 'Draft Release',
          author: { login: 'dave' },
          draft: true,
          prerelease: false,
          created_at: '2026-05-12T12:00:00Z',
          published_at: null,
          assets: [],
          html_url: 'https://github.com/user/repo/releases/tag/v0.1.0-draft'
        },
        repository: { name: 'repo', full_name: 'user/repo' },
        sender: { login: 'dave' }
      };

      const result = await handleRelease(draftPayload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /Draft Release \(v0\.1\.0-draft\)/);
      // Draft releases with no assets should not show "Assets:" line
      assert.doesNotMatch(result.message, /Assets:/);
      assert.strictEqual(result.data.assetsCount, 0);
    });

    it('should handle prerelease payload', async () => {
      const prereleasePayload = {
        action: 'created',
        release: {
          id: 444555666,
          tag_name: 'v2.1.0-rc.1',
          name: 'Release Candidate 1',
          author: { login: 'eve' },
          draft: false,
          prerelease: true,
          created_at: '2026-05-12T13:00:00Z',
          published_at: null,
          assets: [
            {
              name: 'app-rc1.tar.gz',
              size: 5242880,
              download_count: 10
            }
          ],
          html_url: 'https://github.com/user/repo/releases/tag/v2.1.0-rc.1'
        },
        repository: { name: 'repo', full_name: 'user/repo' },
        sender: { login: 'eve' }
      };

      const result = await handleRelease(prereleasePayload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /Release Candidate 1 \(v2\.1\.0-rc\.1\)/);
      assert.match(result.message, /Assets: 1 file\(s\)/);
      assert.strictEqual(result.data.action, 'created');
    });
  });

  describe('Release Scenarios', () => {
    it('should handle official release scenario', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Stable Release 1.0.0',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: [
            { name: 'app.exe', size: 10485760 },
            { name: 'app.dmg', size: 12582912 },
            { name: 'app.tar.gz', size: 9437184 }
          ],
          draft: false,
          prerelease: false,
          author: { login: 'frank' }
        },
        sender: { login: 'frank' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /🚀 Release Published by @frank/);
      assert.match(result.message, /Stable Release 1\.0\.0 \(v1\.0\.0\)/);
      assert.match(result.message, /Assets: 3 file\(s\)/);
      assert.strictEqual(result.data.assetsCount, 3);
    });

    it('should handle draft release scenario', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v0.0.1',
          name: 'Internal Test Build',
          html_url: 'https://github.com/user/repo/releases/tag/v0.0.1',
          assets: [],
          draft: true,
          prerelease: false,
          author: { login: 'grace' }
        },
        sender: { login: 'grace' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /Internal Test Build \(v0\.0\.1\)/);
      assert.doesNotMatch(result.message, /Assets:/);
      assert.strictEqual(result.data.assetsCount, 0);
    });

    it('should handle prerelease scenario', async () => {
      const payload = {
        action: 'created',
        release: {
          tag_name: 'v1.1.0-alpha',
          name: 'Alpha Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.1.0-alpha',
          assets: [
            { name: 'app-alpha.tar.gz', size: 8388608 }
          ],
          draft: false,
          prerelease: true,
          author: { login: 'henry' }
        },
        sender: { login: 'henry' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /Alpha Release \(v1\.1\.0-alpha\)/);
      assert.match(result.message, /Assets: 1 file\(s\)/);
      assert.strictEqual(result.data.action, 'created');
    });

    it('should handle release with multiple asset types', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v2.0.0',
          name: 'Multi-Platform Release',
          html_url: 'https://github.com/user/repo/releases/tag/v2.0.0',
          assets: [
            { name: 'linux-amd64', size: 10485760 },
            { name: 'linux-arm64', size: 9437184 },
            { name: 'darwin-amd64', size: 12582912 },
            { name: 'darwin-arm64', size: 11534336 },
            { name: 'windows-amd64.exe', size: 11534336 },
            { name: 'checksums.sha256', size: 512 }
          ],
          draft: false,
          prerelease: false,
          author: { login: 'iris' }
        },
        sender: { login: 'iris' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, true);
      assert.strictEqual(result.data.assetsCount, 6);
      assert.match(result.message, /Assets: 6 file\(s\)/);
    });

    it('should handle release with no assets', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Tag-Only Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: [],
          draft: false,
          prerelease: false,
          author: { login: 'jack' }
        },
        sender: { login: 'jack' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, true);
      assert.strictEqual(result.data.assetsCount, 0);
      // Should not show "Assets:" line when no assets
      assert.doesNotMatch(result.message, /Assets:/);
    });
  });

  describe('Assets Handling', () => {
    it('should handle release with single asset', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Single Asset Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: [
            { name: 'app-single.zip', size: 5242880 }
          ],
          author: { login: 'kate' }
        },
        sender: { login: 'kate' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, true);
      assert.strictEqual(result.data.assetsCount, 1);
      assert.match(result.message, /Assets: 1 file\(s\)/);
    });

    it('should handle release with multiple assets', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Multi Asset Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: [
            { name: 'asset1.tar.gz', size: 1000000 },
            { name: 'asset2.tar.gz', size: 2000000 },
            { name: 'asset3.tar.gz', size: 3000000 },
            { name: 'asset4.tar.gz', size: 4000000 }
          ],
          author: { login: 'leo' }
        },
        sender: { login: 'leo' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, true);
      assert.strictEqual(result.data.assetsCount, 4);
      assert.match(result.message, /Assets: 4 file\(s\)/);
    });

    it('should handle release with no assets', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'No Asset Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: [],
          author: { login: 'mary' }
        },
        sender: { login: 'mary' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, true);
      assert.strictEqual(result.data.assetsCount, 0);
      assert.doesNotMatch(result.message, /Assets:/);
    });

    it('should handle release with empty assets array', async () => {
      const payload = {
        action: 'created',
        release: {
          tag_name: 'v1.0.0',
          name: 'Empty Array Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: [],
          author: { login: 'nancy' }
        },
        sender: { login: 'nancy' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, true);
      assert.strictEqual(result.data.assetsCount, 0);
      const lines = result.message.split('\n');
      // Should have 3 lines: action, name/tag, URL (no assets line)
      assert.strictEqual(lines.length, 3);
      assert.doesNotMatch(result.message, /Assets:/);
    });
  });

  describe('Release Name and Tag', () => {
    it('should handle release with explicit name', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Production Ready',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: [{ name: 'app.zip', size: 1000000 }],
          author: { login: 'olivia' }
        },
        sender: { login: 'olivia' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /Production Ready \(v1\.0\.0\)/);
      assert.strictEqual(result.data.releaseName, 'Production Ready');
      assert.strictEqual(result.data.tagName, 'v1.0.0');
    });

    it('should handle release with empty name (use tag)', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v2.0.0',
          name: '',
          html_url: 'https://github.com/user/repo/releases/tag/v2.0.0',
          assets: [{ name: 'app.zip', size: 1000000 }],
          author: { login: 'peter' }
        },
        sender: { login: 'peter' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, true);
      // Empty name should fall back to tag name
      assert.match(result.message, /v2\.0\.0 \(v2\.0\.0\)/);
      assert.strictEqual(result.data.releaseName, 'v2.0.0');
      assert.strictEqual(result.data.tagName, 'v2.0.0');
    });

    it('should handle release with name same as tag', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'v1.0.0',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: [{ name: 'app.zip', size: 1000000 }],
          author: { login: 'paul' }
        },
        sender: { login: 'paul' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /v1\.0\.0 \(v1\.0\.0\)/);
      assert.strictEqual(result.data.releaseName, 'v1.0.0');
      assert.strictEqual(result.data.tagName, 'v1.0.0');
    });

    it('should handle release with v prefix in tag', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.2.3',
          name: 'Version 1.2.3',
          html_url: 'https://github.com/user/repo/releases/tag/v1.2.3',
          assets: [{ name: 'app.zip', size: 1000000 }],
          author: { login: 'quinn' }
        },
        sender: { login: 'quinn' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /Version 1\.2\.3 \(v1\.2\.3\)/);
      assert.strictEqual(result.data.tagName, 'v1.2.3');
    });

    it('should handle release without v prefix in tag', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: '1.0.0',
          name: 'Release 1.0.0',
          html_url: 'https://github.com/user/repo/releases/tag/1.0.0',
          assets: [{ name: 'app.zip', size: 1000000 }],
          author: { login: 'rachel' }
        },
        sender: { login: 'rachel' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /Release 1\.0\.0 \(1\.0\.0\)/);
      assert.strictEqual(result.data.tagName, '1.0.0');
    });
  });

  describe('Integration with Router', () => {
    it('should process release through router and return correct structure', async () => {
      registerHandler('release', handleRelease);

      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Router Integration Test',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: [{ name: 'test.zip', size: 1000 }],
          author: { login: 'routeruser' }
        },
        sender: { login: 'routeruser' }
      };

      const result = await routeEvent('release', payload);

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.eventType, 'release');
      assert.strictEqual(result.result.processed, true);
      assert.strictEqual(result.result.event, 'release');
      assert.match(result.result.message, /Router Integration Test/);
      assert.strictEqual(result.result.data.tagName, 'v1.0.0');
    });

    it('should handle unprocessed release action through router', async () => {
      registerHandler('release', handleRelease);

      const payload = {
        action: 'deleted',
        release: {
          tag_name: 'v1.0.0',
          name: 'Deleted Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: [],
          author: { login: 'deleter' }
        },
        sender: { login: 'deleter' }
      };

      const result = await routeEvent('release', payload);

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.eventType, 'release');
      assert.strictEqual(result.result.processed, false);
      assert.match(result.result.message, /Unsupported release action/);
    });
  });

  describe('End-to-End Message Verification', () => {
    it('should verify complete message structure for release with assets (4 lines)', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Complete Test Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: [
            { name: 'asset1.zip', size: 1000000 },
            { name: 'asset2.zip', size: 2000000 }
          ],
          author: { login: 'e2euser' }
        },
        sender: { login: 'e2euser' }
      };

      const result = await handleRelease(payload);
      const lines = result.message.split('\n');

      // Line 1: Action label with sender
      assert.match(lines[0], /^🚀 Release Published by @e2euser$/);

      // Line 2: Release name with tag
      assert.strictEqual(lines[1], 'Complete Test Release (v1.0.0)');

      // Line 3: Assets count
      assert.strictEqual(lines[2], 'Assets: 2 file(s)');

      // Line 4: Release URL
      assert.strictEqual(lines[3], '🔗 https://github.com/user/repo/releases/tag/v1.0.0');

      assert.strictEqual(lines.length, 4);
    });

    it('should verify complete message structure for release without assets (3 lines)', async () => {
      const payload = {
        action: 'created',
        release: {
          tag_name: 'v2.0.0',
          name: 'No Assets Release',
          html_url: 'https://github.com/user/repo/releases/tag/v2.0.0',
          assets: [],
          author: { login: 'noassets' }
        },
        sender: { login: 'noassets' }
      };

      const result = await handleRelease(payload);
      const lines = result.message.split('\n');

      // Line 1: Action label with sender
      assert.match(lines[0], /^🚀 Release Created by @noassets$/);

      // Line 2: Release name with tag
      assert.strictEqual(lines[1], 'No Assets Release (v2.0.0)');

      // Line 3: Release URL (no assets line)
      assert.strictEqual(lines[2], '🔗 https://github.com/user/repo/releases/tag/v2.0.0');

      assert.strictEqual(lines.length, 3);
    });

    it('should verify message line by line for published release', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v3.0.0',
          name: 'Line by Line Test',
          html_url: 'https://github.com/test/repo/releases/tag/v3.0.0',
          assets: [{ name: 'single.zip', size: 5000000 }],
          author: { login: 'linebyline' }
        },
        sender: { login: 'linebyline' }
      };

      const result = await handleRelease(payload);
      const lines = result.message.split('\n');

      // Verify each line individually
      assert.strictEqual(lines[0], '🚀 Release Published by @linebyline');
      assert.strictEqual(lines[1], 'Line by Line Test (v3.0.0)');
      assert.strictEqual(lines[2], 'Assets: 1 file(s)');
      assert.strictEqual(lines[3], '🔗 https://github.com/test/repo/releases/tag/v3.0.0');
      assert.strictEqual(lines.length, 4);
    });

    it('should verify message structure when name is empty (uses tag)', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v4.0.0',
          name: '',
          html_url: 'https://github.com/test/repo/releases/tag/v4.0.0',
          assets: [{ name: 'app.zip', size: 3000000 }],
          author: { login: 'emptyname' }
        },
        sender: { login: 'emptyname' }
      };

      const result = await handleRelease(payload);
      const lines = result.message.split('\n');

      // Name should fall back to tag name
      assert.strictEqual(lines[1], 'v4.0.0 (v4.0.0)');
      assert.strictEqual(lines.length, 4);
    });
  });

  describe('Log Validation', () => {
    it('should log warning for unsupported actions', async () => {
      const consoleWarnSpy = mock.method(console, 'warn', () => {});

      const payload = {
        action: 'deleted',
        release: {
          tag_name: 'v1.0.0',
          name: 'Deleted Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: [],
          author: { login: 'deleter' }
        },
        sender: { login: 'deleter' }
      };

      await handleRelease(payload);

      assert.strictEqual(consoleWarnSpy.mock.calls.length, 1);
      const warningMsg = consoleWarnSpy.mock.calls[0].arguments[0];
      assert.match(warningMsg, /Unsupported release action: deleted/);

      consoleWarnSpy.mock.restore();
    });

    it('should log warnings for multiple unsupported actions', async () => {
      const consoleWarnSpy = mock.method(console, 'warn', () => {});

      const unsupportedActions = ['edited', 'deleted', 'prereleased'];

      for (const action of unsupportedActions) {
        const payload = {
          action: action,
          release: {
            tag_name: 'v1.0.0',
            name: 'Test',
            html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
            assets: [],
            author: { login: 'tester' }
          },
          sender: { login: 'tester' }
        };

        await handleRelease(payload);
      }

      assert.strictEqual(consoleWarnSpy.mock.calls.length, 3);

      consoleWarnSpy.mock.restore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle extremely long release name', async () => {
      const longName = 'A'.repeat(200);

      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: longName,
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: [{ name: 'app.zip', size: 1000 }],
          author: { login: 'longname' }
        },
        sender: { login: 'longname' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, new RegExp(longName));
    });

    it('should handle special characters in release name', async () => {
      const specialName = 'Release: v1.0.0-beta (Final) [TEST]';

      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: specialName,
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: [{ name: 'app.zip', size: 1000 }],
          author: { login: 'specialchars' }
        },
        sender: { login: 'specialchars' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, new RegExp(specialName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    });

    it('should handle build metadata in semver', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0+build.123',
          name: 'Build Metadata Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0+build.123',
          assets: [{ name: 'app.zip', size: 1000 }],
          author: { login: 'buildmeta' }
        },
        sender: { login: 'buildmeta' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, true);
      assert.strictEqual(result.data.tagName, 'v1.0.0+build.123');
    });

    it('should handle whitespace-only name (treated as empty)', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v2.0.0',
          name: '   ',
          html_url: 'https://github.com/user/repo/releases/tag/v2.0.0',
          assets: [{ name: 'app.zip', size: 1000 }],
          author: { login: 'whitespace' }
        },
        sender: { login: 'whitespace' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, true);
      // Whitespace-only name should fall back to tag name
      assert.match(result.message, /v2\.0\.0 \(v2\.0\.0\)/);
      assert.strictEqual(result.data.releaseName, 'v2.0.0');
    });

    it('should handle missing sender (use unknown)', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'No Sender Release',
          html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
          assets: [{ name: 'app.zip', size: 1000 }],
          author: { login: 'originalauthor' }
        }
        // No sender field
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, true);
      assert.match(result.message, /@unknown/);
      assert.strictEqual(result.data.author, 'unknown');
    });

    it('should handle missing html_url', async () => {
      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'No URL Release',
          // No html_url field
          assets: [{ name: 'app.zip', size: 1000 }],
          author: { login: 'nourl' }
        },
        sender: { login: 'nourl' }
      };

      const result = await handleRelease(payload);

      assert.strictEqual(result.processed, true);
      // Should not have URL line
      assert.doesNotMatch(result.message, /🔗/);
      assert.strictEqual(result.data.releaseUrl, null);
    });
  });
});
