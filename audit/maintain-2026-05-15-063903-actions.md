All done. Here's a summary of what was updated and verified:

**Dependency update:**
- `@types/node` 25.7.0 → 25.8.0 (patch bump — only `package-lock.json` changed)

**All quality gates passed:**
- ✅ `npm run lint` — zero warnings
- ✅ `npm run format:check` — all files properly formatted
- ✅ `npm test` — 669 tests across 34 suites, all passing
- ✅ `npm run build` — TypeScript compiled cleanly
- ✅ `npm audit --omit=dev --audit-level=moderate` — 0 vulnerabilities

Committed and pushed to `origin/main` as `chore(deps): bump @types/node from 25.7.0 to 25.8.0`.