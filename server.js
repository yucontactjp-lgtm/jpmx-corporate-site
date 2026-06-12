// ジャパンマーベリックス株式会社 コーポレートサイト用サーバー
// 役割：静的サイトの配信と、Claude API を使ったチャットボットの中継（ストリーミング）
import 'dotenv/config';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ANTHROPIC_API_KEY 環境変数からAPIキーを読み込む（キーはサーバー側にのみ保持し、外部に出さない）
const client = new Anthropic();

app.use(express.json());
app.use(express.static(__dirname)); // index.html などを配信

// チャットボットの人格・知識を定義するシステムプロンプト
const SYSTEM_PROMPT = `あなたはジャパンマーベリックス株式会社の公式サイトに常駐するAIアシスタントです。
丁寧で親しみやすい日本語で、簡潔に回答してください。

# 会社情報
- 会社名：ジャパンマーベリックス株式会社
- 代表者：生貝 和也
- 所在地：千葉県
- 事業内容：コンサルティング、電気通信工事業、電気工事業、セールスマーケティング
- お問い合わせ：サイト下部のお問い合わせフォーム（メール・電話）から受け付けています。

# 回答の方針
- 上記の会社情報に基づいて回答してください。
- 分からないことや確証のないことは推測で断言せず、「お問い合わせフォームよりご連絡ください」とご案内してください。
- 料金や個別の契約内容など詳細な情報は、お問い合わせへ誘導してください。
- 思考の過程は出力せず、最終的な回答のみを述べてください。`;

// チャットエンドポイント（SSEでストリーミング応答）
app.post('/api/chat', async (req, res) => {
  const { messages } = req.body ?? {};

  // 入力の簡易バリデーション
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages が不正です' });
  }

  // 役割と本文のみ通し、直近20件・各2000文字までに制限（過大な入力を防ぐ）
  const safeMessages = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Claude APIへストリーミングでリクエスト
    const stream = client.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: safeMessages,
    });

    // テキストの差分を逐次クライアントへ送信
    stream.on('text', (delta) => {
      res.write(`data: ${JSON.stringify(delta)}\n\n`);
    });

    await stream.finalMessage();
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Claude API エラー:', err);
    // 途中までの接続でもクライアントが終了を検知できるようにする
    res.write(`data: ${JSON.stringify('（エラーが発生しました。時間をおいて再度お試しください）')}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`サーバーを起動しました： http://localhost:${PORT}`);
});
