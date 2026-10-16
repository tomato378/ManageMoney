export type AccountType = 'bank' | 'cash' | 'securities' | 'crypto' | 'credit' | 'other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  /** 円。クレジットカードなどの負債はマイナス */
  balance: number;
  sortOrder: number;
  archived: boolean;
}

export type CategoryKind = 'income' | 'expense';

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  /** Ionicons のアイコン名 */
  icon: string;
  color: string;
  sortOrder: number;
}

export type TransactionKind = 'income' | 'expense' | 'transfer';

export interface Transaction {
  id: string;
  kind: TransactionKind;
  /** 円（正の整数） */
  amount: number;
  categoryId: string | null;
  /** 収入の入金先 / 支出の支払元 / 振替の移動元 */
  accountId: string | null;
  /** 振替の移動先 */
  toAccountId: string | null;
  /** YYYY-MM-DD */
  date: string;
  memo: string;
  createdAt: number;
}

export type TransactionInput = Omit<Transaction, 'id' | 'createdAt'>;

export interface Budget {
  /** カテゴリ予算は categoryId、全体予算は TOTAL_BUDGET_ID */
  id: string;
  /** null なら全体予算 */
  categoryId: string | null;
  monthlyAmount: number;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  /** YYYY-MM-DD */
  targetDate: string | null;
  /** 指定するとその口座の残高を進捗として使う */
  accountId: string | null;
  /** accountId がないときの手入力の現在額 */
  currentAmount: number;
}

export interface AppSettings {
  /** ウィジェットのボタンに出す支出カテゴリ（最大4つ） */
  widgetCategoryIds: string[];
  /** 入力時に最初から選ばれている口座 */
  defaultAccountId: string | null;
}

export const TOTAL_BUDGET_ID = 'total';
