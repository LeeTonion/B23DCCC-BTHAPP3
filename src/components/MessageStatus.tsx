import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import { Avatar } from './Avatar';
import { timeLabel } from '../services/chat';
import { deliveryLabels, type DeliveryState } from '../services/delivery';
import { colors } from '../theme/colors';

interface Props {
  state: DeliveryState;
  peerName: string;
  peerAvatarUrl?: string;
  seenAt?: number;
  compact?: boolean;
  showAvatar?: boolean;
}

export function MessageStatus({
  state,
  peerName,
  peerAvatarUrl,
  seenAt,
  compact = false,
  showAvatar = true,
}: Props) {
  const color = state === 'failed' ? colors.danger : colors.textMuted;
  const labelText =
    state === 'seen' && seenAt
      ? `Đã xem · ${timeLabel(seenAt)}`
      : deliveryLabels[state];

  return (
    <View accessible accessibilityLabel={labelText} style={styles.row}>
      {state === 'sending' ? (
        <ActivityIndicator size="small" color={color} />
      ) : state === 'seen' && showAvatar ? (
        <Avatar
          name={peerName}
          avatarUrl={peerAvatarUrl}
          size={compact ? 19 : 17}
          label={`${peerName} đã xem`}
        />
      ) : (
        <Ionicons
          name={
            state === 'failed'
              ? 'alert-circle'
              : state === 'seen'
              ? 'checkmark-circle'
              : 'checkmark-circle-outline'
          }
          size={compact ? 19 : 15}
          color={state === 'seen' ? colors.primary : color}
        />
      )}
      {!compact && <Text style={[styles.label, { color }]}>{labelText}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    minHeight: 20,
  },
  label: { fontSize: 11, lineHeight: 16 },
});
