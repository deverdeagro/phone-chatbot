import { emailSkill } from './email/emailSkill';
import { fetchUrlSkill } from './web/fetchUrlSkill';
import type { Skill, ToolDefinition } from './types';

/**
 * All skills the model is allowed to call. Add new skills here and they are
 * automatically advertised to the model as tools.
 */
const SKILLS: Skill[] = [emailSkill, fetchUrlSkill];

/** Tool definitions to pass to llama.rn's completion({ tools }). */
export function getToolDefinitions(): ToolDefinition[] {
  return SKILLS.map(s => ({
    type: 'function',
    function: {
      name: s.name,
      description: s.description,
      parameters: s.parameters,
    },
  }));
}

/**
 * Run a tool the model requested. `argumentsJson` is the raw JSON string of
 * arguments from the model's tool call. Never throws — returns an error string
 * the model can read and relay to the user.
 */
export async function runTool(
  name: string,
  argumentsJson: string,
): Promise<string> {
  const skill = SKILLS.find(s => s.name === name);
  if (!skill) {
    return `Error: no skill named "${name}".`;
  }

  let args: Record<string, unknown> = {};
  if (argumentsJson) {
    try {
      args = JSON.parse(argumentsJson);
    } catch {
      return `Error: could not parse arguments for ${name}: ${argumentsJson}`;
    }
  }

  try {
    return await skill.run(args);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return `Error running ${name}: ${msg}`;
  }
}
