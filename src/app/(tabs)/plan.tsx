import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { useData } from '@/data/DataProvider';
import { budgetStatuses, goalProgress } from '@/lib/calc';
import { formatMonth, today } from '@/lib/date';
import { Card, Empty, Screen, SectionTitle, TextLink } from '@/ui/components';
import { BudgetRow, GoalRow } from '@/ui/rows';

export default function PlanScreen() {
  const { accounts, categories, budgets, goals, thisMonth, thisMonthTransactions } = useData();
  // 全体予算を先頭に、あとはカテゴリの並び順
  const order = (categoryId: string | null) =>
    categoryId === null ? -1 : categories.findIndex((c) => c.id === categoryId);
  const statuses = budgetStatuses(budgets, thisMonthTransactions).sort(
    (a, b) => order(a.budget.categoryId) - order(b.budget.categoryId),
  );

  return (
    <Screen>
      <Card>
        <SectionTitle
          title={`${formatMonth(thisMonth)}の予算`}
          action={
            <TextLink
              title="＋ 追加"
              onPress={() => router.push({ pathname: '/budget/[id]', params: { id: 'new' } })}
            />
          }
        />
        {statuses.length === 0 ? <Empty message="月の予算を決めると、使いすぎに気づけます" /> : null}
        {statuses.map((s) => (
          <Pressable
            key={s.budget.id}
            onPress={() => router.push({ pathname: '/budget/[id]', params: { id: s.budget.id } })}
          >
            <BudgetRow status={s} category={categories.find((c) => c.id === s.budget.categoryId)} />
          </Pressable>
        ))}
      </Card>

      <Card>
        <SectionTitle
          title="目標"
          action={
            <TextLink title="＋ 追加" onPress={() => router.push({ pathname: '/goal/[id]', params: { id: 'new' } })} />
          }
        />
        {goals.length === 0 ? <Empty message="「旅行資金 30万円」などの目標を立てましょう" /> : null}
        {goals.map((g) => (
          <Pressable key={g.id} onPress={() => router.push({ pathname: '/goal/[id]', params: { id: g.id } })}>
            <GoalRow goal={g} progress={goalProgress(g, accounts, today())} />
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}
