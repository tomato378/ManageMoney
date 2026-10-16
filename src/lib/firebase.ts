import { getAuth } from '@react-native-firebase/auth';
import { collection, doc, getFirestore } from '@react-native-firebase/firestore';

export const auth = getAuth();
export const db = getFirestore();

export type UserCollection = 'accounts' | 'categories' | 'transactions' | 'budgets' | 'goals' | 'settings';

export function userCollection(uid: string, name: UserCollection) {
  return collection(db, 'users', uid, name);
}

export function userDoc(uid: string, name: UserCollection, id: string) {
  return doc(db, 'users', uid, name, id);
}

export function settingsDoc(uid: string) {
  return userDoc(uid, 'settings', 'app');
}

/** Firebase Auth のエラーコードを日本語のメッセージにする */
export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'メールアドレスの形式が正しくありません';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'メールアドレスかパスワードが違います';
    case 'auth/email-already-in-use':
      return 'このメールアドレスはすでに登録されています';
    case 'auth/weak-password':
      return 'パスワードは6文字以上にしてください';
    case 'auth/too-many-requests':
      return '試行回数が多すぎます。しばらくしてからお試しください';
    case 'auth/network-request-failed':
      return 'ネットワークに接続できません';
    default:
      return `エラーが発生しました（${code || String(error)}）`;
  }
}
