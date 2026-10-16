import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useData } from '@/data/DataProvider';
import { deleteCategory, runWrite, saveCategory, updateSettings } from '@/data/repo';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/defaults';
import type { CategoryKind } from '@/types';
import { Button, Field, IconBadge, Input, Screen, type IconName } from '@/ui/components';
import { colors } from '@/ui/theme';

export default function CategoryEditScreen() {
  const params = useLocalSearchParams<{ id: string; kind?: CategoryKind }>();
  const { uid, categories, settings } = useData();
  const existing = categories.find((c) => c.id === params.id) ?? null;
  const kind: CategoryKind = existing?.kind ?? (params.kind === 'income' ? 'income' : 'expense');

  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? 'ellipsis-horizontal');
  const [color, setColor] = useState(existing?.color ?? CATEGORY_COLORS[0]);

  function save() {
    if (!name.trim()) {
      Alert.alert('カテゴリ名を入力してください');
      return;
    }
    runWrite(
      saveCategory(uid, {
        id: existing?.id,
        name: name.trim(),
        kind,
        icon,
        color,
        sortOrder: existing?.sortOrder ?? categories.filter((c) => c.kind === kind).length,
      }),
    );
    router.back();
  }

  function remove() {
    if (!existing) return;
    Alert.alert(`「${existing.name}」を削除しますか？`, '過去の取引は「未分類」として表示されます。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          runWrite(deleteCategory(uid, existing.id));
          if (settings.widgetCategoryIds.includes(existing.id)) {
            runWrite(
              updateSettings(uid, { widgetCategoryIds: settings.widgetCategoryIds.filter((id) => id !== existing.id) }),
            );
          }
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen>
      <Stack.Screen
        options={{ title: `${kind === 'expense' ? '支出' : '収入'}カテゴリを${existing ? '編集' : '追加'}` }}
      />
      <View style={styles.preview}>
        <IconBadge icon={icon} color={color} size={64} />
      </View>
      <Field label="名前">
        <Input value={name} onChangeText={setName} placeholder="例：カフェ" autoFocus={!existing} />
      </Field>
      <Field label="色">
        <View style={styles.grid}>
          {CATEGORY_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[styles.colorDot, { backgroundColor: c }, c === color && styles.selectedDot]}
              accessibilityLabel={`色 ${c}`}
            />
          ))}
        </View>
      </Field>
      <Field label="アイコン">
        <View style={styles.grid}>
          {CATEGORY_ICONS.map((i) => (
            <Pressable
              key={i}
              onPress={() => setIcon(i)}
              style={[styles.iconCell, i === icon && { backgroundColor: `${color}33` }]}
              accessibilityLabel={`アイコン ${i}`}
            >
              <Ionicons name={i as IconName} size={22} color={i === icon ? color : colors.subText} />
            </Pressable>
          ))}
        </View>
      </Field>
      <Button title="保存する" onPress={save} />
      {existing ? <Button title="削除する" variant="danger" onPress={remove} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: { width: 34, height: 34, borderRadius: 17 },
  selectedDot: { borderWidth: 3, borderColor: colors.text },
  iconCell: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
