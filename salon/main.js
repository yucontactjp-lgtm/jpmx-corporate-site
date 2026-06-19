// ===== LUMINE hair & spa 共通スクリプト =====

// JSが動作していることを示す印（CSSのスクロール出現演出はこのクラスがある時のみ有効）
document.documentElement.classList.add('js');

// スクロールでヘッダーに影を付ける
const nav = document.getElementById('nav');
if (nav) {
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 20);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

// スマホ用ハンバーガーメニューの開閉
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
  // メニュー内リンクをタップしたら閉じる
  navLinks.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => navLinks.classList.remove('open'));
  });
}

// ===== スクロールで各セクションをふわっと表示 =====
const reveals = document.querySelectorAll('.reveal');
if (reveals.length && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target); // 一度だけ実行
      }
    });
  }, { threshold: 0.15 });
  reveals.forEach((el) => io.observe(el));
} else {
  // IntersectionObserver 非対応環境では常に表示
  reveals.forEach((el) => el.classList.add('is-visible'));
}

// ===== チャットボットのUI制御とサーバー通信 =====
const chatToggle = document.getElementById('chatToggle');
const chatPanel = document.getElementById('chatPanel');
const chatClose = document.getElementById('chatClose');
const chatBody = document.getElementById('chatBody');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');
const chatHistory = []; // APIへ送る会話履歴

if (chatToggle && chatPanel) {
  // パネルを開く
  const openChat = () => {
    chatPanel.classList.add('open');
    // 初回オープン時に挨拶を表示
    if (chatBody.childElementCount === 0) {
      addChatMsg('bot', 'こんにちは！LUMINE hair & spa のAIアシスタント「ルミネちゃん」です🌿 ヘアメニューやご予約、ヘアケアのご相談など、お気軽にどうぞ。');
    }
    chatInput.focus();
  };

  chatToggle.addEventListener('click', () => {
    chatPanel.classList.contains('open') ? chatPanel.classList.remove('open') : openChat();
  });
  if (chatClose) chatClose.addEventListener('click', () => chatPanel.classList.remove('open'));

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
      // site:'salon' を付与してサーバー側で美容室用プロンプトに切り替える
      body: JSON.stringify({ messages: chatHistory, site: 'salon' }),
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
