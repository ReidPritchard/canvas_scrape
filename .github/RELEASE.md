# Release Process

This document describes how to create releases using the GitHub Action workflow.

## Creating a Release

### Using GitHub Actions (Recommended)

1. Go to the **Actions** tab in the GitHub repository
2. Select **Package and Release** workflow from the left sidebar
3. Click **Run workflow** button (on the right)
4. Fill in the required inputs:
   - **Release version**: Enter version in format `vX.Y.Z` (e.g., `v1.0.0`, `v1.1.0-beta`)
   - **Mark as pre-release**: Check if this is a beta/alpha release
5. Click **Run workflow** to start the packaging process

### What Happens During Release

The workflow will automatically:

1. **Build the application**
   - Checkout code
   - Install dependencies
   - Bundle with esbuild → `dist/main.cjs`

2. **Package executables**
   - Create macOS x64 executable (priority platform)
   - Create Linux x64 executable
   - Create Windows x64 executable
   - Apply Brotli compression

3. **Generate artifacts**
   - SHA256 checksums for verification
   - Configuration template (`.env.example`)
   - Quick start README

4. **Create GitHub Release**
   - Tag the commit with version
   - Upload all executables
   - Include checksums and documentation
   - Generate release notes automatically

### Release Artifacts

Each release includes:

| File | Description | Platform |
|------|-------------|----------|
| `canvas-scrape-macos` | Standalone executable | macOS x64 |
| `canvas-scrape-linux` | Standalone executable | Linux x64 |
| `canvas-scrape-win.exe` | Standalone executable | Windows x64 |
| `checksums.txt` | SHA256 checksums | All |
| `.env.example` | Configuration template | All |
| `README.txt` | Quick start guide | All |

## Release Notes

Release notes are automatically generated from:
- Commit messages since last release
- Pull request descriptions
- Issue references

You can edit the release after creation to add:
- Breaking changes
- Migration guides
- Notable bug fixes
- New features

## Version Numbering

Follow semantic versioning:

- **Major** (v2.0.0): Breaking changes to export format or Canvas integration
- **Minor** (v1.1.0): New features, new export targets, non-breaking changes
- **Patch** (v1.0.1): Bug fixes, selector updates, minor improvements

Examples:
- `v1.0.0` - First stable release
- `v1.1.0` - Added new Canvas content type support
- `v1.0.1` - Fixed selector after Canvas UI update
- `v2.0.0-beta.1` - Pre-release for major version

## Troubleshooting

### Workflow Fails During Build

Check the workflow logs:
1. Go to Actions tab
2. Click on the failed workflow run
3. Expand the failed step to see error messages

Common issues:
- **Dependencies fail to install**: Check `package.json` for correct versions
- **Build fails**: Test locally with `pnpm run build`
- **Packaging fails**: Test locally with `pnpm run package`

### Executables Too Large

Expected sizes (with Brotli compression):
- macOS: ~60-70MB
- Linux: ~70-80MB
- Windows: ~60-70MB

These include the Node.js runtime and all dependencies.

### Release Already Exists

If a tag already exists:
1. Delete the existing release and tag in GitHub
2. Or use a new version number

## Manual Release (Alternative)

If you prefer to create releases manually:

```bash
# 1. Build and package locally
pnpm run package

# 2. Create tag
git tag v1.0.0
git push origin v1.0.0

# 3. Create release manually in GitHub
#    - Go to Releases → Draft a new release
#    - Select the tag
#    - Upload files from dist/
```

## Post-Release

After creating a release:

1. **Announce**: Share the release in relevant channels
2. **Update documentation**: Ensure README reflects new version
3. **Test**: Download and test executables on target platforms
4. **Monitor**: Watch for issues reported by users

## Security

- ⚠️ **Never** include credentials in releases
- ✅ **Always** include `.env.example` (not `.env`)
- ✅ **Verify** checksums match before distribution
- ✅ **Test** executables before announcing widely
