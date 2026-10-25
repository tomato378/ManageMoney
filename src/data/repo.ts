import { deleteDoc, doc, getDocFromServer, increment, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

import { balanceDeltaDiff } from '@/lib/calc';
import { DEFAULT_ACCOUNT, DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '@/lib/defaults';
import { db, settingsDoc, userCollection, userDoc } from '@/lib/firebase';
import { notify } from '@/ui/dialog';
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

/**
 * Firestore の書き込みはオフラインでもローカルに即反映されるが、
 * Promise はサーバーに届くまで解決しない。画面は待たずに進め、失敗だけ知らせる。
 */
export function runWrite(promise: Promise<unknown>) {
  promise.catch((error) => {
    notify('保存できませんでした', String(error?.message ?? error));
  });
}

function newId(uid: string, name: 'accounts' | 'categories' | 'transactions' | 'goals'): string {
  return doc(userCollection(uid, name)).id;
}

function withoutId<T extends { id: string }>(value: T): Omit<T, 'id'> {
  const { id: _id, ...rest } = value;
  return rest;
}

/**
 * 初回ログイン時にカテゴリ・口座・設定の初期データを作る。
 * キャッシュの「なし」で既存データを上書きしないよう、サーバーで確認できたときだけ作る。
 */
export async function seedDefaultsIfNeeded(uid: string) {
  const snapshot = await getDocFromServer(settingsDoc(uid));
  if (snapshot.exists()) return;
  const batch = writeBatch(db);
  for (const category of DEFAULT_CATEGORIES) {
    batch.set(userDoc(uid, 'categories', category.id), withoutId(category));
  }
  batch.set(userDoc(uid, 'accounts', DEFAULT_ACCOUNT.id), withoutId(DEFAULT_ACCOUNT));
  batch.set(settingsDoc(uid), DEFAULT_SETTINGS);
  await batch.commit();
}

// ---- 口座 ----

export function saveAccount(uid: string, account: Omit<Account, 'id'> & { id?: string }) {
  const id = account.id ?? newId(uid, 'accounts');
  return setDoc(userDoc(uid, 'accounts', id), withoutId({ ...account, id }));
}

/** 取引から参照されている可能性があるので、口座は消さずにアーカイブする */
export function archiveAccount(uid: string, id: string) {
  return updateDoc(userDoc(uid, 'accounts', id), { archived: true });
}

// ---- カテゴリ ----

export function saveCategory(uid: string, category: Omit<Category, 'id'> & { id?: string }) {
  const id = category.id ?? newId(uid, 'categories');
  return setDoc(userDoc(uid, 'categories', id), withoutId({ ...category, id }));
}

export function deleteCategory(uid: string, id: string) {
  return deleteDoc(userDoc(uid, 'categories', id));
}

// ---- 取引 ----

/**
 * 取引を保存し、関係する口座の残高を同じ batch で増減する。
 * before は編集前の取引（新規なら null）。
 */
export function saveTransaction(
  uid: string,
  before: Transaction | null,
  input: TransactionInput,
  existingAccountIds: Set<string>,
) {
  const id = before?.id ?? newId(uid, 'transactions');
  const batch = writeBatch(db);
  const data: Omit<Transaction, 'id'> = { ...input, createdAt: before?.createdAt ?? Date.now() };
  batch.set(userDoc(uid, 'transactions', id), data);
  applyBalanceDeltas(batch, uid, balanceDeltaDiff(before, input), existingAccountIds);
  return batch.commit();
}

export function deleteTransaction(uid: string, tx: Transaction, existingAccountIds: Set<string>) {
  const batch = writeBatch(db);
  batch.delete(userDoc(uid, 'transactions', tx.id));
  applyBalanceDeltas(batch, uid, balanceDeltaDiff(tx, null), existingAccountIds);
  return batch.commit();
}

function applyBalanceDeltas(
  batch: ReturnType<typeof writeBatch>,
  uid: string,
  deltas: Record<string, number>,
  existingAccountIds: Set<string>,
) {
  for (const [accountId, delta] of Object.entries(deltas)) {
    // 存在しない口座を update すると batch 全体が失敗するので飛ばす
    if (!existingAccountIds.has(accountId)) continue;
    batch.update(userDoc(uid, 'accounts', accountId), { balance: increment(delta) });
  }
}

// ---- 予算 ----

/** 予算は1カテゴリ1件なので、カテゴリIDをドキュメントIDにする */
export function saveBudget(uid: string, categoryId: string | null, monthlyAmount: number) {
  const id = categoryId ?? TOTAL_BUDGET_ID;
  const data: Omit<Budget, 'id'> = { categoryId, monthlyAmount };
  return setDoc(userDoc(uid, 'budgets', id), data);
}

export function deleteBudget(uid: string, id: string) {
  return deleteDoc(userDoc(uid, 'budgets', id));
}

// ---- 目標 ----

export function saveGoal(uid: string, goal: Omit<Goal, 'id'> & { id?: string }) {
  const id = goal.id ?? newId(uid, 'goals');
  return setDoc(userDoc(uid, 'goals', id), withoutId({ ...goal, id }));
}

export function deleteGoal(uid: string, id: string) {
  return deleteDoc(userDoc(uid, 'goals', id));
}

// ---- 設定 ----

export function updateSettings(uid: string, patch: Partial<AppSettings>) {
  return setDoc(settingsDoc(uid), patch, { merge: true });
}
