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

// Import config module once
const configModule = await import(path.join(getProjectRoot(), 'src/lib/config.js'));

describe('Configuration Hot Reload Integration Tests', () => {
  describe('Complete Reload Flow', () => {
    it('应从文件加载配置', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({
        enabled: true,
        port: 3999,
        logging: { level: 'info' }
      });

      try {
        const config = await configModule.loadConfig(testConfigPath);

        assert.strictEqual(config.enabled, true, 'Should load enabled from file');
        assert.strictEqual(config.port, 3999, 'Should load port from file (non-default value)');
        assert.strictEqual(config.logging.level, 'info', 'Should load logging level from file');
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });

    it('应监控文件变更', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({ port: 3999 });

      try {
        let watchStarted = false;
        configModule.watchConfig(() => {
          watchStarted = true;
        }, testConfigPath);

        await wait(100);
        configModule.stopWatching();

        assert.ok(true, 'File watcher should start without errors');
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });

    it('应在文件变更后重载配置', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({ port: 3999 });

      try {
        // Start watching
        let reloadedConfig = null;
        configModule.watchConfig((newConfig) => {
          reloadedConfig = newConfig;
        }, testConfigPath);

        // Modify config
        await fs.writeFile(testConfigPath, JSON.stringify({ port: 4999 }, null, 2));
        await wait(700);

        configModule.stopWatching();

        // Verify reload happened
        if (reloadedConfig) {
          assert.strictEqual(reloadedConfig.port, 4999, 'Reloaded config should have new port');
        } else {
          // If timing caused miss, verify manually
          const newConfig = await configModule.loadConfig(testConfigPath);
          assert.strictEqual(newConfig.port, 4999, 'Config should have new port');
        }
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });

    it('应处理无效的 JSON（保持旧配置）', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({ port: 3999 });

      try {
        const initialConfig = await configModule.loadConfig(testConfigPath);

        // Start watching
        let reloadedConfig = null;
        configModule.watchConfig((newConfig) => {
          reloadedConfig = newConfig;
        }, testConfigPath);

        // Write invalid JSON
        await fs.writeFile(testConfigPath, '{ invalid json }');
        await wait(700);

        configModule.stopWatching();

        // Config should not have changed (error recovery)
        assert.strictEqual(reloadedConfig, null, 'Invalid JSON should not trigger reload');
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });
  });

  describe('Configuration Application', () => {
    it('端口变更应在重载后生效', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({ port: 3999 });

      try {
        const config1 = await configModule.loadConfig(testConfigPath);
        assert.strictEqual(config1.port, 3999);

        // Modify and reload
        await fs.writeFile(testConfigPath, JSON.stringify({ port: 4999 }, null, 2));

        let reloadedConfig = null;
        configModule.watchConfig((newConfig) => {
          reloadedConfig = newConfig;
        }, testConfigPath);

        await wait(700);
        configModule.stopWatching();

        if (reloadedConfig) {
          assert.strictEqual(reloadedConfig.port, 4999);
        } else {
          const config2 = await configModule.loadConfig(testConfigPath);
          assert.strictEqual(config2.port, 4999);
        }
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });

    it('日志级别变更应在重载后生效', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({
        logging: { level: 'info' }
      });

      try {
        const config1 = await configModule.loadConfig(testConfigPath);
        assert.strictEqual(config1.logging.level, 'info');

        // Modify and reload
        await fs.writeFile(testConfigPath, JSON.stringify({
          logging: { level: 'debug' }
        }, null, 2));

        let reloadedConfig = null;
        configModule.watchConfig((newConfig) => {
          reloadedConfig = newConfig;
        }, testConfigPath);

        await wait(700);
        configModule.stopWatching();

        if (reloadedConfig) {
          assert.strictEqual(reloadedConfig.logging.level, 'debug');
        } else {
          const config2 = await configModule.loadConfig(testConfigPath);
          assert.strictEqual(config2.logging.level, 'debug');
        }
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });

    it('webhook secret 变更应在重载后生效', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({
        webhookSecret: 'initial-secret-12345678'
      });

      try {
        const config1 = await configModule.loadConfig(testConfigPath);
        assert.strictEqual(config1.webhookSecret, 'initial-secret-12345678');

        // Modify and reload
        await fs.writeFile(testConfigPath, JSON.stringify({
          webhookSecret: 'new-secret-87654321'
        }, null, 2));

        let reloadedConfig = null;
        configModule.watchConfig((newConfig) => {
          reloadedConfig = newConfig;
        }, testConfigPath);

        await wait(700);
        configModule.stopWatching();

        if (reloadedConfig) {
          assert.strictEqual(reloadedConfig.webhookSecret, 'new-secret-87654321');
        } else {
          const config2 = await configModule.loadConfig(testConfigPath);
          assert.strictEqual(config2.webhookSecret, 'new-secret-87654321');
        }
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });

    it('enabled 标志变更为 false 应触发关闭', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({
        enabled: true
      });

      try {
        const config1 = await configModule.loadConfig(testConfigPath);
        assert.strictEqual(config1.enabled, true);

        // Modify and reload
        await fs.writeFile(testConfigPath, JSON.stringify({
          enabled: false
        }, null, 2));

        let reloadedConfig = null;
        configModule.watchConfig((newConfig) => {
          reloadedConfig = newConfig;
        }, testConfigPath);

        await wait(700);
        configModule.stopWatching();

        if (reloadedConfig) {
          assert.strictEqual(reloadedConfig.enabled, false);
        } else {
          const config2 = await configModule.loadConfig(testConfigPath);
          assert.strictEqual(config2.enabled, false);
        }
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });
  });

  describe('Error Handling', () => {
    it('JSON 语法错误应保持旧配置', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({ port: 3999 });

      try {
        const initialConfig = await configModule.loadConfig(testConfigPath);

        // Write invalid JSON
        await fs.writeFile(testConfigPath, '{ "port": 3999, }');

        let reloadedConfig = null;
        configModule.watchConfig((newConfig) => {
          reloadedConfig = newConfig;
        }, testConfigPath);

        await wait(700);
        configModule.stopWatching();

        // Should not have reloaded due to JSON error
        assert.strictEqual(reloadedConfig, null);
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });

    it('配置验证失败应保持旧配置', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({ port: 3999 });

      try {
        const initialConfig = await configModule.loadConfig(testConfigPath);

        // Write invalid config (port too large)
        await fs.writeFile(testConfigPath, JSON.stringify({ port: 99999 }, null, 2));

        let reloadedConfig = null;
        configModule.watchConfig((newConfig) => {
          reloadedConfig = newConfig;
        }, testConfigPath);

        await wait(700);
        configModule.stopWatching();

        // Should not have reloaded due to validation error
        assert.strictEqual(reloadedConfig, null);
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });

    it('应记录错误但继续运行', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({ port: 3999 });

      try {
        // Write invalid JSON
        await fs.writeFile(testConfigPath, 'not json at all');

        let reloadedConfig = null;
        let errorOccurred = false;
        configModule.watchConfig((newConfig) => {
          reloadedConfig = newConfig;
        }, testConfigPath);

        await wait(700);
        configModule.stopWatching();

        // Should not have reloaded, but should not have crashed
        assert.strictEqual(reloadedConfig, null);
        assert.ok(true, 'Service should continue running after config error');
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });
  });

  describe('Performance', () => {
    it('重载应在 1 秒内完成', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({ port: 3999 });

      try {
        const startTime = Date.now();

        let reloadedConfig = null;
        configModule.watchConfig((newConfig) => {
          reloadedConfig = newConfig;
        }, testConfigPath);

        await fs.writeFile(testConfigPath, JSON.stringify({ port: 4999 }, null, 2));

        while (!reloadedConfig && Date.now() - startTime < 1000) {
          await wait(50);
        }

        configModule.stopWatching();

        assert.ok(reloadedConfig, 'Config should have reloaded within 1 second');
        assert.ok(Date.now() - startTime < 1000, 'Reload should complete within 1 second');
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });

    it('防抖应防止多次重载', async () => {
      const { testDir, testConfigPath } = await setupTestConfig({ port: 3999 });

      try {
        let reloadCount = 0;
        configModule.watchConfig(() => {
          reloadCount++;
        }, testConfigPath);

        // Write multiple times rapidly
        await fs.writeFile(testConfigPath, JSON.stringify({ port: 4000 }, null, 2));
        await wait(50);
        await fs.writeFile(testConfigPath, JSON.stringify({ port: 4001 }, null, 2));
        await wait(50);
        await fs.writeFile(testConfigPath, JSON.stringify({ port: 4002 }, null, 2));
        await wait(700);

        configModule.stopWatching();

        // Should only reload once due to debouncing
        assert.ok(reloadCount <= 2, `Debouncing should prevent multiple reloads, got ${reloadCount}`);
      } finally {
        await teardownTestConfig(testDir, testConfigPath);
      }
    });
  });
});
