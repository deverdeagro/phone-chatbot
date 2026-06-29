/**
 * Catalog of on-device GGUF models the app can run.
 *
 * Both are 4-bit (Q4_K_M) quantizations downloaded once from Hugging Face on
 * first launch, then cached locally. After the download the app is fully
 * offline — inference makes no network calls.
 */
export type ModelSpec = {
  /** Stable identifier. */
  id: string;
  /** Human-friendly name shown in the UI. */
  name: string;
  /** Approximate parameter count, in billions. */
  paramsB: number;
  /** Approximate on-disk size of the GGUF, in bytes (used for space checks + progress fallback). */
  sizeBytes: number;
  /** Minimum total device RAM (bytes) we require before selecting this model. */
  minRamBytes: number;
  /** Direct download URL for the GGUF file. */
  url: string;
  /** File name used for the local cache. */
  fileName: string;
};

const GB = 1024 * 1024 * 1024;

/**
 * Primary model: Llama 3.1 8B Instruct (Q4_K_M, ~4.9GB).
 * Only selected on high-RAM devices (~12GB+) where it won't be OOM-killed.
 *
 * sizeBytes is the EXACT file size from Hugging Face (Content-Length), used for
 * the download-completeness check — don't approximate it.
 */
export const PRIMARY_MODEL: ModelSpec = {
  id: 'llama-3.1-8b-instruct-q4_k_m',
  name: 'Llama 3.1 8B Instruct',
  paramsB: 8,
  sizeBytes: 4920739232,
  minRamBytes: Math.round(10.5 * GB),
  url: 'https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
  fileName: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
};

/**
 * Fallback model: Llama 3.2 3B Instruct (Q4_K_M, ~2.0GB).
 * Used on devices that can't safely hold the 8B model.
 *
 * sizeBytes is the EXACT file size from Hugging Face (Content-Length).
 */
export const FALLBACK_MODEL: ModelSpec = {
  id: 'llama-3.2-3b-instruct-q4_k_m',
  name: 'Llama 3.2 3B Instruct',
  paramsB: 3,
  sizeBytes: 2019377696,
  minRamBytes: 0,
  url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
  fileName: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
};

export const MODELS: ModelSpec[] = [PRIMARY_MODEL, FALLBACK_MODEL];
