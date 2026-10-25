import type { Account, AccountType, AppSettings, Category } from '@/types';

/** 初回ログイン時に作るカテゴリ。ID を固定して二重作成を防ぐ */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'food', name: '食費', kind: 'expense', icon: 'restaurant', color: '#F97316', sortOrder: 0 },
  { id: 'daily', name: '日用品', kind: 'expense', icon: 'cart', color: '#EAB308', sortOrder: 1 },
  { id: 'transport', name: '交通', kind: 'expense', icon: 'train', color: '#3B82F6', sortOrder: 2 },
  { id: 'hobby', name: '娯楽', kind: 'expense', icon: 'game-controller', color: '#EC4899', sortOrder: 3 },
  { id: 'housing', name: '住居', kind: 'expense', icon: 'home', color: '#8B5CF6', sortOrder: 4 },
  { id: 'utility', name: '水道光熱', kind: 'expense', icon: 'flash', color: '#06B6D4', sortOrder: 5 },
  { id: 'phone', name: '通信', kind: 'expense', icon: 'phone-portrait', color: '#6366F1', sortOrder: 6 },
  { id: 'clothes', name: '衣服', kind: 'expense', icon: 'shirt', color: '#14B8A6', sortOrder: 7 },
  { id: 'medical', name: '医療', kind: 'expense', icon: 'medkit', color: '#EF4444', sortOrder: 8 },
  { id: 'other-expense', name: 'その他', kind: 'expense', icon: 'ellipsis-horizontal', color: '#6B7280', sortOrder: 9 },
  { id: 'salary', name: '給与', kind: 'income', icon: 'cash', color: '#16A34A', sortOrder: 0 },
  { id: 'side-job', name: '副業', kind: 'income', icon: 'briefcase', color: '#0EA5E9', sortOrder: 1 },
  { id: 'other-income', name: 'その他収入', kind: 'income', icon: 'gift', color: '#84CC16', sortOrder: 2 },
];

export const DEFAULT_ACCOUNT: Account = {
  id: 'cash',
  name: '財布',
  type: 'cash',
  balance: 0,
  sortOrder: 0,
  archived: false,
};

export const DEFAULT_SETTINGS: AppSettings = {
  quickCategoryIds: ['food', 'daily', 'transport', 'hobby'],
  defaultAccountId: DEFAULT_ACCOUNT.id,
};

export const ACCOUNT_TYPES: { type: AccountType; label: string; icon: string }[] = [
  { type: 'bank', label: '銀行', icon: 'business' },
  { type: 'cash', label: '現金', icon: 'wallet' },
  { type: 'securities', label: '証券', icon: 'trending-up' },
  { type: 'crypto', label: '暗号資産', icon: 'logo-bitcoin' },
  { type: 'credit', label: 'クレカ', icon: 'card' },
  { type: 'other', label: 'その他', icon: 'cube' },
];

export function accountTypeLabel(type: AccountType): string {
  return ACCOUNT_TYPES.find((t) => t.type === type)?.label ?? type;
}

export const CATEGORY_COLORS = [
  '#F97316',
  '#EAB308',
  '#84CC16',
  '#16A34A',
  '#14B8A6',
  '#06B6D4',
  '#0EA5E9',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#EF4444',
  '#6B7280',
];

export const CATEGORY_ICONS = [
  'restaurant',
  'cafe',
  'beer',
  'cart',
  'basket',
  'train',
  'car',
  'airplane',
  'home',
  'flash',
  'water',
  'phone-portrait',
  'wifi',
  'shirt',
  'cut',
  'medkit',
  'fitness',
  'school',
  'book',
  'game-controller',
  'film',
  'musical-notes',
  'gift',
  'paw',
  'heart',
  'people',
  'cash',
  'briefcase',
  'trending-up',
  'card',
  'receipt',
  'ellipsis-horizontal',
];
