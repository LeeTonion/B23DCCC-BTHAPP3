import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../theme/colors';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'danger';
  style?: StyleProp<ViewStyle>;
}

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  style,
}: AppButtonProps) {
  const isDanger = variant === 'danger';
  const bgColor = isDanger ? colors.danger : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bgColor,
          shadowColor: bgColor,
          opacity: pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}>
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 15,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
