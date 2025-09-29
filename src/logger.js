import winston from "winston";
import config from "../config.js";
import { promises as fs } from "fs";

const { align, combine, timestamp, errors, json, printf, colorize } =
  winston.format;

// AIDEV-NOTE: Custom format for console output - provides readable dev logging
const consoleFormat = printf(
  ({ level, message, timestamp, context, ...meta }) => {
    let contextStr = context ? `[${context}] ` : "";

    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : "";

    return `${timestamp} ${level}: ${contextStr}${message}\n${metaStr}`;
  },
);

// AIDEV-NOTE: Ensure logs directory exists before creating transports
const ensureLogsDirectory = async () => {
  try {
    await fs.mkdir("logs", { recursive: true });
  } catch (error) {
    if (error.code !== "EEXIST") {
      console.warn("Failed to create logs directory:", error.message);
    }
  }
};

// AIDEV-NOTE: Logger configuration optimized for performance and environment
const createLogger = async () => {
  const isDev = process.argv.includes("--dev") || config.logging?.isDev;
  const isPerformanceTest = process.argv.includes("--performance-test");

  // Ensure logs directory exists
  await ensureLogsDirectory();

  const transports = [];

  // Console transport - optimized for performance in production
  if (!isPerformanceTest) {
    transports.push(
      new winston.transports.Console({
        level: isDev ? "debug" : "warn", // Less verbose in production
        format: isDev
          ? combine(
              colorize({ all: true }),
              timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
              errors({ stack: true }),
              align(),
              consoleFormat,
            )
          : combine(timestamp(), json()),
        // Performance optimization: silent console in production mode for non-critical logs
        silent: !isDev && !process.env.FORCE_CONSOLE_LOGGING,
      }),
    );
  }

  // File transport for all logs - optimized for performance
  if (config.logging?.enableFileLogging !== false) {
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
  }

  // Add debug file in development
  if (isDev) {
    transports.push(
      new winston.transports.File({
        filename: "logs/debug.log",
        level: "debug",
        format: combine(timestamp(), errors({ stack: true }), json()),
        maxsize: 5242880, // 5MB
        maxFiles: 3,
      }),
    );
  }

  // AIDEV-NOTE: Performance test mode needs minimal transport, not silent logger
  if (isPerformanceTest && transports.length === 0) {
    transports.push(
      new winston.transports.File({
        filename: "logs/performance.log",
        level: "warn",
        format: combine(timestamp(), json()),
        maxsize: 5242880,
        maxFiles: 1,
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
  });

  // AIDEV-NOTE: Production performance optimization - minimal metadata
  if (!isDev && !isPerformanceTest) {
    logger.configure({
      level: "info",
      format: json(),
      defaultMeta: null, // Reduce metadata overhead
    });
  }

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

export default await createLogger();

