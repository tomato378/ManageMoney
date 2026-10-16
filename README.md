# ManageMoney

自分の資産と収支をまとめて管理する Android アプリです。

- **資産**：銀行・現金・証券・暗号資産・クレジットカードなどの口座ごとの残高と総資産
- **収支（家計簿）**：収入・支出・口座間の振替を記録。月ごとの一覧とカテゴリ別の円グラフ
- **予算・目標**：月の予算（全体／カテゴリ別）の使用状況、貯金目標の進捗と毎月の必要額
- **ホーム画面ウィジェット**：今月の支出と予算残りを表示。「支出」「収入」とよく使うカテゴリのボタンから、カテゴリ選択済みの入力画面をすぐ開ける

データは Firebase（Firestore）に保存され、オフラインでも入力できます（つながったときに同期されます）。

## 技術構成

- Expo SDK 57 / React Native / TypeScript / Expo Router
- Firebase Authentication（メール＋パスワード）と Cloud Firestore（`@react-native-firebase`）
- ホーム画面ウィジェット：`react-native-android-widget`

ネイティブモジュールを使うため **Expo Go では動きません**。下の手順で開発ビルド（または APK）を作ってください。

## セットアップ

### 1. Firebase プロジェクトを作る

1. [Firebase コンソール](https://console.firebase.google.com/) で「プロジェクトを追加」（Google アナリティクスはオフで OK）
2. プロジェクトの「Android アプリを追加」
   - Android パッケージ名：`com.tomato378.managemoney`
   - `google-services.json` をダウンロードし、**このリポジトリの直下**に置く（`.gitignore` 済みでコミットされません）
3. 「Authentication」→「始める」→「ログイン方法」で **メール / パスワード** を有効にする
4. 「Firestore Database」→「データベースを作成」
   - ロケーション：`asia-northeast1`（東京）
   - 「本番環境モード」で作成
5. セキュリティルールを反映する（どちらか）
   - コンソールの「Firestore Database」→「ルール」に [`firestore.rules`](./firestore.rules) の内容を貼り付けて「公開」
   - または `npx firebase-tools login` のあと `npx firebase-tools deploy --only firestore:rules --project <プロジェクトID>`

> ルールは「ログインした本人だけが `users/{自分のuid}/` 配下を読み書きできる」ようになっています。

### 2. アプリをビルドしてスマホに入れる

Mac や Android Studio がなくても、EAS Build（Expo のクラウドビルド・無料枠あり）で APK を作れます。

```sh
npm install
npx eas-cli@latest login          # Expo アカウント（無料）でログイン
npx eas-cli@latest init           # 初回のみ。EAS プロジェクトを作成
                                  # （app.config.ts に projectId を書くよう案内されたら、表示どおり extra.eas.projectId を追加）

# google-services.json は git に入れないので、EAS の環境変数として登録する（初回のみ）
npx eas-cli@latest env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret --environment preview --environment development

# そのまま使う APK
npx eas-cli@latest build -p android --profile preview
```

ビルドが終わると表示される URL / QR コードからスマホで APK をダウンロードしてインストールします。

#### 開発しながら動かす場合

```sh
npx eas-cli@latest build -p android --profile development   # 開発ビルドを一度作ってインストール
npm start                                                    # 以後はこれでコードの変更が即反映
```

Android Studio がある場合は `npm run android` でローカルにビルドして実機・エミュレータで動かせます。

### 3. ウィジェットを置く

ホーム画面を長押し →「ウィジェット」→「ManageMoney」→「ManageMoney クイック入力」をドラッグ。
ボタンに出すカテゴリはアプリの「設定」タブで選べます（最大4つ）。

## 使い方のポイント

- 取引に口座を指定すると、その口座の残高が自動で増減します（編集・削除しても正しく戻ります）
- 証券・暗号資産など値動きがあるものは、「資産」タブで口座をタップして評価額を書き換えてください
- クレジットカードは残高をマイナス（未払い額）で管理し、引き落とし時に「振替（銀行 → カード）」を記録すると残高が 0 に戻ります
- 予算は「全体」と「カテゴリ別」を設定できます。ウィジェットとホームの「予算残り」は、全体予算があればそれを、なければカテゴリ予算の合計を使います

## 開発

```sh
npm test            # 単体テスト（集計・残高計算・ウィジェット表示データ）
npm run typecheck   # 型チェック
npm run lint        # ESLint
```

### ディレクトリ構成

```
src/
  app/          画面（Expo Router。ファイル＝画面）
    (tabs)/     ホーム・収支・資産・予算目標・設定のタブ
    quick-add.tsx  ウィジェットから開く入力画面（managemoney://quick-add?kind=expense&categoryId=food）
  data/         ログイン状態・Firestore の購読（DataProvider）・書き込み（repo）
  lib/          計算（calc）・日付・金額の書式・初期データ
  ui/           共通コンポーネントと取引入力フォーム
  widget/       ホーム画面ウィジェットの見た目・描画処理・表示データのキャッシュ
firestore.rules Firestore のセキュリティルール
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
| `settings/app` | ウィジェットのボタンに出すカテゴリ、入力時のデフォルト口座 |
