import { router, Stack, useLocalSearchParams } from 'expo-router';

import { useData } from '@/data/DataProvider';
import type { TransactionKind } from '@/types';
import { Loading, Screen } from '@/ui/components';
import { emptyTransaction, TransactionForm } from '@/ui/TransactionForm';

/**
 * ホームのクイック入力ボタンから開く入力画面。
 * /quick-add?kind=expense&categoryId=food
 */
export default function QuickAddScreen() {
  const params = useLocalSearchParams<{ kind?: string; categoryId?: string }>();
  const { settings, categories, loading } = useData();
  const kind: TransactionKind = params.kind === 'income' ? 'income' : 'expense';
  const category = categories.find((c) => c.id === params.categoryId);
  const initial = { ...emptyTransaction(kind, settings.defaultAccountId), categoryId: params.categoryId ?? null };

  function done() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  // フォームは初期値を最初の描画で決めるので、データが揃ってから出す
  if (loading) return <Loading />;

  return (
    <Screen>
      <Stack.Screen
        options={{ title: category ? `${category.name}を入力` : kind === 'income' ? '収入を入力' : '支出を入力' }}
      />
      <TransactionForm before={null} initial={initial} onDone={done} />
    </Screen>
  );
}
