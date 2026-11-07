import { balanceDeltaDiff } from '@/lib/calc';
import { addMonths, dayInMonth, monthOf } from '@/lib/date';
import {
  DEFAULT_ACCOUNT,
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
  UNKNOWN_EXPENSE_ID,
  UNKNOWN_INCOME_ID,
} from '@/lib/defaults';
import {
  TOTAL_BUDGET_ID,
  type Account,
  type AppSettings,
  type BalanceCheck,
  type Budget,
  type Category,
  type Goal,
  type RecurringItem,
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
  recurring: RecurringItem[];
  balanceChecks: BalanceCheck[];
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
    recurring: [],
    balanceChecks: [],
    settings: {
      ...DEFAULT_SETTINGS,
      quickCategoryIds: [...DEFAULT_SETTINGS.quickCategoryIds],
      paymentAccountIds: { ...DEFAULT_SETTINGS.paymentAccountIds },
    },
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
  /** 新規のとき、呼び出し側で決めた ID を使う（後から開けるように） */
  id?: string,
): AppData {
  const tx: Transaction = { ...input, id: before?.id ?? id ?? newId(), createdAt: before?.createdAt ?? now };
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

/** 複数の取引をまとめて保存する（レシートのまとめ読み取りなど） */
export function saveTransactions(data: AppData, inputs: TransactionInput[], now = Date.now()): AppData {
  return inputs.reduce((d, input) => saveTransaction(d, null, input, now), data);
}

// ---- 残高チェック ----

export const ADJUSTMENT_MEMO = '残高チェックで調整';

/**
 * 実際の残高（口座ID → 円。クレカの未払いはマイナス）に合わせて記録を調整する。
 * 増えた口座と減った口座があれば、まず振替として相殺する（記録し忘れた引き落としやチャージなど）。
 * 残った差は「使途不明金」（減った）／「使途不明の収入」（増えた）として記録する。
 */
export function reconcileBalances(
  data: AppData,
  actuals: Record<string, number>,
  date: string,
  now = Date.now(),
): AppData {
  const entries: BalanceCheck['entries'] = [];
  const surplus: { accountId: string; amount: number }[] = [];
  const shortage: { accountId: string; amount: number }[] = [];
  for (const account of data.accounts) {
    const actual = actuals[account.id];
    if (actual === undefined || account.archived) continue;
    entries.push({ accountId: account.id, recorded: account.balance, actual });
    const diff = actual - account.balance;
    if (diff > 0) surplus.push({ accountId: account.id, amount: diff });
    if (diff < 0) shortage.push({ accountId: account.id, amount: -diff });
  }
  if (entries.length === 0) return data;

  const inputs: TransactionInput[] = [];
  const base = { date, memo: ADJUSTMENT_MEMO, toAccountId: null, categoryId: null };
  // 大きい順に組み合わせると、振替の件数が少なくて済む
  surplus.sort((a, b) => b.amount - a.amount);
  shortage.sort((a, b) => b.amount - a.amount);
  let i = 0;
  let j = 0;
  while (i < surplus.length && j < shortage.length) {
    const amount = Math.min(surplus[i].amount, shortage[j].amount);
    inputs.push({ ...base, kind: 'transfer', amount, accountId: shortage[j].accountId, toAccountId: surplus[i].accountId });
    surplus[i].amount -= amount;
    shortage[j].amount -= amount;
    if (surplus[i].amount === 0) i++;
    if (shortage[j].amount === 0) j++;
  }
  for (const s of surplus.slice(i)) {
    if (s.amount > 0) inputs.push({ ...base, kind: 'income', amount: s.amount, accountId: s.accountId, categoryId: UNKNOWN_INCOME_ID });
  }
  for (const s of shortage.slice(j)) {
    if (s.amount > 0) inputs.push({ ...base, kind: 'expense', amount: s.amount, accountId: s.accountId, categoryId: UNKNOWN_EXPENSE_ID });
  }

  const reconciled = saveTransactions(data, inputs, now);
  return { ...reconciled, balanceChecks: [...data.balanceChecks, { id: newId(), date, entries }] };
}

// ---- 毎月の収入・固定費 ----

/** 何か月も開かなかったときに作りすぎないよう、追いつくのはこの月数まで */
const MAX_CATCH_UP_MONTHS = 24;

export function saveRecurring(data: AppData, item: WithOptionalId<RecurringItem>): AppData {
  return { ...data, recurring: upsert(data.recurring, { ...item, id: item.id ?? newId() }) };
}

export function deleteRecurring(data: AppData, id: string): AppData {
  return { ...data, recurring: data.recurring.filter((r) => r.id !== id) };
}

/** 指定日を過ぎた毎月の収入・固定費を取引にする。開くたびに呼んでよい（同じ月は二度作らない） */
export function postDueRecurring(data: AppData, today: string, now = Date.now()): AppData {
  const thisMonth = monthOf(today);
  let next = data;
  let changed = false;
  const recurring = data.recurring.map((item) => {
    let month = item.lastPostedMonth ? addMonths(item.lastPostedMonth, 1) : item.startMonth;
    const earliest = addMonths(thisMonth, -(MAX_CATCH_UP_MONTHS - 1));
    if (month < earliest) month = earliest;
    let lastPostedMonth = item.lastPostedMonth;
    while (month <= thisMonth) {
      const date = dayInMonth(month, item.dayOfMonth);
      if (date > today) break;
      next = saveTransaction(
        next,
        null,
        {
          kind: item.kind,
          amount: item.amount,
          categoryId: item.categoryId,
          accountId: item.accountId,
          toAccountId: null,
          date,
          memo: item.name,
        },
        now,
      );
      lastPostedMonth = month;
      month = addMonths(month, 1);
    }
    if (lastPostedMonth === item.lastPostedMonth) return item;
    changed = true;
    return { ...item, lastPostedMonth };
  });
  return changed ? { ...next, recurring } : data;
}

// ---- 設定 ----

export function updateSettings(data: AppData, patch: Partial<AppSettings>): AppData {
  return { ...data, settings: { ...data.settings, ...patch } };
}
