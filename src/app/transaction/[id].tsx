import { router, Stack, useLocalSearchParams } from 'expo-router';

import { useData } from '@/data/DataProvider';
import { Empty, Screen } from '@/ui/components';
import { emptyTransaction, TransactionForm } from '@/ui/TransactionForm';

export default function TransactionEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions, settings } = useData();
  const isNew = id === 'new';
  const before = isNew ? null : (transactions.find((t) => t.id === id) ?? null);

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
