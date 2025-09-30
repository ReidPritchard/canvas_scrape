import { config as dotenvxConfig } from "@dotenvx/dotenvx";

// AIDEV-NOTE: Using dotenvx for encrypted .env file support
// Supports both plain and encrypted .env files automatically
// Encrypted files use .env.keys for decryption (git-ignored)

// TODO: Add support for config files for end user convenience
// e.g. config.json or config.yaml at ~/Documents/canvas-scraper/ or similar
// Ideally have UI to set this up

// Load environment variables from .env file if it exists
// Supports both plain and encrypted .env files
dotenvxConfig({
  quiet: true,
  path: [".env", `${process.env.HOME}/.canvas-scraper.env`],
});

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
