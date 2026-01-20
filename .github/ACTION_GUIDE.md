# GitHub Action Usage Guide

## How to Trigger a Release

### Step-by-Step Visual Guide

```
┌─────────────────────────────────────────────────────────────────┐
│ GitHub Repository: ReidPritchard/canvas_scrape                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Navigate to "Actions" tab                                    │
│    ┌──────────────────────────────────────────────────────┐    │
│    │ ☰ Code  Issues  Pull requests  ▶ Actions  Projects │    │
│    └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Select "Package and Release" workflow                        │
│    ┌─────────────────────┐                                      │
│    │ All workflows    ▼  │                                      │
│    │ ─────────────────── │                                      │
│    │ 📦 Package and      │                                      │
│    │    Release          │ ◀── Click here                       │
│    └─────────────────────┘                                      │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Click "Run workflow" button                                  │
│    ┌─────────────────────────────────────────────────────┐     │
│    │ This workflow has a workflow_dispatch event         │     │
│    │ trigger.                                             │     │
│    │                                                      │     │
│    │              [Run workflow ▼]  ◀── Click here       │     │
│    └─────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Fill in workflow inputs                                      │
│    ┌─────────────────────────────────────────────────────┐     │
│    │ Use workflow from: Branch: master          ▼        │     │
│    │                                                      │     │
│    │ Release version (e.g., v1.0.0) *                    │     │
│    │ ┌────────────────────────────────────────────────┐ │     │
│    │ │ v1.0.0                    ◀── Enter version    │ │     │
│    │ └────────────────────────────────────────────────┘ │     │
│    │                                                      │     │
│    │ Mark as pre-release                                 │     │
│    │ [ ] Yes  ◀── Optional: Check for beta/alpha        │     │
│    │                                                      │     │
│    │              [Run workflow]  ◀── Final click        │     │
│    └─────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Workflow executes (takes ~5-10 minutes)                      │
│    ┌─────────────────────────────────────────────────────┐     │
│    │ Package and Release #1                              │     │
│    │ ✓ Checkout repository                               │     │
│    │ ✓ Setup Node.js                                     │     │
│    │ ✓ Install dependencies                              │     │
│    │ ✓ Build with esbuild                                │     │
│    │ ⏳ Package executables (slowest step)               │     │
│    │ ⏳ Generate checksums                                │     │
│    │ ⏳ Create GitHub Release                             │     │
│    └─────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Release Created! 🎉                                          │
│    ┌─────────────────────────────────────────────────────┐     │
│    │ Releases                                            │     │
│    │                                                      │     │
│    │ v1.0.0  Latest                                      │     │
│    │ Canvas Scraper v1.0.0                               │     │
│    │                                                      │     │
│    │ Assets (6):                                         │     │
│    │ 📦 canvas-scrape-macos         66 MB               │     │
│    │ 📦 canvas-scrape-linux         77 MB               │     │
│    │ 📦 canvas-scrape-win.exe       61 MB               │     │
│    │ 📄 checksums.txt               192 bytes           │     │
│    │ 📄 .env.example                1.2 KB              │     │
│    │ 📄 README.txt                  2.1 KB              │     │
│    │                                                      │     │
│    │ [Download all]                                      │     │
│    └─────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

## Workflow Timeline

```
Time    Step                        Status
────────────────────────────────────────────
0:00    Checkout repository         ⏱ 10s
0:10    Setup Node.js              ⏱ 15s
0:25    Install dependencies        ⏱ 30s
0:55    Build with esbuild         ⏱ 5s
1:00    Package executables        ⏱ 4-8 min  ◀── Longest step
5-9:00  Generate checksums         ⏱ 5s
5-9:05  Create GitHub Release      ⏱ 15s
────────────────────────────────────────────
Total: ~5-10 minutes
```

## What Gets Released

```
canvas-scrape-v1.0.0/
├── 📦 canvas-scrape-macos    (macOS x64, ~66MB)    ◀── Priority platform
├── 📦 canvas-scrape-linux    (Linux x64, ~77MB)
├── 📦 canvas-scrape-win.exe  (Windows x64, ~61MB)
├── 🔐 checksums.txt          (SHA256 verification)
├── ⚙️  .env.example           (Configuration template)
└── 📖 README.txt             (Quick start guide)
```

## Quick Commands for Users

After downloading:

### macOS / Linux

```bash
# 1. Download executable for your platform
curl -LO https://github.com/ReidPritchard/canvas_scrape/releases/latest/download/canvas-scrape-macos

# 2. Make executable
chmod +x canvas-scrape-macos

# 3. Download config template
curl -LO https://github.com/ReidPritchard/canvas_scrape/releases/latest/download/.env.example
cp .env.example .env

# 4. Edit .env with your credentials
nano .env

# 5. Run
./canvas-scrape-macos
```

### Windows

```powershell
# 1. Download executable
Invoke-WebRequest -Uri "https://github.com/ReidPritchard/canvas_scrape/releases/latest/download/canvas-scrape-win.exe" -OutFile "canvas-scrape.exe"

# 2. Download config template
Invoke-WebRequest -Uri "https://github.com/ReidPritchard/canvas_scrape/releases/latest/download/.env.example" -OutFile ".env.example"
Copy-Item .env.example .env

# 3. Edit .env with your credentials
notepad .env

# 4. Run
.\canvas-scrape.exe
```

## Verify Download Integrity

```bash
# Download checksum file
curl -LO https://github.com/ReidPritchard/canvas_scrape/releases/latest/download/checksums.txt

# Verify (macOS/Linux)
sha256sum -c checksums.txt

# Expected output:
# canvas-scrape-macos: OK
```

## Version Numbering Guide

| Version Type    | Example       | When to Use                   |
| --------------- | ------------- | ----------------------------- |
| **Major**       | v2.0.0        | Breaking changes, API changes |
| **Minor**       | v1.1.0        | New features, non-breaking    |
| **Patch**       | v1.0.1        | Bug fixes, small improvements |
| **Pre-release** | v1.0.0-beta.1 | Testing new features          |

## Common Issues

### ❌ "Workflow not found"

**Solution**: Make sure you're on the correct branch with the workflow file

### ❌ "Permission denied"

**Solution**: Need repository write permissions to trigger workflows

### ❌ "Release already exists"

**Solution**: Delete existing release/tag or use a different version number

### ❌ "Packaging step fails"

**Solution**: Check workflow logs - usually a dependency or build issue

## Need Help?

- 📖 Full documentation: [BUILD.md](../BUILD.md)
- 📋 Release process: [RELEASE.md](RELEASE.md)
- 🐛 Report issues: [GitHub Issues](https://github.com/ReidPritchard/canvas_scrape/issues)
