import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { useData } from '@/data/DataProvider';
import { archiveAccount, runWrite, saveAccount } from '@/data/repo';
import { ACCOUNT_TYPES } from '@/lib/defaults';
import { parseAmount } from '@/lib/money';
import type { AccountType } from '@/types';
import { Button, Chip, ChipRow, Field, Input, Screen } from '@/ui/components';

export default function AccountEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { uid, accounts, settings } = useData();
  const existing = accounts.find((a) => a.id === id) ?? null;

  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<AccountType>(existing?.type ?? 'bank');
  const [balanceText, setBalanceText] = useState(existing ? String(existing.balance) : '');

  function save() {
    if (!name.trim()) {
      Alert.alert('口座名を入力してください');
      return;
    }
    const balance = parseAmount(balanceText, { allowNegative: true }) ?? 0;
    runWrite(
      saveAccount(uid, {
        id: existing?.id,
        name: name.trim(),
        type,
        balance,
        sortOrder: existing?.sortOrder ?? accounts.length,
        archived: false,
      }),
    );
    router.back();
  }

  function remove() {
    if (!existing) return;
    if (existing.id === settings.defaultAccountId) {
      Alert.alert('入力時のデフォルト口座は削除できません', '設定で別の口座に変えてから削除してください');
      return;
    }
    Alert.alert(`「${existing.name}」を削除しますか？`, '過去の取引は残ります。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          runWrite(archiveAccount(uid, existing.id));
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? '口座を編集' : '口座を追加' }} />
      <Field label="口座名">
        <Input value={name} onChangeText={setName} placeholder="例：〇〇銀行、楽天証券" autoFocus={!existing} />
      </Field>
      <Field label="種類">
        <ChipRow>
          {ACCOUNT_TYPES.map((t) => (
            <Chip
              key={t.type}
              label={t.label}
              icon={t.icon}
              selected={t.type === type}
              onPress={() => setType(t.type)}
            />
          ))}
        </ChipRow>
      </Field>
      <Field label={type === 'credit' ? '現在の残高（未払い額はマイナスで入力）' : '現在の残高・評価額'}>
        <Input
          value={balanceText}
          onChangeText={setBalanceText}
          keyboardType="numbers-and-punctuation"
          placeholder="0"
        />
      </Field>
      <Button title="保存する" onPress={save} />
      {existing ? <Button title="削除する" variant="danger" onPress={remove} /> : null}
    </Screen>
  );
}
