import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Mojentic',
  description: 'Modern LLM integration framework for TypeScript',

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/introduction' },
      { text: 'API', link: '/api/' },
      { text: 'GitHub', link: 'https://github.com/svetzal/mojentic-ts' }
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Overview', link: '/introduction' }
        ]
      },
      {
        text: 'User Guide',
        items: [
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'LLM Broker', link: '/broker' },
          { text: 'Tool Usage', link: '/tool-usage' },
          { text: 'Structured Output', link: '/structured-output' }
        ]
      },
      {
        text: 'Advanced Topics',
        items: [
          { text: 'Error Handling', link: '/error-handling' },
          { text: 'Streaming', link: '/streaming' },
          { text: 'Best Practices', link: '/best-practices' }
        ]
      },
      {
        text: 'API Reference',
        items: [
          { text: 'Core Types', link: '/api/core' },
          { text: 'Gateways', link: '/api/gateways' },
          { text: 'Tools', link: '/api/tools' }
        ]
      },
      {
        text: 'Project',
        items: [
          { text: 'Architecture', link: '/architecture' },
          { text: 'Contributing', link: '/contributing' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/svetzal/mojentic-ts' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 Mojility Inc.'
    },

    search: {
      provider: 'local'
    }
  }
})
