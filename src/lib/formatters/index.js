/**
 * Message Formatters Module
 *
 * Centralized message formatting utilities for GitHub webhook events.
 * Provides consistent message structure, URL formatting, and action labeling.
 *
 * @module formatters
 */

// Re-export all formatter modules
export * from './base.js';
export * from './actions.js';
export * from './urls.js';
export * from './labels.js';

/**
 * Message Structure
 *
 * All messages follow this structure:
 * - Line 1: Action label with sender (e.g., "🔓 Issue Opened by @alice")
 * - Line 2-N: Context-specific information (labels, title, branch info, etc.)
 * - Last Line: URL with 🔗 prefix (e.g., "🔗 https://github.com/user/repo/issues/42")
 *
 * @example
 * import { buildBaseMessage, addLine, addUrl, finalize, getActionLabel } from '../formatters/index.js';
 *
 * const builder = buildBaseMessage('alice', getActionLabel('issues', 'opened'));
 * addLine(builder, '🔴 bug 🔵 enhancement');
 * addLine(builder, '#42: Fix login bug');
 * addUrl(builder, 'https://github.com/user/repo/issues/42');
 * const message = finalize(builder);
 */
