# PhoneChatbot — On-Device LLM Chat (Android)

A React Native (bare CLI) app that runs a 7–8B-parameter LLM **fully on-device** and
exposes a simple chat UI. After a one-time model download, all inference is local — no
network calls during chat.

## How it works

Boot flow (`App.tsx`): pick a model based on device RAM → download it once (cached) → load
it into llama.cpp via [`llama.rn`](https://github.com/mybigday/llama.rn) → show chat.

- **Model selection** (`src/models/ModelManager.ts`): devices with ≥ ~10.5GB RAM get
  **Llama 3.1 8B Instruct** (Q4_K_M, ~4.9GB); smaller devices fall back to
  **Llama 3.2 3B Instruct** (Q4_K_M, ~2.0GB). Models are catalogued in
  `src/models/modelRegistry.ts`.
  - **Dev flag** (`src/config.ts`): `DEV_FORCE_MODEL` forces a model regardless of RAM —
    `'fallback'` (3B), `'primary'` (8B), or `null` for automatic selection. It currently
    ships as `'fallback'` so you can smoke-test the flow on a lower-RAM device/emulator;
    set it to `null` for production RAM-based selection.
- **Download** (`react-native-fs`): one-time fetch from Hugging Face with a progress bar,
  cached to app storage. Re-launch reuses the cached file.
- **Inference** (`src/llm/LlamaService.ts`): wraps `llama.rn` — loads the GGUF, streams
  tokens, keeps a sliding context window (`n_ctx = 2048`).
- **UI**: `src/screens/ChatScreen.tsx`, `src/components/MessageBubble.tsx`,
  `src/screens/LoadingScreen.tsx`.

## Requirements

- Node + JDK 17 + Android SDK (New Architecture is enabled — `newArchEnabled=true`).
- A **physical Android device with ≥ 12GB RAM** for the 8B model (e.g. Pixel 8/9 Pro,
  Galaxy S24+). 8GB devices run the 3B fallback. Emulators are too slow / RAM-limited for 8B.
- First launch needs Wi-Fi for the multi-GB model download. The device must be `arm64-v8a`.

## Run

```bash
npm install
# connect a device over USB with debugging enabled, then:
npx react-native run-android
```

Note on model URLs: the GGUF links in `modelRegistry.ts` point at public `bartowski`
re-quant repos. If a download returns HTTP 401/403, the repo is gated — swap the `url` for
an ungated mirror or add an `Authorization: Bearer <hf_token>` header in
`ModelManager.ensureDownloaded`.

## Verify end-to-end

1. `npx react-native run-android` on a high-RAM device.
2. First launch: confirm the selected model (8B on flagship, 3B on 8GB), the download bar
   completes, and the GGUF is cached.
3. Send a message: the assistant reply streams token-by-token; tokens/sec shows in the header.
4. Kill and relaunch: it reuses the cached model and reaches chat without re-downloading.
5. Memory sanity: `adb shell dumpsys meminfo com.phonechatbot` during a multi-turn chat to
   confirm the app isn't OOM-killed.
