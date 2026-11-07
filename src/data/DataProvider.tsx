import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';

import { activeAccounts, sortCategories } from '@/lib/calc';
import { currentMonth, monthOf, today } from '@/lib/date';
import type { Account, AppSettings, BalanceCheck, Budget, Category, Goal, RecurringItem, Transaction } from '@/types';
import { postDueRecurring } from './repo';
import { getSnapshot, subscribe } from './store';

interface DataState {
  /** アーカイブ済みも含むすべての口座 */
  allAccounts: Account[];
  /** 表示用（アーカイブ除外・並び順どおり） */
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  recurring: RecurringItem[];
  /** 古い順 */
  balanceChecks: BalanceCheck[];
  settings: AppSettings;
  /** 今月の取引（ホーム・予算用） */
  thisMonth: string;
  thisMonthTransactions: Transaction[];
}

const DataContext = createContext<DataState | null>(null);

/** 指定した月の取引を新しい順に並べる */
function transactionsOfMonth(transactions: Transaction[], month: string): Transaction[] {
  return transactions
    .filter((tx) => monthOf(tx.date) === month)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

/**
 * 日付が変わったら今月を更新する（開いたまま月をまたいだとき用）。
 * あわせて、指定日を過ぎた毎月の収入・固定費を記録する。
 */
function useCurrentMonth(): string {
  const [month, setMonth] = useState(currentMonth);
  useEffect(() => {
    postDueRecurring(today());
    const timer = setInterval(() => {
      setMonth(currentMonth());
      postDueRecurring(today());
    }, 60_000);
    return () => clearInterval(timer);
  }, []);
  return month;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const data = useSyncExternalStore(subscribe, getSnapshot);
  const thisMonth = useCurrentMonth();

  const value = useMemo<DataState>(
    () => ({
      allAccounts: data.accounts,
      accounts: activeAccounts(data.accounts),
      categories: sortCategories(data.categories),
      transactions: data.transactions,
      budgets: data.budgets,
      goals: data.goals,
      recurring: data.recurring,
      balanceChecks: data.balanceChecks,
      settings: data.settings,
      thisMonth,
      thisMonthTransactions: transactionsOfMonth(data.transactions, thisMonth),
    }),
    [data, thisMonth],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataState {
  const value = useContext(DataContext);
  if (!value) throw new Error('useData は DataProvider の中で使ってください');
  return value;
}

/** 指定した月の取引を新しい順に返す */
export function useMonthTransactions(month: string): Transaction[] {
  const { transactions } = useData();
  return useMemo(() => transactionsOfMonth(transactions, month), [transactions, month]);
}
