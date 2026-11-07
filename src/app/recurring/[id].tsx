import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useData } from '@/data/DataProvider';
import { deleteRecurring, saveRecurring } from '@/data/repo';
import { addMonths, currentMonth, today } from '@/lib/date';
import { parseAmount } from '@/lib/money';
import type { RecurringItem } from '@/types';
import { Button, Chip, ChipRow, Field, Input, Screen, Segmented } from '@/ui/components';
import { confirmAsync, notify } from '@/ui/dialog';
import { colors } from '@/ui/theme';

/** 新しく登録したものは、次にその日が来たときから記録する（今月の分が過ぎていれば来月から） */
function firstMonth(dayOfMonth: number): string {
  const day = Number(today().slice(8, 10));
  return dayOfMonth >= day ? currentMonth() : addMonths(currentMonth(), 1);
}

export default function RecurringEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recurring, categories, accounts, settings } = useData();
  const existing = recurring.find((r) => r.id === id) ?? null;

  const [kind, setKind] = useState<RecurringItem['kind']>(existing?.kind ?? 'expense');
  const [name, setName] = useState(existing?.name ?? '');
  const [amountText, setAmountText] = useState(existing ? String(existing.amount) : '');
  const [dayText, setDayText] = useState(existing ? String(existing.dayOfMonth) : '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? null);
  const [accountId, setAccountId] = useState(existing?.accountId ?? settings.defaultAccountId);
  const kindCategories = categories.filter((c) => c.kind === kind);

  function save() {
    const amount = parseAmount(amountText);
    const day = parseAmount(dayText);
    if (!name.trim()) return notify('名前を入力してください');
    if (!amount) return notify('金額を入力してください');
    if (!day || day < 1 || day > 31) return notify('毎月何日かを 1〜31 で入力してください');
    const category = kindCategories.some((c) => c.id === categoryId) ? categoryId : (kindCategories[0]?.id ?? null);
    saveRecurring({
      id: existing?.id,
      name: name.trim(),
      kind,
      amount,
      dayOfMonth: day,
      categoryId: category,
      accountId,
      startMonth: existing?.startMonth ?? firstMonth(day),
      lastPostedMonth: existing?.lastPostedMonth ?? null,
    });
    router.back();
  }

  async function remove() {
    if (!existing || !(await confirmAsync(`「${existing.name}」を削除しますか？`, 'これまでに記録した取引は残ります。'))) return;
    deleteRecurring(existing.id);
    router.back();
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? '毎月の項目を編集' : '毎月の項目を追加' }} />
      <Text style={styles.caption}>
        給料・家賃・スマホ代・サブスクなど、レシートの出ないお金を登録すると、毎月その日に自動で記録します。金額はだいたいで大丈夫です（ずれは残高チェックで合います）。
      </Text>
      <Segmented
        options={[
          { value: 'expense', label: '支出', color: colors.expense },
          { value: 'income', label: '収入', color: colors.income },
        ]}
        value={kind}
        onChange={setKind}
      />
      <Field label="名前">
        <Input value={name} onChangeText={setName} placeholder={kind === 'income' ? '例：給料' : '例：家賃'} />
      </Field>
      <Field label="金額（円）">
        <Input value={amountText} onChangeText={setAmountText} keyboardType="number-pad" placeholder="例：70000" />
      </Field>
      <Field label="毎月何日">
        <Input value={dayText} onChangeText={setDayText} keyboardType="number-pad" placeholder="例：25（31 なら月末）" />
      </Field>
      <Field label="カテゴリ">
        <ChipRow>
          {kindCategories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              icon={c.icon}
              color={c.color}
              selected={c.id === categoryId}
              onPress={() => setCategoryId(c.id)}
            />
          ))}
        </ChipRow>
      </Field>
      <Field label={kind === 'income' ? '入金される口座' : '支払う口座'}>
        <ChipRow>
          {accounts.map((a) => (
            <Chip key={a.id} label={a.name} selected={a.id === accountId} onPress={() => setAccountId(a.id)} />
          ))}
        </ChipRow>
      </Field>
      <Button title="保存する" onPress={save} />
      {existing ? <Button title="削除する" variant="danger" onPress={remove} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 13, color: colors.subText, lineHeight: 19 },
});
