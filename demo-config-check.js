#!/usr/bin/env node

// AIDEV-NOTE: Demo script showing config wizard integration
// This demonstrates how the wizard checks for existing config

import { checkConfigExists } from "./src/config-wizard.js";

console.log("\n📋 Configuration File Detection Demo\n");
console.log("=====================================\n");

// Check standard locations
const standardLocations = [
  ".env",
  "config.json",
  "~/.canvas-scraper.env",
  "~/.canvas-scraper.json",
];

console.log("Checking standard locations:");
standardLocations.forEach((location) => {
  const status = checkConfigExists(location);
  const statusEmoji = status.exists ? "✅" : "❌";
  console.log(
    `${statusEmoji} ${location}: ${status.exists ? `Found (${status.format})` : "Not found"}`,
  );
});

// Overall status
console.log("\n");
const configStatus = checkConfigExists();
if (configStatus.exists) {
  console.log(`✅ Configuration found at: ${configStatus.path}`);
  console.log(`   Format: ${configStatus.format}`);
  console.log("\nReady to run Canvas Scraper!");
} else {
  console.log("⚠️  No configuration file found.");
  console.log("\nRun one of these commands to set up:");
  console.log("  • pnpm run setup");
  console.log("  • node main.js --setup");
  console.log("  • node setup.js");
}

console.log("\n");
