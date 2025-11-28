# Tutorial: Extracting Structured Data

## Why Use Structured Output?

LLMs are great at generating text, but sometimes you need data in a machine-readable format like JSON. Structured output allows you to define a schema (using Zod in TypeScript) and force the LLM to return data that matches that schema.

This is essential for:
- Data extraction from unstructured text
- Building API integrations
- Populating databases
- ensuring reliable downstream processing

## Getting Started

Let's build an example that extracts user information from a natural language description.

### 1. Define Your Data Schema

We use `zod` to define the structure we want.

```typescript
import { z } from 'zod';

const UserInfoSchema = z.object({
  name: z.string(),
  age: z.number(),
  interests: z.array(z.string())
});

type UserInfo = z.infer<typeof UserInfoSchema>;
```

### 2. Initialize the Broker

```typescript
import { LlmBroker, OllamaGateway } from 'mojentic';

const gateway = new OllamaGateway();
const broker = new LlmBroker('qwen3:32b', gateway);
```

### 3. Generate Structured Data

Use `broker.generateStructured` to request the data.

```typescript
const text = "John Doe is a 30-year-old software engineer who loves hiking and reading.";

const userInfo = await broker.generateStructured(text, UserInfoSchema);

console.log(userInfo);
// {
//   name: "John Doe",
//   age: 30,
//   interests: ["hiking", "reading"]
// }
```

## How It Works

1.  **Schema Definition**: Mojentic converts your Zod schema into a JSON schema that the LLM can understand.
2.  **Prompt Engineering**: The broker automatically appends instructions to the prompt, telling the LLM to output JSON matching the schema.
3.  **Validation**: When the response comes back, Mojentic parses the JSON and validates it against your Zod schema.

## Advanced: Nested Schemas

You can also use nested schemas for more complex data.

```typescript
const AddressSchema = z.object({
  street: z.string(),
  city: z.string()
});

const UserProfileSchema = z.object({
  name: z.string(),
  address: AddressSchema
});
```

## Summary

Structured output turns unstructured text into reliable data structures. By defining Zod schemas, you can integrate LLM outputs directly into your application's logic with type safety and validation.
