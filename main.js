import fs from "fs";
import config from "./config.js";
import logger from "./src/logger.js";
import { scrapeCanvas } from "./src/canvas-scraper.js";
import { exportToTodoist } from "./src/todoist-export.js";
import { exportToNotion } from "./src/notion-export.js";
import { runConfigWizard, checkConfigExists } from "./src/config-wizard.js";
import crypto from "crypto";

const { exportTo } = config;

// AIDEV-NOTE: Session correlation ID for end-to-end operation tracking
const SESSION_ID = crypto.randomUUID();

// AIDEV-NOTE: Session-scoped logger ensures all entries include sessionId
const sessionLogger = logger.child({ sessionId: SESSION_ID });

// AIDEV-NOTE: Performance tracking for API operations only (Canvas stats moved to canvas-scraper.js)
const operationStats = {
  sessionId: SESSION_ID,
  startTime: Date.now(),
  apiStats: {
    notion: { creates: 0, updates: 0, errors: 0 },
    todoist: { creates: 0, updates: 0, errors: 0 },
  },
  endTime: null,
  totalDuration: null,
};

(async () => {
  var myArgs = process.argv.slice(2);
  const isDev = myArgs[0] === "--dev";
  const skipScraping = myArgs.includes("--skip-scraping");
  const runSetup = myArgs.includes("--setup");

  // AIDEV-NOTE: Configuration wizard support for first-time setup
  // Runs if --setup flag provided or no config file exists
  if (runSetup) {
    try {
      await runConfigWizard();
      process.exit(0);
    } catch (error) {
      console.error("Configuration wizard failed:", error.message);
      process.exit(1);
    }
  }

  // Check if config exists, offer to run wizard if not
  const configStatus = checkConfigExists();
  if (!configStatus.exists && !config.account.password) {
    console.log("\n⚠️  No configuration file found.");
    console.log("Run the configuration wizard to set up Canvas Scraper:\n");
    console.log("  node main.js --setup\n");
    console.log("Or create a .env file manually (see .env.example)\n");
    process.exit(1);
  }

  // AIDEV-NOTE: Session initialization for main application workflow
  sessionLogger.info("Starting Canvas scraping application", {
    context: "app_start",
    timestamp: Date.now(),
    mode: isDev ? "development" : "production",
    arguments: myArgs,
    nodeVersion: process.version,
    platform: process.platform,
  });

  try {
    let assignments = [];
    if (skipScraping) {
      sessionLogger.info(
        "Skipping Canvas scraping as per command-line argument",
        {
          context: "skip_scraping",
        },
      );

      if (fs.existsSync("output.json")) {
        assignments = JSON.parse(fs.readFileSync("output.json", "utf-8"));
        sessionLogger.info(
          `Loaded ${assignments.length} assignments from output.json`,
          {
            context: "load_assignments",
          },
        );
      }
    } else {
      // AIDEV-NOTE: Canvas scraping using dedicated module with session correlation
      assignments = await scrapeCanvas(config, isDev, SESSION_ID);
    }

    // AIDEV-NOTE: Export operations using dedicated modules
    const { todoist, notion } = exportTo;
    if (todoist)
      await exportToTodoist(assignments, config, SESSION_ID, operationStats);
    if (notion)
      await exportToNotion(assignments, config, SESSION_ID, operationStats);

    if (!(todoist || notion))
      fs.writeFileSync("output.json", JSON.stringify(assignments, null, 2));

    // AIDEV-NOTE: Application completion logging
    logger.info("Canvas scraping application completed successfully", {
      context: "app_end",
      sessionId: SESSION_ID,
      assignmentsFound: assignments.length,
      outputFile: "output.json",
    });
  } catch (error) {
    // AIDEV-NOTE: Global error handler for main application workflow
    logger.error("Canvas scraping application failed", {
      context: "app_error",
      sessionId: SESSION_ID,
      error: error.message,
      errorType: error.constructor.name,
      stack: error.stack,
    });
    process.exit(1);
  }
})().catch((error) => {
  // AIDEV-NOTE: Global error handler for unhandled promise rejections in main application
  logger.error("Unhandled error in main application - terminated", {
    context: "global_error",
    sessionId: SESSION_ID,
    error: error.message,
    errorType: error.constructor.name,
    stack: error.stack,
    operation: "main_application",
  });
  process.exit(1);
});

// AIDEV-NOTE: Canvas verification and scraping functions moved to src/canvas-scraper.js
// AIDEV-NOTE: Notion export functionality moved to src/notion-export.js
