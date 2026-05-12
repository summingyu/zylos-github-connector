/**
 * Issue Comment Event Handler
 *
 * Processes GitHub issue_comment webhook events and formats them into readable messages.
 * Supports created action for both issues and pull requests.
 *
 * @module handlers/comment
 */

// Import centralized formatters
import { buildBaseMessage, addLine, addUrl, finalize, getActionLabel } from '../formatters/index.js';

// Logger will be passed from the main app via Fastify's app.log
// For now, we use console for warnings (will be integrated with app.log in main flow)
const logger = {
  warn: ({ event, action, issueNumber }, msg) => {
    console.warn(`[comment-handler] ${msg}`, { event, action, issueNumber });
  }
};

/**
 * Supported issue_comment actions
 *
 * @type {Set<string>}
 */
const SUPPORTED_ACTIONS = new Set(['created']);

/**
 * Formats an issue comment event into a readable message
 *
 * Uses centralized formatters for consistent message structure.
 * Action labels are obtained via getActionLabel from the formatters module.
 *
 * @param {string} action - The action performed
 * @param {string} sender - Username of the sender
 * @param {string} issueTitle - Issue or pull request title
 * @param {number} issueNumber - Issue or pull request number
 * @param {string} commentBody - Comment body text
 * @param {string} commentUrl - Comment URL
 * @param {boolean} isPr - Whether this is a pull request comment
 * @returns {string} Formatted message
 *
 * @example
 * formatCommentMessage('created', 'alice', 'Fix bug', 42, 'Looks good', 'https://github.com/...', false)
 * // Returns multi-line message with action label, issue context, comment preview, and URL
 */
function formatCommentMessage(action, sender, issueTitle, issueNumber, commentBody, commentUrl, isPr) {
  // Get action label from centralized mapping
  const actionLabel = getActionLabel('issue_comment', action);

  // Build message using centralized formatters
  const builder = buildBaseMessage(sender, actionLabel);

  // Add context (issue vs PR)
  const context = isPr ? `PR #${issueNumber}: ${issueTitle}` : `Issue #${issueNumber}: ${issueTitle}`;
  addLine(builder, context);

  // Add comment body preview (truncated to 200 chars)
  let preview = commentBody ?? '[No comment text]';
  if (preview.length > 200) {
    preview = preview.substring(0, 200) + '...';
  }
  addLine(builder, preview);

  // Add URL
  addUrl(builder, commentUrl);

  return finalize(builder);
}

/**
 * Handles issue_comment webhook events
 *
 * @param {Object} payload - GitHub webhook payload for issue_comment event
 * @param {string} payload.action - The action performed (created, edited, deleted, etc.)
 * @param {Object} payload.comment - The comment object
 * @param {string} payload.comment.body - Comment body text
 * @param {string} payload.comment.html_url - Comment URL
 * @param {Object} payload.issue - The issue object
 * @param {string} payload.issue.title - Issue or pull request title
 * @param {number} payload.issue.number - Issue or pull request number
 * @param {Object|null} payload.issue.pull_request - Present if this is a PR comment
 * @param {Object} payload.sender - The user who triggered the event
 * @param {string} payload.sender.login - Username
 * @returns {Promise<Object>} Handler result
 * @returns {boolean} returns.processed - Whether the event was processed
 * @returns {string} returns.message - Formatted message or error message
 * @returns {string} returns.event - Event type ('issue_comment')
 * @returns {Object} returns.data - Extracted comment data
 *
 * @throws {Error} If payload is invalid or missing required fields
 *
 * @example
 * const result = await handleIssueComment({
 *   action: 'created',
 *   comment: {
 *     body: 'Looks good to me!',
 *     html_url: 'https://github.com/user/repo/issues/42#issuecomment-123'
 *   },
 *   issue: {
 *     title: 'Fix login bug',
 *     number: 42,
 *     pull_request: null
 *   },
 *   sender: { login: 'alice' }
 * });
 */
export async function handleIssueComment(payload) {
  // Input validation
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid payload: expected object');
  }

  // Validate action field
  if (!payload.action || typeof payload.action !== 'string') {
    throw new Error('Invalid payload: missing or invalid action field');
  }

  // Validate comment object
  if (!payload.comment || typeof payload.comment !== 'object') {
    throw new Error('Invalid payload: missing or invalid comment object');
  }

  // Validate issue object
  if (!payload.issue || typeof payload.issue !== 'object') {
    throw new Error('Invalid payload: missing or invalid issue object');
  }

  const { action, comment, issue, sender } = payload;

  // Check if action is supported
  if (!SUPPORTED_ACTIONS.has(action)) {
    // Log warning for unsupported actions
    logger.warn({
      event: 'issue_comment',
      action,
      issueNumber: issue?.number
    }, `Unsupported issue_comment action: ${action}`);

    return {
      processed: false,
      message: `Unsupported issue_comment action: ${action}`,
      event: 'issue_comment',
      data: {
        action,
        issueNumber: issue?.number,
        title: issue?.title
      }
    };
  }

  // Extract data with placeholders
  const commentBody = (typeof comment.body === 'string' && comment.body.trim())
    ? comment.body
    : '[No comment text]';
  const commentUrl = comment.html_url ?? null;
  const issueTitle = (typeof issue.title === 'string' && issue.title.trim())
    ? issue.title
    : '[No title]';
  const issueNumber = issue.number ?? null;
  const senderLogin = sender?.login ?? 'unknown';
  const isPr = !!(issue?.pull_request);

  // Format message
  const message = formatCommentMessage(
    action,
    senderLogin,
    issueTitle,
    issueNumber,
    commentBody,
    commentUrl,
    isPr
  );

  return {
    processed: true,
    message,
    event: 'issue_comment',
    data: {
      action,
      number: issueNumber,
      title: issueTitle,
      sender: senderLogin,
      commentBody,
      commentUrl,
      isPr
    }
  };
}
