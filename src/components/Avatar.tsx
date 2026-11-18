import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

const palette = [
  { bg: '#EEF2FF', ink: '#4F46E5', ring: '#C7D2FE' },
  { bg: '#ECFDF5', ink: '#059669', ring: '#A7F3D0' },
  { bg: '#FFF1F2', ink: '#E11D48', ring: '#FECDD3' },
  { bg: '#FAF5FF', ink: '#9333EA', ring: '#E9D5FF' },
  { bg: '#FFFBEB', ink: '#D97706', ring: '#FDE68A' },
  { bg: '#F0FDF4', ink: '#16A34A', ring: '#BBF7D0' },
  { bg: '#EFF6FF', ink: '#2563EB', ring: '#BFDBFE' },
];

interface Props {
  name: string;
  avatarUrl?: string;
  size?: number;
  online?: boolean;
  label?: string;
}

export function Avatar({
  name,
  avatarUrl,
  size = 48,
  online = false,
  label,
}: Props) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = (
    words.length > 1
      ? words[0][0] + words[words.length - 1][0]
      : words[0]?.slice(0, 2) || '?'
  ).toUpperCase();
  const hash = Array.from(name).reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const tint = palette[hash % palette.length];

  return (
    <View
      accessible
      accessibilityLabel={label || `${name}${online ? ', đang hoạt động' : ''}`}
      style={{ width: size, height: size }}
    >
      <View
        style={[
          styles.avatar,
          {
            height: size,
            width: size,
            borderRadius: size / 2,
            backgroundColor: tint.bg,
            borderColor: tint.ring,
            borderWidth: 1.5,
            overflow: 'hidden',
          },
        ]}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: size, height: size }}
          />
        ) : (
          <Text
            style={[
              styles.letters,
              {
                fontSize: size * (letters.length > 1 ? 0.34 : 0.42),
                color: tint.ink,
              },
            ]}
          >
            {letters}
          </Text>
        )}
      </View>
      {online && (
        <View
          style={[
            styles.dot,
            {
              width: Math.max(13, size * 0.28),
              height: Math.max(13, size * 0.28),
              borderRadius: size,
              borderWidth: size > 40 ? 2.5 : 2,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  letters: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: colors.success,
    borderColor: '#FFFFFF',
    elevation: 3,
  },
});
