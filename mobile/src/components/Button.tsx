import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';

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
  const getButtonStyle = (): any[] => {
    const baseStyle: any[] = [styles.button];

    if (variant === 'primary') baseStyle.push(styles.primary);
    if (variant === 'secondary') baseStyle.push(styles.secondary);
    if (variant === 'danger') baseStyle.push(styles.danger);
    if (variant === 'outline') baseStyle.push(styles.outline);
    if (disabled || loading) baseStyle.push(styles.disabled);

    return baseStyle;
  };

  const getTextStyle = (): any[] => {
    const baseStyle: any[] = [styles.text];
    if (variant === 'outline') baseStyle.push(styles.outlineText);
    return baseStyle;
  };

  return (
    <Pressable
      style={({ pressed }) => [
        ...getButtonStyle(),
        style,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={getTextStyle()}>{title}</Text>
      )}
    </Pressable>
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
    cursor: 'pointer',
  },
  pressed: {
    opacity: 0.7,
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
