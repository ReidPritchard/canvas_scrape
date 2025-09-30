# Canvas Scraper

A comprehensive Node.js automation tool that scrapes assignments, quizzes, and announcements from Canvas LMS and exports them to productivity tools (Todoist and Notion). Features robust Winston-based logging, error handling, and performance monitoring.

## Overview

This program automates the tedious process of manually tracking Canvas assignments by:

- **Web Scraping**: Uses Playwright to automate Canvas login and data extraction
- **Data Processing**: Parses assignment details (title, due date, description, class)
- **Export Integration**: Syncs with Todoist API and Notion API for task management
- **Structured Logging**: Comprehensive logging system for debugging and monitoring

## Quick Start

### Installation

```bash
# Install dependencies
pnpm install

# Install Playwright browsers
pnpm exec playwright install
```

### Configuration

**Step 1: Create .env file**

Copy the example template and add your credentials:

```bash
cp .env.example .env
# Edit .env with your credentials (see below)
```

**Step 2: Required Environment Variables**

```bash
# Canvas LMS password (required)
CANVAS_PWD=your_canvas_password

# Todoist integration (optional)
TODOIST_EXPORT=true
TODOIST_API_KEY=your_todoist_api_key

# Notion integration (optional)
NOTION_EXPORT=true
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID=your_notion_database_id
```

**Step 3: Configure Logging (optional)**

See "Logging Configuration" section below for environment variables.

**Step 4: (Optional) Encrypt Your .env File**

For enhanced security, you can encrypt your `.env` file using dotenvx:

```bash
# Encrypt your .env file
npx dotenvx encrypt

# This creates:
# - An encrypted .env file (safe to commit to git)
# - A .env.keys file (NEVER commit this - it's git-ignored)
```

The application automatically detects and decrypts encrypted `.env` files when the `.env.keys` file is present. You can continue using plain `.env` files if encryption is not needed.

**Important:**
- Keep your `.env.keys` file secure and never commit it to version control
- The `.env.keys` file is already git-ignored for your safety
- Share the `.env.keys` file securely with team members who need access

### Usage

```bash
# Run in production mode (headless)
node main.js

# Run in development mode (visible browser)
pnpm run dev

# Run with cached data (faster testing, no Canvas scraping)
pnpm run dev:skip-scraping
```

## Logging Configuration

The Canvas Scraper uses Winston for comprehensive structured logging. Logging behavior can be customized through environment variables and command-line flags.

### Environment Variables

| Variable              | Description       | Default                      | Example                          |
| --------------------- | ----------------- | ---------------------------- | -------------------------------- |
| `NODE_ENV`            | Environment mode  | `production`                 | `development`                    |
| `LOG_LEVEL`           | Minimum log level | `info` (prod), `debug` (dev) | `debug`, `info`, `warn`, `error` |
| `ENABLE_FILE_LOGGING` | Enable log files  | `true`                       | `false`                          |

### Configuration Options

```javascript
// config.js logging section
logging: {
  isDev: process.env.NODE_ENV === 'development' || process.argv.includes('--dev'),
  level: process.env.LOG_LEVEL || (process.argv.includes('--dev') ? 'debug' : 'info'),
  enableFileLogging: process.env.ENABLE_FILE_LOGGING !== 'false'
}
```

### Log Files

Logs are automatically organized and rotated:

```
logs/
├── app.log          # All application logs (5MB max, 5 files)
├── error.log        # Error logs only (5MB max, 5 files)
├── debug.log        # Debug logs (dev mode only)
└── performance-test-results.json # Performance metrics
```

### Development vs Production

**Development Mode** (`--dev` flag or `NODE_ENV=development`):

- Console output with colors and readable formatting
- Debug-level logging enabled
- Additional debug.log file created
- Detailed Canvas scraping context

**Production Mode** (default):

- JSON-formatted console output (if enabled)
- Info-level logging minimum
- Optimized performance
- Minimal console output

### Example Log Output

**Development Mode:**

```
2025-09-18 23:15:42 info: [canvas-scraping] Canvas login successful {"nextStep":"dashboard_navigation","timestamp":"2025-09-18T23:15:42.765Z"}
2025-09-18 23:15:43 debug: [canvas-scraping] Accessing Canvas planner view {"selector":"button[id=\"planner-today-btn\"]","view":"planner"}
```

**Production Mode:**

```json
{"context":"canvas-scraping","level":"info","message":"Canvas login successful","nextStep":"dashboard_navigation","timestamp":"2025-09-18T23:15:42.765Z"}
{"context":"canvas-scraping","level":"info","message":"Scraping completed","assignments":[],"assignmentsFound":0,"timestamp":"2025-09-18T23:15:43.585Z"}
```

## Advanced Configuration

### Performance Monitoring

Run performance tests to validate logging efficiency:

```bash
node src/performance-test.js --performance-test
```

Performance targets:

- Logging overhead: <25% of Canvas processing time
- Memory usage: <600 bytes per log entry
- File I/O: Non-blocking and performant

### Security Considerations

The logging system automatically sanitizes sensitive data:

- Passwords, API keys, tokens, and secrets are automatically redacted
- Log files use appropriate file permissions
- Sensitive Canvas data is filtered before logging

### Log Analysis

Common log analysis patterns:

```bash
# Find all Canvas login attempts
grep "Canvas login" logs/app.log

# Monitor performance issues
grep "performance" logs/app.log

# Check error patterns
cat logs/error.log | jq '.message'

# Session correlation
grep "SESSION_ID" logs/app.log
```

## Troubleshooting

### Common Issues

**Logs not appearing in files:**

```bash
# Check log directory exists
ls -la logs/

# Verify file permissions
ls -la logs/app.log

# Enable file logging explicitly
ENABLE_FILE_LOGGING=true node main.js
```

**Too much/little console output:**

```bash
# Reduce console verbosity
LOG_LEVEL=warn node main.js

# Increase console verbosity
LOG_LEVEL=debug node main.js --dev

# Disable console logging
FORCE_CONSOLE_LOGGING=false node main.js
```

**Performance issues:**

```bash
# Run performance diagnostics
node src/performance-test.js

# Use production optimizations
NODE_ENV=production node main.js

# Monitor memory usage
node --inspect main.js
```

**Canvas scraping errors:**

- Check `logs/error.log` for detailed error context
- Run in development mode for visual debugging: `pnpm run dev`
- Verify Canvas URL and credentials in `config.js`
- Check Canvas selector updates in error logs
- Update selectors in `src/selectors.js` if Canvas UI has changed

### Debug Mode

For detailed troubleshooting, enable debug mode:

```bash
LOG_LEVEL=debug pnpm run dev
```

This provides:

- Detailed Canvas selector information
- Step-by-step scraping progress
- Performance timing data
- Memory usage monitoring

## Development

### Development Setup

```bash
# Clone and install
git clone <repository-url>
cd canvas_scrape
pnpm install
pnpm exec playwright install

# Development with logging
LOG_LEVEL=debug pnpm run dev
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm run test:watch

# Run tests with UI
pnpm run test:ui

# Run tests with coverage
pnpm run test:coverage
```

**Note**: Currently only placeholder tests exist. Full test suite is pending implementation.

### File Structure

The codebase is organized into focused modules for maintainability:

```
canvas_scrape/
├── main.js                     # Main orchestration and entry point
├── config.js                   # Configuration loader with .env support
├── .env.example                # Environment variable template
├── src/
│   ├── canvas-scraper.js        # Canvas authentication and content extraction
│   ├── todoist-export.js        # Todoist API integration (REST API)
│   ├── notion-export.js         # Notion API integration
│   ├── selectors.js             # Canvas CSS selectors (centralized)
│   ├── logger.js                # Winston logging configuration
│   └── error-handler.js         # Shared error handling utilities
├── tests/
│   └── placeholder.test.js      # Placeholder tests (Vitest)
├── specs/
│   └── feat-*.md                # Feature specifications and proposals
├── logs/                        # Log files (auto-rotated)
└── output.json                  # Cached assignment data (git-ignored)
```

**Core Module Purpose:**

- **`main.js`**: Orchestration with session tracking and error handling
- **`config.js`**: Environment variable loader with sensible defaults
- **`src/canvas-scraper.js`**: Canvas authentication and content extraction
- **`src/todoist-export.js`**: Todoist REST API with date cleaning and label support
- **`src/notion-export.js`**: Notion database integration
- **`src/selectors.js`**: All Canvas CSS selectors organized by page type
- **`src/logger.js`**: Winston configuration with structured logging
- **`tests/placeholder.test.js`**: Minimal Vitest tests (full suite pending)

### Updating Canvas Selectors

When Canvas updates their UI, selectors may break. The codebase centralizes all selectors in `src/selectors.js` for easy maintenance.

**Selector Categories:**

- **Login**: Username/password fields and submit button
- **Navigation**: Dashboard links and planner button
- **Planner**: Assignment/quiz item discovery selectors
- **Assignment**: Title, due date, and description extraction
- **Quiz**: Title and due date extraction
- **Discussion**: Title, publish date, and content extraction

**Update Process:**

1. **Identify broken selector**: Check error logs for "selector not found" messages
2. **Debug visually**: Run `pnpm run dev` to see Canvas UI in browser
3. **Update selector**: Edit the appropriate category in `src/selectors.js`
4. **Test changes**: Run `pnpm run dev` to verify new selector works
5. **Keep legacy**: Comment out old selectors with "Legacy" note for reference

**Example Update:**

```javascript
// In src/selectors.js
assignment: {
  title: 'h1[class="title"]',        // Current selector
  // titleOld: 'h1.assignment-title'  // Legacy selector (commented)
}
```

### Contributing

See `CLAUDE.md` for detailed development guidelines and AI assistant instructions.

## API Integration

### Todoist Setup

1. Get API key from Todoist settings
2. Add to `config.js` or environment variable
3. Test connection with development mode

### Notion Setup

1. Create Notion integration
2. Get API key and database ID
3. Add to `config.js` or environment variable
4. Test database access

## Performance

The Canvas Scraper is optimized for performance:

- **Logging Overhead**: <25% of total processing time
- **Memory Usage**: <600 bytes per log entry
- **File I/O**: Non-blocking operations
- **Canvas Operations**: Minimal impact on scraping speed

Run `node src/performance-test.js` to validate performance metrics.

## Security

- **Credential Protection**: Sensitive data automatically redacted from logs
- **File Permissions**: Log files use secure permissions
- **API Keys**: Never logged in plain text
- **Canvas Data**: Personal information filtered before logging

## Recent Updates (2025-09-29)

### Todoist Export Improvements

- ✅ **Date Cleaning**: Automatically removes "Due: " prefix from Canvas dates
- ✅ **Label Support**: Adds class name and assignment type as Todoist labels
- ✅ **Smart Updates**: Skips unnecessary updates when no changes exist
- ✅ **Canvas Links**: Appends assignment URLs to task descriptions

### Configuration Enhancements

- ✅ **Notion Export Toggle**: Added `NOTION_EXPORT` environment variable
- ✅ **JSON Caching**: Always exports to `output.json` for debugging
- ✅ **Skip Scraping Mode**: `--skip-scraping` flag for faster testing

### Testing Infrastructure

- ✅ **Vitest Integration**: Full test framework configured
- ✅ **Test Commands**: watch, UI, and coverage modes available
- ⚠️ **Pending**: Comprehensive test suite implementation

## Roadmap

### Recently Completed

- ✅ **Encrypted Credentials**: Integration with `@dotenvx/dotenvx` for encrypted `.env` files

### Planned Features

- 🔄 **Interactive Setup Wizard**: CLI wizard for `.env` configuration (see `specs/feat-interactive-config-setup.md`)
- 🔄 **Comprehensive Tests**: Full unit and integration test coverage
- 🔄 **Performance Optimization**: Canvas scraping performance improvements

### Under Consideration

- Canvas calendar view scraping
- Assignment status tracking (submitted vs. pending)
- Multi-Canvas-instance support
- GitHub Issues integration

## License

Created for personal use. See repository for license details.
