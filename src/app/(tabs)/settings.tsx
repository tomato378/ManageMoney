import { signOut } from '@react-native-firebase/auth';
import { router } from 'expo-router';
import { Alert, StyleSheet, Text } from 'react-native';

import { useAuth } from '@/data/AuthProvider';
import { useData } from '@/data/DataProvider';
import { runWrite, updateSettings } from '@/data/repo';
import { auth } from '@/lib/firebase';
import type { CategoryKind } from '@/types';
import { saveWidgetSummary } from '@/widget/cache';
import { Button, Card, Chip, ChipRow, IconBadge, Row, Screen, SectionTitle, TextLink } from '@/ui/components';
import { colors } from '@/ui/theme';

const MAX_WIDGET_BUTTONS = 4;

export default function SettingsScreen() {
  const { user } = useAuth();
  const { uid, categories, accounts, settings } = useData();
  const expenseCategories = categories.filter((c) => c.kind === 'expense');

  function toggleWidgetCategory(id: string) {
    const current = settings.widgetCategoryIds;
    if (current.includes(id)) {
      runWrite(updateSettings(uid, { widgetCategoryIds: current.filter((c) => c !== id) }));
    } else if (current.length >= MAX_WIDGET_BUTTONS) {
      Alert.alert(`ウィジェットに置けるのは${MAX_WIDGET_BUTTONS}つまでです`, 'どれかを外してから選んでください');
    } else {
      runWrite(updateSettings(uid, { widgetCategoryIds: [...current, id] }));
    }
  }

  function logout() {
    Alert.alert('ログアウトしますか？', undefined, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'ログアウト',
        style: 'destructive',
        onPress: async () => {
          await saveWidgetSummary(null);
          await signOut(auth);
        },
      },
    ]);
  }

  return (
    <Screen>
      <Card>
        <SectionTitle title="ホーム画面ウィジェット" />
        <Text style={styles.caption}>
          ボタンに表示する支出カテゴリ（{settings.widgetCategoryIds.length}/{MAX_WIDGET_BUTTONS}）。ホーム画面を長押し →
          「ウィジェット」→「ManageMoney クイック入力」で追加できます。
        </Text>
        <ChipRow>
          {expenseCategories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              icon={c.icon}
              color={c.color}
              selected={settings.widgetCategoryIds.includes(c.id)}
              onPress={() => toggleWidgetCategory(c.id)}
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
            onPress={() => runWrite(updateSettings(uid, { defaultAccountId: null }))}
          />
          {accounts.map((a) => (
            <Chip
              key={a.id}
              label={a.name}
              selected={a.id === settings.defaultAccountId}
              onPress={() => runWrite(updateSettings(uid, { defaultAccountId: a.id }))}
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

      <Card>
        <SectionTitle title="アカウント" />
        <Text style={styles.caption}>{user?.email}</Text>
        <Button title="ログアウト" variant="secondary" onPress={logout} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 13, color: colors.subText, lineHeight: 19 },
});
