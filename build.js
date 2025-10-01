import esbuild from "esbuild";

// AIDEV-NOTE: esbuild configuration optimized for pkg packaging
// Key considerations:
// - format: 'cjs' required for pkg compatibility
// - external: playwright and native modules must be handled by pkg
// - platform: 'node' with proper target version
// - bundle: true to create single output file

const buildConfig = {
  entryPoints: ["main.js"],
  bundle: true,
  platform: "node",
  target: "node22", // AIDEV-NOTE: Node 22 supported by yao-pkg/pkg maintained fork
  format: "cjs", // CRITICAL: pkg requires CommonJS format
  outfile: "dist/main.cjs",
  external: [
    // AIDEV-NOTE: Playwright has native dependencies - must be external
    "playwright",
    "playwright-core",
    // Native Node.js modules
    "fsevents",
    // Patterns for .node files (native addons)
    "*.node",
  ],
  banner: {
    // AIDEV-NOTE: Shebang required for executable
    js: "#!/usr/bin/env node",
  },
  minify: false, // Keep readable for debugging; enable for production
  sourcemap: false,
  treeShaking: true,
  logLevel: "info",
};

async function build() {
  try {
    console.log("🔨 Building with esbuild for pkg compatibility...");
    await esbuild.build(buildConfig);
    console.log("✅ Build complete: dist/main.cjs");
    console.log("\n📦 Next steps:");
    console.log("  1. Run: pnpm run package");
    console.log("  2. Test: ./dist/canvas-scrape-macos");
  } catch (error) {
    console.error("❌ Build failed:", error);
    process.exit(1);
  }
}

build();
