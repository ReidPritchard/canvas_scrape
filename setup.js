#!/usr/bin/env node

// AIDEV-NOTE: Standalone setup script for Canvas Scraper configuration wizard
// Can be run directly: node setup.js or npm run setup

import { runConfigWizard } from "./src/config-wizard.js";

(async () => {
  try {
    await runConfigWizard();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Configuration wizard failed:", error.message);
    process.exit(1);
  }
})();
