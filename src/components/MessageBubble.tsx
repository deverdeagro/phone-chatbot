import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { ChatMessage } from '../llm/types';
import { colors, radius, shadow, space } from '../theme';

const ICON = require('../assets/icon.png');

type Props = {
  message: ChatMessage;
  /** Show a typing indicator while this assistant message is still streaming. */
  streaming?: boolean;
};

function MessageBubbleComponent({ message, streaming }: Props) {
  const isUser = message.role === 'user';
  const waiting = streaming && !message.content;

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Image source={ICON} style={styles.avatarImg} resizeMode="cover" />
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}>
        {waiting ? (
          <View style={styles.typing}>
            <View style={[styles.dot, styles.dot1]} />
            <View style={[styles.dot, styles.dot2]} />
            <View style={[styles.dot, styles.dot3]} />
          </View>
        ) : (
          <Text style={isUser ? styles.textUser : styles.textAssistant}>
            {message.content}
            {streaming && message.content ? (
              <Text style={styles.caret}>▍</Text>
            ) : null}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: space(1.5),
    paddingHorizontal: space(3),
  },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    marginRight: space(2),
    overflow: 'hidden',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarImg: { width: '100%', height: '100%' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: space(3.5),
    paddingVertical: space(2.5),
    ...shadow(1),
  },
  bubbleUser: {
    backgroundColor: colors.userBubble,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.sm,
  },
  bubbleAssistant: {
    backgroundColor: colors.assistantBubble,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    borderBottomLeftRadius: radius.sm,
  },
  textUser: { color: colors.onPrimary, fontSize: 16, lineHeight: 23 },
  textAssistant: { color: colors.text, fontSize: 16, lineHeight: 23 },
  caret: { color: colors.primary, fontWeight: '700' },
  typing: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.textMuted,
    marginHorizontal: 2,
  },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.7 },
  dot3: { opacity: 1 },
});

export const MessageBubble = React.memo(MessageBubbleComponent);
