# Code Quality Standards

This document outlines the code quality tools and standards in place for the Mojentic TypeScript project.

## Overview

The TypeScript port maintains the same high code quality standards as the Python, Elixir, and Rust ports:

- ✅ **Linting**: ESLint with strict TypeScript rules
- ✅ **Formatting**: Prettier with consistent configuration
- ✅ **Testing**: Jest with target 70% code coverage
- ✅ **Security**: npm audit for dependency vulnerability scanning
- ✅ **CI/CD**: Automated quality checks on all pull requests

## Quick Reference

```bash
# Run all quality checks
npm run quality

# Individual checks
npm run lint              # ESLint
npm run lint:fix          # Auto-fix lint issues
npm run format:check      # Check formatting
npm run format            # Auto-format files
npm test                  # Run tests
npm run test:coverage     # Run tests with coverage
npm run audit             # Security vulnerability scan
npm run build             # TypeScript compilation
```

## Tools Configuration

### ESLint (.eslintrc.json)

Configured with:
- TypeScript ESLint parser
- Recommended TypeScript rules
- Custom rules for code quality:
  - `no-explicit-any`: warn
  - `no-unused-vars`: error (with `_` prefix exemption)
  - `prefer-const`: error
  - `no-var`: error
  - `eqeqeq`: error (strict equality)

### Prettier (.prettierrc.json)

Configured with:
- Single quotes
- Semicolons required
- 100 character line width
- 2-space indentation
- ES5 trailing commas

### Jest (jest.config.js)

Configured with:
- ts-jest preset for TypeScript
- Coverage thresholds: 70% (target)
- Exclusions: index files, test files, type declarations
- Multiple coverage reporters: text, lcov, html, json

### Security Auditing

- npm audit checks for known vulnerabilities
- Runs in CI/CD pipeline
- Audit level set to: moderate

## CI/CD Pipeline

All pull requests run through:

1. **Lint Check**: ESLint validation
2. **Format Check**: Prettier validation
3. **Build**: TypeScript compilation
4. **Test**: Jest test suite
5. **Security Audit**: npm audit scan

All checks must pass before merging.

## Coverage Status

Current coverage status:
- error.ts: 100% ✅
- models.ts: 100% ✅
- broker.ts: 0% (needs tests)
- ollama.ts: 0% (needs tests)
- tools: 0% (needs tests)

**Target**: 70% across all metrics

## Development Workflow

### Before Committing

```bash
# Format your code
npm run format

# Fix lint issues
npm run lint:fix

# Run tests
npm test

# Full quality check
npm run quality
```

### Pre-commit Hook (Optional)

You can set up a Git pre-commit hook to run quality checks automatically:

```bash
# .git/hooks/pre-commit
#!/bin/sh
npm run lint && npm test
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

## Comparison with Other Ports

| Feature | Python | Elixir | Rust | TypeScript |
|---------|--------|--------|------|------------|
| Linter | flake8 | credo | clippy | ESLint ✅ |
| Formatter | - | mix format | rustfmt | Prettier ✅ |
| Tests | pytest | ExUnit | cargo test | Jest ✅ |
| Coverage | pytest-cov | ExCoveralls | tarpaulin | Jest ✅ |
| Security | - | mix audit | cargo-audit/deny | npm audit ✅ |
| CI/CD | ✅ | ✅ | ✅ | ✅ |

## Future Improvements

- [ ] Add more comprehensive broker tests
- [ ] Add gateway integration tests
- [ ] Add tool execution tests
- [ ] Increase coverage to 70%+
- [ ] Add mutation testing (optional)
- [ ] Add performance benchmarks (optional)

## Resources

- [ESLint Documentation](https://eslint.org/)
- [Prettier Documentation](https://prettier.io/)
- [Jest Documentation](https://jestjs.io/)
- [TypeScript ESLint](https://typescript-eslint.io/)
- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit)

## Questions?

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.
