import type { Account, AppSettings, Category, Goal, RecurringItem, Transaction, TransactionInput } from '@/types';
import * as state from './state';
import { update } from './store';

// 画面から呼ぶ書き込み操作。中身は state.ts の純粋関数で、保存は store.ts が行う

type WithOptionalId<T extends { id: string }> = Omit<T, 'id'> & { id?: string };

export function saveAccount(account: WithOptionalId<Account>) {
  update((d) => state.saveAccount(d, account));
}

export function archiveAccount(id: string) {
  update((d) => state.archiveAccount(d, id));
}

export function saveCategory(category: WithOptionalId<Category>) {
  update((d) => state.saveCategory(d, category));
}

export function deleteCategory(id: string) {
  update((d) => state.deleteCategory(d, id));
}

export function saveTransaction(before: Transaction | null, input: TransactionInput) {
  update((d) => state.saveTransaction(d, before, input));
}

/** 新しい取引を保存して、その ID を返す */
export function addTransaction(input: TransactionInput): string {
  const id = state.newId();
  update((d) => state.saveTransaction(d, null, input, Date.now(), id));
  return id;
}

export function deleteTransaction(tx: Transaction) {
  update((d) => state.deleteTransaction(d, tx));
}

export function saveBudget(categoryId: string | null, monthlyAmount: number) {
  update((d) => state.saveBudget(d, categoryId, monthlyAmount));
}

export function deleteBudget(id: string) {
  update((d) => state.deleteBudget(d, id));
}

export function saveGoal(goal: WithOptionalId<Goal>) {
  update((d) => state.saveGoal(d, goal));
}

export function deleteGoal(id: string) {
  update((d) => state.deleteGoal(d, id));
}

export function updateSettings(patch: Partial<AppSettings>) {
  update((d) => state.updateSettings(d, patch));
}

export function saveTransactions(inputs: TransactionInput[]) {
  update((d) => state.saveTransactions(d, inputs));
}

export function reconcileBalances(actuals: Record<string, number>, date: string) {
  update((d) => state.reconcileBalances(d, actuals, date));
}

export function saveRecurring(item: WithOptionalId<RecurringItem>) {
  update((d) => state.saveRecurring(d, item));
}

export function deleteRecurring(id: string) {
  update((d) => state.deleteRecurring(d, id));
}

export function postDueRecurring(today: string) {
  update((d) => state.postDueRecurring(d, today));
}
