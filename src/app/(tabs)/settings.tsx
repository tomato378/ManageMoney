import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { useData } from '@/data/DataProvider';
import { updateSettings } from '@/data/repo';
import type { CategoryKind } from '@/types';
import { BackupCard } from '@/ui/BackupCard';
import { Card, Chip, ChipRow, IconBadge, Row, Screen, SectionTitle, TextLink } from '@/ui/components';
import { notify } from '@/ui/dialog';
import { colors } from '@/ui/theme';

const MAX_QUICK_BUTTONS = 4;

export default function SettingsScreen() {
  const { categories, accounts, settings } = useData();
  const expenseCategories = categories.filter((c) => c.kind === 'expense');

  function toggleQuickCategory(id: string) {
    const current = settings.quickCategoryIds;
    if (current.includes(id)) {
      updateSettings({ quickCategoryIds: current.filter((c) => c !== id) });
    } else if (current.length >= MAX_QUICK_BUTTONS) {
      notify(`クイック入力に置けるのは${MAX_QUICK_BUTTONS}つまでです`, 'どれかを外してから選んでください');
    } else {
      updateSettings({ quickCategoryIds: [...current, id] });
    }
  }

  return (
    <Screen>
      <BackupCard />

      <Card>
        <SectionTitle title="ホームのクイック入力ボタン" />
        <Text style={styles.caption}>
          ホーム画面のボタンに出す支出カテゴリ（{settings.quickCategoryIds.length}/{MAX_QUICK_BUTTONS}
          ）。押すとそのカテゴリを選んだ状態で入力画面が開きます。
        </Text>
        <ChipRow>
          {expenseCategories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              icon={c.icon}
              color={c.color}
              selected={settings.quickCategoryIds.includes(c.id)}
              onPress={() => toggleQuickCategory(c.id)}
            />
          ))}
        </ChipRow>
      </Card>

      <Card>
        <SectionTitle title="入力時のデフォルト口座" />
        <ChipRow>
          <Chip
            label="指定しない"
            selected={settings.defaultAccountId === null}
            onPress={() => updateSettings({ defaultAccountId: null })}
          />
          {accounts.map((a) => (
            <Chip
              key={a.id}
              label={a.name}
              selected={a.id === settings.defaultAccountId}
              onPress={() => updateSettings({ defaultAccountId: a.id })}
            />
          ))}
        </ChipRow>
      </Card>

      {(['expense', 'income'] as CategoryKind[]).map((kind) => (
        <Card key={kind}>
          <SectionTitle
            title={kind === 'expense' ? '支出カテゴリ' : '収入カテゴリ'}
            action={
              <TextLink
                title="＋ 追加"
                onPress={() => router.push({ pathname: '/category/[id]', params: { id: 'new', kind } })}
              />
            }
          />
          {categories
            .filter((c) => c.kind === kind)
            .map((c) => (
              <Row
                key={c.id}
                left={<IconBadge icon={c.icon} color={c.color} size={30} />}
                title={c.name}
                onPress={() => router.push({ pathname: '/category/[id]', params: { id: c.id } })}
              />
            ))}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 13, color: colors.subText, lineHeight: 19 },
});
