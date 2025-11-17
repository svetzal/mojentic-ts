/**
 * Router for directing events to appropriate agents
 */

import { Event } from './event';
import { BaseAsyncAgent } from './base-async-agent';

/**
 * Routes events to registered agents based on event type.
 *
 * The Router maintains a mapping of event constructors to agent instances,
 * allowing multiple agents to subscribe to the same event type.
 *
 * @example
 * ```typescript
 * const router = new Router();
 * router.addRoute(QuestionEvent, factCheckerAgent);
 * router.addRoute(QuestionEvent, answerGeneratorAgent);
 *
 * const agents = router.getAgents(questionEvent);
 * ```
 */
export class Router {
  private routes: Map<string, BaseAsyncAgent[]> = new Map();

  /**
   * Register an agent to handle a specific event type.
   *
   * @param eventType - The event type name to route
   * @param agent - The agent that should handle this event type
   */
  addRoute(eventType: string, agent: BaseAsyncAgent): void {
    const agents = this.routes.get(eventType) || [];
    agents.push(agent);
    this.routes.set(eventType, agents);
  }

  /**
   * Get all agents registered to handle an event's type.
   *
   * @param event - The event to route
   * @returns Array of agents that handle this event type
   */
  getAgents(event: Event & { type?: string }): BaseAsyncAgent[] {
    const eventType = event.type || event.constructor.name;
    return this.routes.get(eventType) || [];
  }

  /**
   * Clear all routes from the router.
   */
  clear(): void {
    this.routes.clear();
  }
}
