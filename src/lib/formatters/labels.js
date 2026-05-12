/**
 * Label Formatter
 *
 * Provides label formatting utilities for GitHub webhook events.
 * Maps label colors to emoji dots for visual clarity.
 *
 * @module formatters/labels
 */

/**
 * Color to emoji mapping for issue labels
 *
 * Maps GitHub label colors to emoji dots.
 * Frozen to prevent prototype pollution (security best practice).
 *
 * @type {Object<string, string>}
 */
export const COLOR_EMOJI_MAP = {
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
 * getEmojiForColor('unknown') // Returns '⚫'
 */
export function getEmojiForColor(color) {
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
 *
 * formatLabels([{ name: 'bug', color: 'd73a4a' }, { name: 'enhancement', color: 'a2eeef' }])
 * // Returns '🔴 bug 🔵 enhancement'
 */
export function formatLabels(labels) {
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
