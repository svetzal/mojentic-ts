/**
 * Base data models for the ReAct pattern.
 *
 * This module defines the core data structures used throughout the ReAct
 * implementation, including actions, plans, observations, and context.
 */

/**
 * Enumeration of possible next actions in the ReAct loop.
 */
export enum NextAction {
  PLAN = 'PLAN',
  ACT = 'ACT',
  FINISH = 'FINISH',
}

/**
 * A single step in the ReAct loop capturing thought, action, and observation.
 *
 * This model represents one iteration of the ReAct pattern where the agent:
 * 1. Thinks about what to do
 * 2. Takes an action
 * 3. Observes the result
 */
export interface ThoughtActionObservation {
  /** The thought process behind the action taken in the current context */
  thought: string;
  /** The action taken in the current context */
  action: string;
  /** The observation made after the action taken in the current context */
  observation: string;
}

/**
 * A structured plan for solving a user query.
 *
 * Contains a list of steps that outline how to approach answering the query.
 */
export interface Plan {
  /** How to answer the query, step by step, each step outlining an action to take */
  steps: string[];
}

/**
 * The complete context for a ReAct session.
 *
 * This model tracks everything needed to maintain state throughout the
 * reasoning and acting loop, including the user's query, the plan,
 * the history of actions, and the iteration count.
 */
export interface CurrentContext {
  /** The user query to which we are responding */
  userQuery: string;
  /** The current plan of action for the current context */
  plan: Plan;
  /** The history of actions taken and observations made in the current context */
  history: ThoughtActionObservation[];
  /** The number of iterations taken in the current context */
  iteration: number;
}
