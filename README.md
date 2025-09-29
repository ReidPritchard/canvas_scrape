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

1. **Update Canvas URL** (if not CU): Edit `config.js` to change the Canvas URL
2. **Set Credentials**: Add your Canvas password and API keys to environment variables
3. **Configure Logging**: Set logging preferences (see Logging Configuration below)

### Usage

```bash
# Run in production mode (headless)
node main.js

# Run in development mode (visible browser)
pnpm run dev
```

## Logging Configuration

The Canvas Scraper uses Winston for comprehensive structured logging. Logging behavior can be customized through environment variables and command-line flags.

### Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `NODE_ENV` | Environment mode | `production` | `development` |
| `LOG_LEVEL` | Minimum log level | `info` (prod), `debug` (dev) | `debug`, `info`, `warn`, `error` |
| `ENABLE_FILE_LOGGING` | Enable log files | `true` | `false` |

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

### File Structure

The codebase is organized into focused modules for maintainability:

```
canvas_scrape/
├── main.js                     # Main orchestration and entry point
├── config.js                   # Configuration and credentials
├── src/
│   ├── selectors.js             # Canvas CSS selectors (centralized)
│   ├── canvas-scraper.js        # Canvas login and scraping logic
│   ├── todoist-export.js        # Todoist API integration
│   ├── notion-export.js         # Notion API integration
│   ├── logger.js                # Winston logging configuration
│   └── performance-test.js      # Performance testing suite
├── tests/
│   └── integration.test.js      # Basic integration tests
└── logs/                        # Log files and performance results
```

**Core Module Purpose:**
- **`main.js`**: Simplified orchestration and command-line interface
- **`src/selectors.js`**: All Canvas CSS selectors organized by page type
- **`src/canvas-scraper.js`**: Canvas authentication and content extraction
- **`src/todoist-export.js`**: Todoist task creation and management
- **`src/notion-export.js`**: Notion database integration
- **`tests/integration.test.js`**: End-to-end testing functionality

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

## License

Created for personal use. See repository for license details.
