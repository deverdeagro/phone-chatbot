import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageBubble } from '../components/MessageBubble';
import { LlamaService } from '../llm/LlamaService';
import type { ChatMessage } from '../llm/types';
import { GmailConnectModal } from '../skills/gmail/GmailConnectModal';
import { getGmailCredentials } from '../skills/gmail/credentials';

type Props = {
  /** Name of the model that was loaded, shown in the header. */
  modelName: string;
};

let idCounter = 0;
const nextId = () => `m${++idCounter}`;

export function ChatScreen({ modelName }: Props) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [gmailOpen, setGmailOpen] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Reflect whether Gmail is already connected (controls the header indicator).
  useEffect(() => {
    getGmailCredentials().then(creds => setGmailConnected(!!creds));
  }, []);

  // Collapse the input's bottom (nav-bar) inset while the keyboard is up so the
  // input sits flush above the keyboard, the way WhatsApp/Messages do it.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () =>
      setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const onSend = useCallback(async () => {
    const text = input.trim();
    if (!text || generating) {
      return;
    }

    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: text };
    const assistantMsg: ChatMessage = {
      id: nextId(),
      role: 'assistant',
      content: '',
    };

    // History sent to the model excludes the empty placeholder we render for streaming.
    const history = [...messages, userMsg];
    setMessages([...history, assistantMsg]);
    setInput('');
    setGenerating(true);
    setStatusLine('Thinking…');
    scrollToEnd();

    try {
      const result = await LlamaService.chat(history, {
        onToken: partial => {
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsg.id ? { ...m, content: partial } : m,
            ),
          );
          scrollToEnd();
        },
        onStatus: status => setStatusLine(status ?? 'Thinking…'),
      });

      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsg.id ? { ...m, content: result.text } : m,
        ),
      );
      setStatusLine(
        result.tokensPerSecond
          ? `${result.tokensPerSecond.toFixed(1)} tok/s`
          : null,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsg.id
            ? { ...m, content: `⚠️ ${msg}` }
            : m,
        ),
      );
      setStatusLine(null);
    } finally {
      setGenerating(false);
      scrollToEnd();
    }
  }, [input, generating, messages, scrollToEnd]);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>On-Device Chat</Text>
          <Text style={styles.headerSubtitle}>
            {modelName}
            {statusLine ? `  ·  ${statusLine}` : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.gmailBtn, gmailConnected && styles.gmailBtnOn]}
          onPress={() => setGmailOpen(true)}>
          <Text
            style={[
              styles.gmailBtnText,
              gmailConnected && styles.gmailBtnTextOn,
            ]}>
            {gmailConnected ? '✓ Gmail' : 'Connect Gmail'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <MessageBubble
            message={item}
            streaming={
              generating &&
              item.role === 'assistant' &&
              index === messages.length - 1
            }
          />
        )}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={scrollToEnd}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Ask anything — everything runs locally on your phone.
          </Text>
        }
      />

      <View
        style={[
          styles.inputRow,
          { paddingBottom: keyboardVisible ? 8 : insets.bottom + 8 },
        ]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message…"
          placeholderTextColor="#9ca3af"
          multiline
          editable={!generating}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (generating || !input.trim()) && styles.sendBtnDisabled]}
          onPress={onSend}
          disabled={generating || !input.trim()}>
          {generating ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.sendBtnText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>

      <GmailConnectModal
        visible={gmailOpen}
        onClose={() => setGmailOpen(false)}
        onConnectedChange={setGmailConnected}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  headerSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  gmailBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  gmailBtnOn: { backgroundColor: '#ecfdf5', borderColor: '#059669' },
  gmailBtnText: { color: '#2563eb', fontSize: 13, fontWeight: '600' },
  gmailBtnTextOn: { color: '#059669' },
  listContent: { paddingVertical: 12, flexGrow: 1 },
  empty: {
    textAlign: 'center',
    color: '#9ca3af',
    marginTop: 40,
    paddingHorizontal: 24,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d1d5db',
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    backgroundColor: '#f3f4f6',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    color: '#111827',
  },
  sendBtn: {
    marginLeft: 8,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#9ca3af' },
  sendBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 16 },
});
