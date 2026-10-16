import { router, Stack, useLocalSearchParams } from 'expo-router';

import { useData, useMonthTransactions } from '@/data/DataProvider';
import { Empty, Loading, Screen } from '@/ui/components';
import { emptyTransaction, TransactionForm } from '@/ui/TransactionForm';

export default function TransactionEditScreen() {
  const { id, month } = useLocalSearchParams<{ id: string; month?: string }>();
  const { uid, thisMonth, settings, loading } = useData();
  // 編集対象はその取引の月の購読から探す（新規なら今月の購読を使い回すだけ）
  const txs = useMonthTransactions(uid, month ?? thisMonth);
  const isNew = id === 'new';

  if (loading || (!isNew && txs === null)) return <Loading />;
  const before = isNew ? null : (txs?.find((t) => t.id === id) ?? null);

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? '取引を追加' : '取引を編集' }} />
      {!isNew && !before ? (
        <Empty message="この取引は見つかりませんでした" />
      ) : (
        <TransactionForm
          before={before}
          initial={before ?? emptyTransaction('expense', settings.defaultAccountId)}
          onDone={() => router.back()}
        />
      )}
    </Screen>
  );
}
