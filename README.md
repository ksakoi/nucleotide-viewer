# Nucleotide Viewer

ブラウザだけで動作する軽量な DNA シーケンス波形 (.ab1) ビューアです。
ファイルは File API でローカルに読み込まれ、サーバーへ送信されることはありません。

## 機能 (MVP)

- `.ab1` ファイルのドラッグ＆ドロップ / ファイル選択による読み込み（画面全体がドロップ対象）
- 依存ライブラリなしの ABIF パーサー（`src/lib/abif/parser.ts`）
  - 塩基配列 (PBAS)、ピーク位置 (PLOC)、波形 (DATA9–12 + FWO_)、品質値 (PCON)、サンプル名 (SMPL)
- Canvas による波形描画（A: 緑, T: 赤, C: 青, G: 黒）。表示範囲のみを再描画
- 波形ピークと位置を揃えた塩基テキスト行、品質値バー、10 塩基ごとのルーラー
- 横スクロール、ズーム（スライダー / Ctrl+ホイール）、波形の高さ調整
- 塩基の選択（クリック・← → キー）と、配列パネル ⇔ 波形の連動
- ダークモード

## 開発

```bash
npm install
npm run dev      # 開発サーバー
npm test         # ユニットテスト (Vitest)
npm run build    # 型チェック + 本番ビルド
npm run lint     # oxlint
```

`public/sample.ab1` はデモ用の合成データです（`npm run generate:sample` で再生成）。
実機の .ab1 ファイルでパーサーを検証する場合は、ディレクトリを指定してテストを実行します:

```bash
AB1_FIXTURE_DIR=/path/to/ab1-files npm test
```

## Firebase Hosting へのデプロイ

`firebase.json` に設定済みです（公開ディレクトリ `dist`、SPA リライト、キャッシュ設定）。
`Content-Security-Policy` で `connect-src 'self'` などを指定しており、外部への通信をブラウザ側でも禁止しています。

初回のみ:

```bash
npm install -g firebase-tools   # または各コマンドを npx firebase-tools ... で実行
firebase login
firebase use --add              # Firebase プロジェクトを選択 (.firebaserc が作成されます)
```

デプロイ:

```bash
npm run deploy                  # build + firebase deploy --only hosting
```

公開前に確認したい場合はプレビューチャンネルが使えます（URL は7日で失効）:

```bash
npm run build && firebase hosting:channel:deploy preview --expires 7d
```

### GitHub Actions による自動デプロイ

`.github/workflows/deploy.yml` が次のように動きます。

| きっかけ | 動作 |
| --- | --- |
| すべての push / PR | lint・テスト・ビルド |
| `main` への push | 本番 (`live`) にデプロイ |
| PR（このリポジトリ内のブランチから） | 7日間有効なプレビュー URL にデプロイし、PR にコメント |

リポジトリの Settings → Secrets and variables → Actions に次の2つを登録すると有効になります
（未登録の間はデプロイのジョブがスキップされ、チェックだけ実行されます）。

- **Variables** `FIREBASE_PROJECT_ID`: Firebase のプロジェクト ID
- **Secrets** `FIREBASE_SERVICE_ACCOUNT`: デプロイ用サービスアカウントの JSON キー（ファイルの中身をそのまま貼り付け）

## 技術スタック

React + Vite (TypeScript) / Tailwind CSS v4 + shadcn/ui (new-york) / Lucide React / Zustand / Canvas API
