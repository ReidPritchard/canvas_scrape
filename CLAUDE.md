# Canvas Scraper - AI Assistant Documentation

## 0. Project Overview

**Canvas Scraper** is a Node.js automation tool that scrapes assignments, quizzes, and announcements from Canvas LMS (Learning Management System) and exports them to productivity tools (Todoist and Notion). It helps students automatically sync their Canvas assignments with their personal task management systems.

Key components:
- **Web Scraping**: Uses Playwright to automate Canvas login and data extraction
- **Data Processing**: Parses assignment details (title, due date, description, class)
- **Export Integration**: Syncs with Todoist API and Notion API for task management

**Golden rule**: When unsure about Canvas selectors, authentication, or API integrations, ALWAYS consult the developer rather than making assumptions about the university's Canvas configuration.

---

## 1. Non-negotiable Golden Rules

| #: | AI *may* do | AI *must NOT* do |
|---|-------------|------------------|
| G-0 | Ask for clarification when unsure about Canvas configuration or API requirements | ❌ Make assumptions about Canvas URL structure or authentication without confirmation |
| G-1 | Generate code **only inside** the main project directory | ❌ Touch config.js with real credentials or commit sensitive data |
| G-2 | Add/update **`AIDEV-NOTE:` anchor comments** near non-trivial edited code | ❌ Delete or modify existing `AIDEV-` comments |
| G-3 | Follow existing JavaScript ES module style and Playwright patterns | ❌ Reformat code to different style standards or change module system |
| G-4 | For changes >50 LOC or affecting core scraping logic, ask for confirmation | ❌ Make large refactors to scraping selectors without human guidance |
| G-5 | Stay within current task context | ❌ Continue work from prior prompts after "new task" designation |

---

## 2. Build, Test & Utility Commands

```bash
pnpm install                    # Install dependencies
pnpm exec playwright install    # Install Playwright browsers
node main.js                    # Run scraper in headless mode
pnpm run dev                    # Run scraper with visible browser (--dev flag)
```

**Special Setup Notes:**
- Requires Playwright browser installation after dependency install
- Uses ES modules (type: "module" in package.json)
- No formal test suite currently implemented
- Configuration requires API keys for Todoist and Notion

---

## 3. Coding Standards

- **Language**: JavaScript ES2020+ with ES modules
- **Framework**: Playwright for browser automation
- **Formatting**: Standard JavaScript conventions, 2-space indentation
- **Typing**: No TypeScript (plain JavaScript)
- **Naming**: camelCase for functions, snake_case for some data properties
- **Error Handling**: Basic try-catch blocks, console logging for debugging
- **Documentation**: Inline comments for complex scraping logic
- **Testing**: Manual testing with --dev flag for visual debugging

**Example code pattern:**
```javascript
const verify_is_assignment = async (content) => {
  return !!(await content.$("div[id='assignment_show']"));
};
```

---

## 4. Project Layout & Core Components

| Directory/File | Description |
|----------------|-------------|
| `main.js` | Main scraping logic and export functions |
| `config.js` | Sensitive configuration (credentials, URLs, API keys) |
| `package.json` | Dependencies and scripts |
| `node_modules/` | Dependencies (not version controlled) |

**Key domain models/concepts:**
- **Assignment**: Canvas assignment with title, due date, description, class
- **Quiz**: Canvas quiz with title, due date (no description)
- **Discussion/Announcement**: Canvas discussion post with title, date, content
- **Export Item**: Standardized data structure for Todoist/Notion APIs

---

## 4.1. Logging Integration

The Canvas Scraper uses Winston for comprehensive structured logging throughout all operations. Understanding the logging system is crucial for development, debugging, and production monitoring.

### Logging Architecture

| Component | Purpose | File Location |
|-----------|---------|---------------|
| `src/logger.js` | Winston logger configuration and setup | Core logging module |
| `logs/app.log` | All application logs (info level and above) | Auto-rotated, 5MB max |
| `logs/error.log` | Error logs only for critical issue tracking | Auto-rotated, 5MB max |
| `logs/debug.log` | Debug logs (development mode only) | Auto-rotated, 5MB max |
| `config.js` | Logging configuration section | Environment-aware settings |

### Development Workflow with Logging

**Development Mode** (`--dev` flag):
```javascript
// AIDEV-NOTE: Development logging provides rich debugging context
logger.debug('Canvas selector found', {
  context: 'canvas-scraping',
  selector: 'div[class*="planner-item"]',
  elementCount: items.length,
  sessionId: SESSION_ID
});
```

**Production Mode** (default):
```javascript
// AIDEV-NOTE: Production logging optimized for performance and monitoring
logger.info('Canvas scraping completed', {
  context: 'canvas-scraping',
  assignmentsFound: assignments.length,
  timing: performance.now() - startTime,
  sessionId: SESSION_ID
});
```

### Canvas Operation Context

**Session Correlation:**
- Each scraping session gets a unique UUID for tracking operations
- All logs within a session include the `sessionId` for correlation
- Useful for debugging failed sessions or performance analysis

**Canvas-Specific Logging:**
```javascript
// AIDEV-NOTE: Canvas operations include detailed context for debugging
logger.info('Canvas assignment discovered', {
  context: 'canvas-scraping',
  operation: 'assignment-extract',
  assignmentId: assignment.id,
  title: assignment.title,
  dueDate: assignment.dueDate,
  course: assignment.course,
  canvasUrl: assignment.url,
  sessionId: SESSION_ID
});
```

### Performance Monitoring Integration

**Performance Tracking:**
```javascript
// AIDEV-NOTE: Performance monitoring integrated throughout scraping process
const operationStart = performance.now();
// ... Canvas operation ...
const operationTime = performance.now() - operationStart;

logger.info('Canvas operation completed', {
  context: 'performance',
  operation: 'login-sequence',
  timing: operationTime,
  memoryUsage: process.memoryUsage().heapUsed,
  sessionId: SESSION_ID
});
```

**Memory Monitoring:**
- Automatic memory usage tracking during long scraping sessions
- Alerts for memory leaks or excessive usage
- Integration with performance test suite

### Error Handling and Debugging

**Canvas Selector Debugging:**
```javascript
// AIDEV-NOTE: Canvas selectors logged for debugging when elements not found
try {
  const element = await page.$(selector);
  if (!element) {
    logger.warn('Canvas selector not found', {
      context: 'canvas-scraping',
      selector: selector,
      pageUrl: page.url(),
      pageTitle: await page.title(),
      sessionId: SESSION_ID
    });
  }
} catch (error) {
  logger.error('Canvas selector error', {
    context: 'canvas-scraping',
    selector: selector,
    error: error.message,
    stack: error.stack,
    sessionId: SESSION_ID
  });
}
```

**API Integration Logging:**
```javascript
// AIDEV-NOTE: API operations logged with response status and timing
logger.info('Todoist API request', {
  context: 'api-integration',
  service: 'todoist',
  operation: 'create-task',
  taskTitle: task.title,
  responseStatus: response.status,
  timing: apiTime,
  sessionId: SESSION_ID
});
```

### Production Considerations

**Sensitive Data Protection:**
- Automatic redaction of passwords, API keys, and tokens
- Canvas personal data filtered before logging
- Use `sanitizeLogData()` for user-provided content

**Performance Impact:**
- Logging overhead: <25% of Canvas processing time
- Memory usage: <600 bytes per log entry
- File I/O operations: Non-blocking
- Automatic log rotation prevents disk space issues

**File Management:**
- Logs automatically rotate at 5MB per file
- Historical retention: 5 files per log type
- Debug logs only in development mode
- Performance test results saved separately

### Common Debugging Patterns

**Canvas Scraping Issues:**
```bash
# Find Canvas login problems
grep "Canvas login" logs/app.log | tail -10

# Check for selector changes
grep "selector.*not found" logs/app.log

# Session correlation for failed runs
SESSION_ID="failed-session-uuid"
grep "$SESSION_ID" logs/app.log
```

**Performance Analysis:**
```bash
# Check operation timing
grep "timing" logs/app.log | jq '.timing' | sort -n

# Memory usage patterns
grep "memoryUsage" logs/app.log | jq '.memoryUsage'

# Canvas operation success rates
grep "Canvas.*completed" logs/app.log | wc -l
```

**API Integration Debugging:**
```bash
# Check API response patterns
grep "api-integration" logs/app.log | jq '.responseStatus'

# Find API errors
grep "api-integration" logs/error.log
```

### Integration with External Monitoring

**Log Format for Analysis:**
- All logs use structured JSON format
- Consistent field naming across operations
- Timestamp in ISO 8601 format
- Context-based log grouping

**Recommended Monitoring Queries:**
- Error rate: `grep "error" logs/app.log | wc -l`
- Session success: `grep "Scraping completed" logs/app.log`
- Performance degradation: `grep "timing.*[5-9][0-9][0-9][0-9]" logs/app.log`

For comprehensive operational documentation, see `docs/logging-guide.md`.

---

## 5. Anchor Comments

Add specially formatted comments throughout the codebase for inline knowledge that can be easily searched.

### Guidelines:

- Use `AIDEV-NOTE:`, `AIDEV-TODO:`, or `AIDEV-QUESTION:` prefixes
- Keep concise (≤ 120 chars)
- Always locate existing anchors before scanning files
- Update relevant anchors when modifying code
- Don't remove `AIDEV-NOTE`s without explicit instruction
- Add anchors for code that is: complex, important, confusing, or potentially buggy

Example:
```javascript
// AIDEV-NOTE: Canvas selectors are fragile - verify after Canvas updates
const title = await (await content.$('h1[class="title"]')).innerText();
```

---

## 6. Commit Discipline

- **Granular commits**: One logical change per commit (scraping logic, export logic, config)
- **Tag AI-generated commits**: Include "AI:" prefix for commits made by assistants
- **Clear commit messages**: Describe what changed and why (e.g., "Fix quiz selector after Canvas UI update")
- **Branch strategy**: Main branch development (small personal project)
- **Review requirements**: Manual testing with --dev flag before commits

---

## 7. Web Scraping & API Patterns

- **Playwright Selectors**: CSS selectors and XPath for Canvas elements
- **Authentication**: Form-based login with username/password fields
- **Page Navigation**: Dashboard → Planner view → Individual assignments
- **Data Extraction**: Element.innerText() for content, getAttribute() for links
- **API Integration**: REST APIs for Todoist and Notion with authentication headers

**Example pattern:**
```javascript
// Canvas selector pattern
const item_links = await page$$("div[class*='planner-item'] >> div[class*='title'] >> a");

// API call pattern
const response = await notion.pages.create({
  parent: { database_id: notion_db_id },
  properties: { /* structured data */ }
});
```

---

## 8. Canvas Integration Specifics

This project integrates specifically with Canvas LMS (University of Colorado configuration).

**Key points:**
- **URL Structure**: https://canvas.colorado.edu/ (configurable in config.js)
- **Authentication**: Standard Canvas login form with username/password
- **Navigation Flow**: Login → Dashboard → Planner view for assignment overview
- **Content Types**: Supports assignments, quizzes, and announcements/discussions

**Testing approach:**
- Use `--dev` flag to run with visible browser for debugging selectors
- Test with actual Canvas account to verify scraping accuracy
- Validate export data in Todoist/Notion after runs

---

## 9. Testing Framework & Patterns

- **Framework**: Manual testing with browser automation
- **Test patterns**: Visual debugging with headless:false browser mode
- **Running tests**: `pnpm run dev` to see browser automation in action
- **Test organization**: No formal test suite - relies on production testing

**Example test:**
```javascript
// Manual testing pattern
if (myArgs[0] === "--dev") {
  browser = await chromium.launch({ headless: false }); // Visual debugging
} else {
  browser = await chromium.launch({ headless: true });  // Production
}
```

---

## 10. Directory-Specific Documentation

- **Always check for `AGENTS.md` files in specific directories** before working on code
- If outdated or incorrect, update them
- Document significant changes in directory-specific `AGENTS.md` files
- Suggest creating `AGENTS.md` for complex directories lacking documentation

---

## 11. Common Pitfalls

- **Canvas UI Changes**: Selectors break when Canvas updates their interface
- **Authentication Issues**: Credentials in config.js must be current and valid
- **API Rate Limits**: Todoist and Notion APIs have rate limiting
- **Timezone Issues**: Date parsing requires timezone awareness (MDT/MST)
- **Missing Browser Install**: Playwright requires `pnpm exec playwright install`
- **Credential Exposure**: Never commit config.js with real credentials to git

---

## 12. Versioning Conventions

**Simple semantic versioning for personal project:**

- **MAJOR**: Breaking changes to export format or Canvas integration
- **MINOR**: New features (support for new Canvas content types, new export targets)
- **PATCH**: Bug fixes, selector updates, minor improvements

---

## 13. Key File & Pattern References

- **Scraping Functions**:
  - Location: `main.js:116-196`
  - Pattern: Content verification → data extraction for each Canvas content type
- **Export Functions**:
  - Location: `main.js:198-410`
  - Pattern: API authentication → data transformation → create/update operations
- **Configuration**:
  - Location: `config.js`
  - Pattern: Single object export with credentials and settings

---

## 14. Domain-Specific Terminology

- **Canvas LMS**: Learning Management System used by universities
- **Planner View**: Canvas dashboard showing upcoming assignments across all courses
- **Assignment/Quiz/Discussion**: Different types of Canvas content items
- **Todoist**: Task management service with API for creating/updating tasks
- **Notion**: Note-taking/database service with API for page creation
- **Playwright**: Browser automation library for web scraping

---

## 15. Files to NOT Modify

These files should not be modified without explicit permission:

- `config.js`: Contains sensitive credentials and API keys
- `pnpm-lock.yaml`: Package manager lock file
- `node_modules/`: Dependencies managed by package manager

**When adding new files**, ensure they don't contain credentials and follow the ES module pattern.

---

## AI Assistant Workflow: Step-by-Step Methodology

When responding to user instructions, follow this process:

1. **Consult Relevant Guidance**: Check this CLAUDE.md for Canvas/API-specific instructions
2. **Clarify Ambiguities**: Ask about Canvas configuration, API requirements, or university setup
3. **Break Down & Plan**: Create a plan considering scraping reliability and API constraints
4. **Trivial Tasks**: Proceed immediately for simple requests
5. **Non-Trivial Tasks**: Present plan for user review, especially for scraping logic changes
6. **Track Progress**: Use to-do lists for complex multi-step tasks
7. **If Stuck, Re-plan**: Return to step 3 to re-evaluate Canvas changes or API issues
8. **Update Documentation**: Update anchor comments and this CLAUDE.md as needed
9. **User Review**: Ask for review, especially after Canvas selector changes
10. **Session Boundaries**: Suggest fresh sessions for unrelated new tasks