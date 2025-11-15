/**
 * ChatSession - Manages conversational state with automatic context window management
 */

import { LlmBroker } from './broker';
import { LlmMessage, MessageRole } from './models';
import { LlmTool } from './tools';
import { TokenizerGateway } from './gateways/tokenizerGateway';

/**
 * Message with token count for efficient context management
 */
interface SizedLlmMessage extends LlmMessage {
  tokenLength: number;
}

/**
 * Configuration options for ChatSession
 */
export interface ChatSessionConfig {
  systemPrompt?: string;
  tools?: LlmTool[];
  maxContext?: number;
  tokenizerGateway?: TokenizerGateway;
  temperature?: number;
}

/**
 * Manages the state of a conversation with an LLM, automatically handling
 * context window limits by removing older messages when needed.
 *
 * @example
 * ```typescript
 * const broker = new LlmBroker('qwen3:32b', new OllamaGateway());
 * const session = new ChatSession(broker, {
 *   systemPrompt: 'You are a helpful coding assistant.',
 *   tools: [new DateResolverTool()],
 *   maxContext: 8192
 * });
 *
 * const response = await session.send('What is TypeScript?');
 * console.log(response);
 * ```
 */
export class ChatSession {
  private messages: SizedLlmMessage[] = [];
  private readonly llm: LlmBroker;
  private readonly systemPrompt: string;
  private readonly tools?: LlmTool[];
  private readonly maxContext: number;
  private readonly temperature: number;
  private readonly tokenizerGateway: TokenizerGateway;

  /**
   * Create a new ChatSession instance.
   *
   * @param llm - The LLM broker to use for generating responses
   * @param config - Optional configuration options
   */
  constructor(llm: LlmBroker, config: ChatSessionConfig = {}) {
    this.llm = llm;
    this.systemPrompt = config.systemPrompt || 'You are a helpful assistant.';
    this.tools = config.tools;
    this.maxContext = config.maxContext || 32768;
    this.temperature = config.temperature || 1.0;
    this.tokenizerGateway = config.tokenizerGateway || new TokenizerGateway();

    // Initialize with system prompt
    this.insertMessage({
      role: MessageRole.System,
      content: this.systemPrompt,
    });
  }

  /**
   * Send a query to the LLM and return the response.
   * Also records the query and response in the ongoing chat session.
   *
   * @param query - The query to send to the LLM
   * @returns The response from the LLM
   *
   * @example
   * ```typescript
   * const response = await session.send('Hello, how are you?');
   * console.log(response);
   * ```
   */
  async send(query: string): Promise<string> {
    // Add user message
    this.insertMessage({
      role: MessageRole.User,
      content: query,
    });

    // Generate response
    const result = await this.llm.generate(
      this.messages as LlmMessage[],
      this.tools,
      { temperature: this.temperature }
    );

    if (!result.ok) {
      throw result.error;
    }

    // Ensure all messages have token counts
    this.ensureAllMessagesAreSized();

    // Add assistant response
    this.insertMessage({
      role: MessageRole.Assistant,
      content: result.value,
    });

    return result.value;
  }

  /**
   * Get the current message history.
   *
   * @returns Array of messages in the session
   */
  getMessages(): LlmMessage[] {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return this.messages.map(({ tokenLength, ...msg }) => msg);
  }

  /**
   * Clear all messages except the system prompt.
   */
  clear(): void {
    const systemMessage = this.messages[0];
    this.messages = [systemMessage];
  }

  /**
   * Insert a message into the chat session.
   * If the total token count exceeds maxContext, older messages are removed.
   *
   * @param message - The message to add
   */
  private insertMessage(message: LlmMessage): void {
    const sizedMessage = this.buildSizedMessage(message);
    this.messages.push(sizedMessage);

    // Remove old messages if we exceed context limit
    let totalLength = this.messages.reduce((sum, msg) => sum + msg.tokenLength, 0);

    while (totalLength > this.maxContext && this.messages.length > 1) {
      // Remove the second message (keep system prompt at index 0)
      const removed = this.messages.splice(1, 1)[0];
      totalLength -= removed.tokenLength;
    }
  }

  /**
   * Build a sized message with token count.
   *
   * @param message - The message to size
   * @returns Message with token length
   */
  private buildSizedMessage(message: LlmMessage): SizedLlmMessage {
    if (!message.content || typeof message.content !== 'string') {
      return { ...message, tokenLength: 0 };
    }

    const tokens = this.tokenizerGateway.encode(message.content);
    return { ...message, tokenLength: tokens.length };
  }

  /**
   * Ensure all messages in the history have token counts.
   * This is needed after tool calls which may add messages without sizing.
   */
  private ensureAllMessagesAreSized(): void {
    for (let i = 0; i < this.messages.length; i++) {
      const msg = this.messages[i];
      if (!('tokenLength' in msg) || msg.tokenLength === undefined) {
        this.messages[i] = this.buildSizedMessage(msg as LlmMessage);
      }
    }
  }

  /**
   * Clean up resources when done with the session.
   */
  dispose(): void {
    this.tokenizerGateway.free();
  }
}
