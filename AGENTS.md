# Usage Rules for Mojentic TypeScript

**IMPORTANT**: Consult these usage rules early and often when working with this TypeScript project.
Review these guidelines to understand the correct patterns, conventions, and best practices.

## TypeScript Core Usage Rules

### Error Handling
- Use `Result<T, Error>` type pattern (inspired by Rust) for expected errors
- Throw exceptions only for truly exceptional/unexpected conditions
- Use specific error classes extending `MojenticError`
- Document error conditions in JSDoc comments

### Testing
- Tests are co-located with implementation files using `.test.ts` suffix
- Use Jest for testing with `jest.mock()` for mocking
- Use descriptive test names: `it('should return error when gateway fails')`
- Separate test phases with a single blank line
- Do not write conditional statements in tests
- Each test must fail for only one clear reason

### Code Style
- Follow ESLint configuration (zero warnings allowed)
- Use Prettier for formatting
- Use explicit type annotations for function signatures
- Use interfaces over type aliases where appropriate
- Use `readonly` for immutable properties
- Prefer `const` over `let`, never use `var`

### Common Mistakes to Avoid
- Don't use `any` type - use `unknown` and type guards instead
- Don't use non-null assertion `!` without validation
- Don't ignore Promise rejections - always handle errors
- Don't mutate function arguments unexpectedly
- Don't use `== null` checks - be explicit with `=== null || === undefined`

### Data Structures
- Use Zod for runtime validation and schema definition
- Use TypeScript interfaces for compile-time type safety
- Use `readonly` arrays and objects where mutation isn't needed
- Use discriminated unions for state machines

### Async Patterns
- Use `async/await` over raw Promises
- Use `async function*` generators for streaming
- Use `yield*` for recursive stream flattening
- Always handle Promise rejections

## Quality Guidelines

### MANDATORY Pre-Commit Quality Gates

**STOP**: Before considering ANY work complete or committing code, you MUST run ALL quality checks:

```bash
# Complete quality gate check (run this EVERY TIME)
npm run lint && \
npm run format:check && \
npm test && \
npm audit --omit=dev --audit-level=moderate
```

**Why this matters**: Examples and tests must pass. When examples fail, users cannot learn from them. The `npm run lint` command validates all TypeScript files including examples, not just library code.

**If any check fails**:
- STOP immediately
- Fix the root cause (don't suppress warnings)
- Re-run all checks
- Only proceed when all pass

### Additional Quality Practices

- Write unit tests for new functions
- Run tests: `npm test`
- Run linting: `npm run lint` (zero warnings enforced)
- Run formatting: `npm run format:check`

## Security Guidelines

### Dependency Security
- Run `npm audit` to check for known vulnerabilities
- Keep dependencies up to date, especially security patches
- Review security advisories regularly
- Use `npm audit fix` for automatic fixes when safe

### Secure Coding
- Validate all inputs using Zod schemas
- Never use `eval()` on user input
- Don't log sensitive data (API keys, passwords, tokens)
- Use environment variables for configuration, not hardcoded values

## Project-Specific Guidelines

### Mojentic Framework
- This is a **port** of the Python reference implementation
- Follow the Python implementation patterns and API design
- Changes should be reflected in the parent PARITY.md
- Use Zod for data validation (equivalent to Python's Pydantic)

### Documentation
- Use VitePress for user documentation in `docs/`
- Write JSDoc comments for all public APIs
- Include examples in documentation where helpful
- Keep README.md synchronized with actual functionality

## Release Process

### Versioning
- Follow semantic versioning (semver): MAJOR.MINOR.PATCH
- Update version in `package.json`
- Update `CHANGELOG.md` with release notes

### Release Types

#### Standard Release (publishes to npm)
Use `v*` tags to trigger npm publishing:

```bash
# 1. Update version in package.json
npm version patch  # or minor, or major

# 2. Update CHANGELOG.md with release notes

# 3. Commit and push
git add -A && git commit -m "chore: prepare vX.Y.Z release"
git push origin main

# 4. Create GitHub release with v-prefixed tag
gh release create vX.Y.Z --title "vX.Y.Z" --notes "Release notes here"
```

The CI/CD pipeline will automatically:
- Run quality checks (lint, format, test, security)
- Build the package
- Deploy documentation to GitHub Pages
- Publish to npm with provenance

#### Documentation-Only Release (no npm publish)
Use non-`v` tags for releases that only update documentation:

```bash
gh release create RELEASE_X_Y_Z --title "Release X.Y.Z" --notes "Notes"
```

This will:
- Run quality checks
- Deploy documentation to GitHub Pages
- **Skip** npm publishing

### CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs:

| Trigger | Quality Checks | Docs Deploy | npm Publish |
|---------|---------------|-------------|-------------|
| Push to main | ✅ | ❌ | ❌ |
| Pull request | ✅ | ❌ | ❌ |
| Release (`v*` tag) | ✅ | ✅ | ✅ |
| Release (other tag) | ✅ | ✅ | ❌ |

### npm Publishing Requirements

1. **NPM_TOKEN secret**: Must be configured in GitHub repository settings
   - Settings → Secrets and variables → Actions → New repository secret
   - Use a Granular Access Token with read/write access to the package

2. **Package configuration** (`package.json`):
   - `"publishConfig": { "access": "public" }`
   - `"files": ["dist", "README.md", "LICENSE"]`

### Pre-Release Checklist

Before creating a release:
- [ ] All tests pass locally: `npm test`
- [ ] Linting passes: `npm run lint`
- [ ] Format check passes: `npm run format:check`
- [ ] Security audit clean: `npm audit`
- [ ] Version updated in `package.json`
- [ ] CHANGELOG.md updated
- [ ] Changes committed and pushed to main

## Useful Commands

### Development Setup
```bash
npm install              # Install dependencies
npm run build            # Build TypeScript to dist/
```

### Running Tests
```bash
npm test                 # All tests
npm test -- broker.test  # Specific test file
npm run test:coverage    # With coverage report
```

### Linting & Formatting
```bash
npm run lint             # ESLint (zero warnings)
npm run lint:fix         # Auto-fix lint issues
npm run format           # Format with Prettier
npm run format:check     # Check formatting
```

### Running Examples
```bash
npm run example:simple      # Simple LLM usage
npm run example:streaming   # Streaming responses
npm run example:tool        # Tool calling
npm run example:structured  # Structured output
```

### Documentation
```bash
npm run docs:dev    # Serve docs locally with hot reload
npm run docs:build  # Build static documentation
```

### Before Committing
```bash
# Run all quality checks
npm run lint && npm run format:check && npm test && npm audit
```

## Resources

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Zod Documentation](https://zod.dev/)
- [ESLint Documentation](https://eslint.org/docs/latest/)
- [Prettier Documentation](https://prettier.io/docs/en/)

---

*Last Updated: November 2025 • Node.js 18+ • TypeScript 5.3+*
