# Tool Usage

Tools allow LLMs to interact with your code, APIs, and external systems. Mojentic makes tool integration seamless with automatic execution and result handling.

## What are Tools?

Tools are functions that LLMs can call to perform actions or retrieve information they can't handle directly:

- **Date/Time Operations**: "What's the date next Friday?"
- **API Calls**: "What's the weather in Tokyo?"
- **File Operations**: "Read the contents of config.json"
- **Calculations**: "What's 15% of 2,847?"
- **Database Queries**: "How many users registered today?"

## Creating a Tool

Implement the `LlmTool` interface or extend `BaseTool`:

```typescript
import { BaseTool, ToolArgs, ToolDescriptor, ToolResult, Ok, Err } from 'mojentic';

export class WeatherTool extends BaseTool {
  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    try {
      const location = args.location as string;

      // Your implementation
      const weather = await fetchWeather(location);

      return Ok({
        location,
        temperature: weather.temp,
        condition: weather.condition
      });
    } catch (error) {
      return Err(new Error(`Weather fetch failed: ${error.message}`));
    }
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get current weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'City name or location'
            }
          },
          required: ['location']
        }
      }
    };
  }
}
```

## Using Tools

### Basic Usage

```typescript
import { LlmBroker, OllamaGateway, Message, DateResolverTool, isOk } from 'mojentic';

const gateway = new OllamaGateway();
const broker = new LlmBroker('qwen3:32b', gateway);

// Create tool instances
const tools = [new DateResolverTool()];

// Ask a question that requires the tool
const messages = [
  Message.system('You are a helpful assistant with access to tools.'),
  Message.user('What day of the week is next Friday?')
];

const result = await broker.generate(messages, tools);

if (isOk(result)) {
  console.log(result.value);
  // "Next Friday is December 20, 2025, which is a Saturday."
}
```

### Multiple Tools

```typescript
const tools = [
  new DateResolverTool(),
  new WeatherTool(),
  new CalculatorTool()
];

const messages = [
  Message.user('What will the weather be like next Monday in Tokyo?')
];

// The LLM will:
// 1. Call DateResolverTool to get next Monday's date
// 2. Call WeatherTool with that date and "Tokyo"
// 3. Respond with the weather information
const result = await broker.generate(messages, tools);
```

## Tool Execution Flow

When you provide tools to the broker:

1. **LLM Decides**: The LLM determines if it needs to call tools
2. **Tool Call**: LLM returns tool call requests with arguments
3. **Execution**: Broker executes the requested tools
4. **Result Injection**: Results are added to the conversation
5. **Continuation**: LLM is called again with tool results
6. **Final Response**: LLM provides the final answer

```typescript
// User: "What's the date 2 weeks from now?"
//
// Step 1: LLM receives question
// Step 2: LLM requests: resolve_date("in 2 weeks")
// Step 3: Tool returns: {"resolved": "2025-12-25", "day_of_week": "Thursday"}
// Step 4: Result added to conversation
// Step 5: LLM called again with tool result
// Step 6: LLM responds: "Two weeks from now is December 25, 2025, a Thursday."
```

## Built-in Tools

### DateResolverTool

Resolves relative date references:

```typescript
import { DateResolverTool } from 'mojentic';

const tool = new DateResolverTool();

// Handles:
// - "next Friday"
// - "tomorrow"
// - "in 2 weeks"
// - "last Monday"
```

## Tool Descriptor

The descriptor tells the LLM about your tool:

```typescript
{
  type: 'function',
  function: {
    name: 'tool_name',              // Unique identifier
    description: 'What it does',    // Clear description
    parameters: {                   // JSON Schema
      type: 'object',
      properties: {
        arg1: {
          type: 'string',
          description: 'What this arg is for'
        }
      },
      required: ['arg1']
    }
  }
}
```

### Writing Good Descriptions

Be specific and clear:

❌ Bad:
```typescript
description: 'Gets weather'
```

✅ Good:
```typescript
description: 'Get current weather conditions and temperature for a specific city or location'
```

## Error Handling

### Returning Errors

```typescript
async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
  const location = args.location as string;

  if (!location) {
    return Ok({ error: 'Location is required' });
  }

  try {
    const data = await fetchData(location);
    return Ok(data);
  } catch (error) {
    return Err(new ToolError(
      `Failed to fetch data: ${error.message}`,
      'MyTool'
    ));
  }
}
```

### Handling Tool Failures

The broker handles tool failures gracefully:

```typescript
// If a tool fails, the broker:
// 1. Logs the error
// 2. Sends error message back to LLM
// 3. Lets LLM try again or respond differently

const result = await broker.generate(messages, tools);
// Even if a tool fails, you get a response
```

## Advanced Patterns

### Stateful Tools

```typescript
class DatabaseTool extends BaseTool {
  constructor(private db: Database) {
    super();
  }

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    const query = args.query as string;
    const results = await this.db.query(query);
    return Ok({ results });
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'query_database',
        description: 'Execute a database query',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'SQL query to execute' }
          },
          required: ['query']
        }
      }
    };
  }
}

// Usage with state
const db = await connectDatabase();
const tools = [new DatabaseTool(db)];
```

### Async Operations

Tools support async operations naturally:

```typescript
class ApiTool extends BaseTool {
  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    // Make API calls
    const data = await fetch(url);
    const json = await data.json();

    // Process results
    const processed = await processData(json);

    return Ok(processed);
  }
}
```

### Tool Chains

Tools can call other tools indirectly through the LLM:

```typescript
// The LLM can chain tools:
// User: "What's the weather next Friday in Paris?"
//
// 1. LLM calls: resolve_date("next Friday")
// 2. LLM calls: get_weather("Paris", "2025-12-19")
// 3. LLM responds with combined information
```

## Best Practices

### 1. Keep Tools Focused

Each tool should do one thing well:

❌ Bad:
```typescript
class DataTool {
  // Does too much
  async run(args) {
    if (args.action === 'fetch') { /* ... */ }
    else if (args.action === 'save') { /* ... */ }
    else if (args.action === 'delete') { /* ... */ }
  }
}
```

✅ Good:
```typescript
class FetchDataTool { /* ... */ }
class SaveDataTool { /* ... */ }
class DeleteDataTool { /* ... */ }
```

### 2. Validate Input

```typescript
async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
  const email = args.email as string;

  if (!email || !email.includes('@')) {
    return Ok({ error: 'Invalid email address' });
  }

  // Proceed with valid input
}
```

### 3. Provide Clear Results

```typescript
// Return structured, useful data
return Ok({
  success: true,
  data: {
    temperature: 22,
    condition: 'sunny',
    humidity: 45
  },
  timestamp: new Date().toISOString()
});
```

### 4. Handle Rate Limits

```typescript
class RateLimitedTool extends BaseTool {
  private lastCall = 0;
  private minInterval = 1000; // 1 second

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    const now = Date.now();
    if (now - this.lastCall < this.minInterval) {
      return Ok({ error: 'Rate limit exceeded, try again later' });
    }

    this.lastCall = now;
    // Proceed with operation
  }
}
```

## Example: Complete Tool

```typescript
import { BaseTool, ToolArgs, ToolDescriptor, ToolResult, Ok, Err, ToolError } from 'mojentic';

export class GithubTool extends BaseTool {
  constructor(private apiKey: string) {
    super();
  }

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    try {
      const owner = args.owner as string;
      const repo = args.repo as string;

      if (!owner || !repo) {
        return Ok({ error: 'Both owner and repo are required' });
      }

      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) {
        return Ok({ error: `GitHub API error: ${response.status}` });
      }

      const data = await response.json();

      return Ok({
        name: data.name,
        description: data.description,
        stars: data.stargazers_count,
        forks: data.forks_count,
        language: data.language,
        url: data.html_url
      });
    } catch (error) {
      return Err(new ToolError(
        `GitHub API call failed: ${error.message}`,
        'GithubTool'
      ));
    }
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'get_github_repo',
        description: 'Get information about a GitHub repository including stars, forks, and description',
        parameters: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'GitHub username or organization name'
            },
            repo: {
              type: 'string',
              description: 'Repository name'
            }
          },
          required: ['owner', 'repo']
        }
      }
    };
  }
}

// Usage
const tool = new GithubTool(process.env.GITHUB_TOKEN);
const tools = [tool];

const messages = [
  Message.user('Tell me about the microsoft/TypeScript repository')
];

const result = await broker.generate(messages, tools);
```

## See Also

- [Broker Guide](/broker)
- [API Reference - Tools](/api/tools)
- [Best Practices](/best-practices)
