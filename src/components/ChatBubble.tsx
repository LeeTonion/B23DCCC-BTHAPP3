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
    paddingHorizontal: 15,
    paddingVertical: 10,
    elevation: 2,
  },
  bubbleIn: {
    alignSelf: 'flex-start',
    backgroundColor: '#131D2E',
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#1E2F4D',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  bubbleOut: {
    alignSelf: 'flex-end',
    backgroundColor: colors.bubbleOut,
    borderTopRightRadius: 4,
    shadowColor: colors.bubbleOut,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  textIn: {
    color: '#F8FAFC',
    fontSize: 15,
    lineHeight: 21,
  },
  textOut: {
    color: '#060A12',
    fontWeight: '600',
    fontSize: 15,
    lineHeight: 21,
  },
  timeIn: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  timeOut: {
    color: '#0A3342',
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
    alignSelf: 'flex-end',
  },
});
