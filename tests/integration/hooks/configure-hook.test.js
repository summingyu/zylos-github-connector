/**
 * Integration tests for configure hook
 * Tests validation logic, key mapping, and config file writing
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test helper: get project root
const getProjectRoot = () => {
  return path.resolve(__dirname, '../../..');
};

// Test helper: create temporary config directory
const createTempConfigDir = async () => {
  // Use fs.mkdtemp() for safe temporary directory creation
  return await fs.mkdtemp(path.join(tmpdir(), 'github-connector-hooks-test-'));
};

// Test helper: cleanup temporary directory
const cleanupTempDir = async (tempDir) => {
  try {
    if (tempDir && fsSync.existsSync(tempDir)) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  } catch (err) {
    // Log warning but don't fail the test
    console.error(`[warning] Failed to cleanup temp dir ${tempDir}:`, err.message);
  }
};

// Test helper: run configure hook with input
const runConfigure = async (input, tempHome, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const configurePath = path.join(getProjectRoot(), 'hooks/configure.js');

    const proc = spawn('node', [configurePath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        HOME: tempHome
      }
    });

    let stdout = '';
    let stderr = '';

    // Set up timeout to prevent hanging
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`Process timeout after ${timeout}ms`));
    }, timeout);

    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
};

// Track temp directories for cleanup
const tempDirs = [];

// Cleanup all temp directories after tests
after(async () => {
  for (const dir of tempDirs) {
    await cleanupTempDir(dir);
  }
});

describe('Configure Hook Integration Tests', () => {
  describe('Port Validation', () => {
    it('应接受有效的纯整数端口', async () => {
      const tempHome = await createTempConfigDir();
      tempDirs.push(tempHome);

      const { code, stdout } = await runConfigure({
        GITHUB_WEBHOOK_PORT: '3461'
      }, tempHome);

      assert.strictEqual(code, 0, 'Should succeed with valid port');
      assert.ok(stdout.includes('[configure]'), 'Should output configure log');
    });

    it('应拒绝非纯整数端口 (abc)', async () => {
      const tempHome = await createTempConfigDir();
      tempDirs.push(tempHome);

      const { code, stderr } = await runConfigure({
        GITHUB_WEBHOOK_PORT: 'abc'
      }, tempHome);

      assert.strictEqual(code, 1, 'Should fail with non-integer port');
      assert.ok(stderr.includes('Invalid port value'), 'Should output validation error');
    });

    it('应拒绝带尾随字符的端口 (3000abc)', async () => {
      const tempHome = await createTempConfigDir();
      tempDirs.push(tempHome);

      const { code, stderr } = await runConfigure({
        GITHUB_WEBHOOK_PORT: '3000abc'
      }, tempHome);

      assert.strictEqual(code, 1, 'Should fail with trailing characters');
      assert.ok(stderr.includes('Invalid port value'), 'Should output validation error');
    });

    it('应拒绝超出范围的端口 (0)', async () => {
      const tempHome = await createTempConfigDir();
      tempDirs.push(tempHome);

      const { code, stderr } = await runConfigure({
        GITHUB_WEBHOOK_PORT: '0'
      }, tempHome);

      assert.strictEqual(code, 1, 'Should fail with port 0');
      assert.ok(stderr.includes('Port out of range'), 'Should output range error');
    });

    it('应拒绝超出范围的端口 (65536)', async () => {
      const tempHome = await createTempConfigDir();
      tempDirs.push(tempHome);

      const { code, stderr } = await runConfigure({
        GITHUB_WEBHOOK_PORT: '65536'
      }, tempHome);

      assert.strictEqual(code, 1, 'Should fail with port 65536');
      assert.ok(stderr.includes('Port out of range'), 'Should output range error');
    });

    it('应接受边界值端口 (1 和 65535)', async () => {
      const tempHome1 = await createTempConfigDir();
      const tempHome2 = await createTempConfigDir();
      tempDirs.push(tempHome1, tempHome2);

      const result1 = await runConfigure({
        GITHUB_WEBHOOK_PORT: '1'
      }, tempHome1);
      assert.strictEqual(result1.code, 0, 'Should accept port 1');

      const result2 = await runConfigure({
        GITHUB_WEBHOOK_PORT: '65535'
      }, tempHome2);
      assert.strictEqual(result2.code, 0, 'Should accept port 65535');
    });
  });

  describe('Key Mapping', () => {
    it('应正确映射 GITHUB_WEBHOOK_SECRET 到 webhookSecret', async () => {
      const tempHome = await createTempConfigDir();
      tempDirs.push(tempHome);

      await runConfigure({
        GITHUB_WEBHOOK_SECRET: 'test-secret-12345678'
      }, tempHome);

      const configPath = path.join(tempHome, 'zylos/components/github-connector/config.json');
      const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
      assert.strictEqual(config.webhookSecret, 'test-secret-12345678');
    });

    it('应正确映射 GITHUB_WEBHOOK_PORT 到 port (number)', async () => {
      const tempHome = await createTempConfigDir();
      tempDirs.push(tempHome);

      await runConfigure({
        GITHUB_WEBHOOK_PORT: '3999'
      }, tempHome);

      const configPath = path.join(tempHome, 'zylos/components/github-connector/config.json');
      const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
      assert.strictEqual(typeof config.port, 'number', 'Port should be number');
      assert.strictEqual(config.port, 3999);
    });

    it('应正确映射 GITHUB_WEBHOOK_LOG_LEVEL 到 logging.level (nested)', async () => {
      const tempHome = await createTempConfigDir();
      tempDirs.push(tempHome);

      await runConfigure({
        GITHUB_WEBHOOK_LOG_LEVEL: 'debug'
      }, tempHome);

      const configPath = path.join(tempHome, 'zylos/components/github-connector/config.json');
      const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
      assert.strictEqual(config.logging?.level, 'debug');
    });
  });

  describe('Config File Writing', () => {
    it('应创建配置文件目录（如果不存在）', async () => {
      const tempHome = await createTempConfigDir();
      tempDirs.push(tempHome);

      const configDir = path.join(tempHome, 'zylos/components/github-connector');
      assert.ok(!fsSync.existsSync(configDir), 'Config dir should not exist');

      await runConfigure({
        GITHUB_WEBHOOK_PORT: '3461'
      }, tempHome);

      assert.ok(fsSync.existsSync(configDir), 'Config dir should be created');
      const configPath = path.join(configDir, 'config.json');
      assert.ok(fsSync.existsSync(configPath), 'Config file should be created');
    });

    it('应合并新配置与现有配置', async () => {
      const tempHome = await createTempConfigDir();
      tempDirs.push(tempHome);

      const configDir = path.join(tempHome, 'zylos/components/github-connector');
      await fs.mkdir(configDir, { recursive: true });
      const configPath = path.join(configDir, 'config.json');

      // Create initial config with existing values
      await fs.writeFile(configPath, JSON.stringify({
        enabled: true,
        webhookSecret: 'existing-secret'
      }, null, 2));

      // Run configure with only port update
      await runConfigure({
        GITHUB_WEBHOOK_PORT: '3999'
      }, tempHome);

      const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
      assert.strictEqual(config.port, 3999, 'Port should be updated');
      assert.strictEqual(config.enabled, true, 'Existing enabled should be preserved');
      assert.strictEqual(config.webhookSecret, 'existing-secret', 'Existing webhookSecret should be preserved');
    });

    it('应忽略空值和 undefined', async () => {
      const tempHome = await createTempConfigDir();
      tempDirs.push(tempHome);

      const configDir = path.join(tempHome, 'zylos/components/github-connector');
      await fs.mkdir(configDir, { recursive: true });
      const configPath = path.join(configDir, 'config.json');

      // Create initial config
      await fs.writeFile(configPath, JSON.stringify({
        port: 3461
      }, null, 2));

      // Run configure with empty values
      await runConfigure({
        GITHUB_WEBHOOK_PORT: '',
        GITHUB_WEBHOOK_SECRET: null
      }, tempHome);

      const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
      assert.strictEqual(config.port, 3461, 'Port should not be overwritten');
    });

    it('应使用原子写入（.tmp 文件）', async () => {
      const tempHome = await createTempConfigDir();
      tempDirs.push(tempHome);

      await runConfigure({
        GITHUB_WEBHOOK_PORT: '3461'
      }, tempHome);

      const configDir = path.join(tempHome, 'zylos/components/github-connector');
      const configPath = path.join(configDir, 'config.json');

      // Verify file exists and no .tmp file remains
      assert.ok(fsSync.existsSync(configPath), 'Config file should exist');
      assert.ok(!fsSync.existsSync(`${configPath}.tmp`), 'Temp file should be removed');
    });
  });

  describe('Error Handling', () => {
    it('应拒绝无效的 JSON 输入', async () => {
      const tempHome = await createTempConfigDir();
      tempDirs.push(tempHome);

      return new Promise((resolve) => {
        const configurePath = path.join(getProjectRoot(), 'hooks/configure.js');
        const proc = spawn('node', [configurePath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, HOME: tempHome }
        });

        proc.stdin.write('not json');
        proc.stdin.end();

        proc.on('close', (code) => {
          assert.strictEqual(code, 1, 'Should fail with invalid JSON');
          resolve();
        });
      });
    });

    it('应拒绝空输入', async () => {
      const tempHome = await createTempConfigDir();
      tempDirs.push(tempHome);

      return new Promise((resolve) => {
        const configurePath = path.join(getProjectRoot(), 'hooks/configure.js');
        const proc = spawn('node', [configurePath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, HOME: tempHome }
        });

        proc.stdin.write('');
        proc.stdin.end();

        proc.on('close', (code) => {
          assert.strictEqual(code, 1, 'Should fail with empty input');
          resolve();
        });
      });
    });

    it('应拒绝非对象输入', async () => {
      const tempHome = await createTempConfigDir();
      tempDirs.push(tempHome);

      const { code } = await runConfigure([], tempHome);
      assert.strictEqual(code, 1, 'Should fail with array input');
    });
  });
});
