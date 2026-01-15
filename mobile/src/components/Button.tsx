import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  style?: any;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}) => {
  const getButtonStyle = () => {
    const baseStyle = [styles.button];

    if (variant === 'primary') baseStyle.push(styles.primary);
    if (variant === 'secondary') baseStyle.push(styles.secondary);
    if (variant === 'danger') baseStyle.push(styles.danger);
    if (variant === 'outline') baseStyle.push(styles.outline);
    if (disabled || loading) baseStyle.push(styles.disabled);

    return baseStyle;
  };

  const getTextStyle = () => {
    const baseStyle = [styles.text];
    if (variant === 'outline') baseStyle.push(styles.outlineText);
    return baseStyle;
  };

  return (
    <TouchableOpacity
      style={[...getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={getTextStyle()}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primary: {
    backgroundColor: '#2563eb',
  },
  secondary: {
    backgroundColor: '#64748b',
  },
  danger: {
    backgroundColor: '#dc2626',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  outlineText: {
    color: '#2563eb',
  },
});
