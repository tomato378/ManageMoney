import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useData } from '@/data/DataProvider';
import { deleteBudget, runWrite, saveBudget } from '@/data/repo';
import { parseAmount } from '@/lib/money';
import { TOTAL_BUDGET_ID } from '@/types';
import { Button, Chip, ChipRow, Field, Input, Screen } from '@/ui/components';
import { notify } from '@/ui/dialog';

export default function BudgetEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { uid, budgets, categories } = useData();
  const existing = budgets.find((b) => b.id === id) ?? null;
  const expenseCategories = categories.filter((c) => c.kind === 'expense');
  // ほかの予算で使っている対象は選べない（1対象1予算）
  const taken = new Set(budgets.filter((b) => b.id !== existing?.id).map((b) => b.id));
  const firstFree = taken.has(TOTAL_BUDGET_ID) ? (expenseCategories.find((c) => !taken.has(c.id))?.id ?? null) : null;

  const [categoryId, setCategoryId] = useState<string | null>(existing ? existing.categoryId : firstFree);
  const [amountText, setAmountText] = useState(existing ? String(existing.monthlyAmount) : '');

  function save() {
    const amount = parseAmount(amountText);
    if (!amount) {
      notify('月の予算額を入力してください');
      return;
    }
    if (taken.has(categoryId ?? TOTAL_BUDGET_ID)) {
      notify('この対象の予算はすでにあります');
      return;
    }
    // カテゴリを変えた場合は古い予算を消して付け替える
    if (existing && existing.categoryId !== categoryId) runWrite(deleteBudget(uid, existing.id));
    runWrite(saveBudget(uid, categoryId, amount));
    router.back();
  }

  function remove() {
    if (!existing) return;
    runWrite(deleteBudget(uid, existing.id));
    router.back();
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? '予算を編集' : '予算を追加' }} />
      <Field label="対象">
        <ChipRow>
          {!taken.has(TOTAL_BUDGET_ID) ? (
            <Chip label="全体" selected={categoryId === null} onPress={() => setCategoryId(null)} />
          ) : null}
          {expenseCategories
            .filter((c) => !taken.has(c.id))
            .map((c) => (
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
      <Field label="月の予算額（円）">
        <Input value={amountText} onChangeText={setAmountText} keyboardType="number-pad" placeholder="例：30000" />
      </Field>
      <Button title="保存する" onPress={save} />
      {existing ? <Button title="削除する" variant="danger" onPress={remove} /> : null}
    </Screen>
  );
}
