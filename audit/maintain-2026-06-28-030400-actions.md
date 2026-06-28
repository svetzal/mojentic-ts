Dependency maintenance complete. Here's what was done:

**Update applied:**
- `prettier` 3.8.5 → 3.9.1 (patch update)

**Side effects fixed:**
- The prettier update introduced minor formatting changes in two files:
  - `src/agents/simple-recursive-agent.ts`
  - `src/realtime/config.ts`

**Quality gates — all green:**
- ✅ `npm run lint` — zero warnings
- ✅ `npm run format:check` — all files pass
- ✅ `npm test` — 715 tests passed across 38 suites
- ✅ `npm run build` — TypeScript compiles cleanly
- ✅ `npm audit` — zero vulnerabilities

Changes committed and pushed to `main`.