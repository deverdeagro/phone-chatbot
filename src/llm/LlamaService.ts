import { initLlama, type LlamaContext } from 'llama.rn';
import { getToolDefinitions, runTool } from '../skills/registry';
import type { ChatMessage } from './types';

const SYSTEM_PROMPT =
  'You are a helpful, concise assistant running on the user’s phone. ' +
  'You can search the user’s Gmail with the search_gmail tool whenever they ' +
  'ask about their email or inbox. After you receive email results, answer the ' +
  'user in plain language and cite the sender and subject — do not show raw tool output.';

/** How many of the most recent turns to keep in context (sliding window). */
const MAX_HISTORY_MESSAGES = 12;

/** Safety cap on tool-call round-trips per user turn. */
const MAX_TOOL_ITERATIONS = 4;

/** Loosely-typed chat message that may carry tool-call metadata for the
 * model's chat template (llama.rn passes extra fields straight through). */
type LlamaMessage = {
  role: string;
  content: string;
  tool_calls?: unknown;
  tool_call_id?: string;
  name?: string;
};

export type ChatResult = {
  text: string;
  /** Tokens generated per second, if reported by the engine. */
  tokensPerSecond?: number;
};

export type ChatCallbacks = {
  /** Called with the accumulated assistant text as tokens stream in. */
  onToken: (partialText: string) => void;
  /** Called with a transient status (e.g. running a skill), or null to clear. */
  onStatus?: (status: string | null) => void;
};

/**
 * Thin wrapper around llama.rn that owns a single loaded model context and
 * exposes streaming chat. All inference is local — no network calls.
 */
class LlamaServiceImpl {
  private context: LlamaContext | null = null;

  get isReady(): boolean {
    return this.context !== null;
  }

  /**
   * Load a GGUF model from a local path into a llama.cpp context.
   * @param modelPath absolute local path (without the file:// prefix)
   * @param onProgress 0..1 model-load progress
   */
  async init(
    modelPath: string,
    onProgress?: (fraction: number) => void,
  ): Promise<void> {
    if (this.context) {
      await this.release();
    }
    this.context = await initLlama(
      {
        model: `file://${modelPath}`,
        n_ctx: 2048,
        n_gpu_layers: 99, // offloaded to GPU where supported (Adreno OpenCL), ignored otherwise
        use_mlock: true,
      },
      progress => onProgress?.(progress / 100),
    );
  }

  /**
   * Run a chat turn, letting the model call skills (tools) as needed before it
   * produces a final streamed answer.
   * @param history conversation so far (system prompt is added automatically)
   */
  async chat(
    history: ChatMessage[],
    callbacks: ChatCallbacks,
  ): Promise<ChatResult> {
    if (!this.context) {
      throw new Error('Model is not loaded.');
    }

    const messages = this.buildMessages(history);
    const tools = getToolDefinitions();
    let lastTps: number | undefined;

    for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
      // Only advertise tools on the first model turn. Once we've fed results
      // back, the model must answer rather than call more tools.
      const offerTools = iter === 0;
      let turnText = '';
      const result = await this.context.completion(
        {
          messages,
          tools: offerTools ? tools : undefined,
          jinja: true,
          n_predict: 512,
          temperature: 0.7,
        },
        data => {
          turnText += data.token;
          callbacks.onToken(turnText);
        },
      );
      lastTps = result.timings?.predicted_per_second ?? lastTps;

      const toolCalls = result.tool_calls ?? [];
      if (toolCalls.length === 0) {
        // No tool requested — this turn is the final answer.
        const text = (result.text ?? turnText).trim();
        callbacks.onStatus?.(null);
        return { text, tokensPerSecond: lastTps };
      }

      // The model asked to run one or more skills. Discard the (non-user-facing)
      // tool-call text it streamed, run the skills, and feed the results back as
      // a plain message. We deliberately do NOT re-inject the OpenAI-style
      // tool_calls/tool messages — the Llama chat template rejects them when an
      // argument is null. A plain follow-up message is template-agnostic.
      callbacks.onToken('');
      const blocks: string[] = [];
      for (const call of toolCalls) {
        callbacks.onStatus?.(statusFor(call.function.name));
        const output = await runTool(
          call.function.name,
          call.function.arguments ?? '',
        );
        blocks.push(`Results from ${call.function.name}:\n${output}`);
      }
      callbacks.onStatus?.('Writing a reply…');
      messages.push({
        role: 'user',
        content:
          `${blocks.join('\n\n')}\n\n` +
          'Using only these results, answer my previous question in plain ' +
          'language. Do not call any tools.',
      });
    }

    callbacks.onStatus?.(null);
    return {
      text: 'Sorry — I couldn’t finish that after several tries.',
      tokensPerSecond: lastTps,
    };
  }

  /** Stop an in-flight completion early. */
  async stop(): Promise<void> {
    await this.context?.stopCompletion();
  }

  /** Free the model context and its memory. */
  async release(): Promise<void> {
    if (this.context) {
      await this.context.release();
      this.context = null;
    }
  }

  /**
   * Build the OpenAI-style message array: system prompt + the most recent
   * turns, trimmed to keep us within the context window.
   */
  private buildMessages(history: ChatMessage[]): LlamaMessage[] {
    const recent = history.slice(-MAX_HISTORY_MESSAGES);
    return [
      { role: 'system', content: SYSTEM_PROMPT },
      ...recent.map(m => ({ role: m.role, content: m.content })),
    ];
  }
}

/** Friendly status text shown while a given skill runs. */
function statusFor(toolName: string): string {
  switch (toolName) {
    case 'search_gmail':
      return 'Searching your email…';
    default:
      return 'Working…';
  }
}

export const LlamaService = new LlamaServiceImpl();
