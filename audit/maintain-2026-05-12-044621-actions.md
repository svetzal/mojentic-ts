Dependency update complete. Here's the summary:

**What changed:**
- `esbuild` bumped from `^0.27.3` → `^0.28.0` (0.27.7 → 0.28.0 installed)

**Why only one update?** All other packages (`@eslint/js`, `@types/jest`, `@types/node`, `typescript-eslint`, `jest`, `prettier`, `zod`, `gpt-tokenizer`, etc.) were already at the latest version within their existing semver ranges — `npm outdated` only flagged esbuild.

**esbuild 0.28.0 assessment:** The sole "breaking change" is added integrity verification on the binary's fallback download path — a security improvement, not an API change. No build behaviour changes affect this project. All 669 tests pass, lint is clean, build succeeds, 0 vulnerabilities.