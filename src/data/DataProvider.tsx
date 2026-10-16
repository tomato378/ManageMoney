import {
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentSnapshot,
  type QuerySnapshot,
} from '@react-native-firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { activeAccounts, sortCategories } from '@/lib/calc';
import { currentMonth, monthRange } from '@/lib/date';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import { settingsDoc, userCollection, type UserCollection } from '@/lib/firebase';
import type { Account, AppSettings, Budget, Category, Goal, Transaction } from '@/types';
import { saveWidgetSummary } from '@/widget/cache';
import { buildWidgetSummary } from '@/widget/summary';
import { seedDefaultsIfNeeded } from './repo';

interface DataState {
  uid: string;
  /** アーカイブ済みも含むすべての口座 */
  allAccounts: Account[];
  /** 表示用（アーカイブ除外・並び順どおり） */
  accounts: Account[];
  accountIds: Set<string>;
  categories: Category[];
  budgets: Budget[];
  goals: Goal[];
  settings: AppSettings;
  /** 今月の取引（ホームとウィジェット用） */
  thisMonth: string;
  thisMonthTransactions: Transaction[];
  loading: boolean;
}

const DataContext = createContext<DataState | null>(null);

type Snapshot = QuerySnapshot;

function docsOf<T>(snapshot: Snapshot): T[] {
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

function useUserCollection<T>(uid: string, name: UserCollection): T[] | null {
  const [items, setItems] = useState<T[] | null>(null);
  useEffect(
    () =>
      onSnapshot(
        userCollection(uid, name),
        (snapshot: Snapshot) => setItems(docsOf<T>(snapshot)),
        (error: Error) => console.warn(`[${name}]`, error),
      ),
    [uid, name],
  );
  return items;
}

/** 指定した月の取引を新しい順に購読する */
export function useMonthTransactions(uid: string, month: string): Transaction[] | null {
  // 月を切り替えた直後に前の月の取引を返さないよう、どの月の結果かも持つ
  const key = `${uid}/${month}`;
  const [loaded, setLoaded] = useState<{ key: string; items: Transaction[] } | null>(null);
  useEffect(() => {
    const { start, end } = monthRange(month);
    const q = query(
      userCollection(uid, 'transactions'),
      where('date', '>=', start),
      where('date', '<', end),
      orderBy('date', 'desc'),
    );
    return onSnapshot(
      q,
      (snapshot: Snapshot) =>
        setLoaded({
          key: `${uid}/${month}`,
          items: docsOf<Transaction>(snapshot).sort(
            (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
          ),
        }),
      (error: Error) => console.warn('[transactions]', error),
    );
  }, [uid, month]);
  return loaded?.key === key ? loaded.items : null;
}

/** 日付が変わったら今月を更新する（アプリを開いたまま月をまたいだとき用） */
function useCurrentMonth(): string {
  const [month, setMonth] = useState(currentMonth);
  useEffect(() => {
    const timer = setInterval(() => setMonth(currentMonth()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return month;
}

export function DataProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const allAccounts = useUserCollection<Account>(uid, 'accounts');
  const rawCategories = useUserCollection<Category>(uid, 'categories');
  const budgets = useUserCollection<Budget>(uid, 'budgets');
  const goals = useUserCollection<Goal>(uid, 'goals');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const thisMonth = useCurrentMonth();
  const thisMonthTransactions = useMonthTransactions(uid, thisMonth);

  useEffect(() => {
    seedDefaultsIfNeeded(uid).catch((error) => console.warn('[seed]', error));
    return onSnapshot(
      settingsDoc(uid),
      (snapshot: DocumentSnapshot) =>
        setSettings({ ...DEFAULT_SETTINGS, ...(snapshot.data() as Partial<AppSettings> | undefined) }),
      (error: Error) => console.warn('[settings]', error),
    );
  }, [uid]);

  const value = useMemo<DataState>(() => {
    const accounts = activeAccounts(allAccounts ?? []);
    return {
      uid,
      allAccounts: allAccounts ?? [],
      accounts,
      accountIds: new Set((allAccounts ?? []).map((a) => a.id)),
      categories: sortCategories(rawCategories ?? []),
      budgets: budgets ?? [],
      goals: goals ?? [],
      settings: settings ?? DEFAULT_SETTINGS,
      thisMonth,
      thisMonthTransactions: thisMonthTransactions ?? [],
      loading: !allAccounts || !rawCategories || !budgets || !goals || !settings || !thisMonthTransactions,
    };
  }, [uid, allAccounts, rawCategories, budgets, goals, settings, thisMonth, thisMonthTransactions]);

  // データが変わるたびにホーム画面ウィジェットの表示を更新する
  useEffect(() => {
    if (value.loading) return;
    saveWidgetSummary(
      buildWidgetSummary({
        month: value.thisMonth,
        monthTxs: value.thisMonthTransactions,
        budgets: value.budgets,
        categories: value.categories,
        settings: value.settings,
      }),
    ).catch((error) => console.warn('[widget]', error));
  }, [value]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataState {
  const value = useContext(DataContext);
  if (!value) throw new Error('useData は DataProvider の中で使ってください');
  return value;
}
