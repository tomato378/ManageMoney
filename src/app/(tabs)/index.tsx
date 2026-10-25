import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useData } from '@/data/DataProvider';
import { budgetStatuses, goalProgress, overallBudgetRemaining, summarizeTransactions, totalAssets } from '@/lib/calc';
import { formatMonth, today } from '@/lib/date';
import { formatYen } from '@/lib/money';
import { Amount, Card, Empty, Fab, Screen, SectionTitle, TextLink } from '@/ui/components';
import type { Category } from '@/types';
import { BudgetRow, GoalRow, TransactionRow } from '@/ui/rows';
import { colors, spacing } from '@/ui/theme';

export default function HomeScreen() {
  const { accounts, categories, budgets, goals, settings, thisMonth, thisMonthTransactions } = useData();
  const summary = summarizeTransactions(thisMonthTransactions);
  const remaining = overallBudgetRemaining(budgets, thisMonthTransactions);
  const statuses = budgetStatuses(budgets, thisMonthTransactions).sort((a, b) => b.ratio - a.ratio);
  const recent = thisMonthTransactions.slice(0, 5);
  const quickCategories = settings.quickCategoryIds
    .map((id) => categories.find((c) => c.id === id && c.kind === 'expense'))
    .filter((c): c is Category => !!c);

  return (
    <View style={styles.flex}>
      <Screen>
        <Card style={styles.hero}>
          <Text style={styles.heroLabel}>総資産</Text>
          <Amount value={totalAssets(accounts)} size={32} color="#FFFFFF" />
          <Text style={styles.heroCaption}>{accounts.length}口座</Text>
        </Card>

        <Card>
          <View style={styles.quickRow}>
            <QuickButton label="－ 支出" color={colors.expense} filled params={{ kind: 'expense' }} />
            <QuickButton label="＋ 収入" color={colors.income} filled params={{ kind: 'income' }} />
          </View>
          {quickCategories.length > 0 ? (
            <View style={styles.quickRow}>
              {quickCategories.map((c) => (
                <QuickButton key={c.id} label={c.name} color={c.color} params={{ kind: 'expense', categoryId: c.id }} />
              ))}
            </View>
          ) : null}
        </Card>

        <Card>
          <SectionTitle title={`${formatMonth(thisMonth)}の収支`} />
          <View style={styles.summaryRow}>
            <SummaryItem label="収入" value={summary.income} color={colors.income} />
            <SummaryItem label="支出" value={summary.expense} color={colors.expense} />
            <SummaryItem label="差額" value={summary.net} color={summary.net < 0 ? colors.expense : colors.text} />
          </View>
          {remaining !== null ? (
            <Text style={[styles.remaining, remaining < 0 && { color: colors.danger }]}>
              {remaining < 0 ? `予算を ${formatYen(-remaining)} オーバー` : `今月あと ${formatYen(remaining)} 使えます`}
            </Text>
          ) : null}
        </Card>

        {statuses.length > 0 ? (
          <Card>
            <SectionTitle title="予算" action={<TextLink title="すべて" onPress={() => router.navigate('/plan')} />} />
            {statuses.slice(0, 3).map((s) => (
              <BudgetRow key={s.budget.id} status={s} category={categories.find((c) => c.id === s.budget.categoryId)} />
            ))}
          </Card>
        ) : null}

        {goals.length > 0 ? (
          <Card>
            <SectionTitle title="目標" />
            {goals.map((g) => (
              <GoalRow key={g.id} goal={g} progress={goalProgress(g, accounts, today())} />
            ))}
          </Card>
        ) : null}

        <Card>
          <SectionTitle
            title="最近の取引"
            action={<TextLink title="すべて" onPress={() => router.navigate('/transactions')} />}
          />
          {recent.length === 0 ? <Empty message="今月の取引はまだありません" /> : null}
          {recent.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} categories={categories} accounts={accounts} showDate />
          ))}
        </Card>
      </Screen>
      <Fab onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: 'new' } })} label="取引を追加" />
    </View>
  );
}

function QuickButton({
  label,
  color,
  filled = false,
  params,
}: {
  label: string;
  color: string;
  filled?: boolean;
  params: { kind: 'expense' | 'income'; categoryId?: string };
}) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/quick-add', params })}
      style={({ pressed }) => [
        styles.quickButton,
        { backgroundColor: filled ? color : `${color}22`, opacity: pressed ? 0.75 : 1 },
      ]}
      accessibilityRole="button"
    >
      <Text style={[styles.quickLabel, { color: filled ? '#FFFFFF' : color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function SummaryItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Amount value={value} color={color} size={17} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { backgroundColor: colors.primary, gap: spacing.xs },
  heroLabel: { color: '#DBEAFE', fontSize: 14 },
  heroCaption: { color: '#DBEAFE', fontSize: 12 },
  quickRow: { flexDirection: 'row', gap: spacing.sm },
  quickButton: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  quickLabel: { fontSize: 14, fontWeight: '700' },
  summaryRow: { flexDirection: 'row' },
  summaryItem: { flex: 1, gap: 2 },
  summaryLabel: { fontSize: 12, color: colors.subText },
  remaining: { fontSize: 14, color: colors.income, fontWeight: '600', marginTop: spacing.xs },
});
