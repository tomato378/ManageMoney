import { balanceDeltaDiff } from '@/lib/calc';
import { DEFAULT_ACCOUNT, DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '@/lib/defaults';
import {
  TOTAL_BUDGET_ID,
  type Account,
  type AppSettings,
  type Budget,
  type Category,
  type Goal,
  type Transaction,
  type TransactionInput,
} from '@/types';

/** ブラウザに保存するデータ全体。変更は常に新しいオブジェクトを返す（元は書き換えない） */
export interface AppData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  settings: AppSettings;
}

type WithOptionalId<T extends { id: string }> = Omit<T, 'id'> & { id?: string };

export function newId(): string {
  return crypto.randomUUID();
}

/** 初めて開いたときのデータ（カテゴリ・「財布」口座・設定） */
export function seedData(): AppData {
  return {
    accounts: [{ ...DEFAULT_ACCOUNT }],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    transactions: [],
    budgets: [],
    goals: [],
    settings: { ...DEFAULT_SETTINGS, quickCategoryIds: [...DEFAULT_SETTINGS.quickCategoryIds] },
  };
}

function upsert<T extends { id: string }>(items: T[], item: T): T[] {
  return items.some((i) => i.id === item.id) ? items.map((i) => (i.id === item.id ? item : i)) : [...items, item];
}

// ---- 口座 ----

export function saveAccount(data: AppData, account: WithOptionalId<Account>): AppData {
  return { ...data, accounts: upsert(data.accounts, { ...account, id: account.id ?? newId() }) };
}

/** 取引から参照されている可能性があるので、口座は消さずにアーカイブする */
export function archiveAccount(data: AppData, id: string): AppData {
  return { ...data, accounts: data.accounts.map((a) => (a.id === id ? { ...a, archived: true } : a)) };
}

// ---- カテゴリ ----

export function saveCategory(data: AppData, category: WithOptionalId<Category>): AppData {
  return { ...data, categories: upsert(data.categories, { ...category, id: category.id ?? newId() }) };
}

/** 過去の取引は残し（「未分類」表示になる）、クイック入力のボタンからは外す */
export function deleteCategory(data: AppData, id: string): AppData {
  return {
    ...data,
    categories: data.categories.filter((c) => c.id !== id),
    settings: { ...data.settings, quickCategoryIds: data.settings.quickCategoryIds.filter((c) => c !== id) },
  };
}

// ---- 取引 ----

/** 口座残高を増減する。存在しない口座への増減は無視する */
function applyBalanceDeltas(accounts: Account[], deltas: Record<string, number>): Account[] {
  return accounts.map((a) => (deltas[a.id] ? { ...a, balance: a.balance + deltas[a.id] } : a));
}

/**
 * 取引を保存し、関係する口座の残高も同時に増減する。
 * before は編集前の取引（新規なら null）。
 */
export function saveTransaction(
  data: AppData,
  before: Transaction | null,
  input: TransactionInput,
  now = Date.now(),
): AppData {
  const tx: Transaction = { ...input, id: before?.id ?? newId(), createdAt: before?.createdAt ?? now };
  return {
    ...data,
    transactions: upsert(data.transactions, tx),
    accounts: applyBalanceDeltas(data.accounts, balanceDeltaDiff(before, input)),
  };
}

export function deleteTransaction(data: AppData, tx: Transaction): AppData {
  return {
    ...data,
    transactions: data.transactions.filter((t) => t.id !== tx.id),
    accounts: applyBalanceDeltas(data.accounts, balanceDeltaDiff(tx, null)),
  };
}

// ---- 予算 ----

/** 予算は1対象1件なので、カテゴリIDを ID にする（全体予算は TOTAL_BUDGET_ID） */
export function saveBudget(data: AppData, categoryId: string | null, monthlyAmount: number): AppData {
  return { ...data, budgets: upsert(data.budgets, { id: categoryId ?? TOTAL_BUDGET_ID, categoryId, monthlyAmount }) };
}

export function deleteBudget(data: AppData, id: string): AppData {
  return { ...data, budgets: data.budgets.filter((b) => b.id !== id) };
}

// ---- 目標 ----

export function saveGoal(data: AppData, goal: WithOptionalId<Goal>): AppData {
  return { ...data, goals: upsert(data.goals, { ...goal, id: goal.id ?? newId() }) };
}

export function deleteGoal(data: AppData, id: string): AppData {
  return { ...data, goals: data.goals.filter((g) => g.id !== id) };
}

// ---- 設定 ----

export function updateSettings(data: AppData, patch: Partial<AppSettings>): AppData {
  return { ...data, settings: { ...data.settings, ...patch } };
}
