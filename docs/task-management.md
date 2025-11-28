# Example: Task Management

The `TaskManager` is an example of how to build stateful tools that allow agents to manage ephemeral tasks. This reference implementation shows how to maintain state across tool calls.

## Features

- **Create Tasks**: Add new tasks to the list
- **List Tasks**: View all current tasks and their status
- **Complete Tasks**: Mark tasks as done
- **Prioritize**: Agents can determine the order of execution

## Usage

```typescript
import { LlmBroker, OllamaGateway, Message } from 'mojentic';
import { TaskManager } from 'mojentic';

// Initialize broker
const gateway = new OllamaGateway();
const broker = new LlmBroker('qwen3:32b', gateway);

// Register the tool
const tools = [new TaskManager()];

// The agent can now manage its own tasks
const messages = [
  Message.system("You are a helpful assistant. Use the task manager to track your work."),
  Message.user("Plan a party for 10 people.")
];

const result = await broker.generate(messages, tools);
```

## Integration with Agents

The Task Manager is particularly powerful when combined with the `IterativeProblemSolver` agent, allowing it to maintain state across multiple reasoning steps.
