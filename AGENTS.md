# Canvas Scraper - Agent Instructions

This document contains essential information for AI agents working on the Canvas Scraper project.
It defines build processes, testing procedures, code style, and architectural patterns.

## 1. Project Context

**Canvas Scraper** is a Node.js automation tool that syncs Canvas LMS assignments to Todoist and Notion.

- **Core Stack:** Node.js, Playwright (scraping), REST APIs (Todoist/Notion).
- **Module System:** ES Modules (`type: "module"` in `package.json`).
- **Package Manager:** `pnpm`.

---

## 2. Commands

### Build & Package

- **Build (Dist):** `pnpm run build` (Cleans `dist/` and bundles `main.js`).
- **Package (Binary):** `pnpm run package` (Creates binaries for macOS/Linux in `dist/`).

### Testing (Vitest)

- **Run All Tests:** `pnpm test`
- **Run Single Test File:** `pnpm test tests/config-wizard.test.js`
- **Run Tests in Watch Mode:** `pnpm run test:watch`
- **Run Tests with UI:** `pnpm run test:ui`
- **Check Coverage:** `pnpm run test:coverage`

### Formatting & Linting

- **Format Code:** `pnpm run format` (Uses Prettier).
- **Note:** Always run formatting before committing changes.

### Running the Application

- **Development (Visible Browser):** `pnpm run dev` (Useful for debugging selectors).
- **Dev (Skip Scraping):** `pnpm run dev:skip-scraping` (Uses cached `output.json`).
- **Production (Headless):** `node main.js`
- **Setup Wizard:** `pnpm run setup`

---

## 3. Code Style & Standards

### Language & Syntax

- **JavaScript Version:** ES2020+.
- **Module System:** **ES Modules** (Use `import`/`export`, not `require`).
- **Typing:** Plain JavaScript (no TypeScript). JSDoc is optional but helpful for complex logic.

### Formatting

- **Indentation:** 2 spaces.
- **Style:** Standard JavaScript conventions.
- **Enforcement:** Use `pnpm run format` to ensure consistency.

### Naming Conventions

- **Functions/Variables:** `camelCase` (e.g., `verifyIsAssignment`, `processData`).
- **Data Properties:** `snake_case` is sometimes used for raw scraped data or API payloads to match external schemas, but internal logic prefers `camelCase`.
- **Files:** `kebab-case` (e.g., `canvas-scraper.js`, `error-handler.js`).

### Logging (Winston)

- **Do NOT use `console.log`** for application logic. Use the structured logger.
- **Import:** `import { logger } from './src/logger.js';`
- **Usage:**
  ```javascript
  logger.info("Operation successful", {
    context: "module-name",
    operation: "specific-action",
    details: someVariable,
    sessionId: SESSION_ID, // if available
  });
  ```
- **Levels:** `error` (critical), `warn` (potential issues), `info` (general flow), `debug` (verbose dev details).

### Error Handling

- Use `try-catch` blocks for async operations, especially network/scraping tasks.
- Log errors using `logger.error` with stack traces.
- **Shared Utilities:** Refer to `src/error-handler.js` for common patterns.

---

## 4. Architectural Patterns

### Web Scraping (Playwright)

- **Selectors:** Located centrally in `src/selectors.js` when possible.
- **Verification:** Always verify an element exists before trying to extract data.
  ```javascript
  const element = await page.$(selector);
  if (!element) return null; // Graceful fallback
  ```
- **Navigation:** Use `await page.waitForLoadState('networkidle')` cautiously; prefer waiting for specific elements.

### Configuration

- **Access:** Import `config` from `config.js`.
- **Secrets:** NEVER hardcode credentials. Use `process.env` or the config object which loads from `.env`/`config.json`.
- **Paths:** Use `path.resolve()` for file system operations to ensure cross-platform compatibility.

### Documentation Anchors

- Use **`AIDEV-NOTE:`** comments to mark important, fragile, or complex logic.
- Do not remove existing anchors without a specific reason.
- Example: `// AIDEV-NOTE: This selector depends on the university's specific Canvas theme.`

---

## 5. Golden Rules (Non-Negotiable)

1.  **No Assumptions:** If unsure about Canvas selectors or API changes, ask the user.
2.  **Project Root Only:** Generate code only inside the project directory.
3.  **Protect Secrets:** Never touch `config.js` to add real credentials or commit `.env` files.
4.  **No Refactors:** Do not reformat entire files or change the module system (ESM).
5.  **Context Aware:** Respect existing `AIDEV-NOTE` comments.

---

## 6. Key Files Map

- `main.js`: Entry point, orchestrator.
- `config.js`: Configuration loader (Env/JSON).
- `src/canvas-scraper.js`: Playwright logic for Canvas.
- `src/todoist-export.js`: Todoist API interaction.
- `src/notion-export.js`: Notion API interaction.
- `src/logger.js`: Winston setup.
- `src/selectors.js`: CSS selectors.
- `tests/`: Vitest test files.
