import dotenv from "dotenv";

// Load environment variables from .env file if it exists
dotenv.config();

// Load environment variables from .env file if it exists
const env_canvas_pwd = process.env.CANVAS_PWD || "";

const env_notion_api_key = process.env.NOTION_API_KEY || "";
const env_notion_db_id = process.env.NOTION_DB_ID || "";

const env_todoist_api_key = process.env.TODOIST_API_KEY || "";
const env_todoist_export = process.env.TODOIST_EXPORT === "true" || false;

export default {
  url: "https://canvas.colorado.edu/",
  account: { username: "repr0811", password: env_canvas_pwd },
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
    notion: false,
  },
};
