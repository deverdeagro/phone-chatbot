/**
 * On-device LLM chat app.
 *
 * Boot flow: pick a model based on device RAM → download it once (cached) →
 * load it into llama.cpp → show the chat UI. After the one-time download all
 * inference runs locally with no network calls.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { ModelManager } from './src/models/ModelManager';
import type { ModelSpec } from './src/models/modelRegistry';
import { LlamaService } from './src/llm/LlamaService';
import { ChatScreen } from './src/screens/ChatScreen';
import { LoadingScreen } from './src/screens/LoadingScreen';

type Phase =
  | { kind: 'selecting' }
  | { kind: 'downloading'; model: ModelSpec; usedFallback: boolean; progress: number }
  | { kind: 'loading'; model: ModelSpec; usedFallback: boolean; progress: number }
  | { kind: 'ready'; model: ModelSpec; usedFallback: boolean }
  | { kind: 'error'; message: string };

function formatGB(bytes: number): string {
  return `${(bytes / 1e9).toFixed(1)}GB`;
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>({ kind: 'selecting' });

  const boot = useCallback(async () => {
    try {
      setPhase({ kind: 'selecting' });
      const { model, usedFallback } = await ModelManager.pickModel();

      setPhase({ kind: 'downloading', model, usedFallback, progress: 0 });
      const path = await ModelManager.ensureDownloaded(model, p => {
        setPhase({
          kind: 'downloading',
          model,
          usedFallback,
          progress: p.fraction,
        });
      });

      setPhase({ kind: 'loading', model, usedFallback, progress: 0 });
      await LlamaService.init(path, fraction => {
        setPhase({ kind: 'loading', model, usedFallback, progress: fraction });
      });

      setPhase({ kind: 'ready', model, usedFallback });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setPhase({ kind: 'error', message });
    }
  }, []);

  useEffect(() => {
    boot();
    return () => {
      LlamaService.release();
    };
  }, [boot]);

  let body: React.ReactNode;
  switch (phase.kind) {
    case 'selecting':
      body = <LoadingScreen title="Checking your device…" />;
      break;
    case 'downloading':
      body = (
        <LoadingScreen
          title={`Downloading ${phase.model.name}`}
          subtitle={
            `${formatGB(phase.model.sizeBytes)} · one-time download` +
            (phase.usedFallback
              ? '\nSmaller model chosen to fit this device’s memory.'
              : '')
          }
          progress={phase.progress}
        />
      );
      break;
    case 'loading':
      body = (
        <LoadingScreen
          title={`Loading ${phase.model.name}…`}
          subtitle="Warming up the model on-device"
          progress={phase.progress}
        />
      );
      break;
    case 'ready':
      body = <ChatScreen modelName={phase.model.name} />;
      break;
    case 'error':
      body = (
        <LoadingScreen
          title="Something went wrong"
          error={phase.message}
          onRetry={boot}
        />
      );
      break;
  }

  // Only the top inset is applied app-wide; the chat screen manages its own
  // bottom inset so the keyboard-avoiding input sits correctly above the keyboard.
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>{body}</View>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
});

export default App;
