/**
 * Push Event Handler
 *
 * Processes GitHub push webhook events and formats them into readable messages.
 * Handles branch pushes, tag pushes, and commit information.
 *
 * @module handlers/push
 */

// Import centralized formatters
import { buildBaseMessage, addLine, addUrl, finalize, getActionLabel } from '../formatters/index.js';

/**
 * Push event types
 *
 * @type {Object<string, string>}
 */
const PUSH_TYPES = {
  branch: '🌿 Branch',
  tag: '🏷️ Tag',
  unknown: '❓ Unknown'
};

/**
 * Formats the ref type (branch or tag)
 *
 * @param {string} ref - The git ref (e.g., "refs/heads/main" or "refs/tags/v1.0.0")
 * @returns {Object} Object with type and name
 * @returns {string} returns.type - One of 'branch', 'tag', 'unknown'
 * @returns {string} returns.name - The branch or tag name
 *
 * @example
 * formatRef('refs/heads/main')
 * // Returns: { type: 'branch', name: 'main' }
 *
 * formatRef('refs/tags/v1.0.0')
 * // Returns: { type: 'tag', name: 'v1.0.0' }
 */
function formatRef(ref) {
  if (!ref || typeof ref !== 'string') {
    return { type: 'unknown', name: 'unknown' };
  }

  if (ref.startsWith('refs/heads/')) {
    return { type: 'branch', name: ref.replace('refs/heads/', '') };
  }

  if (ref.startsWith('refs/tags/')) {
    return { type: 'tag', name: ref.replace('refs/tags/', '') };
  }

  return { type: 'unknown', name: ref };
}

/**
 * Formats commit information for push events
 *
 * @param {Object} pushData - Push data
 * @param {number} pushData.commitCount - Number of commits in the push
 * @param {Array<Object>} pushData.commits - Array of commit objects
 * @param {string} pushData.headCommitId - Short SHA of the head commit
 * @returns {string|null} Formatted commit info or null if no commits
 *
 * @example
 * formatCommitInfo({ commitCount: 2, commits: [...], headCommitId: 'abc1234' })
 * // Returns: '2 commits → abc1234'
 */
function formatCommitInfo(pushData) {
  const { commitCount, headCommitId } = pushData;

  if (commitCount === 0 || !headCommitId) {
    return null;
  }

  const commitWord = commitCount === 1 ? 'commit' : 'commits';
  return `${commitCount} ${commitWord} → ${headCommitId}`;
}

/**
 * Formats commit messages for push events
 *
 * Shows up to 3 commit messages, each truncated to 50 characters.
 *
 * @param {Object} pushData - Push data
 * @param {Array<Object>} pushData.commits - Array of commit objects
 * @returns {string|null} Formatted commit messages or null if no commits
 *
 * @example
 * formatCommitMessages({ commits: [{ message: 'Fix bug' }, { message: 'Add feature' }] })
 * // Returns: '├─ Fix bug\n├─ Add feature'
 */
function formatCommitMessages(pushData) {
  const { commits } = pushData;

  if (!commits || commits.length === 0) {
    return null;
  }

  // Show up to 3 commit messages
  const maxCommits = 3;
  const lines = [];

  for (let i = 0; i < Math.min(commits.length, maxCommits); i++) {
    const commit = commits[i];
    const message = commit?.message || '[No message]';
    const id = commit?.id?.substring(0, 7) || '???????';
    const truncated = message.length > 50 ? message.substring(0, 47) + '...' : message;

    const prefix = i === commits.length - 1 || i === maxCommits - 1 ? '└─' : '├─';
    lines.push(`${prefix} ${id}: ${truncated}`);
  }

  if (commits.length > maxCommits) {
    lines.push(`└─ ... and ${commits.length - maxCommits} more`);
  }

  return lines.join('\n');
}

/**
 * Formats a push event into a readable message
 *
 * Uses centralized formatters for consistent message structure.
 *
 * @param {Object} pushData - Extracted push data
 * @param {string} pushData.sender - Username of the sender
 * @param {string} pushData.refType - Type of ref ('branch', 'tag', 'unknown')
 * @param {string} pushData.refName - Name of the branch or tag
 * @param {string} pushData.repository - Repository full name
 * @param {number} pushData.commitCount - Number of commits
 * @param {Array<Object>} pushData.commits - Array of commit objects
 * @param {string} pushData.headCommitId - Short SHA of head commit
 * @param {string|null} pushData.compareUrl - URL to compare changes
 * @returns {string} Formatted message
 *
 * @example
 * formatPushMessage({
 *   sender: 'alice',
 *   refType: 'branch',
 *   refName: 'main',
 *   repository: 'user/repo',
 *   commitCount: 2,
 *   commits: [{ id: 'abc123...', message: 'Fix bug' }],
 *   headCommitId: 'abc1234',
 *   compareUrl: 'https://github.com/user/repo/compare/old...new'
 * })
 * // Returns multi-line message with push info, commits, and URL
 */
function formatPushMessage(pushData) {
  const {
    sender,
    refType,
    refName,
    repository,
    commitCount,
    commits,
    headCommitId,
    compareUrl
  } = pushData;

  // Get action label for push
  const actionLabel = getActionLabel('push', 'default');

  // Build message using centralized formatters
  const builder = buildBaseMessage(sender, actionLabel);

  // Add ref information
  const refTypeLabel = PUSH_TYPES[refType] || PUSH_TYPES.unknown;
  addLine(builder, `${refTypeLabel}: ${refName}`);

  // Add repository
  addLine(builder, `to: ${repository}`);

  // Add commit count and head SHA
  const commitInfo = formatCommitInfo({ commitCount, commits, headCommitId });
  if (commitInfo) {
    addLine(builder, commitInfo);
  }

  // Add commit messages
  const commitMessages = formatCommitMessages({ commits });
  if (commitMessages) {
    addLine(builder, commitMessages);
  }

  // Add compare URL
  if (compareUrl) {
    addUrl(builder, compareUrl);
  }

  return finalize(builder);
}

/**
 * Handles push webhook events
 *
 * @param {Object} payload - GitHub webhook payload for push event
 * @param {string} payload.ref - The git ref (e.g., "refs/heads/main")
 * @param {Object} payload.repository - The repository object
 * @param {string} payload.repository.full_name - Repository full name
 * @param {Object} payload.pusher - The pusher object
 * @param {string} payload.pusher.name - Pusher's username
 * @param {Array<Object>} payload.commits - Array of commit objects
 * @param {string} payload.head_commit - The head commit object
 * @param {string} payload.head_commit.id - Full SHA of head commit
 * @param {string} payload.compare - URL to compare changes
 * @param {boolean} payload.created - Whether the ref was created
 * @param {boolean} payload.deleted - Whether the ref was deleted
 * @returns {Promise<Object>} Handler result
 * @returns {boolean} returns.processed - Whether the event was processed
 * @returns {string} returns.message - Formatted message
 * @returns {string} returns.event - Event type ('push')
 * @returns {Object} returns.data - Extracted push data
 *
 * @throws {Error} If payload is invalid or missing required fields
 *
 * @example
 * const result = await handlePush({
 *   ref: 'refs/heads/main',
 *   repository: { full_name: 'user/repo' },
 *   pusher: { name: 'alice' },
 *   commits: [{ id: 'abc123...', message: 'Fix bug' }],
 *   head_commit: { id: 'abc123456789...' },
 *   compare: 'https://github.com/user/repo/compare/old...new'
 * });
 */
export async function handlePush(payload) {
  // Input validation
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid payload: expected object');
  }

  // Validate required fields
  if (!payload.ref || typeof payload.ref !== 'string') {
    throw new Error('Invalid payload: missing or invalid ref field');
  }

  if (!payload.repository || typeof payload.repository !== 'object') {
    throw new Error('Invalid payload: missing or invalid repository object');
  }

  if (!payload.pusher || typeof payload.pusher !== 'object') {
    throw new Error('Invalid payload: missing or invalid pusher object');
  }

  const { ref, repository, pusher, commits, head_commit, compare, created, deleted } = payload;

  // Extract ref type and name
  const { type: refType, name: refName } = formatRef(ref);

  // Extract repository name
  const repositoryName = repository.full_name || 'unknown';

  // Extract pusher name
  const pusherName = pusher.name || 'unknown';

  // Extract commits
  const commitsArray = Array.isArray(commits) ? commits : [];
  const commitCount = commitsArray.length;

  // Extract head commit SHA
  const headCommitId = head_commit?.id
    ? (head_commit.id.length >= 7 ? head_commit.id.substring(0, 7) : head_commit.id)
    : null;

  // Extract compare URL
  const compareUrl = compare || null;

  // Build push data object
  const pushData = {
    sender: pusherName,
    refType,
    refName,
    repository: repositoryName,
    commitCount,
    commits: commitsArray,
    headCommitId,
    compareUrl,
    created: created || false,
    deleted: deleted || false
  };

  // Format message
  const message = formatPushMessage(pushData);

  return {
    processed: true,
    message,
    event: 'push',
    data: {
      ref,
      refType,
      refName,
      repository: repositoryName,
      pusher: pusherName,
      commitCount,
      headCommitId,
      compareUrl,
      created: pushData.created,
      deleted: pushData.deleted,
      commits: commitsArray.map(commit => ({
        id: commit?.id?.substring(0, 7) || null,
        message: commit?.message || '[No message]',
        author: commit?.author?.name || 'unknown'
      }))
    }
  };
}
