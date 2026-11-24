import type { Account, AccountType, Budget, Category, Goal, Transaction, TransactionInput } from '@/types';
import { addMonths, daysBetween, dayInMonth, monthOf, monthRange, monthsUntil } from './date';
import { FEE_ID, SPECIAL_ID, SPLIT_ID, UNKNOWN_EXPENSE_ID } from './defaults';

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

/** 割り勘で受け取ったお金 */
export function isSplitRefund(tx: Pick<Transaction, 'kind' | 'categoryId'>): boolean {
  return tx.kind === 'income' && tx.categoryId === SPLIT_ID;
}

/** 戻ってきたお金（割り勘の受け取り・手数料の返金）。収入ではなく、そのカテゴリの支出から差し引く */
export function isRefund(tx: Pick<Transaction, 'kind' | 'categoryId'>): boolean {
  return tx.kind === 'income' && (tx.categoryId === SPLIT_ID || tx.categoryId === FEE_ID);
}

/** 振替は収支に含めない。割り勘の受け取り・手数料の返金は支出から差し引く */
export function summarizeTransactions(txs: Transaction[]): MonthSummary {
  let income = 0;
  let expense = 0;
  for (const tx of txs) {
    if (isRefund(tx)) expense -= tx.amount;
    else if (tx.kind === 'income') income += tx.amount;
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
    const amount = tx.kind === 'expense' ? tx.amount : isRefund(tx) ? -tx.amount : 0;
    if (amount === 0) continue;
    totals.set(tx.categoryId, (totals.get(tx.categoryId) ?? 0) + amount);
  }
  return [...totals.entries()]
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    // 割り勘で立て替えた分が多く戻ってきた月はマイナスになるので出さない
    .filter((t) => t.amount > 0)
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

export interface AssetPoint {
  /** YYYY-MM */
  month: string;
  /** その月末の総資産（今月は今の総資産） */
  total: number;
}

/**
 * 月末ごとの総資産の推移。今の残高から、その月より後の取引の増減を引き戻して求める。
 * いちばん古い取引の月から、最大 months か月分。
 */
export function assetHistory(accounts: Account[], txs: Transaction[], thisMonth: string, months = 12): AssetPoint[] {
  const active = new Set(activeAccounts(accounts).map((a) => a.id));
  const netOf = (tx: Transaction) =>
    Object.entries(balanceDeltas(tx)).reduce((sum, [id, amount]) => (active.has(id) ? sum + amount : sum), 0);
  const firstMonth = txs.reduce((min, tx) => (monthOf(tx.date) < min ? monthOf(tx.date) : min), thisMonth);
  const start = [addMonths(thisMonth, -(months - 1)), firstMonth].sort().pop()!;
  const now = totalAssets(accounts);
  const points: AssetPoint[] = [];
  for (let month = start; month <= thisMonth; month = addMonths(month, 1)) {
    const { end } = monthRange(month);
    const later = txs.filter((tx) => tx.date >= end).reduce((sum, tx) => sum + netOf(tx), 0);
    points.push({ month, total: now - later });
  }
  return points;
}

/** 支出のうち、指定したカテゴリ（使途不明金など）の合計 */
export function expenseOfCategory(txs: Transaction[], categoryId: string): number {
  return txs.filter((t) => t.kind === 'expense' && t.categoryId === categoryId).reduce((sum, t) => sum + t.amount, 0);
}

/** 月初から day 日までの取引 */
function untilDay(txs: Transaction[], month: string, day: number): Transaction[] {
  const end = dayInMonth(month, day);
  return txs.filter((t) => t.date >= `${month}-01` && t.date <= end);
}

/** 記録のある過去の月（新しい順に最大 months か月） */
function pastMonthsWithData(txs: Transaction[], thisMonth: string, months: number): string[] {
  const withData = new Set(txs.map((t) => monthOf(t.date)));
  const result: string[] = [];
  for (let i = 1; i <= months; i++) {
    const m = addMonths(thisMonth, -i);
    if (withData.has(m)) result.push(m);
  }
  return result;
}

export type PaceLevel = 'good' | 'normal' | 'caution' | 'over';

export interface SpendingPace {
  /** 今月、月初から今日までの支出 */
  current: number;
  /** 過去の月の、月初から同じ日までの支出の平均。比べる月がなければ null */
  usual: number | null;
  /** 比べた月の数 */
  months: number;
  level: PaceLevel | null;
}

/**
 * 今月の使い方を「いつもの月」と比べる。月の途中でも公平になるよう、過去の月も月初から同じ日までで比べる。
 * いつもより 1割以上少なければ good、1割以上多ければ caution、2割5分以上多ければ over。
 */
export function spendingPace(txs: Transaction[], today: string, months = 3): SpendingPace {
  const thisMonth = monthOf(today);
  const day = Number(today.slice(8, 10));
  // めったにない大きな出費（学費など）は比べると判定が狂うので外す
  const regular = txs.filter((t) => t.categoryId !== SPECIAL_ID);
  const current = summarizeTransactions(untilDay(regular, thisMonth, day)).expense;
  const past = pastMonthsWithData(txs, thisMonth, months);
  if (past.length === 0) return { current, usual: null, months: 0, level: null };
  const usual = Math.round(
    past.reduce((sum, m) => sum + summarizeTransactions(untilDay(regular, m, day)).expense, 0) / past.length,
  );
  let level: PaceLevel = 'normal';
  if (usual <= 0) level = current > 0 ? 'caution' : 'normal';
  else if (current >= usual * 1.25) level = 'over';
  else if (current >= usual * 1.1) level = 'caution';
  else if (current <= usual * 0.9) level = 'good';
  return { current, usual, months: past.length, level };
}

/** 割り勘・使途不明金をのぞいた、ふつうの買い物の支出 */
function isPurchase(t: Transaction): boolean {
  return (
    t.kind === 'expense' && t.categoryId !== SPLIT_ID && t.categoryId !== UNKNOWN_EXPENSE_ID && t.categoryId !== SPECIAL_ID
  );
}

export interface SmallSpending {
  count: number;
  total: number;
  /** いつもの月の同じ時期の合計（比べる月がなければ null） */
  usualTotal: number | null;
}

/** 1回 limit 円以下の小さい出費の積み重ね（今月の月初から今日まで） */
export function smallSpending(txs: Transaction[], today: string, limit = 1000, months = 3): SmallSpending {
  const thisMonth = monthOf(today);
  const day = Number(today.slice(8, 10));
  const small = (list: Transaction[]) => list.filter((t) => isPurchase(t) && t.amount <= limit);
  const now = small(untilDay(txs, thisMonth, day));
  const past = pastMonthsWithData(txs, thisMonth, months);
  const usualTotal =
    past.length === 0
      ? null
      : Math.round(
          past.reduce((sum, m) => sum + small(untilDay(txs, m, day)).reduce((s, t) => s + t.amount, 0), 0) / past.length,
        );
  return { count: now.length, total: now.reduce((s, t) => s + t.amount, 0), usualTotal };
}

export interface StaleAccount {
  account: Account;
  /** 最後に残高を確かめてからの日数。一度も確かめていなければ null */
  days: number | null;
}

/** 残高を days 日以上確かめていない口座（古い順） */
export function staleAccounts(
  accounts: Account[],
  confirmedAt: Record<string, string>,
  today: string,
  days = 30,
): StaleAccount[] {
  return activeAccounts(accounts)
    .map((account) => {
      const at = confirmedAt[account.id];
      return { account, days: at ? daysBetween(at, today) : null };
    })
    .filter((s) => s.days === null || s.days >= days)
    .sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity));
}

/**
 * カードの明細がそろっている最後の日。
 * カードの明細は確定してから出るので、今月のカード払いはまだ記録されていないことが多い。
 * 明細を取り込んだクレカごとに最後の利用日を見て、いちばん古いものを返す（明細を取り込んだクレカがなければ null）。
 */
export function statementCoverage(accounts: Account[], txs: Transaction[]): string | null {
  const latest = new Map<string, string>();
  const cards = new Set(activeAccounts(accounts).filter((a) => a.type === 'credit').map((a) => a.id));
  for (const t of txs) {
    if (!t.accountId || !cards.has(t.accountId) || !t.importKeys?.length || t.kind !== 'expense') continue;
    if ((latest.get(t.accountId) ?? '') < t.date) latest.set(t.accountId, t.date);
  }
  if (latest.size === 0) return null;
  return [...latest.values()].sort()[0];
}
