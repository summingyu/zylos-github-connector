/**
 * Release Event Handler
 *
 * Processes GitHub release webhook events and formats them into readable messages.
 * Supports published and created actions.
 *
 * @module handlers/release
 */

// Import centralized formatters
import { buildBaseMessage, addLine, addUrl, finalize, getActionLabel } from '../formatters/index.js';

// Logger will be passed from the main app via Fastify's app.log
// For now, we use console for warnings (will be integrated with app.log in main flow)
const logger = {
  warn: ({ event, action, tagName }, msg) => {
    console.warn(`[release-handler] ${msg}`, { event, action, tagName });
  }
};

/**
 * Supported release actions
 *
 * @type {Set<string>}
 */
const SUPPORTED_ACTIONS = new Set(['published', 'created']);

/**
 * Formats a release event into a readable message
 *
 * Uses centralized formatters for consistent message structure.
 * Action labels are obtained via getActionLabel from the formatters module.
 *
 * @param {Object} releaseData - Extracted release data
 * @param {string} releaseData.action - The action performed
 * @param {string} releaseData.tagName - Git tag name
 * @param {string} releaseData.releaseName - Release name
 * @param {string} releaseData.author - Username of the author
 * @param {number} releaseData.assetsCount - Number of release assets
 * @param {string} releaseData.releaseUrl - Release URL
 * @returns {string} Formatted message
 *
 * @example
 * formatReleaseMessage({
 *   action: 'published',
 *   tagName: 'v1.0.0',
 *   releaseName: 'First Release',
 *   author: 'alice',
 *   assetsCount: 3,
 *   releaseUrl: 'https://github.com/user/repo/releases/tag/v1.0.0'
 * })
 * // Returns multi-line message with action label, release info, assets, and URL
 */
function formatReleaseMessage(releaseData) {
  const { action, tagName, releaseName, author, assetsCount, releaseUrl } = releaseData;

  // Get action label from centralized mapping
  const actionLabel = getActionLabel('release', action);

  // Build message using centralized formatters
  const builder = buildBaseMessage(author, actionLabel);

  // Add release information
  addLine(builder, `${releaseName} (${tagName})`);

  // Add assets count (only when assetsCount > 0)
  if (assetsCount > 0) {
    addLine(builder, `Assets: ${assetsCount} file(s)`);
  }

  // Add URL
  addUrl(builder, releaseUrl);

  return finalize(builder);
}

/**
 * Handles release webhook events
 *
 * @param {Object} payload - GitHub webhook payload for release event
 * @param {string} payload.action - The action performed (published, created, etc.)
 * @param {Object} payload.release - The release object
 * @param {string} payload.release.tag_name - Git tag name
 * @param {string} payload.release.name - Release name
 * @param {string} payload.release.html_url - Release URL
 * @param {Array<Object>} payload.release.assets - Array of asset objects
 * @param {Object} payload.sender - The user who triggered the event
 * @param {string} payload.sender.login - Username
 * @returns {Promise<Object>} Handler result
 * @returns {boolean} returns.processed - Whether the event was processed
 * @returns {string} returns.message - Formatted message or error message
 * @returns {string} returns.event - Event type ('release')
 * @returns {Object} returns.data - Extracted release data
 *
 * @throws {Error} If payload is invalid or missing required fields
 *
 * @example
 * const result = await handleRelease({
 *   action: 'published',
 *   release: {
 *     tag_name: 'v1.0.0',
 *     name: 'First Release',
 *     html_url: 'https://github.com/user/repo/releases/tag/v1.0.0',
 *     assets: [{ name: 'binary.zip', size: 1024 }]
 *   },
 *   sender: { login: 'alice' }
 * });
 */
export async function handleRelease(payload) {
  // Input validation
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid payload: expected object');
  }

  // Validate action field
  if (!payload.action || typeof payload.action !== 'string') {
    throw new Error('Invalid payload: missing or invalid action field');
  }

  // Validate release object
  if (!payload.release || typeof payload.release !== 'object') {
    throw new Error('Invalid payload: missing or invalid release object');
  }

  const { action, release, sender } = payload;

  // Check if action is supported
  if (!SUPPORTED_ACTIONS.has(action)) {
    // Log warning for unsupported actions
    logger.warn({
      event: 'release',
      action,
      tagName: release?.tag_name
    }, `Unsupported release action: ${action}`);

    return {
      processed: false,
      message: `Unsupported release action: ${action}`,
      event: 'release',
      data: {
        action,
        tagName: release?.tag_name,
        releaseName: release?.name
      }
    };
  }

  // Extract data with placeholders (treat empty string as missing)
  const tagName = (release.tag_name && release.tag_name.trim()) ? release.tag_name : '[No tag]';
  const releaseName = (release.name && release.name.trim()) ? release.name : tagName;
  const releaseUrl = release.html_url ?? null;
  const senderLogin = sender?.login ?? 'unknown';
  const assetsCount = (Array.isArray(release.assets) && release.assets.every(a => a && typeof a === 'object'))
    ? release.assets.length
    : 0;

  // Build release data object
  const releaseData = {
    action,
    tagName,
    releaseName,
    author: senderLogin,
    assetsCount,
    releaseUrl
  };

  // Format message
  const message = formatReleaseMessage(releaseData);

  return {
    processed: true,
    message,
    event: 'release',
    data: {
      action,
      tagName,
      releaseName,
      author: senderLogin,
      assetsCount,
      releaseUrl
    }
  };
}
