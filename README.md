# ManageMoney

自分の資産と収支をまとめて管理する Web アプリです。PC でもスマホのブラウザでも使えます。

- **資産**：銀行・現金・証券・暗号資産・クレジットカードなどの口座ごとの残高と総資産
- **収支（家計簿）**：収入・支出・口座間の振替を記録。月ごとの一覧とカテゴリ別の円グラフ
- **予算・目標**：月の予算（全体／カテゴリ別）の使用状況、貯金目標の進捗と毎月の必要額
- **クイック入力**：ホームの「支出」「収入」とよく使うカテゴリのボタンから、すぐ金額を入力できる

データは Firebase（Authentication + Cloud Firestore）に保存されます。ブラウザにもキャッシュされるので、オフラインでも入力でき、つながったときに同期されます。

## 技術構成

- Expo SDK 57 / Expo Router / React Native Web / TypeScript（`expo export -p web` で静的な SPA を出力）
- Firebase JS SDK（Authentication：メール＋パスワード、Firestore：IndexedDB の永続キャッシュ付き）
- ホスティング：Vercel（`vercel.json`）

## セットアップ

### 1. Firebase プロジェクトを作る

1. [Firebase コンソール](https://console.firebase.google.com/) で「プロジェクトを追加」（Google アナリティクスはオフで OK）
2. 「プロジェクトの概要」の **ウェブ（`</>`）アイコン** から Web アプリを追加（Firebase Hosting は不要）
   - 表示される `firebaseConfig` の 6 つの値（apiKey / authDomain / projectId / storageBucket / messagingSenderId / appId）を控える
3. 「Authentication」→「始める」→「ログイン方法」で **メール / パスワード** を有効にする
4. 「Firestore Database」→「データベースを作成」
   - ロケーション：`asia-northeast1`（東京）
   - 「本番環境モード」で作成
5. 「Firestore Database」→「ルール」に [`firestore.rules`](./firestore.rules) の内容を貼り付けて「公開」
   （または `npx firebase-tools deploy --only firestore:rules --project <プロジェクトID>`）

> `firebaseConfig` の値はブラウザに配られる前提の値で、秘密情報ではありません。データは「ログインした本人だけが `users/{自分のuid}/` 配下を読み書きできる」セキュリティルールで守られています。

### 2. ローカルで動かす

```sh
npm install
cp .env.example .env.local   # 控えた firebaseConfig の値を書き込む
npm run web                  # http://localhost:8081 で開く
```

### 3. Vercel で公開する

1. Vercel でこの GitHub リポジトリをインポート（`vercel.json` にビルド設定があるので、フレームワーク等の設定は不要）
2. 「Settings」→「Environment Variables」に `.env.example` の `EXPO_PUBLIC_FIREBASE_*` 6 つを登録
3. デプロイ。以後は push するたびに自動でデプロイされます

> 環境変数（`EXPO_PUBLIC_*`）はビルド時に埋め込まれます。値を変えたら再デプロイしてください。ローカルで `npx expo export` する場合は、`--clear` を付けないと古い値のキャッシュが使われることがあります。

## 使い方のポイント

- 取引に口座を指定すると、その口座の残高が自動で増減します（編集・削除しても正しく戻ります）
- 証券・暗号資産など値動きがあるものは、「資産」タブで口座をタップして評価額を書き換えてください
- クレジットカードは残高をマイナス（未払い額）で管理し、引き落とし時に「振替（銀行 → カード）」を記録すると残高が 0 に戻ります
- 予算は「全体」と「カテゴリ別」を設定できます。ホームの「今月あと○円使えます」は、全体予算があればそれを、なければカテゴリ予算の合計を使います
- ホームのクイック入力に出すカテゴリは「設定」タブで選べます（最大 4 つ）

## 開発

```sh
npm test            # 単体テスト（集計・残高計算・日付と金額の書式）
npm run typecheck   # 型チェック
npm run lint        # ESLint
npm run build       # dist/ に Web 版を出力
```

`EXPO_PUBLIC_FIREBASE_EMULATOR=1` を設定すると、ローカルの Firebase エミュレータ（auth: 9099 / firestore: 8080）につながります（`npx firebase-tools emulators:start --only auth,firestore --project demo-managemoney`）。

### ディレクトリ構成

```
src/
  app/          画面（Expo Router。ファイル＝画面）
    (tabs)/     ホーム・収支・資産・予算目標・設定のタブ
    quick-add.tsx  クイック入力画面（/quick-add?kind=expense&categoryId=food）
  data/         ログイン状態・Firestore の購読（DataProvider）・書き込み（repo）
  lib/          Firebase 初期化・計算（calc）・日付・金額の書式・初期データ
  ui/           共通コンポーネント・取引入力フォーム・ダイアログ・日付入力
firestore.rules Firestore のセキュリティルール
vercel.json     Vercel のビルド設定（SPA のため全パスを index.html に rewrite）
```

### データ構造（Firestore）

すべて `users/{uid}/` の下にあります。

| コレクション | 内容 |
|---|---|
| `accounts` | 口座（名前・種類・残高・並び順・アーカイブ） |
| `categories` | 収入／支出カテゴリ（名前・アイコン・色） |
| `transactions` | 取引（種類・金額・カテゴリ・口座・振替先・日付・メモ） |
| `budgets` | 月の予算（ドキュメントID はカテゴリID、全体は `total`） |
| `goals` | 目標（目標額・期日・進捗に使う口座 or 手入力額） |
| `settings/app` | クイック入力に出すカテゴリ、入力時のデフォルト口座 |
