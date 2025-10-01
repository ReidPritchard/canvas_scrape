import winston from "winston";
import config from "../config.js";
import fs from "fs";

const { align, combine, timestamp, errors, json, printf, colorize } =
  winston.format;

// AIDEV-NOTE: Custom format for console output - provides readable dev logging
const consoleFormat = printf(
  ({ level, message, timestamp, context, ...meta }) => {
    let contextStr = context ? `[${context}] ` : "";

    const metaStr = Object.keys(meta).length
      ? JSON.stringify(meta, null, 2)
      : "";

    return `${timestamp} ${level}: ${contextStr}${message}\n${metaStr}`;
  },
);

// AIDEV-NOTE: Ensure logs directory exists before creating transports (synchronous for pkg compatibility)
const ensureLogsDirectory = () => {
  try {
    fs.mkdirSync("logs", { recursive: true });
    return true;
  } catch (error) {
    if (error.code !== "EEXIST") {
      console.warn("Failed to create logs directory:", error.message);
    }
    return false;
  }
};

// AIDEV-NOTE: Logger configuration optimized for performance and environment (synchronous for pkg compatibility)
const createLogger = () => {
  const isDev = process.argv.includes("--dev") || config.logging?.isDev;
  const isPerformanceTest = process.argv.includes("--performance-test");

  // Ensure logs directory exists
  const canWriteLogs = ensureLogsDirectory();

  const transports = [];

  // AIDEV-NOTE: Always add console transport to prevent "no transports" warning in packaged apps
  // File logging may fail in restricted environments, so console is the fallback
  if (!isPerformanceTest) {
    transports.push(
      new winston.transports.Console({
        level: isDev ? "debug" : "error", // Only show errors in production by default
        format: isDev
          ? combine(
              colorize({ all: true }),
              timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
              errors({ stack: true }),
              align(),
              consoleFormat,
            )
          : combine(timestamp(), json()),
        silent: false,
      }),
    );
  }

  // File transport for all logs - only if directory creation succeeded
  if (canWriteLogs && config.logging?.enableFileLogging !== false) {
    try {
      transports.push(
        new winston.transports.File({
          filename: "logs/app.log",
          level: "info",
          format: combine(timestamp(), errors({ stack: true }), json()),
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          // Performance optimization: reduce file system overhead
          options: { flags: "a" }, // append mode
          tailable: true,
        }),
      );

      // Separate file for errors - critical logs only
      transports.push(
        new winston.transports.File({
          filename: "logs/error.log",
          level: "error",
          format: combine(timestamp(), errors({ stack: true }), json()),
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          options: { flags: "a" },
          tailable: true,
        }),
      );
    } catch (error) {
      // AIDEV-NOTE: File transport creation failed - console transport will handle all logs
      console.warn("File logging disabled due to error:", error.message);
    }
  }

  // Add debug file in development
  if (isDev && canWriteLogs) {
    try {
      transports.push(
        new winston.transports.File({
          filename: "logs/debug.log",
          level: "debug",
          format: combine(timestamp(), errors({ stack: true }), json()),
          maxsize: 5242880, // 5MB
          maxFiles: 3,
        }),
      );
    } catch (error) {
      console.warn("Debug file logging disabled:", error.message);
    }
  }

  // AIDEV-NOTE: Fallback for performance test mode - ensure at least one transport exists
  if (isPerformanceTest && transports.length === 0) {
    if (canWriteLogs) {
      try {
        transports.push(
          new winston.transports.File({
            filename: "logs/performance.log",
            level: "warn",
            format: combine(timestamp(), json()),
            maxsize: 5242880,
            maxFiles: 1,
          }),
        );
      } catch (error) {
        // Fallback to console if file logging fails
        transports.push(
          new winston.transports.Console({
            level: "warn",
            format: combine(timestamp(), json()),
            silent: false,
          }),
        );
      }
    } else {
      // No file logging available, use console
      transports.push(
        new winston.transports.Console({
          level: "warn",
          format: combine(timestamp(), json()),
          silent: false,
        }),
      );
    }
  }

  // AIDEV-NOTE: Safety check - ensure at least one transport exists to prevent Winston warnings
  if (transports.length === 0) {
    transports.push(
      new winston.transports.Console({
        level: "warn",
        format: combine(timestamp(), json()),
        silent: false,
      }),
    );
  }

  const logger = winston.createLogger({
    level: isDev ? "debug" : "info",
    transports,
    // Performance optimizations
    exitOnError: false,
    // Don't silence entire logger - handle per transport
    silent: false,
    // Minimal formatting for performance
    format: isDev
      ? combine(timestamp(), errors({ stack: true }), json())
      : json(), // Skip timestamp in production for performance
    // Performance optimizations
    handleExceptions: isDev,
    handleRejections: isDev,
    // AIDEV-NOTE: Avoid defaultMeta in production to reduce overhead
    defaultMeta: isDev ? {} : null,
  });

  // AIDEV-NOTE: Removed logger.configure() call that was clearing transports in production
  // All configuration is now done in winston.createLogger() to prevent transport loss

  return logger;
};

// AIDEV-NOTE: Sensitive data filtering to prevent logging credentials
export const sanitizeLogData = (data) => {
  const sensitiveKeys = ["password", "api_key", "token", "secret"];
  const sanitized = { ...data };

  sensitiveKeys.forEach((key) => {
    if (sanitized[key]) {
      sanitized[key] = "[REDACTED]";
    }
  });

  return sanitized;
};

// AIDEV-NOTE: Export logger instance synchronously for pkg/CommonJS compatibility
export default createLogger();
