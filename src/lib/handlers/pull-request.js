/**
 * Pull Request Event Handler
 *
 * Processes GitHub pull_request webhook events and formats them into readable messages.
 * Supports opened, closed, reopened, merged, and ready_for_review actions.
 *
 * @module handlers/pull-request
 */

// Import centralized formatters
import { buildBaseMessage, addLine, addUrl, finalize, getActionLabel, formatLabels } from '../formatters/index.js';

// Logger will be passed from the main app via Fastify's app.log
// For now, we use console for warnings (will be integrated with app.log in main flow)
const logger = {
  warn: ({ event, action, prNumber }, msg) => {
    console.warn(`[pull-request-handler] ${msg}`, { event, action, prNumber });
  }
};

/**
 * Supported pull request actions
 *
 * @type {Set<string>}
 */
const SUPPORTED_ACTIONS = new Set([
  'opened',
  'closed',
  'reopened',
  'merged',
  'ready_for_review'
]);

/**
 * Formats branch information for pull requests
 *
 * @param {Object} prData - Pull request data
 * @param {string} prData.head_ref - Source branch name
 * @param {string} prData.base_ref - Target branch name
 * @returns {string} Formatted branch information
 *
 * @example
 * formatBranchInfo({ head_ref: 'feature/auth', base_ref: 'main' })
 * // Returns 'from: feature/auth → main'
 */
function formatBranchInfo(prData) {
  const headRef = prData.head_ref || 'unknown';
  const baseRef = prData.base_ref || 'unknown';
  return `from: ${headRef} → ${baseRef}`;
}

/**
 * Formats merger information for merged pull requests
 *
 * @param {Object} prData - Pull request data
 * @param {string} prData.merged_by - Username of the user who merged
 * @param {string} prData.merge_commit_sha - Full merge commit SHA
 * @returns {string|null} Formatted merger information or null if not merged
 *
 * @example
 * formatMergerInfo({ merged_by: 'alice', merge_commit_sha: 'abcdef123456789' })
 * // Returns 'merged_by: @alice · abcdef1'
 */
function formatMergerInfo(prData) {
  if (!prData.merged_by?.login || !prData.merge_commit_sha) {
    return null;
  }

  const merger = prData.merged_by.login;
  const sha = prData.merge_commit_sha;

  if (typeof sha !== 'string' || sha.length === 0) {
    return null;
  }

  const shortSha = sha.length >= 7 ? sha.substring(0, 7) : sha;
  return `merged_by: @${merger} · ${shortSha}`;
}

/**
 * Formats a pull request event into a readable message
 *
 * Uses centralized formatters for consistent message structure.
 * Action labels are obtained via getActionLabel from the formatters module.
 *
 * @param {Object} prData - Extracted pull request data
 * @param {string} prData.action - The action performed
 * @param {string} prData.title - PR title
 * @param {number|null} prData.number - PR number
 * @param {string} prData.sender - Username of the sender
 * @param {string} prData.htmlUrl - PR URL
 * @param {Array<Object>} prData.labels - Array of labels
 * @param {boolean} prData.draft - Whether this is a draft PR
 * @param {Object} prData.merged_by - Merger information (for merged action)
 * @param {string} prData.merge_commit_sha - Merge commit SHA
 * @param {string} prData.head_ref - Source branch name
 * @param {string} prData.base_ref - Target branch name
 * @returns {string} Formatted message
 *
 * @example
 * formatPRMessage({
 *   action: 'opened',
 *   title: 'Add new authentication flow',
 *   number: 42,
 *   sender: 'alice',
 *   htmlUrl: 'https://github.com/user/repo/pull/42',
 *   labels: [{ name: 'feature', color: 'a2eeef' }],
 *   draft: false,
 *   head_ref: 'feature/auth',
 *   base_ref: 'main'
 * })
 * // Returns multi-line message with action label, labels, PR info, branch info, and URL
 */
function formatPRMessage(prData) {
  const {
    action,
    title,
    number,
    sender,
    htmlUrl,
    labels,
    draft,
    merged_by,
    merge_commit_sha,
    head_ref,
    base_ref
  } = prData;

  // Get action label from centralized mapping
  const actionLabel = getActionLabel('pull_request', action);

  // Build message using centralized formatters
  const builder = buildBaseMessage(sender, actionLabel);

  // Add labels (if any)
  const labelLine = formatLabels(labels);
  if (labelLine) {
    addLine(builder, labelLine);
  }

  // Add PR information with draft prefix if applicable
  const prefix = draft ? '[Draft] ' : '';
  addLine(builder, `${prefix}#${number}: ${title}`);

  // Add branch information
  addLine(builder, formatBranchInfo({ head_ref: head_ref, base_ref: base_ref }));

  // Add merger information (only for merged action)
  if (action === 'merged') {
    const mergerInfo = formatMergerInfo({ merged_by, merge_commit_sha });
    if (mergerInfo) {
      addLine(builder, mergerInfo);
    }
  }

  // Add URL (only if number is not null)
  if (number !== null && htmlUrl) {
    addUrl(builder, htmlUrl);
  }

  return finalize(builder);
}

/**
 * Handles pull_request webhook events
 *
 * @param {Object} payload - GitHub webhook payload for pull_request event
 * @param {string} payload.action - The action performed (opened, closed, reopened, merged, ready_for_review, etc.)
 * @param {Object} payload.pull_request - The pull request object
 * @param {string} payload.pull_request.title - PR title
 * @param {number} payload.pull_request.number - PR number
 * @param {string} payload.pull_request.html_url - PR URL
 * @param {Array<Object>} payload.pull_request.labels - Array of label objects
 * @param {boolean} payload.pull_request.draft - Whether this is a draft PR
 * @param {string|null} payload.pull_request.merged_at - Timestamp when PR was merged
 * @param {Object|null} payload.pull_request.merged_by - User who merged the PR
 * @param {string} payload.pull_request.merged_by.login - Username of merger
 * @param {string|null} payload.pull_request.merge_commit_sha - Merge commit SHA
 * @param {Object} payload.pull_request.head - Source branch info
 * @param {string} payload.pull_request.head.ref - Source branch name
 * @param {Object} payload.pull_request.base - Target branch info
 * @param {string} payload.pull_request.base.ref - Target branch name
 * @param {Object} payload.sender - The user who triggered the event
 * @param {string} payload.sender.login - Username
 * @returns {Promise<Object>} Handler result
 * @returns {boolean} returns.processed - Whether the event was processed
 * @returns {string} returns.message - Formatted message or error message
 * @returns {string} returns.event - Event type ('pull_request')
 * @returns {Object} returns.data - Extracted PR data
 *
 * @throws {Error} If payload is invalid or missing required fields
 *
 * @example
 * const result = await handlePullRequest({
 *   action: 'opened',
 *   pull_request: {
 *     title: 'Add new authentication flow',
 *     number: 42,
 *     html_url: 'https://github.com/user/repo/pull/42',
 *     labels: [{ name: 'feature', color: 'a2eeef' }],
 *     head: { ref: 'feature/auth' },
 *     base: { ref: 'main' },
 *     draft: false
 *   },
 *   sender: { login: 'alice' }
 * });
 */
export async function handlePullRequest(payload) {
  // Input validation
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid payload: expected object');
  }

  // Validate action field (per D-08)
  if (!payload.action || typeof payload.action !== 'string') {
    throw new Error('Invalid payload: missing or invalid action field');
  }

  // Validate pull_request object (per D-18)
  if (!payload.pull_request || typeof payload.pull_request !== 'object') {
    throw new Error('Invalid payload: missing or invalid pull_request object');
  }

  const { action, pull_request: pr, sender } = payload;

  // Check if action is supported
  if (!SUPPORTED_ACTIONS.has(action)) {
    // Log warning for unsupported actions (per D-07)
    logger.warn({
      event: 'pull_request',
      action,
      prNumber: pr?.number
    }, `Unsupported pull_request action: ${action}`);

    return {
      processed: false,
      message: `Unsupported pull_request action: ${action}`,
      event: 'pull_request',
      data: {
        action,
        prNumber: pr?.number,
        title: pr?.title
      }
    };
  }

  // Extract data with placeholders (per D-19, D-20, D-21)
  const title = (typeof pr.title === 'string' && pr.title.trim())
    ? pr.title
    : '[No title]';
  const number = pr.number ?? null;
  const htmlUrl = pr.html_url ?? null;
  const labels = pr.labels ?? [];
  const senderLogin = sender?.login ?? 'unknown';
  const draft = pr.draft ?? false;

  // Extract PR-specific fields
  const merged_at = pr.merged_at ?? null;
  const merged_by = pr.merged_by ?? null;
  const merge_commit_sha = pr.merge_commit_sha ?? null;
  const head_ref = pr.head?.ref ?? 'unknown';
  const base_ref = pr.base?.ref ?? 'unknown';

  // Build PR data object
  const prData = {
    action,
    title,
    number,
    sender: senderLogin,
    htmlUrl,
    labels,
    draft,
    merged_at,
    merged_by,
    merge_commit_sha,
    head_ref,
    base_ref
  };

  // Format message
  const message = formatPRMessage(prData);

  return {
    processed: true,
    message,
    event: 'pull_request',
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
        })),
      draft,
      mergedAt: merged_at,
      mergedBy: merged_by?.login ?? null,
      branchInfo: `${head_ref} → ${base_ref}`
    }
  };
}
