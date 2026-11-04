import { StyleSheet, Text, View } from 'react-native';
import type { ChatMessage } from '../data/chats';
import { colors } from '../theme/colors';

export function ChatBubble({ message }: { message: ChatMessage }) {
  const isMe = message.fromMe;

  return (
    <View
      style={[
        styles.bubble,
        isMe ? styles.bubbleOut : styles.bubbleIn,
      ]}>
      <Text style={isMe ? styles.textOut : styles.textIn}>
        {message.text}
      </Text>
      <Text style={isMe ? styles.timeOut : styles.timeIn}>
        {message.time}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    borderRadius: 18,
    marginBottom: 8,
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  bubbleIn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bubbleOut: {
    alignSelf: 'flex-end',
    backgroundColor: colors.bubbleOut,
    borderTopRightRadius: 4,
  },
  textIn: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  textOut: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 21,
  },
  timeIn: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  timeOut: {
    color: '#E0E7FF',
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
});
