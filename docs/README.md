# Mojentic Documentation

This directory contains the VitePress-powered documentation site for Mojentic TypeScript.

## Quick Start

```bash
# Install dependencies (from project root)
npm install

# Start dev server
npm run docs:dev

# Build for production
npm run docs:build

# Preview production build
npm run docs:preview
```

## Structure

```
docs/
├── .vitepress/
│   ├── config.ts          # Site configuration
│   └── theme/             # Custom theme (optional)
├── guide/                 # User guides
│   ├── getting-started.md
│   ├── what-is-mojentic.md
│   └── ...
├── api/                   # API reference
│   ├── broker.md
│   ├── gateway.md
│   └── ...
├── examples/              # Code examples
├── index.md               # Home page
├── changelog.md           # Version history
└── contributing.md        # Contribution guide
```

## Writing Content

### Markdown Basics

VitePress uses standard Markdown with some enhancements:

```markdown
# Heading 1
## Heading 2

**Bold** and *italic* text

- List item 1
- List item 2

[Link text](url)

`inline code`
```

### Code Blocks

````markdown
```typescript
// Code with syntax highlighting
const result = await broker.generate(messages);
```
````

### Code Groups

````markdown
::: code-group

```typescript [TypeScript]
const result = await broker.generate(messages);
```

```javascript [JavaScript]
const result = await broker.generate(messages);
```

:::
````

### Custom Containers

```markdown
::: tip
This is a tip!
:::

::: warning
This is a warning!
:::

::: danger
This is a danger message!
:::

::: info
This is an info box!
:::
```

### Tables

```markdown
| Feature | Status |
|---------|--------|
| Ollama  | ✅     |
| OpenAI  | 📝     |
```

## Configuration

Edit `.vitepress/config.ts` to customize:

```typescript
export default defineConfig({
  title: 'Your Title',
  description: 'Your description',

  themeConfig: {
    nav: [...],      // Top navigation
    sidebar: {...},  // Sidebar navigation
    socialLinks: [...] // Social media links
  }
})
```

## Deployment

### GitHub Pages

1. Build the site:
   ```bash
   npm run docs:build
   ```

2. The output will be in `docs/.vitepress/dist/`

3. Deploy to GitHub Pages (add to `.github/workflows/docs.yml`):
   ```yaml
   - name: Build docs
     run: npm run docs:build

   - name: Deploy to GitHub Pages
     uses: peaceiris/actions-gh-pages@v3
     with:
       github_token: ${{ secrets.GITHUB_TOKEN }}
       publish_dir: ./docs/.vitepress/dist
   ```

### Netlify

1. Build command: `npm run docs:build`
2. Publish directory: `docs/.vitepress/dist`

### Vercel

1. Framework preset: Other
2. Build command: `npm run docs:build`
3. Output directory: `docs/.vitepress/dist`

## Tips

### Hot Reload

Dev server auto-reloads when you save files. Just edit and see changes instantly!

### Search

Built-in search works automatically. It indexes all your content.

### Custom Components

You can use Vue components in Markdown:

```vue
<script setup>
const message = 'Hello!'
</script>

<template>
  <div>{{ message }}</div>
</template>
```

### Frontmatter

Add metadata to pages:

```markdown
---
title: Custom Title
description: Custom description
---

# Page content
```

## Resources

- [VitePress Documentation](https://vitepress.dev/)
- [Markdown Guide](https://www.markdownguide.org/)
- [Vue 3 Documentation](https://vuejs.org/)

## Need Help?

- 📚 Check [VitePress docs](https://vitepress.dev/)
- 💬 Open an issue
- 📧 Email: stacey@mojility.com

## Testing without infrastructure

Run `npm test`, `npm test -- --coverage`, and `npm run verify:package` from the
repository root. After dependencies have been installed, these paths require no
service, socket, listener, DNS or registry. Package verification creates local
tarballs for the library and its exact installed runtime dependencies and installs
them offline into a new consumer directory. It also compiles the installed public
TypeScript declarations and verifies runtime exports.

Tests call public gateways, brokers and sessions with doubles only at I/O and
clock boundaries. `scripts/test-support/transport.cjs` routes fetch and recovery
transport calls to in-process handlers without altering the production Node
HTTP/HTTPS transport. Keep exact requests, destinations, headers, response bytes,
identities, lifecycle order, history and completion/error assertions. Do not mock
recovery, parsers, brokers or sessions.

The Jest setup rejects socket/listener/DNS access, fixes the clock, and advances
virtual timers after promises and streams drain. No elapsed real time decides a
test result. Use completion signals for asynchronous work and event order for
concurrency; use injected clocks/sleepers for deadline, jitter and Retry-After
assertions. The installed consumer rejects real timer calls as well as network
access. `src/llm/test-boundary.test.ts` verifies enforcement and a public API
failure on an unexpected destination.

The current [decision map](../CONFORMANCE-3.0.0.md) and
[recovery conformance map](../RECOVERY-CONFORMANCE.md) distinguish source and
packed-consumer verification from verification by other repositories.
