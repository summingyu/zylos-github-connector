#!/usr/bin/env node
/**
 * Configure hook for zylos-github-connector
 *
 * Called by zylos after collecting SKILL.md config.required values.
 * Receives a JSON object on stdin and writes component-owned config.json.
 *
 * Example stdin:
 *   { "GITHUB_WEBHOOK_SECRET": "secret" }
 */

import fs from 'node:fs';
import path from 'node:path';

const HOME = process.env.HOME;
const DATA_DIR = path.join(HOME, 'zylos/components/github-connector');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const COMPONENT_PREFIX = 'GITHUB_WEBHOOK_';

const DEFAULT_CONFIG = {
  enabled: true
};

function readStdin() {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { input += chunk; });
    process.stdin.on('end', () => resolve(input));
    process.stdin.on('error', reject);
  });
}

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return { ...fallback };
    return { ...fallback, ...JSON.parse(fs.readFileSync(filePath, 'utf8')) };
  } catch (err) {
    throw new Error(`Failed to read ${filePath}: ${err.message}`);
  }
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmpPath, filePath);
}

function configKeyFromRequiredName(name) {
  // Special case: GITHUB_WEBHOOK_SECRET -> webhookSecret (not 'secret')
  if (name === 'GITHUB_WEBHOOK_SECRET') {
    return 'webhookSecret';
  }
  // Special case: GITHUB_WEBHOOK_LOG_LEVEL -> logging.level (nested)
  if (name === 'GITHUB_WEBHOOK_LOG_LEVEL') {
    return 'logging.level';
  }
  return name
    .replace(new RegExp(`^${COMPONENT_PREFIX}`), '')
    .toLowerCase();
}

function convertConfigValue(key, value) {
  // Type conversion for port: string -> number with validation
  if (key === 'port' && typeof value === 'string') {
    // Validate that the value is a pure integer (no trailing characters)
    if (!/^\d+$/.test(value)) {
      console.error(`[configure] Invalid port value: "${value}". Must be a pure integer.`);
      process.exit(1);
    }
    const port = parseInt(value, 10);
    // Validate port range
    if (port < 1 || port > 65535) {
      console.error(`[configure] Port out of range: ${port}. Must be between 1 and 65535.`);
      process.exit(1);
    }
    return port;
  }
  return value;
}

/**
 * Set a nested config value using dot notation
 * @param {Object} obj - The config object
 * @param {string} path - The dot-notation path (e.g., 'logging.level')
 * @param {*} value - The value to set
 */
function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

try {
  const raw = (await readStdin()).trim();
  if (!raw) {
    throw new Error('Expected stdin JSON object with collected config values');
  }

  const collected = JSON.parse(raw);
  if (!collected || Array.isArray(collected) || typeof collected !== 'object') {
    throw new Error('Configure input must be a JSON object');
  }

  const config = readJsonFile(CONFIG_PATH, DEFAULT_CONFIG);
  for (const [name, value] of Object.entries(collected)) {
    if (value === undefined || value === null || value === '') continue;
    const key = configKeyFromRequiredName(name);
    const convertedValue = convertConfigValue(key, value);

    // Use nested assignment for keys with dots (e.g., 'logging.level')
    if (key.includes('.')) {
      setNestedValue(config, key, convertedValue);
    } else {
      config[key] = convertedValue;
    }
  }

  writeJsonFile(CONFIG_PATH, config);
  console.log(`[configure] Wrote config to ${CONFIG_PATH}`);
} catch (err) {
  console.error(`[configure] ${err.message}`);
  process.exit(1);
}
