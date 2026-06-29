import { initLlama, type LlamaContext } from 'llama.rn';
import type { ChatMessage, ChatRole } from './types';

const SYSTEM_PROMPT =
  'You are a helpful, concise assistant running entirely on the user’s phone.';

/** How many of the most recent turns to keep in context (sliding window). */
const MAX_HISTORY_MESSAGES = 12;

export type ChatResult = {
  text: string;
  /** Tokens generated per second, if reported by the engine. */
  tokensPerSecond?: number;
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
   * Run a streaming chat completion over the conversation so far.
   * @param history full message list (system prompt is added automatically)
   * @param onToken called with the accumulated assistant text as tokens arrive
   */
  async chat(
    history: ChatMessage[],
    onToken: (partialText: string) => void,
  ): Promise<ChatResult> {
    if (!this.context) {
      throw new Error('Model is not loaded.');
    }

    const messages = this.buildMessages(history);
    let accumulated = '';

    const result = await this.context.completion(
      {
        messages,
        n_predict: 512,
        temperature: 0.7,
        stop: ['<|eot_id|>', '<|end_of_text|>', '<|endoftext|>'],
      },
      data => {
        accumulated += data.token;
        onToken(accumulated);
      },
    );

    const text = (result.text ?? accumulated).trim();
    const tps = result.timings?.predicted_per_second;
    return { text, tokensPerSecond: tps };
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
  private buildMessages(
    history: ChatMessage[],
  ): { role: ChatRole; content: string }[] {
    const recent = history.slice(-MAX_HISTORY_MESSAGES);
    return [
      { role: 'system' as ChatRole, content: SYSTEM_PROMPT },
      ...recent.map(m => ({ role: m.role, content: m.content })),
    ];
  }
}

export const LlamaService = new LlamaServiceImpl();
