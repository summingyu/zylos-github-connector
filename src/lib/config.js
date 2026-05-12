/**
 * Configuration loader for zylos-github-connector
 *
 * Loads config from ~/zylos/components/github-connector/config.json
 * with hot-reload support via file watcher.
 */

import fs from 'fs';
import path from 'path';

const HOME = process.env.HOME;
export const DATA_DIR = path.join(HOME, 'zylos/components/github-connector');
export const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

// Default configuration
export const DEFAULT_CONFIG = {
  enabled: true,
  port: 3461,
  webhookSecret: '',
  commBridge: {
    enabled: true,
    defaultEndpoint: 'default'
  },
  logging: {
    level: 'info'
  },
  settings: {}
};

let config = null;
let configWatcher = null;

/**
 * Load configuration from file
 * @returns {Object} Configuration object
 */
export function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const content = fs.readFileSync(CONFIG_PATH, 'utf8');
      config = { ...DEFAULT_CONFIG, ...JSON.parse(content) };
    } else {
      console.warn(`[github-connector] Config file not found: ${CONFIG_PATH}`);
      config = { ...DEFAULT_CONFIG };
    }

    // Apply environment variable overrides
    if (process.env.GITHUB_WEBHOOK_SECRET) {
      config.webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
      console.log('[github-connector] Using webhook secret from environment variable');
    }

    // Validate webhook secret
    if (!config.webhookSecret || config.webhookSecret === '') {
      console.warn('[github-connector] WARNING: webhookSecret is not configured!');
      console.warn('[github-connector] Webhook signature verification will fail.');
      console.warn('[github-connector] Set webhookSecret in config.json or GITHUB_WEBHOOK_SECRET environment variable.');
    }
  } catch (err) {
    console.error(`[github-connector] Failed to load config: ${err.message}`);
    config = { ...DEFAULT_CONFIG };
  }
  return config;
}

/**
 * Get current configuration
 * @returns {Object} Configuration object
 */
export function getConfig() {
  if (!config) {
    loadConfig();
  }
  return config;
}

/**
 * Save configuration to file
 * @param {Object} newConfig - Configuration to save
 */
export function saveConfig(newConfig) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
    config = newConfig;
  } catch (err) {
    console.error(`[github-connector] Failed to save config: ${err.message}`);
    throw err;
  }
}

/**
 * Start watching config file for changes
 * @param {Function} onChange - Callback when config changes
 */
export function watchConfig(onChange) {
  if (configWatcher) {
    configWatcher.close();
  }

  if (fs.existsSync(CONFIG_PATH)) {
    configWatcher = fs.watch(CONFIG_PATH, (eventType) => {
      if (eventType === 'change') {
        console.log('[github-connector] Config file changed, reloading...');
        loadConfig();
        if (onChange) {
          onChange(config);
        }
      }
    });
  }
}

/**
 * Stop watching config file
 */
export function stopWatching() {
  if (configWatcher) {
    configWatcher.close();
    configWatcher = null;
  }
}
