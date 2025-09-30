// AIDEV-NOTE: Shared error handling utility for consistent error recovery across all modules
import logger from "./logger.js";

/**
 * Creates a standardized error handler for a specific context and session
 * @param {string} context - The context/module where errors occur (e.g., 'canvas_scraping', 'api_integration')
 * @param {string} sessionId - Session ID for correlation across operations
 * @param {Object} operationStats - Statistics object to update error counts
 * @returns {Function} Error handler function
 */
export const createErrorHandler = (context, sessionId, operationStats) => {
  return (operation) => (error) => {
    // AIDEV-NOTE: Update error statistics if provided
    if (operationStats && operationStats.scrapingStats) {
      operationStats.scrapingStats.errors++;
    }
    if (operationStats && operationStats.apiStats) {
      // Update API-specific error counts
      if (context.includes("todoist") && operationStats.apiStats.todoist) {
        operationStats.apiStats.todoist.errors++;
      }
      if (context.includes("notion") && operationStats.apiStats.notion) {
        operationStats.apiStats.notion.errors++;
      }
    }

    // AIDEV-NOTE: Standardized error logging with consistent structure
    logger.error(`${operation} failed`, {
      context,
      sessionId,
      error: error.message,
      errorType: error.constructor.name,
      stack: error.stack,
      operation,
      timestamp: Date.now(),
    });

    // AIDEV-NOTE: Always re-throw for caller handling - maintains consistent error propagation
    throw error;
  };
};

/**
 * Creates a non-throwing error handler for operations that should continue on error
 * @param {string} context - The context/module where errors occur
 * @param {string} sessionId - Session ID for correlation
 * @param {Object} operationStats - Statistics object to update error counts
 * @returns {Function} Error handler function that logs but doesn't throw
 */
export const createWarningHandler = (context, sessionId, operationStats) => {
  return (operation) => (error) => {
    // AIDEV-NOTE: Update statistics but don't increment critical error counts
    if (operationStats && operationStats.scrapingStats) {
      operationStats.scrapingStats.warnings =
        (operationStats.scrapingStats.warnings || 0) + 1;
    }

    // AIDEV-NOTE: Log as warning instead of error for non-critical failures
    logger.warn(`${operation} had non-critical failure`, {
      context,
      sessionId,
      error: error.message,
      errorType: error.constructor.name,
      operation,
      timestamp: Date.now(),
      recoverable: true,
    });

    // AIDEV-NOTE: Return null or default value instead of throwing
    return null;
  };
};
