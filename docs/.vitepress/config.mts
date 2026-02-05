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
        text: 'Use Cases',
        items: [
          { text: 'Building Chatbots', link: '/chat-sessions' },
          { text: 'Structured Output', link: '/structured-output' },
          { text: 'Building Agents', link: '/simple-recursive-agent' },
          { text: 'Image Analysis', link: '/image-analysis' }
        ]
      },
      {
        text: 'Examples',
        items: [
          { text: 'Example: File Tools', link: '/file-tools' },
          { text: 'Example: Task Management', link: '/task-management' },
          { text: 'Example: Web Search', link: '/web-search' },
          { text: 'Streaming', link: '/streaming' },
          { text: 'Embeddings', link: '/embeddings' }
        ]
      },
      {
        text: 'Core Concepts',
        items: [
          { text: 'LLM Broker', link: '/broker' },
          { text: 'Reasoning Effort', link: '/reasoning-effort' },
          { text: 'Tool Usage', link: '/tool-usage' },
          { text: 'Agent Delegation', link: '/agent-delegation' },
          { text: 'Async Agents', link: '/async-agents' },
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
