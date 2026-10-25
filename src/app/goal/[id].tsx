import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useData } from '@/data/DataProvider';
import { deleteGoal, runWrite, saveGoal } from '@/data/repo';
import { today } from '@/lib/date';
import { parseAmount } from '@/lib/money';
import { Button, Chip, ChipRow, Field, Input, Screen } from '@/ui/components';
import { DateInput } from '@/ui/DateInput';
import { confirmAsync, notify } from '@/ui/dialog';

export default function GoalEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { uid, goals, accounts } = useData();
  const existing = goals.find((g) => g.id === id) ?? null;

  const [name, setName] = useState(existing?.name ?? '');
  const [targetText, setTargetText] = useState(existing ? String(existing.targetAmount) : '');
  const [targetDate, setTargetDate] = useState<string | null>(existing?.targetDate ?? null);
  const [accountId, setAccountId] = useState<string | null>(existing?.accountId ?? null);
  const [currentText, setCurrentText] = useState(existing ? String(existing.currentAmount) : '');

  function save() {
    const targetAmount = parseAmount(targetText);
    if (!name.trim() || !targetAmount) {
      notify('目標の名前と金額を入力してください');
      return;
    }
    runWrite(
      saveGoal(uid, {
        id: existing?.id,
        name: name.trim(),
        targetAmount,
        targetDate,
        accountId,
        currentAmount: accountId ? 0 : (parseAmount(currentText) ?? 0),
      }),
    );
    router.back();
  }

  async function remove() {
    if (!existing || !(await confirmAsync(`「${existing.name}」を削除しますか？`))) return;
    runWrite(deleteGoal(uid, existing.id));
    router.back();
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? '目標を編集' : '目標を追加' }} />
      <Field label="目標の名前">
        <Input value={name} onChangeText={setName} placeholder="例：旅行資金、生活防衛資金" autoFocus={!existing} />
      </Field>
      <Field label="目標額（円）">
        <Input value={targetText} onChangeText={setTargetText} keyboardType="number-pad" placeholder="例：300000" />
      </Field>
      <Field label="期日">
        <ChipRow>
          <Chip label="期日なし" selected={targetDate === null} onPress={() => setTargetDate(null)} />
          <DateInput value={targetDate ?? ''} min={today()} onChange={setTargetDate} label="期日" />
        </ChipRow>
      </Field>
      <Field label="進捗の数え方">
        <ChipRow>
          <Chip label="手入力" selected={accountId === null} onPress={() => setAccountId(null)} />
          {accounts.map((a) => (
            <Chip
              key={a.id}
              label={`${a.name}の残高`}
              selected={a.id === accountId}
              onPress={() => setAccountId(a.id)}
            />
          ))}
        </ChipRow>
      </Field>
      {accountId === null ? (
        <Field label="今貯まっている額（円）">
          <Input value={currentText} onChangeText={setCurrentText} keyboardType="number-pad" placeholder="0" />
        </Field>
      ) : null}
      <Button title="保存する" onPress={save} />
      {existing ? <Button title="削除する" variant="danger" onPress={remove} /> : null}
    </Screen>
  );
}
