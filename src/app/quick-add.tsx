import { router, useLocalSearchParams } from 'expo-router';
import { BackHandler } from 'react-native';

import { useData } from '@/data/DataProvider';
import type { TransactionKind } from '@/types';
import { Loading, Screen } from '@/ui/components';
import { emptyTransaction, TransactionForm } from '@/ui/TransactionForm';

/**
 * ホーム画面ウィジェットのボタンから開く入力画面。
 * managemoney://quick-add?kind=expense&categoryId=food&from=widget
 */
export default function QuickAddScreen() {
  const params = useLocalSearchParams<{ kind?: string; categoryId?: string; from?: string }>();
  const { settings, loading } = useData();
  const kind: TransactionKind = params.kind === 'income' ? 'income' : 'expense';
  const initial = { ...emptyTransaction(kind, settings.defaultAccountId), categoryId: params.categoryId ?? null };

  function done() {
    if (params.from === 'widget') {
      // 保存はローカルに即反映される。ウィジェットの再描画を待ってからホーム画面に戻る
      setTimeout(() => BackHandler.exitApp(), 600);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  // フォームは初期値を最初の描画で決めるので、データが揃ってから出す
  if (loading) return <Loading />;

  return (
    <Screen>
      <TransactionForm before={null} initial={initial} onDone={done} />
    </Screen>
  );
}
