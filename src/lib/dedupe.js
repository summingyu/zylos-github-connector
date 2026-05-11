/**
 * Deduplication Module
 *
 * Tracks processed GitHub webhook delivery IDs to prevent duplicate processing.
 * Uses in-memory Set for fast lookups (suitable for single-instance deployment).
 *
 * @module dedupe
 */

/**
 * In-memory storage for processed delivery IDs
 *
 * Each GitHub webhook delivery has a unique GUID in the X-GitHub-Delivery header.
 * We track these IDs to ensure we don't process the same event twice.
 *
 * Changed from Set to Map to support TTL-based cleanup (WR-02 fix).
 *
 * @type {Map<string, number>}
 *
 * @example
 * // After receiving a webhook
 * markDeliveryAsSeen('12345678-1234-1234-1234-123456789abc');
 *
 * // Later, checking if we've seen this delivery
 * if (hasDeliveryBeenSeen('12345678-1234-1234-1234-123456789abc')) {
 *   // Skip processing
 * }
 */
export const seenDeliveries = new Map();

/**
 * Checks if a delivery ID has already been processed
 *
 * @param {string} deliveryId - The X-GitHub-Delivery GUID to check
 * @returns {boolean} True if the delivery ID has been seen before
 *
 * @example
 * if (hasDeliveryBeenSeen(deliveryId)) {
 *   return reply.code(200).send({ message: 'Duplicate, already processed' });
 * }
 */
export function hasDeliveryBeenSeen(deliveryId) {
  if (!deliveryId || typeof deliveryId !== 'string') {
    return false;
  }
  return seenDeliveries.has(deliveryId);
}

/**
 * Marks a delivery ID as having been processed
 *
 * @param {string} deliveryId - The X-GitHub-Delivery GUID to mark as seen
 * @returns {boolean} True if the delivery was newly added, false if already present
 *
 * @example
 * const wasNew = markDeliveryAsSeen(deliveryId);
 * if (wasNew) {
 *   // First time seeing this delivery, process it
 * } else {
 *   // Duplicate delivery, skip processing
 * }
 */
export function markDeliveryAsSeen(deliveryId) {
  if (!deliveryId || typeof deliveryId !== 'string') {
    return false;
  }

  if (seenDeliveries.has(deliveryId)) {
    return false;
  }

  // 存储时间戳以支持 TTL 清理
  seenDeliveries.set(deliveryId, Date.now());
  return true;
}

/**
 * Returns deduplication statistics
 *
 * Useful for monitoring and debugging. Can be exposed via health check endpoint.
 *
 * @returns {Object} Statistics object
 * @returns {number} returns.totalSeen - Total number of unique delivery IDs seen
 * @returns {number} returns.currentSetSize - Current size of the seenDeliveries Set
 * @returns {string} returns.memoryEstimate - Rough estimate of memory usage
 *
 * @example
 * const stats = getDedupeStats();
 * console.log(`Processed ${stats.totalSeen} unique deliveries`);
 * // Output: Processed 1234 unique deliveries
 */
export function getDedupeStats() {
  const totalSeen = seenDeliveries.size;

  // Rough memory estimate: each GUID is ~36 bytes + Set overhead
  // This is a conservative estimate for monitoring purposes
  const estimatedBytes = totalSeen * 40; // 36 chars + overhead
  const estimatedMB = (estimatedBytes / (1024 * 1024)).toFixed(2);

  return {
    totalSeen,
    currentSetSize: totalSeen,
    memoryEstimate: estimatedMB + ' MB'
  };
}

/**
 * Clears all seen delivery IDs
 *
 * WARNING: This should typically only be used in testing or manual recovery scenarios.
 * Clearing the dedupe set will cause all subsequent deliveries to be processed again,
 * potentially causing duplicate notifications.
 *
 * @returns {number} The number of delivery IDs that were cleared
 *
 * @example
 * // In a test suite
 * afterEach(() => {
 *   clearSeenDeliveries();
 * });
 */
export function clearSeenDeliveries() {
  const count = seenDeliveries.size;
  seenDeliveries.clear();
  return count;
}

/**
 * Removes old delivery IDs to prevent unbounded memory growth
 *
 * This is a placeholder for future TTL/LRU implementation. In production,
 * you would implement a proper cleanup strategy based on time or size limits.
 *
 * For now, this function exists as a no-op to document the intended design.
 * In a future version, this could:
 * - Remove entries older than N hours
 * - Keep only the most recent N entries
 * - Use a proper LRU cache library
 *
 * @param {Object} options - Cleanup options
 * @param {number} [options.maxSize] - Maximum entries to keep
 * @param {number} [options.maxAgeHours] - Maximum age in hours
 * @returns {number} Number of entries removed
 *
 * @example
 * // Future implementation
 * const removed = pruneOldDeliveries({ maxSize: 10000 });
 */
export function pruneOldDeliveries(options = {}) {
  // TODO: Implement TTL/LRU cleanup in future version
  // For now, this is a no-op to document the design intent
  return 0;
}

/**
 * Checks if a delivery ID is valid
 *
 * GitHub delivery IDs are GUIDs in the format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 *
 * @param {string} deliveryId - The delivery ID to validate
 * @returns {boolean} True if the delivery ID appears to be a valid GUID
 *
 * @example
 * if (!isValidDeliveryId(deliveryId)) {
 *   return reply.code(400).send({ error: 'Invalid delivery ID' });
 * }
 */
export function isValidDeliveryId(deliveryId) {
  if (!deliveryId || typeof deliveryId !== 'string') {
    return false;
  }

  // Check for GUID format: 8-4-4-4-12 hex digits
  const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return guidPattern.test(deliveryId);
}
