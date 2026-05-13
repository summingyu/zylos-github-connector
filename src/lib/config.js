/**
 * Configuration loader for zylos-github-connector
 *
 * Loads config from ~/zylos/components/github-connector/config.json
 * with hot-reload support via file watcher.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

const HOME = process.env.HOME;
export const DATA_DIR = path.join(HOME, 'zylos/components/github-connector');
export const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

// Default configuration
export const DEFAULT_CONFIG = {
  enabled: true,
  port: 3461,
  webhookSecret: '',
  maxPayloadSize: '10mb',
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
let debounceTimer = null;
let watchedConfigPath = CONFIG_PATH; // Track the path being watched

/**
 * Deep merge default configuration with user configuration
 * @param {Object} defaults - Default configuration object
 * @param {Object} userConfig - User configuration object
 * @returns {Object} Merged configuration
 */
export function mergeDefaults(defaults, userConfig) {
  return {
    ...defaults,
    ...userConfig,
    commBridge: {
      ...defaults.commBridge,
      ...(userConfig.commBridge || {})
    },
    logging: {
      ...defaults.logging,
      ...(userConfig.logging || {})
    }
  };
}

/**
 * Validate configuration object
 * @param {Object} config - Configuration to validate
 * @throws {Error} If validation fails
 */
export function validateConfig(config) {
  // Validate webhookSecret
  if (config.webhookSecret !== undefined && typeof config.webhookSecret !== 'string') {
    throw new Error('webhookSecret must be a string');
  }
  if (config.webhookSecret && config.webhookSecret.length < 16) {
    throw new Error('webhookSecret must be at least 16 characters long');
  }

  // Validate port
  if (config.port !== undefined) {
    if (typeof config.port !== 'number') {
      throw new Error('port must be a number');
    }
    if (config.port < 1 || config.port > 65535) {
      throw new Error('port must be between 1 and 65535');
    }
  }

  // Validate enabled
  if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
    throw new Error('enabled must be a boolean');
  }

  // Validate commBridge.enabled
  if (config.commBridge?.enabled !== undefined && typeof config.commBridge.enabled !== 'boolean') {
    throw new Error('commBridge.enabled must be a boolean');
  }

  // Validate logging.level
  const validLogLevels = ['error', 'warn', 'info', 'debug'];
  if (config.logging?.level !== undefined) {
    if (typeof config.logging.level !== 'string') {
      throw new Error('logging.level must be a string');
    }
    if (!validLogLevels.includes(config.logging.level)) {
      throw new Error(`logging.level must be one of: ${validLogLevels.join(', ')}`);
    }
  }
}

/**
 * Sanitize configuration for logging by removing sensitive fields
 * @param {Object} config - Configuration object
 * @returns {Object} Sanitized configuration
 */
export function sanitizeForLogging(config) {
  const sanitized = { ...config };
  if (sanitized.webhookSecret) {
    sanitized.webhookSecret = '[REDACTED]';
  }
  return sanitized;
}

/**
 * Load configuration from file
 * @param {string} [configPath] - Optional custom config path for testing
 * @returns {Promise<Object>} Configuration object
 */
export async function loadConfig(configPath) {
  let userConfig = {};
  const targetConfigPath = configPath || CONFIG_PATH;

  // Try to read configuration file
  try {
    const content = await fs.readFile(targetConfigPath, 'utf8');
    userConfig = JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`[github-connector] Config file not found: ${targetConfigPath}`);
      console.warn('[github-connector] Using default configuration');
    } else if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file: ${error.message}`);
    } else {
      throw error;
    }
  }

  // Merge defaults with user configuration
  config = mergeDefaults(DEFAULT_CONFIG, userConfig);

  // Apply environment variable overrides
  if (process.env.GITHUB_WEBHOOK_SECRET) {
    config.webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    console.log('[github-connector] Using webhook secret from environment variable');
  }

  // Validate configuration
  validateConfig(config);

  // Log configuration load (with sensitive fields redacted)
  console.log('[github-connector] Configuration loaded:', sanitizeForLogging(config));

  // Validate webhook secret
  if (!config.webhookSecret || config.webhookSecret === '') {
    console.warn('[github-connector] WARNING: webhookSecret is not configured!');
    console.warn('[github-connector] Webhook signature verification will fail.');
    console.warn('[github-connector] Set webhookSecret in config.json or GITHUB_WEBHOOK_SECRET environment variable.');
  }

  return config;
}

/**
 * Get current configuration
 * @returns {Promise<Object>} Configuration object
 */
export async function getConfig() {
  if (!config) {
    await loadConfig();
  }
  return config;
}

/**
 * Get current configuration synchronously (for backward compatibility)
 * @returns {Object} Configuration object
 */
export function getConfigSync() {
  return config || { ...DEFAULT_CONFIG };
}

/**
 * Save configuration to file
 * @param {Object} newConfig - Configuration to save
 */
export async function saveConfig(newConfig) {
  try {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
    config = newConfig;
  } catch (err) {
    console.error(`[github-connector] Failed to save config: ${err.message}`);
    throw err;
  }
}

/**
 * Start watching config file for changes
 * @param {Function} onChange - Callback when config changes (receives newConfig, oldConfig)
 * @param {string} [configPath] - Optional custom config path for testing
 */
export function watchConfig(onChange, configPath) {
  if (configWatcher) {
    configWatcher.close();
  }

  const targetConfigPath = configPath || CONFIG_PATH;
  watchedConfigPath = targetConfigPath;

  if (fsSync.existsSync(targetConfigPath)) {
    configWatcher = fsSync.watch(targetConfigPath, (eventType) => {
      // macOS may trigger 'rename', Linux/Windows typically trigger 'change'
      // Don't rely on event type, rely on debouncing
      if (eventType !== 'change' && eventType !== 'rename') {
        return;
      }

      // Debounce: clear previous timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      // Set new timer
      debounceTimer = setTimeout(async () => {
        try {
          const oldConfig = config;
          const newConfig = await loadConfig(watchedConfigPath);
          console.log('[github-connector] Configuration reloaded successfully');
          if (onChange) {
            onChange(newConfig, oldConfig);
          }
        } catch (error) {
          console.error('[github-connector] Failed to reload configuration:', error.message);
          // Keep old config valid on error
        }
        debounceTimer = null;
      }, 500);
    });

    console.log(`[github-connector] Watching config file: ${targetConfigPath}`);
  }
}

/**
 * Stop watching config file and cleanup resources
 */
export function stopWatching() {
  if (configWatcher) {
    configWatcher.close();
    configWatcher = null;
    console.log('[github-connector] Stopped watching config file');
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}
