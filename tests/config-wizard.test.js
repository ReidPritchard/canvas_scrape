import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import path from "path";
import { checkConfigExists, loadJsonConfig } from "../src/config-wizard.js";

// AIDEV-NOTE: Test suite for enhanced config system with wizard support
// Tests JSON config loading, custom paths, and config detection

describe("Config Wizard Module", () => {
  const testConfigDir = "/tmp/canvas-scraper-test";
  const testEnvPath = path.join(testConfigDir, ".env");
  const testJsonPath = path.join(testConfigDir, "config.json");

  beforeEach(() => {
    // Create test directory
    if (!existsSync(testConfigDir)) {
      require("fs").mkdirSync(testConfigDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    [testEnvPath, testJsonPath].forEach((file) => {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    });
    
    // Clean up test directory if empty
    try {
      require("fs").rmdirSync(testConfigDir);
    } catch {
      // Directory not empty or doesn't exist, ignore
    }
  });

  describe("checkConfigExists", () => {
    it("should detect .env file in current directory", () => {
      writeFileSync(".env.test", "TEST=value\n");
      
      // Test with custom path
      const result = checkConfigExists(".env.test");
      
      expect(result.exists).toBe(true);
      expect(result.path).toBe(".env.test");
      expect(result.format).toBe("env");
      
      unlinkSync(".env.test");
    });

    it("should detect JSON config file", () => {
      writeFileSync("config.test.json", JSON.stringify({ TEST: "value" }));
      
      const result = checkConfigExists("config.test.json");
      
      expect(result.exists).toBe(true);
      expect(result.path).toBe("config.test.json");
      expect(result.format).toBe("json");
      
      unlinkSync("config.test.json");
    });

    it("should return false when no config exists", () => {
      const result = checkConfigExists("/nonexistent/path/config.json");
      
      expect(result.exists).toBe(false);
      expect(result.path).toBe(null);
      expect(result.format).toBe(null);
    });
  });

  describe("loadJsonConfig", () => {
    it("should load plain JSON config file", () => {
      const testConfig = {
        CANVAS_URL: "https://canvas.test.edu/",
        CANVAS_USERNAME: "testuser",
        CANVAS_PWD: "testpass",
        TODOIST_EXPORT: "true",
        TODOIST_API_KEY: "test_key",
      };
      
      writeFileSync(testJsonPath, JSON.stringify(testConfig, null, 2));
      
      const loaded = loadJsonConfig(testJsonPath);
      
      expect(loaded).toEqual(testConfig);
      expect(loaded.CANVAS_URL).toBe("https://canvas.test.edu/");
      expect(loaded.CANVAS_USERNAME).toBe("testuser");
    });

    it("should handle invalid JSON file", () => {
      writeFileSync(testJsonPath, "{ invalid json }");
      
      expect(() => loadJsonConfig(testJsonPath)).toThrow();
    });

    it("should handle missing config file", () => {
      const nonexistentPath = path.join(testConfigDir, "missing.json");
      
      expect(() => loadJsonConfig(nonexistentPath)).toThrow();
    });
  });

  describe("Custom Config Path Support", () => {
    it("should support CONFIG_PATH environment variable", () => {
      const testConfig = { CANVAS_URL: "https://custom.edu/" };
      writeFileSync(testJsonPath, JSON.stringify(testConfig));
      
      // Set environment variable
      const oldConfigPath = process.env.CONFIG_PATH;
      process.env.CONFIG_PATH = testJsonPath;
      
      const result = checkConfigExists(process.env.CONFIG_PATH);
      expect(result.exists).toBe(true);
      expect(result.path).toBe(testJsonPath);
      
      // Cleanup
      if (oldConfigPath) {
        process.env.CONFIG_PATH = oldConfigPath;
      } else {
        delete process.env.CONFIG_PATH;
      }
    });

    it("should detect format from file extension", () => {
      // Create test files to check format detection
      writeFileSync("test.json", JSON.stringify({ TEST: "value" }));
      writeFileSync(".env.test", "TEST=value\n");
      writeFileSync("custom.env", "TEST=value\n");
      
      const jsonResult = checkConfigExists("test.json");
      expect(jsonResult.exists).toBe(true);
      expect(jsonResult.format).toBe("json");
      
      const envResult = checkConfigExists(".env.test");
      expect(envResult.exists).toBe(true);
      expect(envResult.format).toBe("env");
      
      const customEnvResult = checkConfigExists("custom.env");
      expect(customEnvResult.exists).toBe(true);
      expect(customEnvResult.format).toBe("env");
      
      // Cleanup
      unlinkSync("test.json");
      unlinkSync(".env.test");
      unlinkSync("custom.env");
    });
  });

  describe("JSON Config Structure", () => {
    it("should support all required configuration fields", () => {
      const completeConfig = {
        CANVAS_URL: "https://canvas.colorado.edu/",
        CANVAS_USERNAME: "user@example.com",
        CANVAS_PWD: "password123",
        TODOIST_EXPORT: "true",
        TODOIST_API_KEY: "todoist_key",
        NOTION_EXPORT: "false",
        NOTION_API_KEY: "",
        NOTION_DATABASE_ID: "",
        NODE_ENV: "production",
        LOG_LEVEL: "info",
        ENABLE_FILE_LOGGING: "true",
      };
      
      writeFileSync(testJsonPath, JSON.stringify(completeConfig, null, 2));
      
      const loaded = loadJsonConfig(testJsonPath);
      
      // Verify all required fields are present
      expect(loaded).toHaveProperty("CANVAS_URL");
      expect(loaded).toHaveProperty("CANVAS_USERNAME");
      expect(loaded).toHaveProperty("CANVAS_PWD");
      expect(loaded).toHaveProperty("TODOIST_EXPORT");
      expect(loaded).toHaveProperty("NOTION_EXPORT");
      expect(loaded).toHaveProperty("NODE_ENV");
    });

    it("should handle minimal configuration", () => {
      const minimalConfig = {
        CANVAS_URL: "https://canvas.test.edu/",
        CANVAS_USERNAME: "user",
        CANVAS_PWD: "pass",
      };
      
      writeFileSync(testJsonPath, JSON.stringify(minimalConfig));
      
      const loaded = loadJsonConfig(testJsonPath);
      
      expect(loaded.CANVAS_URL).toBe("https://canvas.test.edu/");
      expect(loaded.CANVAS_USERNAME).toBe("user");
      expect(loaded.CANVAS_PWD).toBe("pass");
    });
  });
});
