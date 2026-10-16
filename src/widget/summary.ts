import { overallBudgetRemaining, summarizeTransactions } from '@/lib/calc';
import type { AppSettings, Budget, Category, Transaction } from '@/types';

export interface WidgetButton {
  label: string;
  color: string;
  uri: string;
}

/** ウィジェットの表示に必要なものだけを持つ。アプリ側で作って AsyncStorage に保存する */
export interface WidgetSummary {
  /** YYYY-MM */
  month: string;
  expense: number;
  budgetRemaining: number | null;
  categoryButtons: WidgetButton[];
}

export function quickAddUri(params: { kind: 'expense' | 'income'; categoryId?: string }): string {
  const query = [`kind=${params.kind}`, 'from=widget'];
  if (params.categoryId) query.push(`categoryId=${encodeURIComponent(params.categoryId)}`);
  return `managemoney://quick-add?${query.join('&')}`;
}

export function buildWidgetSummary(input: {
  month: string;
  monthTxs: Transaction[];
  budgets: Budget[];
  categories: Category[];
  settings: AppSettings;
}): WidgetSummary {
  const categoryButtons = input.settings.widgetCategoryIds
    .map((id) => input.categories.find((c) => c.id === id && c.kind === 'expense'))
    .filter((c): c is Category => !!c)
    .slice(0, 4)
    .map((c) => ({ label: c.name, color: c.color, uri: quickAddUri({ kind: 'expense', categoryId: c.id }) }));

  return {
    month: input.month,
    expense: summarizeTransactions(input.monthTxs).expense,
    budgetRemaining: overallBudgetRemaining(input.budgets, input.monthTxs),
    categoryButtons,
  };
}
