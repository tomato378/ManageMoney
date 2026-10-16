import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatYen } from '@/lib/money';
import { colors, radius, spacing } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  if (!scroll) return <View style={[styles.screen, styles.screenContent]}>{children}</View>;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.screenContent, { paddingBottom: insets.bottom + 96 }]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Loading() {
  return (
    <View style={[styles.screen, styles.center]}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionTitleText}>{title}</Text>
      {action}
    </View>
  );
}

export function Amount({
  value,
  size = 16,
  color,
  signed = false,
}: {
  value: number;
  size?: number;
  color?: string;
  /** 正の数に + を付ける */
  signed?: boolean;
}) {
  const text = signed && value > 0 ? `+${formatYen(value)}` : formatYen(value);
  return (
    <Text style={{ fontSize: size, fontWeight: '700', color: color ?? colors.text, fontVariant: ['tabular-nums'] }}>
      {text}
    </Text>
  );
}

export function ProgressBar({ ratio, color = colors.primary }: { ratio: number; color?: string }) {
  const over = ratio > 1;
  const width = `${Math.min(1, Math.max(0, ratio)) * 100}%` as const;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width, backgroundColor: over ? colors.danger : color }]} />
    </View>
  );
}

export function IconBadge({ icon, color, size = 36 }: { icon: string; color: string; size?: number }) {
  return (
    <View
      style={[styles.iconBadge, { width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}22` }]}
    >
      <Ionicons name={icon as IconName} size={size * 0.55} color={color} />
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color = colors.primary,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
  icon?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: color, borderColor: color }]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {icon ? <Ionicons name={icon as IconName} size={16} color={selected ? '#FFFFFF' : color} /> : null}
      <Text style={[styles.chipText, selected && { color: '#FFFFFF' }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; color?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && { backgroundColor: option.color ?? colors.primary }]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.segmentText, selected && { color: '#FFFFFF' }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.subText} {...props} style={[styles.input, props.style]} />;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}) {
  const background = variant === 'primary' ? colors.primary : colors.card;
  const textColor = variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        variant !== 'primary' && styles.buttonOutline,
        variant === 'danger' && { borderColor: colors.danger },
      ]}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Fab({ onPress, label = '追加' }: { onPress: () => void; label?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 16, opacity: pressed ? 0.85 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name="add" size={30} color="#FFFFFF" />
    </Pressable>
  );
}

export function Row({
  left,
  title,
  subtitle,
  right,
  onPress,
}: {
  left?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      {left}
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

export function Empty({ message }: { message: string }) {
  return <Text style={styles.empty}>{message}</Text>;
}

export function TextLink({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
      <Text style={styles.link}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { padding: spacing.lg, gap: spacing.md },
  center: { alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitleText: { fontSize: 15, fontWeight: '700', color: colors.text },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  iconBadge: { alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipText: { fontSize: 14, color: colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  segmented: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center' },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.text },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.subText },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  button: { borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  buttonOutline: { borderWidth: 1, borderColor: colors.border },
  buttonText: { fontSize: 16, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 15, color: colors.text },
  rowSubtitle: { fontSize: 12, color: colors.subText, marginTop: 2 },
  empty: { color: colors.subText, textAlign: 'center', paddingVertical: spacing.lg },
  link: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
