import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { input, confirm, password } from "@inquirer/prompts";

// AIDEV-NOTE: Interactive configuration wizard for first-time setup
// Refactored to use @inquirer/prompts for better UX and maintainability
// Supports both .env and JSON config formats with encryption options

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Main configuration wizard
 * @param {string} configPath - Optional custom config path
 * @param {string} format - Config format ('env' or 'json')
 * @returns {Promise<object>} Configuration object
 */
export async function runConfigWizard(configPath = null, format = null) {
  // AIDEV-NOTE: Detect non-TTY environments and provide helpful error
  // @inquirer/prompts requires a TTY and will crash in CI/CD or piped input
  if (!process.stdin.isTTY) {
    throw new Error(
      "Interactive wizard requires a terminal (TTY).\n" +
      "To use in non-interactive environments:\n" +
      "  1. Create config file manually (see .env.example)\n" +
      "  2. Use environment variables\n" +
      "  3. Provide pre-configured config file via --config flag"
    );
  }

  console.log("\n╔════════════════════════════════════════════════════╗");
  console.log("║   Canvas Scraper - Configuration Wizard           ║");
  console.log("╚════════════════════════════════════════════════════╝\n");
  console.log("This wizard will help you set up Canvas Scraper.\n");

  try {
    // Step 1: Choose config format if not specified
    if (!format) {
      console.log("Configuration Format:");
      console.log("  1) .env file (recommended, supports encryption)");
      console.log("  2) JSON file (supports encryption)\n");

      const formatChoice = await input({
        message: "Choose format (1 or 2)",
        default: "1",
      });
      format = formatChoice === "2" ? "json" : "env";
    }

    // Step 2: Choose config location if not specified
    if (!configPath) {
      console.log("\nConfiguration Location:");
      console.log("  1) Current directory (.env or config.json)");
      console.log("  2) Home directory (~/.canvas-scraper.env or ~/.canvas-scraper.json)");
      console.log("  3) Custom path\n");

      const locationChoice = await input({
        message: "Choose location (1, 2, or 3)",
        default: "1",
      });

      if (locationChoice === "3") {
        configPath = await input({
          message: "Enter custom config file path",
          default: format === "json" ? "./config.json" : "./.env",
        });
      } else if (locationChoice === "2") {
        const home = process.env.HOME || process.env.USERPROFILE;
        configPath = format === "json"
          ? path.join(home, ".canvas-scraper.json")
          : path.join(home, ".canvas-scraper.env");
      } else {
        configPath = format === "json" ? "./config.json" : "./.env";
      }
    }

    // Step 3: Canvas LMS Configuration
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Canvas LMS Configuration");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    let canvasUrl;
    do {
      canvasUrl = await input({
        message: "Canvas URL",
        default: "https://canvas.colorado.edu/",
      });
      if (!isValidUrl(canvasUrl)) {
        console.log("❌ Invalid URL format. Please enter a valid URL.\n");
      }
    } while (!isValidUrl(canvasUrl));

    const canvasUsername = await input({
      message: "Canvas Username",
    });

    // AIDEV-NOTE: Validate password is not empty before proceeding
    let canvasPassword;
    do {
      canvasPassword = await password({
        message: "Canvas Password",
        mask: "*",
      });
      if (!canvasPassword || canvasPassword.trim().length === 0) {
        console.log("❌ Password cannot be empty. Please try again.\n");
      }
    } while (!canvasPassword || canvasPassword.trim().length === 0);

    // Step 4: Todoist Integration (Optional)
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Todoist Integration (Optional)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const enableTodoist = await confirm({
      message: "Enable Todoist export?",
      default: false,
    });

    let todoistApiKey = "";
    if (enableTodoist) {
      console.log("Get your API key from: https://todoist.com/prefs/integrations");
      todoistApiKey = await input({
        message: "Todoist API Key",
      });
    }

    // Step 5: Notion Integration (Optional)
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Notion Integration (Optional)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const enableNotion = await confirm({
      message: "Enable Notion export?",
      default: false,
    });

    let notionApiKey = "";
    let notionDatabaseId = "";
    if (enableNotion) {
      console.log("Get your API key from: https://www.notion.so/my-integrations");
      notionApiKey = await input({
        message: "Notion API Key",
      });
      notionDatabaseId = await input({
        message: "Notion Database ID",
      });
    }

    // Step 6: Encryption Option
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Security Options");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // AIDEV-NOTE: Encryption should be strongly recommended for configs with passwords
    // Default to true and warn if user opts out
    let enableEncryption = await confirm({
      message: "Encrypt configuration file? (strongly recommended)",
      default: true,
    });

    // Add explicit warning if user declines encryption with password present
    if (!enableEncryption && canvasPassword) {
      console.log("\n⚠️  WARNING: Your password will be stored in PLAIN TEXT!");
      console.log("   Anyone with access to the config file can read your password.");
      const confirmPlain = await confirm({
        message: "Are you sure you want to continue without encryption?",
        default: false,
      });
      if (!confirmPlain) {
        enableEncryption = true;
        console.log("✅ Encryption enabled for security.");
      }
    }

    // Build configuration object
    const config = {
      CANVAS_URL: canvasUrl,
      CANVAS_USERNAME: canvasUsername,
      CANVAS_PWD: canvasPassword,
      TODOIST_EXPORT: enableTodoist ? "true" : "false",
      TODOIST_API_KEY: todoistApiKey,
      NOTION_EXPORT: enableNotion ? "true" : "false",
      NOTION_API_KEY: notionApiKey,
      NOTION_DATABASE_ID: notionDatabaseId,
      NODE_ENV: "production",
      LOG_LEVEL: "info",
      ENABLE_FILE_LOGGING: "true",
    };

    // Step 7: Save configuration
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Saving Configuration");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Ensure directory exists
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Save based on format
    if (format === "json") {
      // Save as JSON
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`✅ Configuration saved to: ${configPath}`);

      // Encrypt if requested
      if (enableEncryption) {
        try {
          console.log("\n🔒 Encrypting configuration file...");
          execSync(`npx @dotenvx/dotenvx encrypt -f ${configPath}`, {
            stdio: "inherit",
          });
          console.log("✅ Configuration encrypted successfully");
          console.log(`⚠️  Keep ${configPath}.keys secure and NEVER commit it!`);
        } catch (error) {
          console.log(
            "⚠️  Encryption failed. Configuration saved unencrypted."
          );
          console.log("   You can encrypt it later with: npx @dotenvx/dotenvx encrypt");
        }
      }
    } else {
      // Save as .env
      const envContent = Object.entries(config)
        .map(([key, value]) => `${key}="${value}"`)
        .join("\n");
      fs.writeFileSync(configPath, envContent);
      console.log(`✅ Configuration saved to: ${configPath}`);

      // Encrypt if requested
      if (enableEncryption) {
        try {
          console.log("\n🔒 Encrypting configuration file...");
          execSync(`npx @dotenvx/dotenvx encrypt -f ${configPath}`, {
            stdio: "inherit",
          });
          console.log("✅ Configuration encrypted successfully");
          console.log(`⚠️  Keep ${configPath}.keys secure and NEVER commit it!`);
        } catch (error) {
          console.log(
            "⚠️  Encryption failed. Configuration saved unencrypted."
          );
          console.log("   You can encrypt it later with: npx @dotenvx/dotenvx encrypt");
        }
      }
    }

    console.log("\n╔════════════════════════════════════════════════════╗");
    console.log("║   Configuration Complete!                          ║");
    console.log("╚════════════════════════════════════════════════════╝\n");
    console.log("You can now run Canvas Scraper:");
    console.log("  • Production: node main.js");
    console.log("  • Development: pnpm run dev\n");

    if (configPath !== "./.env" && configPath !== "./config.json") {
      console.log("⚠️  Note: Using custom config path.");
      console.log(`    Set CONFIG_PATH="${configPath}" environment variable`);
      console.log("    or use --config flag when running.\n");
    }

    return { configPath, format, config };
  } catch (error) {
    // AIDEV-NOTE: Distinguish between user cancellation (Ctrl+C) and actual errors
    // @inquirer/prompts throws ExitPromptError or 'User force closed' on cancellation
    if (error.name === 'ExitPromptError' || error.message.includes('User force closed')) {
      console.log("\n\n⚠️  Configuration wizard cancelled by user.");
      process.exit(0);
    }

    // Re-throw actual errors with context
    console.error("\n❌ Configuration wizard encountered an error:");
    throw error;
  }
}

/**
 * Check if configuration exists
 * @param {string} customPath - Optional custom config path
 * @returns {object} Status of configuration files
 */
export function checkConfigExists(customPath = null) {
  const home = process.env.HOME || process.env.USERPROFILE;
  
  const possiblePaths = customPath
    ? [customPath]
    : [
        "./.env",
        "./config.json",
        path.join(home, ".canvas-scraper.env"),
        path.join(home, ".canvas-scraper.json"),
      ];

  for (const configPath of possiblePaths) {
    if (fs.existsSync(configPath)) {
      return {
        exists: true,
        path: configPath,
        format: configPath.endsWith(".json") ? "json" : "env",
      };
    }
  }

  return { exists: false, path: null, format: null };
}

/**
 * Load configuration from JSON file
 * @param {string} configPath - Path to JSON config file
 * @returns {object} Configuration object
 */
export function loadJsonConfig(configPath) {
  // AIDEV-NOTE: JSON config loader with support for encrypted files
  try {
    const content = fs.readFileSync(configPath, "utf-8");
    
    // Check if file appears to be encrypted (dotenvx format)
    if (content.includes("#/---")) {
      // Try to decrypt using dotenvx - this is synchronous via process.env
      const keysPath = `${configPath}.keys`;
      if (fs.existsSync(keysPath)) {
        throw new Error(
          `Encrypted JSON config detected. Please use .env format for encryption or decrypt manually.`
        );
      } else {
        throw new Error(`Encrypted config found but keys file missing: ${keysPath}`);
      }
    }
    
    // Plain JSON file
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load JSON config from ${configPath}: ${error.message}`);
  }
}
