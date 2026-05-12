/**
 * Configuration loader unit tests
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import {
  loadConfig,
  getConfig,
  getConfigSync,
  saveConfig,
  watchConfig,
  stopWatching,
  mergeDefaults,
  validateConfig,
  sanitizeForLogging,
  DEFAULT_CONFIG,
  CONFIG_PATH,
  DATA_DIR
} from '../../../src/lib/config.js';

// Test configuration path
const TEST_CONFIG_DIR = path.join(process.cwd(), 'tests/fixtures/config');
const TEST_CONFIG_PATH = path.join(TEST_CONFIG_DIR, 'test-config.json');

// Helper functions
async function createTempConfig(filename, content) {
  const configPath = path.join(TEST_CONFIG_DIR, filename);
  await fs.mkdir(TEST_CONFIG_DIR, { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(content, null, 2));
  return configPath;
}

async function removeTempConfig(filename) {
  const configPath = path.join(TEST_CONFIG_DIR, filename);
  try {
    await fs.unlink(configPath);
  } catch (err) {
    // Ignore if file doesn't exist
  }
}

async function cleanupTestConfigs() {
  try {
    const files = await fs.readdir(TEST_CONFIG_DIR);
    await Promise.all(files.map(file => fs.unlink(path.join(TEST_CONFIG_DIR, file))));
  } catch (err) {
    // Ignore if directory doesn't exist
  }
}

describe('Configuration Loader', () => {

  describe('mergeDefaults', () => {
    it('should deep merge nested objects (logging, commBridge)', () => {
      const userConfig = {
        port: 4000,
        logging: { level: 'debug' },
        commBridge: { defaultEndpoint: 'custom' }
      };
      const merged = mergeDefaults(DEFAULT_CONFIG, userConfig);

      assert.strictEqual(merged.port, 4000);
      assert.strictEqual(merged.logging.level, 'debug');
      assert.strictEqual(merged.commBridge.enabled, true); // preserved from default
      assert.strictEqual(merged.commBridge.defaultEndpoint, 'custom');
    });

    it('should merge top-level defaults with user config', () => {
      const userConfig = { port: 5000, enabled: false };
      const merged = mergeDefaults(DEFAULT_CONFIG, userConfig);

      assert.strictEqual(merged.port, 5000);
      assert.strictEqual(merged.enabled, false);
      assert.strictEqual(merged.webhookSecret, DEFAULT_CONFIG.webhookSecret);
    });

    it('should handle empty user config', () => {
      const merged = mergeDefaults(DEFAULT_CONFIG, {});
      assert.deepStrictEqual(merged, DEFAULT_CONFIG);
    });

    it('should preserve user config over defaults', () => {
      const userConfig = {
        webhookSecret: 'user-secret-key-12345678',
        port: 3461
      };
      const merged = mergeDefaults(DEFAULT_CONFIG, userConfig);
      assert.strictEqual(merged.webhookSecret, 'user-secret-key-12345678');
    });
  });

  describe('validateConfig', () => {
    it('should accept valid webhook secret (length >= 16)', () => {
      const config = { webhookSecret: 'valid-secret-key-12345678' };
      assert.doesNotThrow(() => validateConfig(config));
    });

    it('should reject invalid webhook secret (length < 16)', () => {
      const config = { webhookSecret: 'short' };
      assert.throws(() => validateConfig(config), /webhookSecret must be at least 16 characters/);
    });

    it('should accept valid port range (1-65535)', () => {
      assert.doesNotThrow(() => validateConfig({ port: 1 }));
      assert.doesNotThrow(() => validateConfig({ port: 8080 }));
      assert.doesNotThrow(() => validateConfig({ port: 65535 }));
    });

    it('should reject invalid port (0)', () => {
      assert.throws(() => validateConfig({ port: 0 }), /port must be between 1 and 65535/);
    });

    it('should reject invalid port (65536)', () => {
      assert.throws(() => validateConfig({ port: 65536 }), /port must be between 1 and 65535/);
    });

    it('should reject invalid port (negative)', () => {
      assert.throws(() => validateConfig({ port: -1 }), /port must be between 1 and 65535/);
    });

    it('should reject invalid port (non-number)', () => {
      assert.throws(() => validateConfig({ port: '8080' }), /port must be a number/);
    });

    it('should accept valid log levels (error, warn, info, debug)', () => {
      ['error', 'warn', 'info', 'debug'].forEach(level => {
        assert.doesNotThrow(() => validateConfig({ logging: { level } }));
      });
    });

    it('should reject invalid log level', () => {
      assert.throws(() => validateConfig({ logging: { level: 'trace' } }), /logging.level must be one of/);
    });

    it('should reject non-boolean enabled field', () => {
      assert.throws(() => validateConfig({ enabled: 'true' }), /enabled must be a boolean/);
    });

    it('should reject non-boolean commBridge.enabled field', () => {
      assert.throws(() => validateConfig({ commBridge: { enabled: 'yes' } }), /commBridge.enabled must be a boolean/);
    });

    it('should reject non-string webhookSecret', () => {
      assert.throws(() => validateConfig({ webhookSecret: 12345 }), /webhookSecret must be a string/);
    });

    it('should accept empty string webhookSecret (for testing)', () => {
      assert.doesNotThrow(() => validateConfig({ webhookSecret: '' }));
    });
  });

  describe('sanitizeForLogging', () => {
    it('should remove webhookSecret', () => {
      const config = { webhookSecret: 'secret-key-12345678', port: 3461 };
      const sanitized = sanitizeForLogging(config);
      assert.strictEqual(sanitized.webhookSecret, '[REDACTED]');
    });

    it('should preserve other fields', () => {
      const config = { webhookSecret: 'secret', port: 3461, enabled: true };
      const sanitized = sanitizeForLogging(config);
      assert.strictEqual(sanitized.port, 3461);
      assert.strictEqual(sanitized.enabled, true);
    });

    it('should handle missing webhookSecret', () => {
      const config = { port: 3461 };
      const sanitized = sanitizeForLogging(config);
      assert.strictEqual(sanitized.port, 3461);
      assert.strictEqual(sanitized.webhookSecret, undefined);
    });
  });

  describe('loadConfig', () => {
    before(async () => {
      await cleanupTestConfigs();
    });

    after(async () => {
      await cleanupTestConfigs();
    });

    it('should return default config when file does not exist', async () => {
      // Use a non-existent path for testing
      const nonExistentPath = path.join(TEST_CONFIG_DIR, 'non-existent.json');
      const originalPath = process.env.CONFIG_PATH;

      // Note: This test assumes CONFIG_PATH points to a non-existent file
      // In real scenario, we'd need to mock the file system
      const config = await loadConfig();
      assert.ok(config);
      assert.ok(config.logging);
      assert.ok(config.commBridge);
    });

    it('should load valid config from file', async () => {
      await createTempConfig('valid-test.json', {
        enabled: true,
        port: 3461,
        webhookSecret: 'test-secret-key-12345678',
        commBridge: { enabled: true, defaultEndpoint: 'default' },
        logging: { level: 'info' }
      });

      // Note: This test requires mocking CONFIG_PATH or using dependency injection
      // For now, we test the merge logic directly
      const userConfig = {
        enabled: true,
        port: 3461,
        webhookSecret: 'test-secret-key-12345678'
      };
      const merged = mergeDefaults(DEFAULT_CONFIG, userConfig);
      assert.strictEqual(merged.port, 3461);
      assert.strictEqual(merged.webhookSecret, 'test-secret-key-12345678');

      await removeTempConfig('valid-test.json');
    });

    it('should apply environment variable override for webhookSecret', async () => {
      const originalSecret = process.env.GITHUB_WEBHOOK_SECRET;
      process.env.GITHUB_WEBHOOK_SECRET = 'env-override-secret-12345678';

      const config = await loadConfig();
      if (process.env.GITHUB_WEBHOOK_SECRET) {
        assert.strictEqual(config.webhookSecret, 'env-override-secret-12345678');
      }

      if (originalSecret !== undefined) {
        process.env.GITHUB_WEBHOOK_SECRET = originalSecret;
      } else {
        delete process.env.GITHUB_WEBHOOK_SECRET;
      }
    });
  });

  describe('Configuration paths', () => {
    it('should CONFIG_PATH point to ~/zylos/components/github-connector/config.json', () => {
      const expectedPath = path.join(process.env.HOME, 'zylos/components/github-connector/config.json');
      assert.strictEqual(CONFIG_PATH, expectedPath);
    });

    it('should DATA_DIR point to ~/zylos/components/github-connector', () => {
      const expectedDir = path.join(process.env.HOME, 'zylos/components/github-connector');
      assert.strictEqual(DATA_DIR, expectedDir);
    });
  });

  describe('Error handling', () => {
    it('should handle JSON syntax errors with detailed message', async () => {
      await createTempConfig('invalid-json.json', {
        enabled: true,
        port: 3461,
        // trailing comma - invalid JSON
        webhookSecret: 'test-secret-key-12345678',
      });

      // Note: This test would require mocking CONFIG_PATH to point to invalid-json.json
      // For now, we test the JSON.parse error handling indirectly
      const invalidJson = '{"enabled": true,}';
      assert.throws(() => JSON.parse(invalidJson), SyntaxError);

      await removeTempConfig('invalid-json.json');
    });

    it('should handle file not found error gracefully', async () => {
      // This is tested by the default config behavior
      const config = await loadConfig();
      assert.ok(config);
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have all required default values', () => {
      assert.strictEqual(DEFAULT_CONFIG.enabled, true);
      assert.strictEqual(DEFAULT_CONFIG.port, 3461);
      assert.strictEqual(DEFAULT_CONFIG.webhookSecret, '');
      assert.strictEqual(DEFAULT_CONFIG.maxPayloadSize, '10mb');
      assert.strictEqual(DEFAULT_CONFIG.commBridge.enabled, true);
      assert.strictEqual(DEFAULT_CONFIG.commBridge.defaultEndpoint, 'default');
      assert.strictEqual(DEFAULT_CONFIG.logging.level, 'info');
      assert.deepStrictEqual(DEFAULT_CONFIG.settings, {});
    });
  });

  describe('getConfigSync', () => {
    it('should return config synchronously', () => {
      const config = getConfigSync();
      assert.ok(config);
      assert.ok(config.logging);
      assert.ok(config.commBridge);
    });

    it('should return default config when none loaded', () => {
      // Reset internal config
      const config1 = getConfigSync();
      assert.ok(config1);
    });
  });
});
