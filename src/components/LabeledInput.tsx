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
        placeholderTextColor="#475569"
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
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 7,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  labelFocused: {
    color: colors.primary,
  },
  input: {
    backgroundColor: '#0C1220',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    color: '#FFFFFF',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: '#0F1829',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 4,
  },
});
