import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '@/lib/defaults';
import type { Transaction } from '@/types';
import { buildWidgetSummary, quickAddUri } from '../summary';

describe('quickAddUri', () => {
  it('カテゴリ付きのディープリンク', () => {
    expect(quickAddUri({ kind: 'expense', categoryId: 'food' })).toBe(
      'managemoney://quick-add?kind=expense&from=widget&categoryId=food',
    );
    expect(quickAddUri({ kind: 'income' })).toBe('managemoney://quick-add?kind=income&from=widget');
  });
});

describe('buildWidgetSummary', () => {
  const monthTxs: Transaction[] = [
    {
      id: '1',
      kind: 'expense',
      amount: 1500,
      categoryId: 'food',
      accountId: null,
      toAccountId: null,
      date: '2026-10-02',
      memo: '',
      createdAt: 0,
    },
  ];

  it('設定したカテゴリのボタンと今月の支出・予算残り', () => {
    const summary = buildWidgetSummary({
      month: '2026-10',
      monthTxs,
      budgets: [{ id: 'total', categoryId: null, monthlyAmount: 50000 }],
      categories: DEFAULT_CATEGORIES,
      settings: { ...DEFAULT_SETTINGS, widgetCategoryIds: ['transport', 'deleted', 'salary', 'food'] },
    });
    expect(summary.expense).toBe(1500);
    expect(summary.budgetRemaining).toBe(48500);
    // 削除済みと収入カテゴリは出さない
    expect(summary.categoryButtons.map((b) => b.label)).toEqual(['交通', '食費']);
  });
});
