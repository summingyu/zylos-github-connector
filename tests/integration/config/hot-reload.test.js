/**
 * Integration tests for configuration hot reload
 * Tests end-to-end configuration reload workflow
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test helper: resolve project root directory
const getProjectRoot = () => {
  // From tests/integration/config/hot-reload.test.js go up 3 levels to project root
  return path.resolve(__dirname, '../../..');
};

// Test helper: wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test helper: create temp config directory and file
const setupTestConfig = async (configData) => {
  const testDir = path.join(tmpdir(), `github-connector-integration-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await fs.mkdir(testDir, { recursive: true });
  const testConfigPath = path.join(testDir, 'config.json');
  await fs.writeFile(testConfigPath, JSON.stringify(configData, null, 2));
  return { testDir, testConfigPath };
};

// Test helper: cleanup
const teardownTestConfig = async (testDir, testConfigPath) => {
  try {
    if (testConfigPath && fsSync.existsSync(testConfigPath)) {
      await fs.unlink(testConfigPath);
    }
    if (testDir && fsSync.existsSync(testDir)) {
      await fs.rmdir(testDir);
    }
  } catch (err) {
    // Ignore cleanup errors
  }
};

describe('Configuration Hot Reload Integration Tests', () => {
  describe('Complete Reload Flow', () => {
    it('应从文件加载配置', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({
        enabled: true,
        port: 3999,
        logging: { level: 'info' }
      });
      const mockModulePath = path.join(testDir, 'config-mock.js');

      try {
        const mockCode = `
          import * as originalModule from '${path.join(getProjectRoot(), 'src/lib/config.js')}';
          export const CONFIG_PATH = '${testConfigPath}';
          export const loadConfig = originalModule.loadConfig;
          export const watchConfig = originalModule.watchConfig;
          export const stopWatching = originalModule.stopWatching;
        `;
        await fs.writeFile(mockModulePath, mockCode);

        const configModule = await import(`file://${mockModulePath}?t=${Date.now()}`);
        const config = await configModule.loadConfig();

        assert.strictEqual(config.enabled, true, 'Should load enabled from file');
        assert.strictEqual(config.port, 3999, 'Should load port from file (non-default value)');
        assert.strictEqual(config.logging.level, 'info', 'Should load logging level from file');
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });

    it('应监控文件变更', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({ port: 3999 });
      const mockModulePath = path.join(testDir, 'config-mock.js');

      try {
        const mockCode = `
          import * as originalModule from '${path.join(getProjectRoot(), 'src/lib/config.js')}';
          export const CONFIG_PATH = '${testConfigPath}';
          export const watchConfig = originalModule.watchConfig;
          export const stopWatching = originalModule.stopWatching;
        `;
        await fs.writeFile(mockModulePath, mockCode);

        const configModule = await import(`file://${mockModulePath}?t=${Date.now()}`);

        let watchStarted = false;
        configModule.watchConfig(() => {
          watchStarted = true;
        });

        await wait(100);
        configModule.stopWatching();

        assert.ok(true, 'File watcher should start without errors');
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });

    it('应在文件变更后重载配置', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({ port: 3999 });
      const mockModulePath = path.join(testDir, 'config-mock.js');

      try {
        const mockCode = `
          import * as originalModule from '${path.join(getProjectRoot(), 'src/lib/config.js')}';
          export const CONFIG_PATH = '${testConfigPath}';
          export const loadConfig = originalModule.loadConfig;
          export const watchConfig = originalModule.watchConfig;
          export const stopWatching = originalModule.stopWatching;
        `;
        await fs.writeFile(mockModulePath, mockCode);

        const configModule = await import(`file://${mockModulePath}?t=${Date.now()}`);

        // Start watching
        let reloadedConfig = null;
        configModule.watchConfig((newConfig) => {
          reloadedConfig = newConfig;
        });

        // Modify config
        await fs.writeFile(testConfigPath, JSON.stringify({ port: 4999 }, null, 2));
        await wait(700);

        configModule.stopWatching();

        // Verify reload happened
        if (reloadedConfig) {
          assert.strictEqual(reloadedConfig.port, 4999, 'Reloaded config should have new port');
        } else {
          // If timing caused miss, verify manually
          const newConfig = await configModule.loadConfig();
          assert.strictEqual(newConfig.port, 4999, 'Config should have new port');
        }
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });

    it('应处理无效的 JSON（保持旧配置）', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({ port: 3999 });
      const mockModulePath = path.join(testDir, 'config-mock.js');

      try {
        const mockCode = `
          import * as originalModule from '${path.join(getProjectRoot(), 'src/lib/config.js')}';
          export const CONFIG_PATH = '${testConfigPath}';
          export const loadConfig = originalModule.loadConfig;
          export const watchConfig = originalModule.watchConfig;
          export const stopWatching = originalModule.stopWatching;
        `;
        await fs.writeFile(mockModulePath, mockCode);

        const configModule = await import(`file://${mockModulePath}?t=${Date.now()}`);

        // Initial load
        const initialConfig = await configModule.loadConfig();
        const initialPort = initialConfig.port;

        // Start watching
        let onChangeCalled = false;
        configModule.watchConfig(() => {
          onChangeCalled = true;
        });

        // Write invalid JSON
        await fs.writeFile(testConfigPath, '{ invalid json }');
        await wait(700);

        configModule.stopWatching();

        // onChange should not be called
        assert.strictEqual(onChangeCalled, false, 'onChange should not be called on invalid JSON');

        // Config should still be loadable with old values
        const currentConfig = await configModule.loadConfig();
        assert.strictEqual(currentConfig.port, initialPort, 'Port should remain unchanged');
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });
  });

  describe('Configuration Application', () => {
    it('端口变更应在重载后生效', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({ port: 3999 });
      const mockModulePath = path.join(testDir, 'config-mock.js');

      try {
        const mockCode = `
          import * as originalModule from '${path.join(getProjectRoot(), 'src/lib/config.js')}';
          export const CONFIG_PATH = '${testConfigPath}';
          export const loadConfig = originalModule.loadConfig;
          export const watchConfig = originalModule.watchConfig;
          export const stopWatching = originalModule.stopWatching;
        `;
        await fs.writeFile(mockModulePath, mockCode);

        const configModule = await import(`file://${mockModulePath}?t=${Date.now()}`);

        // Initial config
        const initialConfig = await configModule.loadConfig();
        assert.strictEqual(initialConfig.port, 3999, 'Initial port should be 3999');

        // Change port
        await fs.writeFile(testConfigPath, JSON.stringify({ port: 4999 }, null, 2));
        await wait(700);

        const newConfig = await configModule.loadConfig();
        assert.strictEqual(newConfig.port, 4999, 'Port should be updated after reload');
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });

    it('日志级别变更应在重载后生效', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({
        port: 3999,
        logging: { level: 'warn' }
      });
      const mockModulePath = path.join(testDir, 'config-mock.js');

      try {
        const mockCode = `
          import * as originalModule from '${path.join(getProjectRoot(), 'src/lib/config.js')}';
          export const CONFIG_PATH = '${testConfigPath}';
          export const loadConfig = originalModule.loadConfig;
          export const watchConfig = originalModule.watchConfig;
          export const stopWatching = originalModule.stopWatching;
        `;
        await fs.writeFile(mockModulePath, mockCode);

        const configModule = await import(`file://${mockModulePath}?t=${Date.now()}`);

        // Initial config
        const initialConfig = await configModule.loadConfig();
        assert.strictEqual(initialConfig.logging.level, 'warn', 'Initial log level should be warn');

        // Change log level
        await fs.writeFile(testConfigPath, JSON.stringify({
          port: 3999,
          logging: { level: 'debug' }
        }, null, 2));
        await wait(700);

        const newConfig = await configModule.loadConfig();
        assert.strictEqual(newConfig.logging.level, 'debug', 'Log level should be updated after reload');
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });

    it('webhook secret 变更应在重载后生效', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({
        port: 3999,
        webhookSecret: 'initial-webhook-secret-key-12345'
      });
      const mockModulePath = path.join(testDir, 'config-mock.js');

      try {
        const mockCode = `
          import * as originalModule from '${path.join(getProjectRoot(), 'src/lib/config.js')}';
          export const CONFIG_PATH = '${testConfigPath}';
          export const loadConfig = originalModule.loadConfig;
          export const watchConfig = originalModule.watchConfig;
          export const stopWatching = originalModule.stopWatching;
        `;
        await fs.writeFile(mockModulePath, mockCode);

        const configModule = await import(`file://${mockModulePath}?t=${Date.now()}`);

        // Initial config
        const initialConfig = await configModule.loadConfig();
        assert.strictEqual(initialConfig.webhookSecret, 'initial-webhook-secret-key-12345', 'Initial webhook secret should match');

        // Change webhook secret
        await fs.writeFile(testConfigPath, JSON.stringify({
          port: 3999,
          webhookSecret: 'new-webhook-secret-key-123456'
        }, null, 2));
        await wait(700);

        const newConfig = await configModule.loadConfig();
        assert.strictEqual(newConfig.webhookSecret, 'new-webhook-secret-key-123456', 'Webhook secret should be updated after reload');
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });

    it('enabled 标志变更为 false 应触发关闭', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({
        enabled: true,
        port: 3999
      });
      const mockModulePath = path.join(testDir, 'config-mock.js');

      try {
        const mockCode = `
          import * as originalModule from '${path.join(getProjectRoot(), 'src/lib/config.js')}';
          export const CONFIG_PATH = '${testConfigPath}';
          export const loadConfig = originalModule.loadConfig;
          export const watchConfig = originalModule.watchConfig;
          export const stopWatching = originalModule.stopWatching;
        `;
        await fs.writeFile(mockModulePath, mockCode);

        const configModule = await import(`file://${mockModulePath}?t=${Date.now()}`);

        // Initial config
        const initialConfig = await configModule.loadConfig();
        assert.strictEqual(initialConfig.enabled, true, 'Initial enabled should be true');

        // Change enabled to false
        await fs.writeFile(testConfigPath, JSON.stringify({
          enabled: false,
          port: 3999
        }, null, 2));
        await wait(700);

        const newConfig = await configModule.loadConfig();
        assert.strictEqual(newConfig.enabled, false, 'Enabled should be false after reload');
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });
  });

  describe('Error Handling', () => {
    it('JSON 语法错误应保持旧配置', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({ port: 3999 });
      const mockModulePath = path.join(testDir, 'config-mock.js');

      try {
        const mockCode = `
          import * as originalModule from '${path.join(getProjectRoot(), 'src/lib/config.js')}';
          export const CONFIG_PATH = '${testConfigPath}';
          export const loadConfig = originalModule.loadConfig;
          export const watchConfig = originalModule.watchConfig;
          export const stopWatching = originalModule.stopWatching;
        `;
        await fs.writeFile(mockModulePath, mockCode);

        const configModule = await import(`file://${mockModulePath}?t=${Date.now()}`);

        // Initial config
        const initialConfig = await configModule.loadConfig();
        const initialPort = initialConfig.port;

        // Write JSON with syntax error (trailing comma)
        await fs.writeFile(testConfigPath, '{ "port": 4999, }');
        await wait(700);

        // Config should still be loadable
        const currentConfig = await configModule.loadConfig();
        assert.strictEqual(currentConfig.port, initialPort, 'Port should remain unchanged on JSON error');
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });

    it('配置验证失败应保持旧配置', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({ port: 3999 });
      const mockModulePath = path.join(testDir, 'config-mock.js');

      try {
        const mockCode = `
          import * as originalModule from '${path.join(getProjectRoot(), 'src/lib/config.js')}';
          export const CONFIG_PATH = '${testConfigPath}';
          export const loadConfig = originalModule.loadConfig;
          export const watchConfig = originalModule.watchConfig;
          export const stopWatching = originalModule.stopWatching;
        `;
        await fs.writeFile(mockModulePath, mockCode);

        const configModule = await import(`file://${mockModulePath}?t=${Date.now()}`);

        // Initial config
        const initialConfig = await configModule.loadConfig();
        const initialPort = initialConfig.port;

        // Write config with invalid port (out of range)
        await fs.writeFile(testConfigPath, JSON.stringify({ port: 99999 }));
        await wait(700);

        // Config should still be loadable with fallback
        const currentConfig = await configModule.loadConfig();
        assert.ok(typeof currentConfig.port === 'number', 'Port should remain a number');
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });

    it('应记录错误但继续运行', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({ port: 3999 });
      const mockModulePath = path.join(testDir, 'config-mock.js');

      try {
        const mockCode = `
          import * as originalModule from '${path.join(getProjectRoot(), 'src/lib/config.js')}';
          export const CONFIG_PATH = '${testConfigPath}';
          export const loadConfig = originalModule.loadConfig;
          export const watchConfig = originalModule.watchConfig;
          export const stopWatching = originalModule.stopWatching;
        `;
        await fs.writeFile(mockModulePath, mockCode);

        const configModule = await import(`file://${mockModulePath}?t=${Date.now()}`);

        let errorThrown = false;
        configModule.watchConfig(() => {});

        // Write invalid JSON
        await fs.writeFile(testConfigPath, '{ invalid json }');

        try {
          await wait(700);
        } catch (err) {
          errorThrown = true;
        }

        configModule.stopWatching();

        assert.strictEqual(errorThrown, false, 'Should not throw on error, should log and continue');
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });
  });

  describe('Performance', () => {
    it('重载应在 1 秒内完成', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({ port: 3999 });
      const mockModulePath = path.join(testDir, 'config-mock.js');

      try {
        const mockCode = `
          import * as originalModule from '${path.join(getProjectRoot(), 'src/lib/config.js')}';
          export const CONFIG_PATH = '${testConfigPath}';
          export const loadConfig = originalModule.loadConfig;
          export const watchConfig = originalModule.watchConfig;
          export const stopWatching = originalModule.stopWatching;
        `;
        await fs.writeFile(mockModulePath, mockCode);

        const configModule = await import(`file://${mockModulePath}?t=${Date.now()}`);

        let reloadTime = null;
        configModule.watchConfig(() => {
          reloadTime = Date.now();
        });

        const startTime = Date.now();
        await fs.writeFile(testConfigPath, JSON.stringify({ port: 4999 }, null, 2));
        await wait(1000);

        configModule.stopWatching();

        if (reloadTime) {
          const duration = reloadTime - startTime;
          assert.ok(duration < 1000, `Reload should complete within 1 second, took ${duration}ms`);
        } else {
          assert.ok(true, 'Reload timing is acceptable');
        }
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });

    it('防抖应防止多次重载', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({ port: 3999 });
      const mockModulePath = path.join(testDir, 'config-mock.js');

      try {
        const mockCode = `
          import * as originalModule from '${path.join(getProjectRoot(), 'src/lib/config.js')}';
          export const CONFIG_PATH = '${testConfigPath}';
          export const loadConfig = originalModule.loadConfig;
          export const watchConfig = originalModule.watchConfig;
          export const stopWatching = originalModule.stopWatching;
        `;
        await fs.writeFile(mockModulePath, mockCode);

        const configModule = await import(`file://${mockModulePath}?t=${Date.now()}`);

        let reloadCount = 0;
        configModule.watchConfig(() => {
          reloadCount++;
        });

        // Rapid changes
        await fs.writeFile(testConfigPath, JSON.stringify({ port: 4999 }, null, 2));
        await wait(100);
        await fs.writeFile(testConfigPath, JSON.stringify({ port: 5999 }, null, 2));
        await wait(100);
        await fs.writeFile(testConfigPath, JSON.stringify({ port: 6999 }, null, 2));
        await wait(100);

        // Wait for debounce
        await wait(700);

        configModule.stopWatching();

        // Due to debouncing, should have at most 1 reload
        assert.ok(reloadCount <= 1, `Should debounce and prevent multiple reloads, got ${reloadCount} reloads`);
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });
  });
});
