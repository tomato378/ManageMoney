import type { Account, AccountType, Budget, Category, Goal, Transaction, TransactionInput } from '@/types';
import { monthsUntil } from './date';

type BalanceAffecting = Pick<TransactionInput, 'kind' | 'amount' | 'accountId' | 'toAccountId'>;

/** 口座ID → 残高の増減。0 になったものは含めない */
export type BalanceDeltas = Record<string, number>;

function addDelta(deltas: BalanceDeltas, accountId: string | null, amount: number) {
  if (!accountId || amount === 0) return;
  const next = (deltas[accountId] ?? 0) + amount;
  if (next === 0) delete deltas[accountId];
  else deltas[accountId] = next;
}

/** 1件の取引が口座残高に与える増減 */
export function balanceDeltas(tx: BalanceAffecting): BalanceDeltas {
  const deltas: BalanceDeltas = {};
  switch (tx.kind) {
    case 'income':
      addDelta(deltas, tx.accountId, tx.amount);
      break;
    case 'expense':
      addDelta(deltas, tx.accountId, -tx.amount);
      break;
    case 'transfer':
      addDelta(deltas, tx.accountId, -tx.amount);
      addDelta(deltas, tx.toAccountId, tx.amount);
      break;
  }
  return deltas;
}

/**
 * 取引を before から after に変えたときの残高の増減。
 * 新規は before = null、削除は after = null。
 */
export function balanceDeltaDiff(before: BalanceAffecting | null, after: BalanceAffecting | null): BalanceDeltas {
  const deltas: BalanceDeltas = {};
  if (before) {
    for (const [id, amount] of Object.entries(balanceDeltas(before))) addDelta(deltas, id, -amount);
  }
  if (after) {
    for (const [id, amount] of Object.entries(balanceDeltas(after))) addDelta(deltas, id, amount);
  }
  return deltas;
}

export interface MonthSummary {
  income: number;
  expense: number;
  net: number;
}

/** 振替は収支に含めない */
export function summarizeTransactions(txs: Transaction[]): MonthSummary {
  let income = 0;
  let expense = 0;
  for (const tx of txs) {
    if (tx.kind === 'income') income += tx.amount;
    else if (tx.kind === 'expense') expense += tx.amount;
  }
  return { income, expense, net: income - expense };
}

export interface CategoryTotal {
  categoryId: string | null;
  amount: number;
}

/** 支出をカテゴリ別に合計し、金額の大きい順に並べる */
export function expenseByCategory(txs: Transaction[]): CategoryTotal[] {
  const totals = new Map<string | null, number>();
  for (const tx of txs) {
    if (tx.kind !== 'expense') continue;
    totals.set(tx.categoryId, (totals.get(tx.categoryId) ?? 0) + tx.amount);
  }
  return [...totals.entries()]
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export interface BudgetStatus {
  budget: Budget;
  spent: number;
  remaining: number;
  /** 使用率（0〜、1 を超えたら予算オーバー） */
  ratio: number;
}

export function budgetStatuses(budgets: Budget[], monthTxs: Transaction[]): BudgetStatus[] {
  const byCategory = new Map(expenseByCategory(monthTxs).map((t) => [t.categoryId, t.amount]));
  const totalExpense = summarizeTransactions(monthTxs).expense;
  return budgets.map((budget) => {
    const spent = budget.categoryId === null ? totalExpense : (byCategory.get(budget.categoryId) ?? 0);
    return {
      budget,
      spent,
      remaining: budget.monthlyAmount - spent,
      ratio: budget.monthlyAmount > 0 ? spent / budget.monthlyAmount : spent > 0 ? Infinity : 0,
    };
  });
}

/**
 * 今月あといくら使えるか。全体予算があればそれを使い、
 * なければカテゴリ予算の合計で見る。予算がなければ null。
 */
export function overallBudgetRemaining(budgets: Budget[], monthTxs: Transaction[]): number | null {
  if (budgets.length === 0) return null;
  const statuses = budgetStatuses(budgets, monthTxs);
  const total = statuses.find((s) => s.budget.categoryId === null);
  if (total) return total.remaining;
  return statuses.reduce((sum, s) => sum + s.remaining, 0);
}

export function activeAccounts(accounts: Account[]): Account[] {
  return accounts.filter((a) => !a.archived).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function totalAssets(accounts: Account[]): number {
  return activeAccounts(accounts).reduce((sum, a) => sum + a.balance, 0);
}

export function totalsByAccountType(accounts: Account[]): Partial<Record<AccountType, number>> {
  const totals: Partial<Record<AccountType, number>> = {};
  for (const a of activeAccounts(accounts)) totals[a.type] = (totals[a.type] ?? 0) + a.balance;
  return totals;
}

export interface GoalProgress {
  current: number;
  remaining: number;
  /** 0〜1 */
  ratio: number;
  /** 期日までに毎月いくら貯めればよいか（期日なし・達成済みなら null） */
  monthlyNeeded: number | null;
}

export function goalProgress(goal: Goal, accounts: Account[], todayDate: string): GoalProgress {
  const account = goal.accountId ? accounts.find((a) => a.id === goal.accountId) : undefined;
  const current = account ? account.balance : goal.currentAmount;
  const remaining = Math.max(0, goal.targetAmount - current);
  const ratio = goal.targetAmount > 0 ? Math.min(1, Math.max(0, current / goal.targetAmount)) : 1;
  let monthlyNeeded: number | null = null;
  if (goal.targetDate && remaining > 0) {
    const months = monthsUntil(todayDate, goal.targetDate);
    monthlyNeeded = months > 0 ? Math.ceil(remaining / months) : remaining;
  }
  return { current, remaining, ratio, monthlyNeeded };
}

export function sortCategories(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ja'));
}
