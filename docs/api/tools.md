# API Reference - Tools

Tools enable LLMs to interact with external systems and perform actions.

## LlmTool Interface

```typescript
interface LlmTool {
  run(args: ToolArgs): Promise<Result<ToolResult, Error>>;
  descriptor(): ToolDescriptor;
}
```

Core interface for implementing tools.

### Methods

#### run

```typescript
async run(args: ToolArgs): Promise<Result<ToolResult, Error>>
```

Execute the tool with given arguments.

**Parameters:**
- `args`: Tool arguments as key-value pairs

**Returns:**
- `Result<ToolResult, Error>`: Ok with result data or Err with error

**Example:**
```typescript
async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
  const location = args.location as string;
  const data = await fetchWeather(location);
  return Ok(data);
}
```

#### descriptor

```typescript
descriptor(): ToolDescriptor
```

Return the tool's JSON schema descriptor.

**Returns:**
- `ToolDescriptor`: Schema describing the tool for the LLM

**Example:**
```typescript
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
            description: 'City name'
          }
        },
        required: ['location']
      }
    }
  };
}
```

## BaseTool Class

```typescript
abstract class BaseTool implements LlmTool {
  abstract run(args: ToolArgs): Promise<Result<ToolResult, Error>>;
  abstract descriptor(): ToolDescriptor;
}
```

Abstract base class for creating tools.

**Example:**
```typescript
import { BaseTool, ToolArgs, ToolDescriptor, ToolResult, Ok, Err } from 'mojentic';

class MyTool extends BaseTool {
  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    // Implementation
  }

  descriptor(): ToolDescriptor {
    // Schema definition
  }
}
```

## Built-in Tools

### DateResolverTool

Resolves relative date expressions to specific dates.

```typescript
class DateResolverTool extends BaseTool
```

**Usage:**
```typescript
import { DateResolverTool } from 'mojentic';

const tool = new DateResolverTool();
```

**Handles:**
- "tomorrow", "yesterday"
- "next Monday", "last Friday"
- "in 2 weeks", "3 days ago"
- "next month", "last year"

**Example:**
```typescript
const result = await tool.run({ relative_date: 'next Friday' });

if (isOk(result)) {
  console.log(result.value);
  // {
  //   resolved: "2025-12-19",
  //   day_of_week: "Friday"
  // }
}
```

## Types

### ToolArgs

```typescript
type ToolArgs = Record<string, any>;
```

Arguments passed to a tool (parsed from JSON).

**Example:**
```typescript
const args: ToolArgs = {
  location: "Paris",
  units: "metric"
};
```

### ToolResult

```typescript
type ToolResult = Record<string, any>;
```

Result returned by a tool.

**Example:**
```typescript
const result: ToolResult = {
  temperature: 22,
  condition: "sunny",
  humidity: 65
};
```

### ToolDescriptor

```typescript
interface ToolDescriptor {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}
```

JSON schema describing a tool.

**Properties:**
- `type`: Always 'function'
- `function.name`: Unique tool identifier
- `function.description`: What the tool does
- `function.parameters`: JSON Schema for arguments

**Example:**
```typescript
const descriptor: ToolDescriptor = {
  type: 'function',
  function: {
    name: 'calculate',
    description: 'Perform mathematical calculations',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Mathematical expression to evaluate'
        }
      },
      required: ['expression']
    }
  }
};
```

### ToolCall

```typescript
interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}
```

Represents a tool call request from the LLM.

**Properties:**
- `id`: Unique identifier for this call
- `type`: Always 'function'
- `function.name`: Tool name to call
- `function.arguments`: JSON string of arguments

**Example:**
```typescript
const toolCall: ToolCall = {
  id: "call_abc123",
  type: "function",
  function: {
    name: "get_weather",
    arguments: '{"location": "Tokyo"}'
  }
};
```

## Creating Custom Tools

### Basic Structure

```typescript
import { BaseTool, ToolArgs, ToolDescriptor, ToolResult, Ok, Err, ToolError } from 'mojentic';

export class MyTool extends BaseTool {
  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    try {
      // 1. Extract and validate arguments
      const param = args.param as string;
      if (!param) {
        return Ok({ error: 'Parameter required' });
      }

      // 2. Perform operation
      const result = await doSomething(param);

      // 3. Return result
      return Ok({ data: result });
    } catch (error) {
      // 4. Handle errors
      return Err(new ToolError(
        `Operation failed: ${error.message}`,
        'MyTool'
      ));
    }
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'my_tool',
        description: 'Clear description of what this tool does',
        parameters: {
          type: 'object',
          properties: {
            param: {
              type: 'string',
              description: 'What this parameter is for'
            }
          },
          required: ['param']
        }
      }
    };
  }
}
```

### With State

```typescript
export class DatabaseTool extends BaseTool {
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
            query: { type: 'string', description: 'SQL query' }
          },
          required: ['query']
        }
      }
    };
  }
}
```

### With Validation

```typescript
export class EmailTool extends BaseTool {
  private validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    const email = args.email as string;
    const subject = args.subject as string;
    const body = args.body as string;

    // Validate
    if (!email || !this.validateEmail(email)) {
      return Ok({ error: 'Invalid email address' });
    }

    if (!subject || !body) {
      return Ok({ error: 'Subject and body required' });
    }

    // Send email
    await sendEmail(email, subject, body);
    return Ok({ sent: true });
  }

  descriptor(): ToolDescriptor {
    return {
      type: 'function',
      function: {
        name: 'send_email',
        description: 'Send an email to a recipient',
        parameters: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              description: 'Recipient email address'
            },
            subject: {
              type: 'string',
              description: 'Email subject line'
            },
            body: {
              type: 'string',
              description: 'Email body content'
            }
          },
          required: ['email', 'subject', 'body']
        }
      }
    };
  }
}
```

## Parameter Types

### String Parameters

```typescript
properties: {
  name: {
    type: 'string',
    description: 'User name'
  }
}
```

### Number Parameters

```typescript
properties: {
  age: {
    type: 'number',
    description: 'User age in years',
    minimum: 0,
    maximum: 150
  }
}
```

### Boolean Parameters

```typescript
properties: {
  verbose: {
    type: 'boolean',
    description: 'Enable verbose output'
  }
}
```

### Enum Parameters

```typescript
properties: {
  priority: {
    type: 'string',
    enum: ['low', 'medium', 'high', 'urgent'],
    description: 'Task priority level'
  }
}
```

### Array Parameters

```typescript
properties: {
  tags: {
    type: 'array',
    items: { type: 'string' },
    description: 'List of tags'
  }
}
```

### Object Parameters

```typescript
properties: {
  address: {
    type: 'object',
    properties: {
      street: { type: 'string' },
      city: { type: 'string' },
      zip: { type: 'string' }
    },
    required: ['street', 'city']
  }
}
```

## Error Handling

### Returning Errors

```typescript
// Option 1: Return error in result
if (!isValid(input)) {
  return Ok({ error: 'Invalid input' });
}

// Option 2: Return Err
if (criticalFailure) {
  return Err(new ToolError('Critical failure', 'MyTool'));
}
```

### Handling Async Errors

```typescript
async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
  try {
    const data = await fetchData();
    return Ok(data);
  } catch (error) {
    return Err(new ToolError(
      `Fetch failed: ${error.message}`,
      'MyTool'
    ));
  }
}
```

### Validation Errors

```typescript
async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
  const url = args.url as string;

  if (!url) {
    return Ok({ error: 'URL is required' });
  }

  if (!url.startsWith('http')) {
    return Ok({ error: 'URL must start with http:// or https://' });
  }

  // Proceed with valid input
}
```

## Best Practices

### 1. Clear Descriptions

```typescript
// Good
descriptor(): ToolDescriptor {
  return {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather conditions and temperature for a specific city or location',
      // ...
    }
  };
}

// Bad
descriptor(): ToolDescriptor {
  return {
    type: 'function',
    function: {
      name: 'weather',
      description: 'Gets weather',
      // ...
    }
  };
}
```

### 2. Validate Input

```typescript
async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
  // Always validate arguments
  const requiredParam = args.required as string;
  if (!requiredParam) {
    return Ok({ error: 'Required parameter missing' });
  }

  // Proceed with validated input
}
```

### 3. Structured Results

```typescript
// Good: Structured data
return Ok({
  success: true,
  data: {
    temperature: 22,
    condition: 'sunny'
  },
  timestamp: new Date().toISOString()
});

// Bad: Unstructured string
return Ok({ result: 'The temperature is 22 degrees and sunny' });
```

### 4. Handle Rate Limits

```typescript
class RateLimitedTool extends BaseTool {
  private lastCall = 0;
  private minInterval = 1000;

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    const now = Date.now();
    if (now - this.lastCall < this.minInterval) {
      return Ok({ error: 'Rate limit exceeded' });
    }

    this.lastCall = now;
    // Proceed
  }
}
```

### 5. Timeout Long Operations

```typescript
async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
  const timeoutMs = 5000;

  try {
    const result = await Promise.race([
      longOperation(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      )
    ]);

    return Ok(result);
  } catch (error) {
    if (error.message === 'Timeout') {
      return Err(new TimeoutError('Operation timed out', timeoutMs));
    }
    return Err(new ToolError(error.message, 'MyTool'));
  }
}
```

## Complete Example

```typescript
import {
  BaseTool,
  ToolArgs,
  ToolDescriptor,
  ToolResult,
  Ok,
  Err,
  ToolError
} from 'mojentic';

export class GithubTool extends BaseTool {
  constructor(private apiKey: string) {
    super();
  }

  async run(args: ToolArgs): Promise<Result<ToolResult, Error>> {
    try {
      // Extract arguments
      const owner = args.owner as string;
      const repo = args.repo as string;

      // Validate
      if (!owner || !repo) {
        return Ok({ error: 'Both owner and repo are required' });
      }

      // Make API call
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

      // Return structured result
      return Ok({
        name: data.name,
        description: data.description,
        stars: data.stargazers_count,
        forks: data.forks_count,
        language: data.language,
        url: data.html_url,
        created_at: data.created_at,
        updated_at: data.updated_at
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
        description: 'Get detailed information about a GitHub repository including stars, forks, language, and description',
        parameters: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'GitHub username or organization name that owns the repository'
            },
            repo: {
              type: 'string',
              description: 'Repository name (without the owner prefix)'
            }
          },
          required: ['owner', 'repo']
        }
      }
    };
  }
}

// Usage
const tool = new GithubTool(process.env.GITHUB_TOKEN!);

const result = await tool.run({
  owner: 'microsoft',
  repo: 'TypeScript'
});

if (isOk(result)) {
  console.log(result.value);
  // {
  //   name: "TypeScript",
  //   description: "TypeScript is a superset of JavaScript...",
  //   stars: 95123,
  //   forks: 12345,
  //   language: "TypeScript",
  //   url: "https://github.com/microsoft/TypeScript",
  //   ...
  // }
}
```

## See Also

- [Tool Usage Guide](/tool-usage)
- [Broker API](/api/broker)
- [Core API](/api/core)
- [Error Handling](/error-handling)
