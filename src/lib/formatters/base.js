/**
 * Base Message Builder
 *
 * Provides a fluent interface for building multi-line messages.
 * All messages follow a consistent structure:
 * - Line 1: Action label with sender
 * - Line 2-N: Context-specific information (labels, title, etc.)
 * - Last Line: URL with 🔗 prefix
 *
 * @module formatters/base
 */

/**
 * Creates a message builder object with the first line
 *
 * The first line always follows the format: "{actionLabel} by @{sender}"
 *
 * @param {string} sender - Username of the sender
 * @param {string} actionLabel - Action label (e.g., "🔓 Issue Opened")
 * @returns {Object} Message builder object with lines array
 * @returns {Array<string>} returns.lines - Array of message lines
 *
 * @example
 * const builder = buildBaseMessage('alice', '🔓 Issue Opened');
 * // Returns: { lines: ['🔓 Issue Opened by @alice'] }
 */
export function buildBaseMessage(sender, actionLabel) {
  if (!sender || typeof sender !== 'string') {
    throw new Error('Invalid sender: expected non-empty string');
  }
  if (!actionLabel || typeof actionLabel !== 'string') {
    throw new Error('Invalid actionLabel: expected non-empty string');
  }
  const lines = [];

  // Line 1: Action label with sender
  lines.push(`${actionLabel} by @${sender}`);

  return { lines };
}

/**
 * Adds a line to the message builder
 *
 * @param {Object} builder - Message builder object
 * @param {Array<string>} builder.lines - Array of message lines
 * @param {string} content - Line content to add
 * @returns {void}
 *
 * @example
 * const builder = buildBaseMessage('alice', '🔓 Issue Opened');
 * addLine(builder, '🔴 bug 🔵 enhancement');
 * // builder.lines is now: ['🔓 Issue Opened by @alice', '🔴 bug 🔵 enhancement']
 */
export function addLine(builder, content) {
  if (!builder || !Array.isArray(builder.lines)) {
    throw new Error('Invalid builder in addLine: expected object with lines array');
  }

  if (content !== null && content !== undefined && content !== '') {
    builder.lines.push(String(content));
  }
}

/**
 * Adds a URL line to the message builder
 *
 * URLs are formatted with a 🔗 prefix for consistency.
 * Null/undefined URLs are handled gracefully (no line added).
 *
 * @param {Object} builder - Message builder object
 * @param {Array<string>} builder.lines - Array of message lines
 * @param {string|null|undefined} url - URL to add
 * @returns {void}
 *
 * @example
 * const builder = buildBaseMessage('alice', '🔓 Issue Opened');
 * addUrl(builder, 'https://github.com/user/repo/issues/42');
 * // builder.lines is now: ['🔓 Issue Opened by @alice', '🔗 https://github.com/user/repo/issues/42']
 */
export function addUrl(builder, url) {
  if (!builder || !Array.isArray(builder.lines)) {
    throw new Error('Invalid builder in addUrl: expected object with lines array');
  }

  if (url && typeof url === 'string' && url.trim()) {
    builder.lines.push(`🔗 ${url}`);
  }
}

/**
 * Finalizes the message builder into a string
 *
 * Joins all lines with newline characters.
 *
 * @param {Object} builder - Message builder object
 * @param {Array<string>} builder.lines - Array of message lines
 * @returns {string} Final message string
 *
 * @example
 * const builder = buildBaseMessage('alice', '🔓 Issue Opened');
 * addLine(builder, '🔴 bug');
 * addLine(builder, '#42: Fix login bug');
 * addUrl(builder, 'https://github.com/user/repo/issues/42');
 * const message = finalize(builder);
 * // Returns:
 * // "🔓 Issue Opened by @alice
 * // 🔴 bug
 * // #42: Fix login bug
 * // 🔗 https://github.com/user/repo/issues/42"
 */
export function finalize(builder) {
  if (!builder || !Array.isArray(builder.lines)) {
    throw new Error('Invalid builder in finalize: expected object with lines array');
  }

  return builder.lines.join('\n');
}
