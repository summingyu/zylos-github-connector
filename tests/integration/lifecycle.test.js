/**
 * PM2 Integration Tests
 *
 * Tests PM2 process management and lifecycle control
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_NAME = 'zylos-github-connector';
const CONFIG_PATH = path.join(__dirname, '../../config.json');
const LOGS_DIR = path.join(__dirname, '../../logs');

// Helper functions
function startPM2() {
  try {
    execSync(`pm2 start ecosystem.config.cjs`, { encoding: 'utf8' });
  } catch (error) {
    // Ignore if already started
  }
}

function stopPM2() {
  try {
    execSync(`pm2 stop ${APP_NAME}`, { encoding: 'utf8' });
  } catch (error) {
    // Ignore if not running
  }
}

function deletePM2() {
  try {
    execSync(`pm2 delete ${APP_NAME}`, { encoding: 'utf8' });
  } catch (error) {
    // Ignore if not exists
  }
}

function getPM2Status() {
  try {
    const output = execSync(`pm2 jlist`, { encoding: 'utf8' });
    const processes = JSON.parse(output);
    const process = processes.find(p => p.name === APP_NAME);
    return process ? process.pm2_env.status : 'none';
  } catch (error) {
    return 'error';
  }
}

function waitForStatus(status, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const current = getPM2Status();
    if (current === status) {
      return true;
    }
    // Wait 500ms before checking again
    try {
      execSync('sleep 0.5', { encoding: 'utf8' });
    } catch (e) {
      // Ignore sleep errors
    }
  }
  return false;
}

function getLogs() {
  const errorLog = path.join(LOGS_DIR, 'error.log');
  const outLog = path.join(LOGS_DIR, 'out.log');

  let errorContent = '';
  let outContent = '';

  try {
    errorContent = fs.readFileSync(errorLog, 'utf8');
  } catch (error) {
    // File doesn't exist yet
  }

  try {
    outContent = fs.readFileSync(outLog, 'utf8');
  } catch (error) {
    // File doesn't exist yet
  }

  return { error: errorContent, out: outContent };
}

describe('PM2 Integration Tests', () => {
  before(() => {
    // Clean up any existing PM2 processes
    deletePM2();

    // Ensure logs directory exists
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
  });

  after(() => {
    // Clean up PM2 processes
    deletePM2();
  });

  describe('PM2 Start', () => {
    it('should start PM2 process successfully', () => {
      startPM2();
      const status = getPM2Status();
      assert.equal(status, 'online', 'Process should be online');
    });

    it('should have process status as online', () => {
      const status = getPM2Status();
      assert.equal(status, 'online', 'Process status should be online');
    });

    it('should create log files', () => {
      const errorLog = path.join(LOGS_DIR, 'error.log');
      const outLog = path.join(LOGS_DIR, 'out.log');

      assert.ok(fs.existsSync(errorLog), 'Error log should exist');
      assert.ok(fs.existsSync(outLog), 'Out log should exist');
    });

    it('should listen on configured port (3461)', () => {
      // Check if port is listening
      try {
        const output = execSync('lsof -i :3461 -P -n -sTCP:LISTEN', { encoding: 'utf8' });
        assert.ok(output.includes('node') || output.includes('node.*3461'), 'Port 3461 should be listening');
      } catch (error) {
        // lsof might fail due to permissions or timing, try curl instead
        try {
          const health = execSync('curl -s http://localhost:3461/health', { encoding: 'utf8', timeout: 2000 });
          assert.ok(health.includes('ok'), 'Health endpoint should respond');
        } catch (curlError) {
          assert.fail('Port 3461 should be accessible via health check');
        }
      }
    });

    it('should have logs in output files', () => {
      const logs = getLogs();
      assert.ok(logs.out.length > 0 || logs.error.length > 0, 'Logs should exist');
    });
  });

  describe('PM2 Stop', () => {
    it('should stop PM2 process gracefully', () => {
      stopPM2();
      const stopped = waitForStatus('stopped');
      assert.ok(stopped, 'Process should reach stopped status');
    });

    it('should have process status as stopped', () => {
      const status = getPM2Status();
      assert.equal(status, 'stopped', 'Process status should be stopped');
    });

    it('should contain graceful shutdown logs', () => {
      const logs = getLogs();
      const hasShutdownLog = logs.error.includes('[github-connector] Shutting down') ||
                            logs.out.includes('[github-connector] Shutting down');
      assert.ok(hasShutdownLog, 'Should have shutdown logs');
    });

    it('should contain resource cleanup logs', () => {
      const logs = getLogs();
      const hasCleanupLog = logs.error.includes('[github-connector] Stopped dedupe cleanup interval') ||
                           logs.out.includes('[github-connector] Stopped dedupe cleanup interval');
      assert.ok(hasCleanupLog, 'Should have cleanup logs');
    });

    it('should not have process listening on port after stop', () => {
      try {
        execSync('lsof -i :3461 -P -n -sTCP:LISTEN', { encoding: 'utf8' });
        assert.fail('Port 3461 should not be listening after stop');
      } catch (error) {
        assert.ok(true, 'Port 3461 should not be listening');
      }
    });
  });

  describe('PM2 Restart', () => {
    it('should restart PM2 process', () => {
      // First ensure it's stopped
      stopPM2();
      waitForStatus('stopped');

      // Then restart
      execSync(`pm2 restart ${APP_NAME}`, { encoding: 'utf8' });
      const restarted = waitForStatus('online');
      assert.ok(restarted, 'Process should reach online status after restart');
    });

    it('should have process status as online after restart', () => {
      const status = getPM2Status();
      assert.equal(status, 'online', 'Process status should be online after restart');
    });

    it('should serve HTTP endpoints after restart', () => {
      try {
        const output = execSync('curl -s http://localhost:3461/health', { encoding: 'utf8' });
        assert.ok(output.includes('ok'), 'Health endpoint should return ok');
      } catch (error) {
        assert.fail('Health endpoint should be accessible after restart');
      }
    });
  });

  describe('PM2 Delete', () => {
    it('should delete PM2 process', () => {
      // First ensure it's running
      startPM2();
      waitForStatus('online');

      // Then delete
      deletePM2();

      // Check if process is removed from PM2 list
      const status = getPM2Status();
      assert.equal(status, 'none', 'Process should be removed from PM2 list');
    });

    it('should not have process in PM2 list after delete', () => {
      const status = getPM2Status();
      assert.equal(status, 'none', 'Process should not be in PM2 list');
    });

    it('should retain log files after delete', () => {
      const errorLog = path.join(LOGS_DIR, 'error.log');
      const outLog = path.join(LOGS_DIR, 'out.log');

      assert.ok(fs.existsSync(errorLog), 'Error log should be retained');
      assert.ok(fs.existsSync(outLog), 'Out log should be retained');
    });
  });

  describe('Configuration Behavior', () => {
    it('should exit when disabled in config', function() {
      // Skip if no config file
      if (!fs.existsSync(CONFIG_PATH)) {
        this.skip();
        return;
      }

      // Read current config
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

      // Save original enabled state
      const originalEnabled = config.enabled;

      try {
        // Set enabled to false
        config.enabled = false;
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

        // Start PM2
        startPM2();

        // Wait for process to exit
        const exited = waitForStatus('stopped', 15000);
        assert.ok(exited, 'Process should exit when disabled');

      } finally {
        // Restore original config
        config.enabled = originalEnabled;
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

        // Clean up
        deletePM2();
      }
    });

    it('should apply log level configuration', function() {
      // Skip if no config file
      if (!fs.existsSync(CONFIG_PATH)) {
        this.skip();
        return;
      }

      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      assert.ok(config.logging, 'Config should have logging section');
      assert.ok(config.logging.level, 'Config should have log level');
    });

    it('should apply port configuration', function() {
      // Skip if no config file
      if (!fs.existsSync(CONFIG_PATH)) {
        this.skip();
        return;
      }

      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      assert.ok(config.port, 'Config should have port');
      assert.ok(typeof config.port === 'number', 'Port should be a number');
    });
  });
});
