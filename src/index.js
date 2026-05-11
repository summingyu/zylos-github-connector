#!/usr/bin/env node
/**
 * zylos-github-webhook
 *
 * GitHub Webhook connector for Zylos AI Agent Platform
 */

import { getConfig, watchConfig, DATA_DIR } from './lib/config.js';

// Initialize
console.log(`[github-webhook] Starting...`);
console.log(`[github-webhook] Data directory: ${DATA_DIR}`);

// Load configuration
let config = getConfig();
console.log(`[github-webhook] Config loaded, enabled: ${config.enabled}`);

if (!config.enabled) {
  console.log(`[github-webhook] Component disabled in config, exiting.`);
  process.exit(0);
}

// Watch for config changes
watchConfig((newConfig) => {
  console.log(`[github-webhook] Config reloaded`);
  config = newConfig;
  if (!newConfig.enabled) {
    console.log(`[github-webhook] Component disabled, stopping...`);
    shutdown();
  }
});

// Main component logic
async function main() {
  // TODO: Implement your component logic here
  //
  // Communication components: set up platform SDK, listen for events, forward to C4
  // Capability components: start HTTP server or other service interface
  // Utility components: run task and exit (remove the keepalive below)

  console.log(`[github-webhook] Running`);
}

// Graceful shutdown
function shutdown() {
  console.log(`[github-webhook] Shutting down...`);
  // TODO: Close connections, stop listeners, cleanup
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Run
main().catch(err => {
  console.error(`[github-webhook] Fatal error:`, err);
  process.exit(1);
});
