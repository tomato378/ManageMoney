import {
  balanceDeltaDiff,
  balanceDeltas,
  budgetStatuses,
  expenseByCategory,
  goalProgress,
  overallBudgetRemaining,
  summarizeTransactions,
  totalAssets,
  totalsByAccountType,
} from '../calc';
import type { Account, Budget, Goal, Transaction } from '@/types';

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: 'tx',
    kind: 'expense',
    amount: 0,
    categoryId: null,
    accountId: null,
    toAccountId: null,
    date: '2026-10-01',
    memo: '',
    createdAt: 0,
    ...partial,
  };
}

function account(partial: Partial<Account>): Account {
  return { id: 'a', name: 'A', type: 'bank', balance: 0, sortOrder: 0, archived: false, ...partial };
}

describe('balanceDeltas', () => {
  it('収入は口座を増やし、支出は減らす', () => {
    expect(balanceDeltas(tx({ kind: 'income', amount: 1000, accountId: 'bank' }))).toEqual({ bank: 1000 });
    expect(balanceDeltas(tx({ kind: 'expense', amount: 300, accountId: 'cash' }))).toEqual({ cash: -300 });
  });

  it('振替は移動元を減らして移動先を増やす', () => {
    expect(balanceDeltas(tx({ kind: 'transfer', amount: 5000, accountId: 'bank', toAccountId: 'cash' }))).toEqual({
      bank: -5000,
      cash: 5000,
    });
  });

  it('口座なしの取引は残高に影響しない', () => {
    expect(balanceDeltas(tx({ kind: 'expense', amount: 300 }))).toEqual({});
  });

  it('同じ口座への振替は差し引きゼロ', () => {
    expect(balanceDeltas(tx({ kind: 'transfer', amount: 100, accountId: 'a', toAccountId: 'a' }))).toEqual({});
  });
});

describe('balanceDeltaDiff', () => {
  const before = tx({ kind: 'expense', amount: 500, accountId: 'cash' });

  it('新規作成はその取引の増減そのもの', () => {
    expect(balanceDeltaDiff(null, before)).toEqual({ cash: -500 });
  });

  it('削除は増減を打ち消す', () => {
    expect(balanceDeltaDiff(before, null)).toEqual({ cash: 500 });
  });

  it('金額の変更は差額だけ', () => {
    expect(balanceDeltaDiff(before, { ...before, amount: 800 })).toEqual({ cash: -300 });
  });

  it('口座の変更は元の口座に戻して新しい口座から引く', () => {
    expect(balanceDeltaDiff(before, { ...before, accountId: 'bank' })).toEqual({ cash: 500, bank: -500 });
  });

  it('支出から収入への変更', () => {
    expect(balanceDeltaDiff(before, { ...before, kind: 'income' })).toEqual({ cash: 1000 });
  });

  it('変化がなければ空', () => {
    const after: Transaction = { ...before, memo: 'メモだけ変更' };
    expect(balanceDeltaDiff(before, after)).toEqual({});
  });
});

describe('月の集計', () => {
  const txs = [
    tx({ kind: 'income', amount: 300000, categoryId: 'salary' }),
    tx({ kind: 'expense', amount: 1200, categoryId: 'food' }),
    tx({ kind: 'expense', amount: 800, categoryId: 'food' }),
    tx({ kind: 'expense', amount: 5000, categoryId: 'hobby' }),
    tx({ kind: 'transfer', amount: 10000, accountId: 'bank', toAccountId: 'cash' }),
  ];

  it('収入・支出・差額（振替は含めない）', () => {
    expect(summarizeTransactions(txs)).toEqual({ income: 300000, expense: 7000, net: 293000 });
  });

  it('カテゴリ別の支出を大きい順に', () => {
    expect(expenseByCategory(txs)).toEqual([
      { categoryId: 'hobby', amount: 5000 },
      { categoryId: 'food', amount: 2000 },
    ]);
  });

  it('予算の使用状況', () => {
    const budgets: Budget[] = [
      { id: 'food', categoryId: 'food', monthlyAmount: 30000 },
      { id: 'total', categoryId: null, monthlyAmount: 5000 },
    ];
    const [food, total] = budgetStatuses(budgets, txs);
    expect(food).toMatchObject({ spent: 2000, remaining: 28000 });
    expect(food.ratio).toBeCloseTo(2000 / 30000);
    expect(total).toMatchObject({ spent: 7000, remaining: -2000, ratio: 1.4 });
  });

  it('全体の予算残りは全体予算を優先する', () => {
    const budgets: Budget[] = [
      { id: 'food', categoryId: 'food', monthlyAmount: 30000 },
      { id: 'total', categoryId: null, monthlyAmount: 100000 },
    ];
    expect(overallBudgetRemaining(budgets, txs)).toBe(93000);
  });

  it('全体予算がなければカテゴリ予算の残りの合計', () => {
    const budgets: Budget[] = [
      { id: 'food', categoryId: 'food', monthlyAmount: 30000 },
      { id: 'hobby', categoryId: 'hobby', monthlyAmount: 4000 },
    ];
    expect(overallBudgetRemaining(budgets, txs)).toBe(28000 - 1000);
  });

  it('予算がなければ null', () => {
    expect(overallBudgetRemaining([], txs)).toBeNull();
  });
});

describe('資産', () => {
  const accounts = [
    account({ id: 'bank', type: 'bank', balance: 500000 }),
    account({ id: 'card', type: 'credit', balance: -30000 }),
    account({ id: 'old', type: 'bank', balance: 99999, archived: true }),
  ];

  it('総資産は負債を差し引き、アーカイブした口座を除く', () => {
    expect(totalAssets(accounts)).toBe(470000);
  });

  it('種類別の小計', () => {
    expect(totalsByAccountType(accounts)).toEqual({ bank: 500000, credit: -30000 });
  });
});

describe('goalProgress', () => {
  const goal: Goal = {
    id: 'g',
    name: '旅行',
    targetAmount: 120000,
    targetDate: '2026-12-31',
    accountId: null,
    currentAmount: 30000,
  };

  it('手入力の現在額から進捗と毎月の必要額を出す', () => {
    // 10月〜12月の3か月で残り 90000
    expect(goalProgress(goal, [], '2026-10-16')).toEqual({
      current: 30000,
      remaining: 90000,
      ratio: 0.25,
      monthlyNeeded: 30000,
    });
  });

  it('口座を紐づけていればその残高を使う', () => {
    const accounts = [account({ id: 'saving', balance: 150000 })];
    expect(goalProgress({ ...goal, accountId: 'saving' }, accounts, '2026-10-16')).toEqual({
      current: 150000,
      remaining: 0,
      ratio: 1,
      monthlyNeeded: null,
    });
  });

  it('期日を過ぎていたら残り全額', () => {
    expect(goalProgress(goal, [], '2027-02-01').monthlyNeeded).toBe(90000);
  });
});
