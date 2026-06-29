import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import { colors, radius, shadow, space } from '../theme';

const ICON = require('../assets/icon.png');

type Props = {
  /** Name of the model that was loaded, shown in the header. */
  modelName: string;
};

const SUGGESTIONS = [
  'Summarize https://en.wikipedia.org/wiki/Llama_(language_model)',
  'Any recent emails about invoices?',
  'Explain how on-device AI works',
];

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
          m.id === assistantMsg.id ? { ...m, content: `⚠️ ${msg}` } : m,
        ),
      );
      setStatusLine(null);
    } finally {
      setGenerating(false);
      scrollToEnd();
    }
  }, [input, generating, messages, scrollToEnd]);

  const canSend = !!input.trim() && !generating;
  const subtitle = generating
    ? statusLine ?? 'Thinking…'
    : `${modelName}${statusLine ? `  ·  ${statusLine}` : ''}`;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <View style={styles.header}>
        <View style={styles.brand}>
          <Image source={ICON} style={styles.brandIcon} resizeMode="cover" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Phone Assistant</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: generating ? colors.primary : colors.success },
              ]}
            />
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.gmailBtn, gmailConnected && styles.gmailBtnOn]}
          onPress={() => setGmailOpen(true)}>
          <View
            style={[
              styles.gmailDot,
              { backgroundColor: gmailConnected ? colors.success : colors.textMuted },
            ]}
          />
          <Text
            style={[styles.gmailBtnText, gmailConnected && styles.gmailBtnTextOn]}>
            {gmailConnected ? 'Gmail' : 'Connect'}
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
        keyboardDismissMode="interactive"
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyLogoWrap}>
              <Image source={ICON} style={styles.emptyLogo} resizeMode="cover" />
            </View>
            <Text style={styles.emptyTitle}>How can I help?</Text>
            <Text style={styles.emptySubtitle}>
              I run entirely on your phone — and I can search your Gmail or read a
              link when you need.
            </Text>
            <View style={styles.chips}>
              {SUGGESTIONS.map(s => (
                <TouchableOpacity
                  key={s}
                  activeOpacity={0.7}
                  style={styles.chip}
                  onPress={() => setInput(s)}>
                  <Text style={styles.chipText} numberOfLines={1}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
      />

      <View
        style={[
          styles.inputBar,
          { paddingBottom: keyboardVisible ? space(2) : insets.bottom + space(2) },
        ]}>
        <View style={styles.inputPill}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message Phone Assistant…"
            placeholderTextColor={colors.textMuted}
            multiline
            editable={!generating}
          />
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
          onPress={onSend}
          disabled={!canSend}>
          {generating ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Text style={[styles.sendIcon, !canSend && styles.sendIconDisabled]}>
              ↑
            </Text>
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
  flex: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space(4),
    paddingVertical: space(2.5),
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    ...shadow(1),
  },
  brand: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.primarySoft,
    marginRight: space(3),
  },
  brandIcon: { width: '100%', height: '100%' },
  headerText: { flex: 1 },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    marginRight: 6,
  },
  headerSubtitle: { fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
  gmailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space(3),
    paddingVertical: space(2),
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    marginLeft: space(2),
  },
  gmailBtnOn: { backgroundColor: colors.successSoft },
  gmailDot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    marginRight: 6,
  },
  gmailBtnText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  gmailBtnTextOn: { color: colors.success },
  listContent: { paddingVertical: space(3), flexGrow: 1 },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space(7),
  },
  emptyLogoWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: space(5),
    backgroundColor: colors.primarySoft,
    ...shadow(2),
  },
  emptyLogo: { width: '100%', height: '100%' },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: space(2),
    lineHeight: 20,
  },
  chips: { width: '100%', marginTop: space(6) },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    marginBottom: space(2.5),
  },
  chipText: { color: colors.text, fontSize: 14, fontWeight: '500' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: space(3),
    paddingTop: space(2),
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  inputPill: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    paddingHorizontal: space(4),
    minHeight: 46,
    maxHeight: 130,
    justifyContent: 'center',
  },
  input: {
    fontSize: 16,
    color: colors.text,
    paddingTop: space(2.5),
    paddingBottom: space(2.5),
    margin: 0,
  },
  sendBtn: {
    marginLeft: space(2),
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(2),
  },
  sendBtnDisabled: {
    backgroundColor: colors.surfaceAlt,
    ...Platform_noShadow(),
  },
  sendIcon: {
    color: colors.onPrimary,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
    marginTop: -1,
  },
  sendIconDisabled: { color: colors.textMuted },
});

/** Disabled send button shouldn't cast a shadow. */
function Platform_noShadow() {
  return { elevation: 0, shadowOpacity: 0 };
}
