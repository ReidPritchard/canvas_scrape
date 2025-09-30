import readline from "readline";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// AIDEV-NOTE: Interactive configuration wizard for first-time setup
// Guides users through Canvas scraper configuration with validation
// Supports both .env and JSON config formats with encryption options

/**
 * Create readline interface for user input
 */
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt user for input with optional default value
 * @param {readline.Interface} rl - Readline interface
 * @param {string} question - Question to ask
 * @param {string} defaultValue - Default value (optional)
 * @returns {Promise<string>} User's answer
 */
function question(rl, question, defaultValue = "") {
  return new Promise((resolve) => {
    const prompt = defaultValue
      ? `${question} (default: ${defaultValue}): `
      : `${question}: `;
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

/**
 * Prompt user for yes/no question
 * @param {readline.Interface} rl - Readline interface
 * @param {string} question - Question to ask
 * @param {boolean} defaultValue - Default value (true/false)
 * @returns {Promise<boolean>} User's answer as boolean
 */
function questionYesNo(rl, question, defaultValue = false) {
  return new Promise((resolve) => {
    const defaultStr = defaultValue ? "Y/n" : "y/N";
    rl.question(`${question} (${defaultStr}): `, (answer) => {
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === "") {
        resolve(defaultValue);
      } else {
        resolve(trimmed === "y" || trimmed === "yes");
      }
    });
  });
}

/**
 * Mask password input (basic implementation)
 * @param {readline.Interface} rl - Readline interface
 * @param {string} question - Question to ask
 * @returns {Promise<string>} User's password
 */
function questionPassword(rl, question) {
  return new Promise((resolve) => {
    process.stdout.write(`${question}: `);
    
    const stdin = process.stdin;
    
    // AIDEV-NOTE: Check for TTY support before enabling raw mode
    // Fallback to visible input in non-TTY environments (CI/CD, Docker, etc.)
    if (!stdin.isTTY) {
      console.warn("\n⚠️  Password will be visible (no TTY detected)");
      return rl.question("", (answer) => {
        resolve(answer.trim());
      });
    }
    
    // Hide input temporarily in TTY environments
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let password = "";
    const onData = (char) => {
      char = char.toString("utf8");
      switch (char) {
        case "\n":
        case "\r":
        case "\u0004": // Ctrl+D
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          process.stdout.write("\n");
          resolve(password);
          break;
        case "\u0003": // Ctrl+C
          process.stdout.write("\n");
          process.exit(0);
          break;
        case "\u007f": // Backspace
        case "\b":
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(`${question}: ${"*".repeat(password.length)}`);
          }
          break;
        default:
          password += char;
          process.stdout.write("*");
          break;
      }
    };

    stdin.on("data", onData);
  });
}

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
  const rl = createInterface();

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
      
      const formatChoice = await question(rl, "Choose format (1 or 2)", "1");
      format = formatChoice === "2" ? "json" : "env";
    }

    // Step 2: Choose config location if not specified
    if (!configPath) {
      console.log("\nConfiguration Location:");
      console.log("  1) Current directory (.env or config.json)");
      console.log("  2) Home directory (~/.canvas-scraper.env or ~/.canvas-scraper.json)");
      console.log("  3) Custom path\n");

      const locationChoice = await question(rl, "Choose location (1, 2, or 3)", "1");
      
      if (locationChoice === "3") {
        configPath = await question(
          rl,
          "Enter custom config file path",
          format === "json" ? "./config.json" : "./.env"
        );
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
      canvasUrl = await question(
        rl,
        "Canvas URL",
        "https://canvas.colorado.edu/"
      );
      if (!isValidUrl(canvasUrl)) {
        console.log("❌ Invalid URL format. Please enter a valid URL.\n");
      }
    } while (!isValidUrl(canvasUrl));

    const canvasUsername = await question(rl, "Canvas Username");
    const canvasPassword = await questionPassword(rl, "Canvas Password");

    // Step 4: Todoist Integration (Optional)
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Todoist Integration (Optional)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const enableTodoist = await questionYesNo(
      rl,
      "Enable Todoist export?",
      false
    );
    let todoistApiKey = "";
    if (enableTodoist) {
      console.log("Get your API key from: https://todoist.com/prefs/integrations");
      todoistApiKey = await question(rl, "Todoist API Key");
    }

    // Step 5: Notion Integration (Optional)
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Notion Integration (Optional)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const enableNotion = await questionYesNo(rl, "Enable Notion export?", false);
    let notionApiKey = "";
    let notionDatabaseId = "";
    if (enableNotion) {
      console.log("Get your API key from: https://www.notion.so/my-integrations");
      notionApiKey = await question(rl, "Notion API Key");
      notionDatabaseId = await question(rl, "Notion Database ID");
    }

    // Step 6: Encryption Option
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Security Options");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // AIDEV-NOTE: Encryption should be strongly recommended for configs with passwords
    // Default to true and warn if user opts out
    let enableEncryption = await questionYesNo(
      rl,
      "Encrypt configuration file? (strongly recommended)",
      true
    );

    // Add explicit warning if user declines encryption with password present
    if (!enableEncryption && canvasPassword) {
      console.log("\n⚠️  WARNING: Your password will be stored in PLAIN TEXT!");
      console.log("   Anyone with access to the config file can read your password.");
      const confirmPlain = await questionYesNo(
        rl,
        "Are you sure you want to continue without encryption?",
        false
      );
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
          execSync(`npx dotenvx encrypt -f ${configPath}`, {
            stdio: "inherit",
          });
          console.log("✅ Configuration encrypted successfully");
          console.log(`⚠️  Keep ${configPath}.keys secure and NEVER commit it!`);
        } catch (error) {
          console.log(
            "⚠️  Encryption failed. Configuration saved unencrypted."
          );
          console.log("   You can encrypt it later with: npx dotenvx encrypt");
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
          execSync(`npx dotenvx encrypt -f ${configPath}`, {
            stdio: "inherit",
          });
          console.log("✅ Configuration encrypted successfully");
          console.log(`⚠️  Keep ${configPath}.keys secure and NEVER commit it!`);
        } catch (error) {
          console.log(
            "⚠️  Encryption failed. Configuration saved unencrypted."
          );
          console.log("   You can encrypt it later with: npx dotenvx encrypt");
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

    rl.close();
    return { configPath, format, config };
  } catch (error) {
    rl.close();
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
