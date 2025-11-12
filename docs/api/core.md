# API Reference - Core

Core types and utilities for Mojentic.

## Error Module

### Result Type

```typescript
type Result<T, E extends Error> = Ok<T> | Err<E>;
```

A discriminated union representing either success (`Ok`) or failure (`Err`).

#### Ok

```typescript
interface Ok<T> {
  ok: true;
  value: T;
}
```

Represents a successful result.

**Creating:**
```typescript
import { Ok } from 'mojentic';

const result = Ok(42);
const result2 = Ok({ name: "Alice", age: 30 });
```

#### Err

```typescript
interface Err<E extends Error> {
  ok: false;
  error: E;
}
```

Represents a failed result.

**Creating:**
```typescript
import { Err } from 'mojentic';

const result = Err(new Error("Something went wrong"));
const result2 = Err(new ValidationError("Invalid input"));
```

### Type Guards

#### isOk

```typescript
function isOk<T, E extends Error>(result: Result<T, E>): result is Ok<T>
```

Type guard to check if result is Ok.

**Example:**
```typescript
const result = await broker.generate(messages);

if (isOk(result)) {
  console.log(result.value); // Type: string
}
```

#### isErr

```typescript
function isErr<T, E extends Error>(result: Result<T, E>): result is Err<E>
```

Type guard to check if result is Err.

**Example:**
```typescript
const result = await broker.generate(messages);

if (isErr(result)) {
  console.error(result.error); // Type: Error
}
```

### Utility Functions

#### unwrap

```typescript
function unwrap<T, E extends Error>(result: Result<T, E>): T
```

Extracts the value from Ok result or throws the error from Err result.

**Example:**
```typescript
const result = Ok(42);
const value = unwrap(result); // 42

const errorResult = Err(new Error("Failed"));
unwrap(errorResult); // Throws Error
```

#### unwrapOr

```typescript
function unwrapOr<T, E extends Error>(result: Result<T, E>, defaultValue: T): T
```

Returns the value from Ok or a default value if Err.

**Example:**
```typescript
const result = Err(new Error("Failed"));
const value = unwrapOr(result, 0); // 0
```

#### mapResult

```typescript
function mapResult<T, U, E extends Error>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E>
```

Transforms the Ok value while preserving Err.

**Example:**
```typescript
const result = Ok(5);
const doubled = mapResult(result, x => x * 2); // Ok(10)
```

#### mapError

```typescript
function mapError<T, E extends Error, F extends Error>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F>
```

Transforms the Err value while preserving Ok.

**Example:**
```typescript
const result = Err(new Error("Failed"));
const mapped = mapError(result, e => new ValidationError(e.message));
```

### Error Classes

#### MojenticError

Base error class for all Mojentic errors.

```typescript
class MojenticError extends Error {
  constructor(message: string)
}
```

#### GatewayError

Errors from LLM gateway operations.

```typescript
class GatewayError extends MojenticError {
  constructor(
    message: string,
    public readonly gateway: string,
    public readonly statusCode?: number
  )
}
```

**Properties:**
- `gateway`: Name of the gateway that threw the error
- `statusCode`: Optional HTTP status code

#### ToolError

Errors from tool execution.

```typescript
class ToolError extends MojenticError {
  constructor(
    message: string,
    public readonly toolName: string
  )
}
```

**Properties:**
- `toolName`: Name of the tool that threw the error

#### ValidationError

Schema validation errors.

```typescript
class ValidationError extends MojenticError {
  constructor(message: string)
}
```

#### ParseError

JSON parsing errors.

```typescript
class ParseError extends MojenticError {
  constructor(message: string)
}
```

#### TimeoutError

Timeout errors.

```typescript
class TimeoutError extends MojenticError {
  constructor(
    message: string,
    public readonly timeoutMs: number
  )
}
```

**Properties:**
- `timeoutMs`: The timeout duration in milliseconds

## Message Module

### MessageRole

```typescript
enum MessageRole {
  System = 'system',
  User = 'user',
  Assistant = 'assistant',
  Tool = 'tool'
}
```

Role identifier for messages in conversation.

### LlmMessage

```typescript
interface LlmMessage {
  role: MessageRole;
  content: string;
  name?: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}
```

Message in a conversation.

**Properties:**
- `role`: Who sent the message
- `content`: Message text
- `name`: Optional name/identifier
- `toolCalls`: Optional tool calls (for assistant messages)
- `toolCallId`: Optional tool call ID (for tool result messages)

### Message Helpers

```typescript
class Message {
  static system(content: string): LlmMessage
  static user(content: string, name?: string): LlmMessage
  static assistant(content: string, toolCalls?: ToolCall[]): LlmMessage
  static tool(content: string, toolCallId: string, name: string): LlmMessage
}
```

Helper class for creating messages.

**Examples:**
```typescript
const system = Message.system('You are a helpful assistant');
const user = Message.user('Hello!');
const assistant = Message.assistant('Hi there!');
const tool = Message.tool('{"result": 42}', 'call_123', 'calculator');
```

## Tool Module

### ToolCall

```typescript
interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;  // JSON string
  };
}
```

Represents a tool call request from the LLM.

### ToolArgs

```typescript
type ToolArgs = Record<string, any>;
```

Arguments passed to a tool (parsed from JSON).

### ToolResult

```typescript
type ToolResult = Record<string, any>;
```

Result returned by a tool.

### ToolDescriptor

```typescript
interface ToolDescriptor {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;  // JSON Schema
  };
}
```

JSON schema describing a tool for the LLM.

### LlmTool Interface

```typescript
interface LlmTool {
  run(args: ToolArgs): Promise<Result<ToolResult, Error>>;
  descriptor(): ToolDescriptor;
}
```

Interface for implementing tools.

**Methods:**
- `run`: Execute the tool with given arguments
- `descriptor`: Return the tool's schema

### BaseTool Class

```typescript
abstract class BaseTool implements LlmTool {
  abstract run(args: ToolArgs): Promise<Result<ToolResult, Error>>;
  abstract descriptor(): ToolDescriptor;
}
```

Abstract base class for tools.

## Configuration

### CompletionConfig

```typescript
interface CompletionConfig {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  [key: string]: any;
}
```

Configuration for LLM generation.

**Properties:**
- `temperature`: Randomness (0.0-2.0, default varies by model)
- `maxTokens`: Maximum tokens to generate
- `topP`: Nucleus sampling threshold
- `stream`: Whether to stream responses
- Additional provider-specific options

## Gateway Types

### GatewayResponse

```typescript
interface GatewayResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

Response from LLM gateway.

**Properties:**
- `content`: Generated text
- `toolCalls`: Tool calls requested by LLM
- `finishReason`: Why generation stopped
- `usage`: Token usage statistics

### StreamChunk

```typescript
interface StreamChunk {
  content: string;
  isComplete: boolean;
  toolCalls?: ToolCall[];
  finishReason?: string;
}
```

Chunk in a streaming response.

**Properties:**
- `content`: Partial or complete text
- `isComplete`: Whether this is the final chunk
- `toolCalls`: Tool calls (only in final chunk)
- `finishReason`: Why generation stopped (only in final chunk)

## See Also

- [Error Handling Guide](/error-handling)
- [Broker API](/api/broker)
- [Gateway API](/api/gateways)
- [Tools API](/api/tools)
