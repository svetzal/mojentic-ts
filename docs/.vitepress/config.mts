import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Mojentic',
  description: 'Modern LLM integration framework for TypeScript',
  base: '/mojentic-ts/',
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
          { text: 'Tool Usage', link: '/tool-usage' },
          { text: 'File Tools', link: '/file-tools' },
          { text: 'Task Management', link: '/task-management' },
          { text: 'Web Search', link: '/web-search' },
          { text: 'Chat Sessions', link: '/chat-sessions' },
          { text: 'Streaming', link: '/streaming' },
          { text: 'Embeddings', link: '/embeddings' },
          { text: 'Image Analysis', link: '/image-analysis' },
          { text: 'Agent Delegation', link: '/agent-delegation' },
          { text: 'Async Agents', link: '/async-agents' },
          { text: 'Simple Recursive Agent', link: '/simple-recursive-agent' },
          { text: 'Tracer', link: '/tracer' }
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
