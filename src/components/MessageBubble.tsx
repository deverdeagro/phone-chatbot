import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ChatMessage } from '../llm/types';

type Props = {
  message: ChatMessage;
  streaming?: boolean;
};

function MessageBubbleComponent({ message, streaming }: Props) {
  const isUser = message.role === 'user';
  return (
    <View
      style={[
        styles.row,
        isUser ? styles.rowUser : styles.rowAssistant,
      ]}>
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}>
        <Text style={isUser ? styles.textUser : styles.textAssistant}>
          {message.content}
          {streaming && !message.content ? '…' : ''}
          {streaming && message.content ? '▌' : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 12,
  },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: { backgroundColor: '#2563eb', borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: '#e5e7eb', borderBottomLeftRadius: 4 },
  textUser: { color: '#ffffff', fontSize: 16 },
  textAssistant: { color: '#111827', fontSize: 16 },
});

export const MessageBubble = React.memo(MessageBubbleComponent);
