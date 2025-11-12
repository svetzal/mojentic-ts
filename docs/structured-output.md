# Structured Output

Get type-safe, validated responses from LLMs in structured formats.

## Overview

LLMs naturally generate text, but applications often need data in specific formats. Mojentic's `generateObject()` method uses JSON schemas to guide LLMs to produce structured, validated output.

## Basic Usage

```typescript
import { LlmBroker, OllamaGateway, Message, isOk } from 'mojentic';

const gateway = new OllamaGateway();
const broker = new LlmBroker('qwen3:32b', gateway);

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
    city: { type: 'string' }
  },
  required: ['name', 'age']
};

const messages = [
  Message.user('Extract: John Smith, 34 years old, lives in Portland')
];

const result = await broker.generateObject(messages, schema);

if (isOk(result)) {
  console.log(result.value);
  // { name: "John Smith", age: 34, city: "Portland" }
}
```

## JSON Schema

Mojentic uses JSON Schema to define expected output structure.

### Basic Types

```typescript
// String
{ type: 'string' }

// Number
{ type: 'number' }

// Boolean
{ type: 'boolean' }

// Array
{
  type: 'array',
  items: { type: 'string' }
}

// Object
{
  type: 'object',
  properties: {
    field: { type: 'string' }
  }
}
```

### Complete Example

```typescript
const schema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Article title'
    },
    author: {
      type: 'string',
      description: 'Author name'
    },
    published: {
      type: 'string',
      description: 'Publication date in ISO format'
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Topic tags'
    },
    summary: {
      type: 'string',
      description: 'Brief summary'
    }
  },
  required: ['title', 'author', 'summary']
};
```

## Use Cases

### Data Extraction

Extract structured information from unstructured text:

```typescript
const schema = {
  type: 'object',
  properties: {
    persons: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          role: { type: 'string' },
          company: { type: 'string' }
        }
      }
    },
    date: { type: 'string' },
    location: { type: 'string' }
  }
};

const messages = [
  Message.user(`Extract entities from:
    "Meeting on Jan 15 at headquarters. Attendees:
     Sarah Chen (CEO, TechCorp), Mike Johnson (CTO, DataSys)"`)
];

const result = await broker.generateObject(messages, schema);
// {
//   persons: [
//     { name: "Sarah Chen", role: "CEO", company: "TechCorp" },
//     { name: "Mike Johnson", role: "CTO", company: "DataSys" }
//   ],
//   date: "2025-01-15",
//   location: "headquarters"
// }
```

### Classification

Classify content into categories:

```typescript
const schema = {
  type: 'object',
  properties: {
    category: {
      type: 'string',
      enum: ['technical', 'marketing', 'sales', 'support']
    },
    priority: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'urgent']
    },
    sentiment: {
      type: 'string',
      enum: ['positive', 'neutral', 'negative']
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1
    }
  },
  required: ['category', 'priority', 'sentiment']
};

const messages = [
  Message.user('Classify: Customer is frustrated with login issues preventing checkout')
];

const result = await broker.generateObject(messages, schema);
// {
//   category: "support",
//   priority: "high",
//   sentiment: "negative",
//   confidence: 0.95
// }
```

### Data Transformation

Convert data from one format to another:

```typescript
const schema = {
  type: 'object',
  properties: {
    firstName: { type: 'string' },
    lastName: { type: 'string' },
    email: { type: 'string' },
    phone: { type: 'string' },
    address: {
      type: 'object',
      properties: {
        street: { type: 'string' },
        city: { type: 'string' },
        state: { type: 'string' },
        zip: { type: 'string' }
      }
    }
  }
};

const messages = [
  Message.user(`Parse contact info:
    John Smith
    jsmith@example.com
    555-1234
    123 Main St, Portland, OR 97201`)
];

const result = await broker.generateObject(messages, schema);
```

### Validation

Get structured feedback on content:

```typescript
const schema = {
  type: 'object',
  properties: {
    isValid: { type: 'boolean' },
    score: { type: 'number', minimum: 0, maximum: 100 },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          message: { type: 'string' },
          severity: { type: 'string', enum: ['error', 'warning', 'info'] }
        }
      }
    },
    suggestions: {
      type: 'array',
      items: { type: 'string' }
    }
  }
};

const messages = [
  Message.user('Validate this code: const x = 5; console.log(y);')
];

const result = await broker.generateObject(messages, schema);
// {
//   isValid: false,
//   score: 60,
//   issues: [
//     { type: "ReferenceError", message: "y is not defined", severity: "error" }
//   ],
//   suggestions: ["Define variable y before using it"]
// }
```

## TypeScript Integration

Define TypeScript interfaces matching your schemas:

```typescript
interface Person {
  name: string;
  age: number;
  email?: string;
}

const personSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
    email: { type: 'string' }
  },
  required: ['name', 'age']
} as const;

const result = await broker.generateObject(messages, personSchema);

if (isOk(result)) {
  const person = result.value as Person;
  console.log(person.name); // Type-safe access
}
```

## Error Handling

### Schema Validation Errors

```typescript
const result = await broker.generateObject(messages, schema);

if (!isOk(result)) {
  const error = result.error;

  if (error instanceof ParseError) {
    console.error('Failed to parse LLM response as JSON');
  } else if (error instanceof ValidationError) {
    console.error('Response doesn\'t match schema');
  }
}
```

### Retries with Feedback

```typescript
let result = await broker.generateObject(messages, schema);

if (!isOk(result)) {
  // Add error context and retry
  messages.push(
    Message.assistant('Let me try again'),
    Message.user('Please ensure the response matches the exact schema format')
  );

  result = await broker.generateObject(messages, schema);
}
```

## Advanced Patterns

### Nested Objects

```typescript
const schema = {
  type: 'object',
  properties: {
    company: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        founded: { type: 'number' },
        employees: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              position: { type: 'string' },
              department: { type: 'string' }
            }
          }
        }
      }
    }
  }
};
```

### Enums for Constraints

```typescript
const schema = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['pending', 'approved', 'rejected']
    },
    priority: {
      type: 'number',
      enum: [1, 2, 3, 4, 5]
    }
  }
};
```

### Optional Fields

```typescript
const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    email: { type: 'string' },
    phone: { type: 'string' }  // Optional - not in 'required'
  },
  required: ['name', 'email']
};
```

### Arrays with Constraints

```typescript
const schema = {
  type: 'object',
  properties: {
    tags: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 5,
      uniqueItems: true
    }
  }
};
```

### Multiple Types

```typescript
const schema = {
  type: 'object',
  properties: {
    value: {
      anyOf: [
        { type: 'string' },
        { type: 'number' }
      ]
    }
  }
};
```

## Schema Descriptions

Add descriptions to guide the LLM:

```typescript
const schema = {
  type: 'object',
  description: 'Product information extracted from text',
  properties: {
    name: {
      type: 'string',
      description: 'Full product name including brand'
    },
    price: {
      type: 'number',
      description: 'Price in USD, numeric value only'
    },
    currency: {
      type: 'string',
      description: 'Three-letter currency code (e.g., USD, EUR)',
      pattern: '^[A-Z]{3}$'
    }
  }
};
```

## Best Practices

### 1. Keep Schemas Simple

Start with simple schemas and add complexity as needed:

```typescript
// Start here
const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' }
  }
};

// Add complexity gradually
```

### 2. Use Descriptions

Descriptions help LLMs understand intent:

```typescript
properties: {
  date: {
    type: 'string',
    description: 'Date in ISO 8601 format (YYYY-MM-DD)'
  }
}
```

### 3. Validate Required Fields

Mark essential fields as required:

```typescript
{
  type: 'object',
  properties: { /* ... */ },
  required: ['id', 'name']  // Essential fields only
}
```

### 4. Use Enums for Fixed Values

```typescript
status: {
  type: 'string',
  enum: ['draft', 'published', 'archived']
}
```

### 5. Handle Parsing Errors

Always check for errors:

```typescript
const result = await broker.generateObject(messages, schema);

if (!isOk(result)) {
  console.error('Structured output failed:', result.error);
  // Fallback logic
}
```

## Complete Example

```typescript
import { LlmBroker, OllamaGateway, Message, isOk, ParseError, ValidationError } from 'mojentic';

interface Meeting {
  title: string;
  date: string;
  attendees: Array<{
    name: string;
    role: string;
  }>;
  topics: string[];
  actionItems: Array<{
    task: string;
    assignee: string;
    dueDate?: string;
  }>;
}

const meetingSchema = {
  type: 'object',
  description: 'Meeting notes structure',
  properties: {
    title: {
      type: 'string',
      description: 'Meeting title or subject'
    },
    date: {
      type: 'string',
      description: 'Meeting date in ISO format'
    },
    attendees: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          role: { type: 'string' }
        },
        required: ['name', 'role']
      }
    },
    topics: {
      type: 'array',
      items: { type: 'string' },
      description: 'Topics discussed'
    },
    actionItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          task: { type: 'string' },
          assignee: { type: 'string' },
          dueDate: { type: 'string' }
        },
        required: ['task', 'assignee']
      }
    }
  },
  required: ['title', 'date', 'attendees', 'topics']
};

const gateway = new OllamaGateway();
const broker = new LlmBroker('qwen3:32b', gateway);

const notes = `
  Product Planning Meeting - Jan 15, 2025

  Attendees:
  - Sarah Chen, Product Manager
  - Mike Lee, Engineering Lead

  Topics:
  - Q1 roadmap review
  - API redesign proposal

  Action Items:
  - Sarah: Draft roadmap document by Jan 20
  - Mike: Review API specs by Jan 22
`;

const messages = [
  Message.system('Extract structured meeting information'),
  Message.user(notes)
];

const result = await broker.generateObject(messages, meetingSchema);

if (isOk(result)) {
  const meeting = result.value as Meeting;
  console.log(`Meeting: ${meeting.title}`);
  console.log(`Date: ${meeting.date}`);
  console.log(`Attendees: ${meeting.attendees.length}`);
  console.log(`Action Items: ${meeting.actionItems.length}`);
} else {
  const error = result.error;
  if (error instanceof ParseError) {
    console.error('Failed to parse response');
  } else if (error instanceof ValidationError) {
    console.error('Response does not match schema');
  } else {
    console.error('Error:', error.message);
  }
}
```

## See Also

- [Broker Guide](/broker)
- [Tool Usage](/tool-usage)
- [API Reference - Broker](/api/broker)
