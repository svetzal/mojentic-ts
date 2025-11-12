import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Mojentic',
  description: 'Modern LLM integration framework for TypeScript',
  ignoreDeadLinks: true,

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/getting-started' },
      { text: 'API', link: '/api/' },
      { text: 'GitHub', link: 'https://github.com/svetzal/mojentic-ts' }
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Introduction', link: '/introduction' },
          { text: 'Installation', link: '/getting-started' }
        ]
      },
      {
        text: 'Core Concepts',
        items: [
          { text: 'LLM Broker', link: '/broker' },
          { text: 'Structured Output', link: '/structured-output' },
          { text: 'Tool Usage', link: '/tool-usage' }
        ]
      },
      {
        text: 'API Reference',
        items: [
          { text: 'Overview', link: '/api/' },
          { text: 'Core Types', link: '/api/core' },
          { text: 'Gateways', link: '/api/gateways' },
          { text: 'Tools', link: '/api/tools' }
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
