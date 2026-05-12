/**
 * URL Formatter
 *
 * Provides URL formatting utilities for GitHub webhook events.
 * Ensures consistent URL formatting across all event types.
 *
 * @module formatters/urls
 */

/**
 * Formats a URL with the 🔗 prefix
 *
 * Validates the URL and adds the 🔗 prefix for consistency.
 * Null/undefined URLs are handled gracefully (returns empty string).
 *
 * @param {string|null|undefined} url - URL to format
 * @returns {string} Formatted URL with 🔗 prefix, or empty string
 *
 * @example
 * formatUrl('https://github.com/user/repo/issues/42')
 * // Returns '🔗 https://github.com/user/repo/issues/42'
 *
 * formatUrl(null)
 * // Returns ''
 */
export function formatUrl(url) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return '';
  }

  return `🔗 ${url}`;
}

/**
 * Builds a GitHub URL for a given resource type
 *
 * Constructs URLs for issues, pull requests, repositories, etc.
 * Handles missing parameters gracefully.
 *
 * @param {string} owner - Repository owner (user or org)
 * @param {string} repo - Repository name
 * @param {string} type - Resource type ('issues', 'pull', 'repo', etc.)
 * @param {number|null} number - Issue/PR number (required for issues/pull)
 * @returns {string|null} GitHub URL or null if parameters are missing
 *
 * @example
 * formatGithubUrl('user', 'repo', 'issues', 42)
 * // Returns 'https://github.com/user/repo/issues/42'
 *
 * formatGithubUrl('user', 'repo', 'repo', null)
 * // Returns 'https://github.com/user/repo'
 */
export function formatGithubUrl(owner, repo, type, number) {
  if (!owner || !repo || typeof owner !== 'string' || typeof repo !== 'string') {
    return null;
  }

  const baseUrl = `https://github.com/${owner}/${repo}`;

  if (type === 'issues' && number !== null && number !== undefined) {
    return `${baseUrl}/issues/${number}`;
  }

  if (type === 'pull' && number !== null && number !== undefined) {
    return `${baseUrl}/pull/${number}`;
  }

  if (type === 'repo') {
    return baseUrl;
  }

  return null;
}
