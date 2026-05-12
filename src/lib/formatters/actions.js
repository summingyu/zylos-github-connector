/**
 * Action Label Formatter
 *
 * Provides action label mappings for all GitHub webhook event types.
 * Centralizes action label definitions to ensure consistency across handlers.
 *
 * @module formatters/actions
 */

/**
 * Action label mappings for all event types
 *
 * Maps event types and their actions to display labels with emojis.
 * This centralized mapping ensures consistent labeling across all handlers.
 *
 * @type {Object<string, Object<string, string>>}
 */
export const ACTION_LABELS = {
  issues: {
    opened: '🔓 Issue Opened',
    closed: '🔒 Issue Closed',
    reopened: '♻️ Issue Reopened',
    deleted: '🗑️ Issue Deleted'
  },
  pull_request: {
    opened: '🔓 PR Opened',
    closed: '🔒 PR Closed',
    reopened: '♻️ PR Reopened',
    merged: '🟣 PR Merged',
    ready_for_review: '👀 PR Ready for Review'
  },
  issue_comment: {
    created: '💬 Comment Created'
  },
  release: {
    published: '🚀 Release Published',
    created: '🚀 Release Created'
  }
};

// Freeze ACTION_LABELS to prevent accidental modifications
Object.freeze(ACTION_LABELS);

// Freeze each event type's action labels
Object.values(ACTION_LABELS).forEach(actionMap => {
  Object.freeze(actionMap);
});

/**
 * Gets the action label for a given event type and action
 *
 * @param {string} eventType - The event type (issues, pull_request, issue_comment, release)
 * @param {string} action - The action performed (opened, closed, created, etc.)
 * @returns {string} Action label with emoji, or generic label if not found
 *
 * @example
 * getActionLabel('issues', 'opened')
 * // Returns '🔓 Issue Opened'
 *
 * getActionLabel('pull_request', 'merged')
 * // Returns '🟣 PR Merged'
 *
 * getActionLabel('unknown', 'unknown')
 * // Returns 'unknown unknown'
 */
export function getActionLabel(eventType, action) {
  if (!eventType || !action) {
    return '❓ Unknown Action';
  }

  // Get the action map for the event type
  const eventActions = ACTION_LABELS[eventType];

  if (!eventActions) {
    // Event type not found, return generic label
    return `❓ ${eventType} ${action}`;
  }

  // Get the specific action label
  const label = eventActions[action];

  if (!label) {
    // Action not found, return generic label
    return `❓ ${eventType} ${action}`;
  }

  return label;
}
