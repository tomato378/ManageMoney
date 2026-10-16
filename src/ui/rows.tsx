import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import type { BudgetStatus, GoalProgress } from '@/lib/calc';
import { formatDate } from '@/lib/date';
import { formatYen } from '@/lib/money';
import type { Account, Category, Goal, Transaction } from '@/types';
import { Amount, IconBadge, ProgressBar, Row } from './components';
import { colors } from './theme';

export function TransactionRow({
  tx,
  categories,
  accounts,
  showDate = false,
}: {
  tx: Transaction;
  categories: Category[];
  accounts: Account[];
  showDate?: boolean;
}) {
  const category = categories.find((c) => c.id === tx.categoryId);
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name;
  const title =
    tx.kind === 'transfer'
      ? `振替 ${accountName(tx.accountId) ?? '?'} → ${accountName(tx.toAccountId) ?? '?'}`
      : (category?.name ?? '未分類');
  const subtitle = [
    showDate ? formatDate(tx.date) : null,
    tx.memo || null,
    tx.kind !== 'transfer' ? accountName(tx.accountId) : null,
  ]
    .filter(Boolean)
    .join('・');
  const color = tx.kind === 'income' ? colors.income : tx.kind === 'expense' ? colors.text : colors.transfer;

  return (
    <Row
      onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: tx.id, month: tx.date.slice(0, 7) } })}
      left={
        tx.kind === 'transfer' ? (
          <IconBadge icon="swap-horizontal" color={colors.transfer} />
        ) : (
          <IconBadge icon={category?.icon ?? 'help'} color={category?.color ?? colors.subText} />
        )
      }
      title={title}
      subtitle={subtitle || undefined}
      right={
        <Amount value={tx.kind === 'expense' ? -tx.amount : tx.amount} color={color} signed={tx.kind === 'income'} />
      }
    />
  );
}

export function BudgetRow({ status, category }: { status: BudgetStatus; category?: Category }) {
  const name = status.budget.categoryId === null ? '全体' : (category?.name ?? '削除されたカテゴリ');
  const over = status.remaining < 0;
  return (
    <View style={styles.planRow}>
      <View style={styles.planHeader}>
        <Text style={styles.planName}>{name}</Text>
        <Text style={[styles.planValue, over && { color: colors.danger }]}>
          {over ? `${formatYen(-status.remaining)} オーバー` : `残り ${formatYen(status.remaining)}`}
        </Text>
      </View>
      <ProgressBar ratio={status.ratio} color={category?.color ?? colors.primary} />
      <Text style={styles.planCaption}>
        {formatYen(status.spent)} / {formatYen(status.budget.monthlyAmount)}
      </Text>
    </View>
  );
}

export function GoalRow({ goal, progress }: { goal: Goal; progress: GoalProgress }) {
  return (
    <View style={styles.planRow}>
      <View style={styles.planHeader}>
        <Text style={styles.planName}>{goal.name}</Text>
        <Text style={styles.planValue}>{Math.floor(progress.ratio * 100)}%</Text>
      </View>
      <ProgressBar ratio={progress.ratio} color={colors.income} />
      <Text style={styles.planCaption}>
        {formatYen(progress.current)} / {formatYen(goal.targetAmount)}
        {goal.targetDate ? `（${formatDate(goal.targetDate)}まで）` : ''}
        {progress.monthlyNeeded !== null ? `・毎月 ${formatYen(progress.monthlyNeeded)}` : ''}
        {progress.remaining === 0 ? '・達成！' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  planRow: { gap: 6, paddingVertical: 6 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  planName: { fontSize: 15, fontWeight: '600', color: colors.text },
  planValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  planCaption: { fontSize: 12, color: colors.subText },
});
