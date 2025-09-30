# Build & Packaging Guide

This document explains how to build and package the Canvas Scraper as standalone executables.

## Overview

The Canvas Scraper uses:

- **esbuild** - Bundles ES modules into a single CommonJS file
- **@yao-pkg/pkg** - Packages the bundled code into platform-specific executables

## Prerequisites

```bash
pnpm install
```

## Build Commands

### Development Build (bundling only)

```bash
pnpm run build
```

Creates `dist/main.cjs` - a bundled CommonJS version suitable for pkg packaging.

### Production Package (executables)

```bash
pnpm run package
```

Creates platform-specific executables:

- `dist/canvas-scrape-macos` (macOS x64)
- `dist/canvas-scrape-linux` (Linux x64)
- `dist/canvas-scrape-win.exe` (Windows x64)

## Configuration

### esbuild Configuration (`build.js`)

Key settings for pkg compatibility:

- **format: 'cjs'** - Required for pkg (CommonJS format)
- **target: 'node22'** - Targets Node.js 22 (supported by yao-pkg)
- **external: ['playwright', '*.node']** - Playwright must remain external
- **bundle: true** - Creates single output file

### pkg Configuration

The `package` script specifies all configuration via CLI arguments:

```bash
pkg dist/main.cjs \
  --targets node22-macos-x64,node22-linux-x64,node22-win-x64 \
  --output dist/canvas-scrape \
  --compress Brotli
```

This creates:

- `dist/canvas-scrape-macos`
- `dist/canvas-scrape-linux`
- `dist/canvas-scrape-win.exe`

No `pkg` section in `package.json` is needed since all options are specified in the CLI command.

## Known Issues & Solutions

### Top-level await

**Issue**: Top-level await not supported in CommonJS format.

**Solution**: Refactored `src/logger.js` to use synchronous initialization:

```javascript
// Before (ESM with top-level await)
export default await createLogger();

// After (synchronous for CommonJS)
export default createLogger();
```

### Playwright Bundling Warnings

**Warning**: `Failed to make bytecode for appIcon.png`

**Impact**: None - these are binary assets that pkg correctly handles. The warnings can be safely ignored.

### Winston Transport Configuration

**Fixed**: The logger now properly configures console transport as a fallback in packaged executables.

**Solution**:
- Console transport always created with `silent: false` and appropriate log level
- File transport creation wrapped in try-catch with fallback handling
- Removed `logger.configure()` call that was clearing transports in production
- Added safety check to ensure at least one transport always exists

Logs in production mode are output as JSON to console for easy parsing and monitoring.

## Testing the Executables

```bash
# Test macOS executable
./dist/canvas-scrape-macos --dev

# Test with arguments
./dist/canvas-scrape-macos --skip-scraping

# Check version/help
./dist/canvas-scrape-macos --help
```

## Automated Releases with GitHub Actions

The repository includes a GitHub Action workflow for automated packaging and releases.

### Triggering a Release

1. Navigate to **Actions** → **Package and Release** in the GitHub repository
2. Click **Run workflow**
3. Enter the release version (e.g., `v1.0.0`)
4. Optionally mark as pre-release
5. Click **Run workflow**

The workflow will:
- Build and package executables for all platforms
- Generate SHA256 checksums
- Create a GitHub Release with all artifacts
- Include release notes and setup instructions

### What Gets Released

Each release includes:
- `canvas-scrape-macos` - macOS x64 executable (priority platform)
- `canvas-scrape-linux` - Linux x64 executable
- `canvas-scrape-win.exe` - Windows x64 executable
- `checksums.txt` - SHA256 checksums for verification
- `.env.example` - Configuration template
- `README.txt` - Quick start guide

### Manual Distribution

The generated executables are self-contained and can be distributed without Node.js installed on the target system. However, note:

1. **Playwright browsers** still need to be installed separately on the target system
2. **Configuration files** (`.env`, `config.js`) must be present in the same directory as the executable
3. **File permissions** - Ensure the executable has execute permissions (`chmod +x` on Unix systems)

## Troubleshooting

### "No available node version satisfies 'nodeXX'"

Use `@yao-pkg/pkg` instead of `vercel/pkg`. The maintained fork supports newer Node.js versions.

### "Top-level await is currently not supported with 'cjs' format"

Refactor async initialization to synchronous. See `src/logger.js` for an example.

### Large executable sizes

This is normal - pkg bundles Node.js runtime and all dependencies. Typical sizes:

- macOS: ~70MB
- Linux: ~77MB
- Windows: ~61MB

Use `--compress Brotli` flag (already included) for best compression.
