# ジャパンマーベリックス株式会社 コーポレートサイト

AIチャットボット（Claude API）付きのコーポレートサイトです。

## 構成

| ファイル | 役割 |
| --- | --- |
| `index.html` | サイト本体（1ページ縦長スクロール型・フロントエンド） |
| `styles.css` | サイトのスタイル |
| `main.js` | スクリプト（ナビ・チャットUI） |
| `system-prompt.js` | チャットボットのシステムプロンプト（共通） |
| `server.js` | ローカル開発用サーバー（静的配信＋API中継） |
| `api/chat.js` | Vercel用サーバーレス関数（チャットAPI） |
| `package.json` | Node.js プロジェクト設定 |
| `.env.example` | APIキー設定のひな形（ローカル用） |

チャットボットは、APIキーを安全に扱うためにサーバー（`server.js`）経由で Claude API を呼び出します。
**APIキーはサーバー側にのみ保持され、ブラウザ（HTML）には一切含まれません。**

## セットアップ手順

### 1. Node.js をインストール

まだの場合は [https://nodejs.org](https://nodejs.org) から LTS 版をインストールしてください。
（Homebrew をお使いの場合は `brew install node` でも可）

インストール確認：

```bash
node -v
npm -v
```

### 2. 依存パッケージをインストール

このフォルダ内で以下を実行します。

```bash
npm install express @anthropic-ai/sdk dotenv
```

### 3. APIキーを設定

1. [https://console.anthropic.com](https://console.anthropic.com) でAPIキーを発行します。
2. `.env.example` をコピーして `.env` というファイルを作成します。
3. `.env` の `ANTHROPIC_API_KEY=...` に発行したキーを貼り付けます。

> ⚠️ `.env` ファイルは絶対に他人に共有・公開しないでください（`.gitignore` で除外済みです）。

### 4. サーバーを起動

```bash
npm start
```

ブラウザで **http://localhost:3000** を開くとサイトが表示され、右下のボタンからチャットボットを利用できます。

## Vercel へのデプロイ

このプロジェクトは Vercel に対応しています。

- 静的ファイル（`index.html` / `styles.css` / `main.js`）は Vercel が自動配信します。
- チャットAPIは `api/chat.js`（サーバーレス関数）として `/api/chat` で動作します。
- `server.js` はローカル開発専用で、Vercel では使われません。

### 設定手順

1. Vercel でこの GitHub リポジトリをインポートします。
2. **Root Directory** は空欄（`./`）のままにします（`index.html` はリポジトリ直下にあります）。
3. **Settings → Environment Variables** で以下を追加します。
   - Key: `ANTHROPIC_API_KEY`
   - Value: 発行したAPIキー（`sk-ant-...`）
   - 対象環境：Production / Preview / Development すべて
4. 環境変数を追加したら **Deployments から再デプロイ（Redeploy）** します。

> `.env` はGitHubにアップロードされないため、Vercel では上記の環境変数設定が必須です。

## 補足

- 使用モデル：`claude-opus-4-8`（応答はストリーミングで逐次表示）
- チャットボットの応答内容や口調は `system-prompt.js` の `SYSTEM_PROMPT` で調整できます（ローカル・Vercel 共通）。
- API利用には Anthropic の利用料金が発生します（モデル・トークン量に応じた従量課金）。
