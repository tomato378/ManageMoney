import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

// EXPO_PUBLIC_* はビルド時に埋め込まれる。process.env.X と直接書かないと置き換わらない
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const useEmulator = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR === '1';

/** 設定値が入っていないときは、アプリの代わりに設定方法の案内を出す */
export const isFirebaseConfigured = useEmulator || (!!firebaseConfig.apiKey && !!firebaseConfig.projectId);

// 未設定でも getAuth などが例外を投げないよう仮の値で初期化しておく（画面側で案内を出すので使われない）
const app = initializeApp(
  useEmulator
    ? { apiKey: 'demo-key', projectId: firebaseConfig.projectId || 'demo-managemoney', authDomain: 'localhost' }
    : isFirebaseConfigured
      ? firebaseConfig
      : { apiKey: 'not-configured', projectId: 'not-configured' },
);

export const auth = getAuth(app);

// ブラウザの IndexedDB にキャッシュし、オフラインでも読み書きできるようにする（複数タブ対応）
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (useEmulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

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
    case 'auth/operation-not-allowed':
      return 'Firebase でメール/パスワードのログインが有効になっていません';
    default:
      return `エラーが発生しました（${code || String(error)}）`;
  }
}
