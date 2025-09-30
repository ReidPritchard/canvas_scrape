// AIDEV-NOTE: Vitest configuration for Canvas scraper integration tests
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Suppress console output during tests to reduce noise
    silent: false,
    // Set test timeout for Canvas scraper tests (some may take longer due to browser automation)
    testTimeout: 10000,
    // Environment configuration
    environment: "node",
    // Global test setup
    globals: true,
    // Coverage configuration (optional)
    coverage: {
      provider: "v8",
      include: ["src/**/*.js"],
      exclude: ["tests/**", "node_modules/**"],
    },
    // Reporter configuration for cleaner output
    reporter: ["verbose"],
    // Handle Winston logger warnings in test environment
    onConsoleLog: (log) => {
      // Suppress Winston "no transports" warnings during tests
      if (log.includes("[winston] Attempt to write logs with no transports")) {
        return false;
      }
      return true;
    },
  },
});
