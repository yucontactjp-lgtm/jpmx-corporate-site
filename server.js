// ジャパンマーベリックス株式会社 コーポレートサイト用サーバー
// 役割：静的サイトの配信と、Claude API を使ったチャットボットの中継（ストリーミング）
import 'dotenv/config';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SYSTEM_PROMPT } from './system-prompt.js';
import { SALON_SYSTEM_PROMPT } from './system-prompt-salon.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ANTHROPIC_API_KEY 環境変数からAPIキーを読み込む（キーはサーバー側にのみ保持し、外部に出さない）
const client = new Anthropic();

app.use(express.json());
app.use(express.static(__dirname)); // index.html などを配信

// チャットエンドポイント（SSEでストリーミング応答）
app.post('/api/chat', async (req, res) => {
  const { messages, site } = req.body ?? {};

  // 入力の簡易バリデーション
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages が不正です' });
  }

  // site の値でサイトごとのシステムプロンプトを切り替える（未指定は不動産サイト＝従来どおり）
  const systemPrompt = site === 'salon' ? SALON_SYSTEM_PROMPT : SYSTEM_PROMPT;

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
      system: systemPrompt,
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
