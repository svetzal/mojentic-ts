# Example: File Tools

This guide demonstrates how to build tools for interacting with the file system using the Mojentic framework. The included `FileTool` and `CodingFileTool` serve as reference implementations that you can use directly or adapt for your specific needs.

## Available Tools

### FileTool

The `FileTool` provides basic file operations:

- `read_file`: Read content of a file
- `write_file`: Write content to a file
- `list_dir`: List directory contents
- `file_exists`: Check if a file exists

### CodingFileTool

The `CodingFileTool` extends `FileTool` with features specifically for coding tasks:

- `apply_patch`: Apply a unified diff patch to a file
- `replace_text`: Replace specific text in a file
- `search_files`: Search for patterns in files

## Usage

```typescript
import { LlmBroker, OllamaGateway, Message } from 'mojentic';
import { FileTool } from 'mojentic';

// Initialize broker
const gateway = new OllamaGateway();
const broker = new LlmBroker('qwen3:32b', gateway);

// Register tools
const tools = [new FileTool()];

// Ask the agent to perform file operations
const messages = [
  Message.user("Create a file named 'hello.txt' with the content 'Hello, World!'")
];

const result = await broker.generate(messages, tools);
```

## Security

By default, file tools are restricted to the current working directory. You can configure allowed paths to restrict access further.
