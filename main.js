// ===== 全ページ共通スクリプト =====

// マウスに反応して背景の光がわずかに動く演出
const glows = document.querySelectorAll('.glow');
window.addEventListener('mousemove', (e) => {
  const x = (e.clientX / window.innerWidth - 0.5);
  const y = (e.clientY / window.innerHeight - 0.5);
  glows.forEach((g, i) => {
    const f = (i + 1) * 12;
    g.style.transform = `translate(${x * f}px, ${y * f}px)`;
  });
});

// スマホ用ハンバーガーメニューの開閉
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });
  // メニュー内リンクをタップしたら閉じる
  navLinks.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => navLinks.classList.remove('open'));
  });
}

// ===== チャットボットのUI制御とサーバー通信 =====
const chatToggle = document.getElementById('chatToggle');
const chatPanel = document.getElementById('chatPanel');
const chatBody = document.getElementById('chatBody');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');
const chatHistory = []; // APIへ送る会話履歴

if (chatToggle && chatPanel) {
  // パネルの開閉
  chatToggle.addEventListener('click', () => {
    chatPanel.classList.toggle('open');
    if (chatPanel.classList.contains('open')) {
      // 初回オープン時に挨拶を表示
      if (chatBody.childElementCount === 0) {
        addChatMsg('bot', 'こんにちは！ジャパンマーベリックス株式会社のAIアシスタントです。事業内容やお問い合わせについて、お気軽にご質問ください。');
      }
      chatInput.focus();
    }
  });

  chatSend.addEventListener('click', sendChat);
  chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
}

// メッセージ要素を追加して返す
function addChatMsg(role, text) {
  const el = document.createElement('div');
  el.className = 'chat-msg ' + role;
  el.textContent = text;
  chatBody.appendChild(el);
  chatBody.scrollTop = chatBody.scrollHeight;
  return el;
}

// 送信処理（サーバーからのストリーミング応答を逐次表示）
async function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';
  addChatMsg('user', text);
  chatHistory.push({ role: 'user', content: text });
  chatInput.disabled = chatSend.disabled = true;

  const botEl = addChatMsg('bot', '');
  let reply = '';
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: chatHistory }),
    });
    if (!res.ok || !res.body) throw new Error('応答エラー');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    // SSE(Server-Sent Events)形式のストリームを読み取る
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop(); // 未完の行は次回へ持ち越し
      for (const part of parts) {
        if (!part.startsWith('data: ')) continue;
        const data = part.slice(6);
        if (data === '[DONE]') continue;
        reply += JSON.parse(data);
        botEl.textContent = reply;
        chatBody.scrollTop = chatBody.scrollHeight;
      }
    }
    chatHistory.push({ role: 'assistant', content: reply });
  } catch (e) {
    botEl.textContent = '申し訳ございません。接続に問題が発生しました。しばらくしてから再度お試しください。';
  } finally {
    chatInput.disabled = chatSend.disabled = false;
    chatInput.focus();
  }
}
