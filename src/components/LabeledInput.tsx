import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { colors } from '../theme/colors';

interface LabeledInputProps extends TextInputProps {
  label: string;
}

export function LabeledInput({
  label,
  style,
  onFocus,
  onBlur,
  ...rest
}: LabeledInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        onFocus={e => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={e => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          focused && styles.inputFocused,
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  labelFocused: {
    color: colors.primary,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 13,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: '#FFFFFF',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
});
