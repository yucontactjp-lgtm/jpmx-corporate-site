// Vercel サーバーレス関数：Claude API へのチャット中継（エンドポイント /api/chat）
// ※ Vercel ではこのファイルが使われます（ローカルの server.js は使われません）
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from '../system-prompt.js';
import { SALON_SYSTEM_PROMPT } from '../system-prompt-salon.js';

// ANTHROPIC_API_KEY は Vercel の環境変数から読み込む（管理画面で設定）
const client = new Anthropic();

export default async function handler(req, res) {
  // POST 以外は受け付けない
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST のみ対応しています' });
    return;
  }

  const { messages, site } = req.body ?? {};

  // 入力の簡易バリデーション
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages が不正です' });
    return;
  }

  // site の値でサイトごとのシステムプロンプトを切り替える（未指定は不動産サイト＝従来どおり）
  const systemPrompt = site === 'salon' ? SALON_SYSTEM_PROMPT : SYSTEM_PROMPT;

  // 役割と本文のみ通し、直近20件・各2000文字までに制限
  const safeMessages = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Claude API へストリーミングでリクエスト
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
    res.write(`data: ${JSON.stringify('（エラーが発生しました。時間をおいて再度お試しください）')}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
}
