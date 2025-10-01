import { config as dotenvxConfig } from "@dotenvx/dotenvx";
import fs from "fs";
import path from "path";

// AIDEV-NOTE: Enhanced config loader with support for:
// - Custom config paths via CONFIG_PATH env var or --config CLI flag
// - Multiple formats: .env and JSON files
// - Encryption support for both formats via dotenvx
// - Automatic detection of config files in standard locations

/**
 * Get custom config path from environment or CLI arguments
 * @returns {string|null} Custom config path or null
 */
function getCustomConfigPath() {
  // Check environment variable
  if (process.env.CONFIG_PATH) {
    return process.env.CONFIG_PATH;
  }

  // Check CLI arguments for --config flag
  const args = process.argv;
  const configFlagIndex = args.indexOf("--config");
  if (configFlagIndex !== -1 && args[configFlagIndex + 1]) {
    return args[configFlagIndex + 1];
  }

  return null;
}

/**
 * Load configuration from JSON file
 * @param {string} configPath - Path to JSON config file
 */
function loadJsonConfig(configPath) {
  try {
    const content = fs.readFileSync(configPath, "utf-8");

    // Check if file appears to be encrypted (dotenvx format)
    if (content.includes("#/---")) {
      // Encrypted JSON - use dotenvx to decrypt
      const keysPath = `${configPath}.keys`;
      if (fs.existsSync(keysPath)) {
        dotenvxConfig({ path: configPath, envKeysFile: keysPath, quiet: true });
      } else {
        console.warn(
          `⚠️  Encrypted config found but keys file missing: ${keysPath}`,
        );
      }
    } else {
      // Plain JSON - parse and validate structure
      const config = JSON.parse(content);

      // AIDEV-NOTE: Validate required configuration fields
      const required = ["CANVAS_URL", "CANVAS_USERNAME", "CANVAS_PWD"];
      const missing = required.filter((key) => !config[key]);
      if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(", ")}`);
      }

      // Set environment variables
      Object.entries(config).forEach(([key, value]) => {
        if (!process.env[key]) {
          process.env[key] = String(value);
        }
      });
    }
  } catch (error) {
    console.error(
      `Failed to load JSON config from ${configPath}:`,
      error.message,
    );
  }
}

/**
 * Load configuration from available sources
 * Priority: custom path > .env > config.json > ~/.canvas-scraper.*
 */
function loadConfiguration() {
  const customPath = getCustomConfigPath();
  const home = process.env.HOME || process.env.USERPROFILE;

  if (customPath) {
    // Custom config path specified
    if (fs.existsSync(customPath)) {
      if (customPath.endsWith(".json")) {
        loadJsonConfig(customPath);
      } else {
        dotenvxConfig({ path: customPath, quiet: true });
      }
      return;
    } else {
      console.warn(`⚠️  Custom config path not found: ${customPath}`);
    }
  }

  // Try standard locations in priority order
  const configPaths = [
    { path: ".env", type: "env" },
    { path: "config.json", type: "json" },
    { path: path.join(home, ".canvas-scraper.env"), type: "env" },
    { path: path.join(home, ".canvas-scraper.json"), type: "json" },
  ];

  for (const { path: configPath, type } of configPaths) {
    if (!!configPath && fs.existsSync(configPath)) {
      if (type === "json") {
        loadJsonConfig(configPath);
      } else {
        dotenvxConfig({ path: configPath, quiet: true });
      }
      return;
    }
  }

  // If no config found, try loading from default .env locations
  try {
    dotenvxConfig({
      quiet: true,
      path: [".env", path.join(home, ".canvas-scraper.env")],
    });
  } catch (error) {
    console.error("Failed to load default .env configuration:", error.message);
  }
}

// Load configuration
loadConfiguration();

// Load environment variables from .env file if it exists
const env_canvas_url = process.env.CANVAS_URL || "https://canvas.colorado.edu/";
const env_canvas_username = process.env.CANVAS_USERNAME || "";
const env_canvas_pwd = process.env.CANVAS_PWD || "";

const env_notion_api_key = process.env.NOTION_API_KEY || "";
const env_notion_db_id = process.env.NOTION_DB_ID || "";
const env_notion_export = process.env.NOTION_EXPORT === "true" || false;

const env_todoist_api_key = process.env.TODOIST_API_KEY || "";
const env_todoist_export = process.env.TODOIST_EXPORT === "true" || false;

export default {
  url: env_canvas_url,
  account: { username: env_canvas_username, password: env_canvas_pwd },
  todoist_api_key: env_todoist_api_key,
  notion_api_key: env_notion_api_key,
  notion_db_id: env_notion_db_id,

  // AIDEV-NOTE: Logging configuration for Winston integration
  logging: {
    isDev:
      process.env.NODE_ENV === "development" || process.argv.includes("--dev"),
    level:
      process.env.LOG_LEVEL ||
      (process.argv.includes("--dev") ? "debug" : "info"),
    enableFileLogging: process.env.ENABLE_FILE_LOGGING !== "false",
  },

  exportTo: {
    todoist: env_todoist_export,
    notion: env_notion_export,
  },
};
