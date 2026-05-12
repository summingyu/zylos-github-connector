/**
 * Issues Event Handler
 *
 * Processes GitHub issues webhook events and formats them into readable messages.
 * Supports opened, closed, reopened, and deleted actions.
 *
 * @module handlers/issues
 */

// Logger will be passed from the main app via Fastify's app.log
// For now, we use console for warnings (will be integrated with app.log in main flow)
const logger = {
  warn: ({ event, action, issueNumber }, msg) => {
    console.warn(`[issues-handler] ${msg}`, { event, action, issueNumber });
  }
};

/**
 * Supported issue actions
 *
 * @type {Set<string>}
 */
const SUPPORTED_ACTIONS = new Set(['opened', 'closed', 'reopened', 'deleted']);

/**
 * Action label mapping for message formatting
 *
 * Maps action types to their display labels with emojis.
 *
 * @type {Object<string, string>}
 */
const ACTION_LABELS = {
  opened: '🔓 Issue Opened',
  closed: '🔒 Issue Closed',
  reopened: '♻️ Issue Reopened',
  deleted: '🗑️ Issue Deleted'
};

/**
 * Color to emoji mapping for issue labels
 *
 * Maps GitHub label colors to emoji dots.
 *
 * @type {Object<string, string>}
 */
const COLOR_EMOJI_MAP = {
  'd73a4a': '🔴',  // red
  'a2eeef': '🔵',  // blue
  '7057ff': '🟣',  // purple
  '008672': '🟢',  // green
  'd4c5f9': '🟣',  // purple (light)
  'e99695': '🔴',  // red (light)
  '9e9a9d': '⚪',  // gray
  'fbca04': '🟡',  // yellow
  'ff7b72': '🔴',  // red (bright)
  'ffffd0': '🟡',  // yellow (light)
  '0075ca': '🔵',  // blue (dark)
  'cfd3d7': '⚪',  // gray (light)
  'bfd4f2': '🔵',  // blue (light)
  'fef2c0': '🟡',  // yellow (dark)
  'ffffff': '⚪',  // white
  'f1e2a7': '🟡',  // yellow (warm)
  'f2f0fa': '⚪',  // gray (very light)
  '5319e7': '🟣',  // purple (dark)
  'b60205': '🔴',  // red (dark)
  '0e8a16': '🟢',  // green (dark)
  '3f161e': '🩷',  // pink (dark)
  'fef6c4': '🟡',  // yellow (pale)
  'ededed': '⚪',  // gray (medium)
  'fcdfd3': '🟠',  // orange (light)
  'bfdadc': '🔵',  // blue (cyan)
  '000000': '⚫',  // black
  'ffeda3': '🟡',  // yellow (bright)
  'c5def5': '🔵'   // blue (sky)
};

// Freeze COLOR_EMOJI_MAP to prevent prototype pollution (CR-01)
Object.freeze(COLOR_EMOJI_MAP);

/**
 * Maps a hex color code to an emoji dot
 *
 * @param {string} color - 6-character hex color code
 * @returns {string} Emoji representing the color
 *
 * @example
 * getEmojiForColor('d73a4a') // Returns '🔴'
 */
function getEmojiForColor(color) {
  if (!color || typeof color !== 'string') {
    return '⚫';
  }

  // Normalize color to lowercase
  const normalizedColor = color.toLowerCase().trim();

  // Return mapped emoji or default black dot
  return COLOR_EMOJI_MAP[normalizedColor] || '⚫';
}

/**
 * Formats issue labels into a string with emoji dots
 *
 * @param {Array<Object>} labels - Array of label objects with name and color
 * @returns {string} Formatted label string or empty string if no labels
 *
 * @example
 * formatLabels([{ name: 'bug', color: 'd73a4a' }])
 * // Returns '🔴 bug'
 */
function formatLabels(labels) {
  if (!Array.isArray(labels) || labels.length === 0) {
    return '';
  }

  return labels.map(label => {
    // Validate label object structure (CR-02)
    if (!label || typeof label !== 'object') {
      return '⚫ unknown';
    }
    const emoji = getEmojiForColor(label?.color);
    const name = label?.name || 'unknown';
    return `${emoji} ${name}`;
  }).join(' ');
}

/**
 * Formats an issue event into a readable message
 *
 * @param {Object} issueData - Extracted issue data
 * @param {string} issueData.action - The action performed
 * @param {string} issueData.title - Issue title
 * @param {number|null} issueData.number - Issue number
 * @param {string} issueData.sender - Username of the sender
 * @param {string} issueData.htmlUrl - Issue URL
 * @param {Array<Object>} issueData.labels - Array of labels
 * @returns {string} Formatted message
 *
 * @example
 * formatIssueMessage({
 *   action: 'opened',
 *   title: 'Fix login bug',
 *   number: 42,
 *   sender: 'alice',
 *   htmlUrl: 'https://github.com/user/repo/issues/42',
 *   labels: [{ name: 'bug', color: 'd73a4a' }]
 * })
 * // Returns multi-line message with action label, labels, issue info, and URL
 */
function formatIssueMessage(issueData) {
  const { action, title, number, sender, htmlUrl, labels } = issueData;

  // Get action label
  const actionLabel = ACTION_LABELS[action] || `Issue ${action}`;

  // Build message lines
  const lines = [];

  // Line 1: Action label with sender
  lines.push(`${actionLabel} by @${sender}`);

  // Line 2: Labels (skip for deleted action per D-06)
  if (action !== 'deleted') {
    const labelLine = formatLabels(labels);
    if (labelLine) {
      lines.push(labelLine);
    }
  }

  // Line 3: Issue information (always included)
  lines.push(`#${number}: ${title}`);

  // Line 4: URL (only if number is not null)
  if (number !== null && htmlUrl) {
    lines.push(`🔗 ${htmlUrl}`);
  }

  return lines.join('\n');
}

/**
 * Handles issues webhook events
 *
 * @param {Object} payload - GitHub webhook payload for issues event
 * @param {string} payload.action - The action performed (opened, closed, reopened, deleted, etc.)
 * @param {Object} payload.issue - The issue object
 * @param {string} payload.issue.title - Issue title
 * @param {number} payload.issue.number - Issue number
 * @param {string} payload.issue.html_url - Issue URL
 * @param {Array<Object>} payload.issue.labels - Array of label objects
 * @param {Object} payload.sender - The user who triggered the event
 * @param {string} payload.sender.login - Username
 * @returns {Promise<Object>} Handler result
 * @returns {boolean} returns.processed - Whether the event was processed
 * @returns {string} returns.message - Formatted message or error message
 * @returns {string} returns.event - Event type ('issues')
 * @returns {Object} returns.data - Extracted issue data
 *
 * @throws {Error} If payload is invalid or missing required fields
 *
 * @example
 * const result = await handleIssues({
 *   action: 'opened',
 *   issue: {
 *     title: 'Fix login bug',
 *     number: 42,
 *     html_url: 'https://github.com/user/repo/issues/42',
 *     labels: [{ name: 'bug', color: 'd73a4a' }]
 *   },
 *   sender: { login: 'alice' }
 * });
 */
export async function handleIssues(payload) {
  // Input validation
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid payload: expected object');
  }

  // Validate action field (per D-07)
  if (!payload.action || typeof payload.action !== 'string') {
    throw new Error('Invalid payload: missing or invalid action field');
  }

  // Validate issue object (per D-13)
  if (!payload.issue || typeof payload.issue !== 'object') {
    throw new Error('Invalid payload: missing or invalid issue object');
  }

  const { action, issue, sender } = payload;

  // Check if action is supported
  if (!SUPPORTED_ACTIONS.has(action)) {
    // Log warning for unsupported actions (per D-05)
    logger.warn({
      event: 'issues',
      action,
      issueNumber: issue?.number
    }, `Unsupported issues action: ${action}`);

    return {
      processed: false,
      message: `Unsupported issues action: ${action}`,
      event: 'issues',
      data: {
        action,
        issueNumber: issue?.number,
        title: issue?.title
      }
    };
  }

  // Extract data with placeholders (per D-14, D-15, D-16)
  const title = issue.title && issue.title.trim() ? issue.title : '[No title]';
  const number = issue.number ?? null;
  const htmlUrl = issue.html_url ?? null;
  const labels = issue.labels ?? [];
  const senderLogin = sender?.login ?? 'unknown';

  // Build issue data object
  const issueData = {
    action,
    title,
    number,
    sender: senderLogin,
    htmlUrl,
    labels
  };

  // Format message
  const message = formatIssueMessage(issueData);

  return {
    processed: true,
    message,
    event: 'issues',
    data: {
      action,
      number,
      title,
      sender: senderLogin,
      labels: labels.map(label => ({
        name: label.name,
        color: label.color
      }))
    }
  };
}

// Export reusable utilities for use in other handlers
export { COLOR_EMOJI_MAP, formatLabels };
