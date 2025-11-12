# Contributing to Mojentic TypeScript

Thank you for your interest in contributing to Mojentic TypeScript! This document provides guidelines for contributing to the project.

## Getting Started

### Prerequisites

- Node.js 18.0 or higher
- npm or yarn
- Git
- A code editor (VS Code recommended)

### Setting Up Your Development Environment

1. Fork the repository on GitHub
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/mojentic-ts.git
   cd mojentic-ts
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Build the project:
   ```bash
   npm run build
   ```
5. Run tests:
   ```bash
   npm test
   ```

## Development Workflow

### Making Changes

1. Create a new branch for your feature or bugfix:
   ```bash
   git checkout -b feature/my-new-feature
   ```
2. Make your changes
3. Run tests to ensure everything works:
   ```bash
   npm test
   ```
4. Format your code:
   ```bash
   npm run format
   ```
5. Lint your code:
   ```bash
   npm run lint
   ```
6. Commit your changes with a clear message:
   ```bash
   git commit -m "Add new feature: description"
   ```
7. Push to your fork:
   ```bash
   git push origin feature/my-new-feature
   ```
8. Create a Pull Request on GitHub

### Code Style

We use Prettier and ESLint to maintain consistent code style:

- **Formatting**: Run `npm run format` before committing
- **Linting**: Run `npm run lint` to check for issues
- **Auto-fix**: Run `npx eslint --fix src/**/*.ts` to auto-fix issues

#### Style Guidelines

- Use TypeScript strict mode
- Prefer `const` over `let`, avoid `var`
- Use descriptive variable names
- Add JSDoc comments for public APIs
- Use interfaces for data structures
- Use classes for components with state
- Use functional style where appropriate

### Testing

All new features and bug fixes should include tests:

- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test component interactions
- **Coverage**: Aim for >80% coverage for new code

Running tests:
```bash
npm test                    # Run all tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run with coverage report
```

Writing tests:
```typescript
describe('MyComponent', () => {
  test('should do something', () => {
    const result = myFunction();
    expect(result).toBe(expected);
  });
});
```

### Code Quality Standards

We maintain high code quality standards across all Mojentic ports:

#### Quick Quality Check
```bash
npm run quality  # Runs lint, format:check, test:coverage, and audit
```

#### Individual Quality Checks

**Linting (ESLint)**
```bash
npm run lint          # Check for linting errors
npm run lint:fix      # Auto-fix linting errors
```

**Formatting (Prettier)**
```bash
npm run format:check  # Check formatting
npm run format        # Auto-format files
```

**Testing with Coverage**
```bash
npm test              # Run tests
npm run test:coverage # Run tests with coverage report
```
- Minimum 70% coverage required for: lines, branches, functions, statements

**Security Audit**
```bash
npm run audit         # Check for vulnerabilities
npm run audit:fix     # Attempt to auto-fix vulnerabilities
```

#### Before Submitting a PR

Always run the full quality check:
```bash
npm run quality
```

All checks must pass:
- ✅ No ESLint errors
- ✅ Code properly formatted
- ✅ All tests passing
- ✅ Coverage thresholds met (70%)
- ✅ No moderate+ security vulnerabilities

### Documentation

Good documentation is crucial:

- **README**: Update if adding new features
- **JSDoc**: Add comments for public APIs
- **Examples**: Include usage examples
- **CHANGELOG**: Update for notable changes

Example JSDoc:
```typescript
/**
 * Generate a completion from the LLM
 *
 * @param messages - Array of conversation messages
 * @param tools - Optional array of tools the LLM can use
 * @param config - Optional configuration for the completion
 * @returns Result containing the generated text or an error
 */
async generate(
  messages: LlmMessage[],
  tools?: LlmTool[],
  config?: CompletionConfig
): Promise<Result<string, Error>>
```

## Project Structure

```
mojentic-ts/
├── src/                    # Source code
│   ├── error.ts           # Error types and Result pattern
│   ├── index.ts           # Main entry point
│   └── llm/               # LLM module
│       ├── broker.ts      # LLM Broker
│       ├── gateway.ts     # Gateway interface
│       ├── models.ts      # Data models
│       ├── gateways/      # Gateway implementations
│       └── tools/         # Tool implementations
├── examples/              # Example scripts
├── __tests__/            # Test files (or *.test.ts alongside code)
└── dist/                 # Compiled output (generated)
```

## Types of Contributions

### Bug Fixes

1. Check if the bug is already reported in Issues
2. If not, create a new issue describing the bug
3. Fork and fix the bug
4. Add tests to prevent regression
5. Submit a Pull Request referencing the issue

### New Features

1. Open an issue to discuss the feature first
2. Get feedback from maintainers
3. Implement the feature
4. Add tests and documentation
5. Submit a Pull Request

### Documentation

1. Fix typos, improve clarity
2. Add examples
3. Expand API documentation
4. Update guides

### New Gateways

When adding a new LLM gateway:

1. Implement the `LlmGateway` interface
2. Handle all required methods
3. Add message adaptation if needed
4. Include comprehensive tests
5. Add examples
6. Update documentation

Example gateway structure:
```typescript
export class MyGateway implements LlmGateway {
  async generate(
    model: string,
    messages: LlmMessage[],
    config?: CompletionConfig,
    tools?: ToolDescriptor[]
  ): Promise<Result<GatewayResponse, Error>> {
    // Implementation
  }

  async *generateStream(...): AsyncGenerator<Result<StreamChunk, Error>> {
    // Implementation
  }

  async listModels(): Promise<Result<string[], Error>> {
    // Implementation
  }
}
```

### New Tools

When adding a new tool:

1. Extend `BaseTool` or implement `LlmTool`
2. Implement `run()` method
3. Implement `descriptor()` method
4. Add tests
5. Add example usage

Example tool:
```typescript
export class MyTool extends BaseTool {
  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    // Tool implementation
    return Ok({ result: 'success' });
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'my_tool',
        description: 'What this tool does',
        parameters: {
          type: 'object',
          properties: {
            arg1: { type: 'string', description: 'First argument' }
          },
          required: ['arg1']
        }
      }
    };
  }
}
```

## Pull Request Process

1. **Before submitting**:
   - Run all tests
   - Run linter
   - Format code
   - Update documentation
   - Update CHANGELOG.md

2. **PR Description**:
   - Describe what changes you made
   - Explain why the changes are needed
   - Reference any related issues
   - Include screenshots if UI changes

3. **Review Process**:
   - Maintainers will review your PR
   - Address feedback and requested changes
   - Once approved, your PR will be merged

## Maintaining Parity

Mojentic has implementations in multiple languages:
- **Python** (reference implementation)
- **Elixir**
- **Rust**
- **TypeScript** (this)

When adding features:
- Check the Python implementation for reference
- Review PARITY.md for feature status
- Update PARITY.md when adding features
- Consider cross-language compatibility

## Commit Messages

Use clear, descriptive commit messages:

```
Add feature: description of feature

More detailed explanation if needed.

Fixes #123
```

Categories:
- `Add`: New features
- `Fix`: Bug fixes
- `Update`: Changes to existing features
- `Remove`: Removed features
- `Docs`: Documentation changes
- `Test`: Test changes
- `Refactor`: Code refactoring

## Code of Conduct

Be respectful and constructive:
- Be welcoming to newcomers
- Respect differing viewpoints
- Accept constructive criticism
- Focus on what's best for the project
- Show empathy towards others

## Questions?

- Open an issue for bugs or features
- Check existing issues first
- Contact maintainers: stacey@mojility.com

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Mojentic TypeScript! 🚀
