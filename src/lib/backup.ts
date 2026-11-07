import type { AppData } from '@/data/state';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, UNKNOWN_EXPENSE_ID, UNKNOWN_INCOME_ID } from './defaults';

const APP = 'managemoney';
const VERSION = 1;

interface BackupFile {
  app: typeof APP;
  version: number;
  exportedAt: string;
  data: AppData;
}

const LIST_KEYS = ['accounts', 'categories', 'transactions', 'budgets', 'goals'] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 後から増えた一覧。古いデータになければ空で始める */
const OPTIONAL_LIST_KEYS = ['recurring', 'balanceChecks'] as const;

/** 残高チェックに必要なので、古いデータにもなければ足すカテゴリ */
const REQUIRED_CATEGORY_IDS = [UNKNOWN_EXPENSE_ID, UNKNOWN_INCOME_ID];

/**
 * 保存データ・バックアップの中身として形が正しければ AppData に整えて返す。
 * 古い形のデータは、足りない一覧・設定・カテゴリを既定値で補う。
 */
export function normalizeData(value: unknown): AppData | null {
  if (!isObject(value)) return null;
  if (!LIST_KEYS.every((key) => Array.isArray(value[key]))) return null;
  const settings = isObject(value.settings) ? value.settings : {};
  const paymentAccountIds = isObject(settings.paymentAccountIds) ? settings.paymentAccountIds : {};
  const categories = value.categories as AppData['categories'];
  const missingCategories = DEFAULT_CATEGORIES.filter(
    (c) => REQUIRED_CATEGORY_IDS.includes(c.id) && !categories.some((existing) => existing.id === c.id),
  ).map((c) => ({ ...c }));
  const [recurring, balanceChecks] = OPTIONAL_LIST_KEYS.map((key) => (Array.isArray(value[key]) ? value[key] : []));
  return {
    accounts: value.accounts as AppData['accounts'],
    categories: [...categories, ...missingCategories],
    transactions: value.transactions as AppData['transactions'],
    budgets: value.budgets as AppData['budgets'],
    goals: value.goals as AppData['goals'],
    recurring: recurring as AppData['recurring'],
    balanceChecks: balanceChecks as AppData['balanceChecks'],
    settings: {
      ...DEFAULT_SETTINGS,
      ...settings,
      paymentAccountIds: { ...DEFAULT_SETTINGS.paymentAccountIds, ...paymentAccountIds },
    } as AppData['settings'],
  };
}

export function serializeBackup(data: AppData, exportedAt = new Date()): string {
  const file: BackupFile = { app: APP, version: VERSION, exportedAt: exportedAt.toISOString(), data };
  return JSON.stringify(file, null, 2);
}

export type ParseResult = { ok: true; data: AppData; exportedAt: string | null } | { ok: false; error: string };

export function parseBackup(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'JSON ファイルとして読み込めませんでした' };
  }
  if (!isObject(json) || json.app !== APP) {
    return { ok: false, error: 'ManageMoney のバックアップファイルではありません' };
  }
  if (typeof json.version !== 'number' || json.version > VERSION) {
    return { ok: false, error: 'このバックアップは新しいバージョンのアプリで作られています' };
  }
  const data = normalizeData(json.data);
  if (!data) return { ok: false, error: 'バックアップの中身が壊れています' };
  return { ok: true, data, exportedAt: typeof json.exportedAt === 'string' ? json.exportedAt : null };
}

export function backupFileName(date: string): string {
  return `managemoney-${date}.json`;
}
