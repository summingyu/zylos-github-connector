/**
 * Issues Event Handler
 *
 * Processes GitHub issues webhook events and formats them into readable messages.
 * Supports opened, closed, reopened, and deleted actions.
 *
 * @module handlers/issues
 */

// Import centralized formatters
import { buildBaseMessage, addLine, addUrl, finalize, getActionLabel, formatLabels } from '../formatters/index.js';

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
 * Formats an issue event into a readable message
 *
 * Uses centralized formatters for consistent message structure.
 * Action labels are obtained via getActionLabel from the formatters module.
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

  // Get action label from centralized mapping
  const actionLabel = getActionLabel('issues', action);

  // Build message using centralized formatters
  const builder = buildBaseMessage(sender, actionLabel);

  // Add labels (skip for deleted action per D-06)
  if (action !== 'deleted') {
    const labelLine = formatLabels(labels);
    if (labelLine) {
      addLine(builder, labelLine);
    }
  }

  // Add issue information
  addLine(builder, `#${number}: ${title}`);

  // Add URL (only if number is not null, per original logic)
  if (number !== null && htmlUrl) {
    addUrl(builder, htmlUrl);
  }

  return finalize(builder);
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
  const title = (typeof issue.title === 'string' && issue.title.trim())
    ? issue.title
    : '[No title]';
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
      labels: labels
        .filter(label => label && typeof label === 'object')
        .map(label => ({
          name: label.name || 'unknown',
          color: label.color || '000000'
        }))
    }
  };
}
