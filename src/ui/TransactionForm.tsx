import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { useData } from '@/data/DataProvider';
import { deleteTransaction, runWrite, saveTransaction } from '@/data/repo';
import { addDays, formatDate, fromDateString, toDateString, today } from '@/lib/date';
import { parseAmount } from '@/lib/money';
import type { Transaction, TransactionInput, TransactionKind } from '@/types';
import { Button, Card, Chip, ChipRow, Field, Input, Segmented } from './components';
import { colors, spacing } from './theme';

const KIND_OPTIONS: { value: TransactionKind; label: string; color: string }[] = [
  { value: 'expense', label: '支出', color: colors.expense },
  { value: 'income', label: '収入', color: colors.income },
  { value: 'transfer', label: '振替', color: colors.transfer },
];

export function emptyTransaction(kind: TransactionKind, defaultAccountId: string | null): TransactionInput {
  return {
    kind,
    amount: 0,
    categoryId: null,
    accountId: defaultAccountId,
    toAccountId: null,
    date: today(),
    memo: '',
  };
}

export function TransactionForm({
  before,
  initial,
  onDone,
}: {
  /** 編集する取引（新規なら null） */
  before: Transaction | null;
  initial: TransactionInput;
  onDone: () => void;
}) {
  const { uid, accounts, accountIds, categories } = useData();
  const [kind, setKind] = useState(initial.kind);
  const [amountText, setAmountText] = useState(initial.amount ? String(initial.amount) : '');
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [accountId, setAccountId] = useState(initial.accountId);
  const [toAccountId, setToAccountId] = useState(initial.toAccountId);
  const [date, setDate] = useState(initial.date);
  const [memo, setMemo] = useState(initial.memo);

  const kindCategories = kind === 'transfer' ? [] : categories.filter((c) => c.kind === kind);
  const selectedCategoryId = kindCategories.some((c) => c.id === categoryId) ? categoryId : null;
  const kindColor = KIND_OPTIONS.find((o) => o.value === kind)!.color;

  function save() {
    const amount = parseAmount(amountText);
    if (!amount) {
      Alert.alert('金額を入力してください');
      return;
    }
    if (kind === 'transfer' && (!accountId || !toAccountId || accountId === toAccountId)) {
      Alert.alert('振替元と振替先に別々の口座を選んでください');
      return;
    }
    const input: TransactionInput = {
      kind,
      amount,
      categoryId: kind === 'transfer' ? null : (selectedCategoryId ?? kindCategories[0]?.id ?? null),
      accountId,
      toAccountId: kind === 'transfer' ? toAccountId : null,
      date,
      memo: memo.trim(),
    };
    runWrite(saveTransaction(uid, before, input, accountIds));
    onDone();
  }

  function remove() {
    if (!before) return;
    Alert.alert('この取引を削除しますか？', undefined, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          runWrite(deleteTransaction(uid, before, accountIds));
          onDone();
        },
      },
    ]);
  }

  function pickDate() {
    DateTimePickerAndroid.open({
      value: fromDateString(date),
      mode: 'date',
      onChange: (event, selected) => {
        if (event.type === 'set' && selected) setDate(toDateString(selected));
      },
    });
  }

  return (
    <View style={styles.container}>
      <Segmented options={KIND_OPTIONS} value={kind} onChange={setKind} />

      <Card>
        <View style={styles.amountRow}>
          <Text style={[styles.yen, { color: kindColor }]}>¥</Text>
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.border}
            autoFocus={!before}
            style={[styles.amountInput, { color: kindColor }]}
            accessibilityLabel="金額"
          />
        </View>
      </Card>

      {kind !== 'transfer' ? (
        <Field label="カテゴリ">
          <ChipRow>
            {kindCategories.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                icon={c.icon}
                color={c.color}
                selected={c.id === selectedCategoryId}
                onPress={() => setCategoryId(c.id)}
              />
            ))}
          </ChipRow>
        </Field>
      ) : null}

      <Field label={kind === 'transfer' ? '振替元' : kind === 'income' ? '入金先の口座' : '支払った口座'}>
        <ChipRow>
          {kind !== 'transfer' ? (
            <Chip label="指定しない" selected={accountId === null} onPress={() => setAccountId(null)} />
          ) : null}
          {accounts.map((a) => (
            <Chip key={a.id} label={a.name} selected={a.id === accountId} onPress={() => setAccountId(a.id)} />
          ))}
        </ChipRow>
      </Field>

      {kind === 'transfer' ? (
        <Field label="振替先">
          <ChipRow>
            {accounts.map((a) => (
              <Chip key={a.id} label={a.name} selected={a.id === toAccountId} onPress={() => setToAccountId(a.id)} />
            ))}
          </ChipRow>
        </Field>
      ) : null}

      <Field label={`日付：${formatDate(date)}`}>
        <ChipRow>
          <Chip label="今日" selected={date === today()} onPress={() => setDate(today())} />
          <Chip label="昨日" selected={date === addDays(today(), -1)} onPress={() => setDate(addDays(today(), -1))} />
          <Chip label="日付を選ぶ" icon="calendar" selected={false} onPress={pickDate} />
        </ChipRow>
      </Field>

      <Field label="メモ">
        <Input value={memo} onChangeText={setMemo} placeholder="任意" />
      </Field>

      <Button title={before ? '更新する' : '保存する'} onPress={save} />
      {before ? <Button title="削除する" variant="danger" onPress={remove} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  yen: { fontSize: 32, fontWeight: '700', marginRight: spacing.sm },
  amountInput: { flex: 1, fontSize: 40, fontWeight: '700', paddingVertical: 0 },
});
