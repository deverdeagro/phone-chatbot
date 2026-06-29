/**
 * A "skill" is a tool the on-device model can call during a chat. Each skill
 * advertises a JSON-schema for its arguments (so the model knows how to call
 * it) and a `run` function the app executes when the model invokes it.
 */
export type JSONSchema = {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
};

export type Skill = {
  /** Function name the model calls (snake_case, no spaces). */
  name: string;
  /** Natural-language description the model uses to decide when to call it. */
  description: string;
  /** JSON-schema describing the arguments the model should pass. */
  parameters: JSONSchema;
  /** Execute the skill with the model-provided arguments; returns a text result. */
  run: (args: Record<string, unknown>) => Promise<string>;
};

/** OpenAI-style tool definition passed to llama.rn's completion(). */
export type ToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
  };
};
