import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

const palette = [
  { bg: '#082F49', ink: '#38BDF8', ring: '#00F0FF' }, // Neon Cyan
  { bg: '#2E1065', ink: '#C084FC', ring: '#A855F7' }, // Neon Purple
  { bg: '#064E3B', ink: '#34D399', ring: '#00FF9D' }, // Neon Mint
  { bg: '#4C0519', ink: '#FB7185', ring: '#FF0055' }, // Neon Pink
  { bg: '#451A03', ink: '#FBBF24', ring: '#F59E0B' }, // Neon Amber
  { bg: '#1E1B4B', ink: '#818CF8', ring: '#6366F1' }, // Neon Indigo
];

interface Props {
  name: string;
  size?: number;
  online?: boolean;
  label?: string;
}

export function Avatar({ name, size = 48, online = false, label }: Props) {
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
            shadowColor: tint.ring,
          },
        ]}
      >
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
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 3,
  },
  letters: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: colors.success,
    borderColor: '#090D16',
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
});
