/* ============================================================
   AerospaceBot v2 — Chat Logic
   ============================================================ */
'use strict';

// ── State ────────────────────────────────────────────────────
const state = {
  messages: [],
  isLoading: false,
  apiKey: '',
};

// ── DOM ──────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const DOM = {
  chatArea:     () => $('chatArea'),
  welcome:      () => $('welcomeScreen'),
  input:        () => $('messageInput'),
  sendBtn:      () => $('sendBtn'),
  typing:       () => $('typingIndicator'),
  errorToast:   () => $('errorToast'),
  errorMsg:     () => $('errorMsg'),
  apiKeyInput:  () => $('apiKeyInput'),
  apiToggleBtn: () => $('apiToggleBtn'),
  apiSaveBtn:   () => $('apiSaveBtn'),
  statusDot:    () => $('statusDot'),
  statusText:   () => $('statusText'),
  sidebar:      () => $('sidebar'),
  overlay:      () => $('sidebarOverlay'),
  hamburger:    () => $('hamburgerBtn'),
  newChat:      () => $('newChatBtn'),
};

// ── Starfield ────────────────────────────────────────────────
function initStarfield() {
  const canvas = $('starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, stars = [], meteors = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function buildStars(n) {
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.2 + 0.2,
      a: Math.random() * 0.65 + 0.1,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.008 + 0.003,
      hue: Math.random() < 0.12 ? (Math.random() < 0.5 ? 214 : 250) : 0,
    }));
  }

  function spawnMeteor() {
    if (Math.random() < 0.003) {
      meteors.push({
        x: Math.random() * W * 0.7 + W * 0.1,
        y: Math.random() * H * 0.4,
        len: Math.random() * 140 + 80,
        vx: 8 + Math.random() * 8,
        vy: 3 + Math.random() * 4,
        a: 1,
      });
    }
  }

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    frame++;

    stars.forEach(s => {
      s.phase += s.speed;
      const brightness = s.a + Math.sin(s.phase) * 0.25;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      if (s.hue === 214) {
        ctx.fillStyle = `rgba(96,165,250,${Math.min(brightness, 1)})`;
      } else if (s.hue === 250) {
        ctx.fillStyle = `rgba(129,140,248,${Math.min(brightness, 1)})`;
      } else {
        ctx.fillStyle = `rgba(240,246,255,${Math.min(brightness, 1)})`;
      }
      ctx.fill();
    });

    spawnMeteor();
    meteors = meteors.filter(m => m.a > 0.02);
    meteors.forEach(m => {
      m.x += m.vx; m.y += m.vy; m.a *= 0.964;
      const grd = ctx.createLinearGradient(m.x - m.vx * m.len / 12, m.y - m.vy * m.len / 12, m.x, m.y);
      grd.addColorStop(0, `rgba(148,163,184,0)`);
      grd.addColorStop(1, `rgba(186,214,255,${m.a})`);
      ctx.beginPath();
      ctx.moveTo(m.x - m.vx * m.len / 12, m.y - m.vy * m.len / 12);
      ctx.lineTo(m.x, m.y);
      ctx.strokeStyle = grd;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    });

    requestAnimationFrame(draw);
  }

  resize();
  buildStars(250);
  draw();
  window.addEventListener('resize', () => { resize(); buildStars(250); });
}

// ── Markdown Parser ──────────────────────────────────────────
function md(text) {
  let h = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks
  h = h.replace(/```(\w*)\n([\s\S]*?)```/gm, (_, lang, code) =>
    `<pre><code class="lang-${lang}">${code.trim()}</code></pre>`);

  // Tables
  h = h.replace(/(\|.+\|\n)(\|[-| :]+\|\n)((?:\|.+\|\n?)*)/gm, match => {
    const rows = match.trim().split('\n').filter(Boolean);
    if (rows.length < 2) return match;
    const ths = rows[0].split('|').slice(1, -1).map(c => `<th>${c.trim()}</th>`).join('');
    const trs = rows.slice(2).map(row =>
      `<tr>${row.split('|').slice(1, -1).map(c => `<td>${c.trim()}</td>`).join('')}</tr>`
    ).join('');
    return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
  });

  // Headings
  h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  h = h.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Blockquotes
  h = h.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // HR
  h = h.replace(/^---+$/gm, '<hr>');

  // Bold / Italic
  h = h.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
  h = h.replace(/_(.+?)_/g, '<em>$1</em>');

  // Inline code
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Unordered lists
  h = h.replace(/((?:^[ \t]*[-*+] .+\n?)+)/gm, match => {
    const items = match.trim().split('\n')
      .map(l => `<li>${l.replace(/^[ \t]*[-*+] /, '').trim()}</li>`).join('');
    return `<ul>${items}</ul>`;
  });

  // Ordered lists
  h = h.replace(/((?:^\d+\. .+\n?)+)/gm, match => {
    const items = match.trim().split('\n')
      .map(l => `<li>${l.replace(/^\d+\. /, '').trim()}</li>`).join('');
    return `<ol>${items}</ol>`;
  });

  // Paragraphs
  h = h.replace(/^(?!<[a-z]|$)(.+)$/gm, '<p>$1</p>');
  return h;
}

// ── Render message ───────────────────────────────────────────
function getMessagesWrapper() {
  let wrap = document.querySelector('.messages-wrapper');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'messages-wrapper';
    const chatArea = DOM.chatArea();
    const typing = DOM.typing();
    chatArea.insertBefore(wrap, typing);
  }
  return wrap;
}

function renderMessage(role, content, animate = true) {
  // Remove welcome screen if present
  const w = DOM.welcome();
  if (w) w.remove();

  const wrap = getMessagesWrapper();
  const row = document.createElement('div');
  row.className = `message-row ${role}`;
  if (animate) row.style.animation = 'msgIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both';

  const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = role === 'user' ? '👤' : '🚀';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  const content_div = document.createElement('div');
  content_div.className = 'message-content';
  content_div.innerHTML = role === 'bot' ? md(content) : escapeHtml(content).replace(/\n/g, '<br>');

  const meta = document.createElement('div');
  meta.className = 'message-meta';
  meta.textContent = time;

  bubble.appendChild(content_div);
  bubble.appendChild(meta);

  row.appendChild(avatar);
  row.appendChild(bubble);
  wrap.appendChild(row);
  scrollBottom();
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function scrollBottom() {
  const ca = DOM.chatArea();
  setTimeout(() => ca.scrollTo({ top: ca.scrollHeight, behavior: 'smooth' }), 40);
}

// ── Typing indicator ─────────────────────────────────────────
function showTyping() {
  DOM.typing().classList.add('visible');
  scrollBottom();
}
function hideTyping() { DOM.typing().classList.remove('visible'); }

// ── Error toast ──────────────────────────────────────────────
let errTimer;
function showError(msg) {
  DOM.errorMsg().textContent = msg;
  DOM.errorToast().classList.add('visible');
  clearTimeout(errTimer);
  errTimer = setTimeout(() => DOM.errorToast().classList.remove('visible'), 5000);
}

// ── Send message ─────────────────────────────────────────────
async function sendMessage(text) {
  text = text.trim();
  if (!text || state.isLoading) return;

  const key = state.apiKey || localStorage.getItem('aerospacebot_key') || '';
  if (!key) {
    showError('⚠ Enter your Gemini API key in the sidebar first.');
    return;
  }

  state.isLoading = true;
  DOM.sendBtn().disabled = true;
  DOM.input().value = '';
  autoResize(DOM.input());

  state.messages.push({ role: 'user', content: text });
  renderMessage('user', text);
  showTyping();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: state.messages, apiKey: key }),
    });

    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Server error');

    hideTyping();
    state.messages.push({ role: 'assistant', content: data.response });
    renderMessage('bot', data.response);

  } catch (err) {
    hideTyping();
    showError('❌ ' + (err.message || 'Connection error'));
    state.messages.pop();
  } finally {
    state.isLoading = false;
    DOM.sendBtn().disabled = false;
    DOM.input().focus();
  }
}

// ── Public: suggestion / topic click ─────────────────────────
window.onSuggestionClick = text => sendMessage(text);

// ── Nav items click ──────────────────────────────────────────
const topicMap = {
  isro:       "Tell me about ISRO — its history, major missions, achievements and upcoming plans.",
  nasa:       "What are NASA's current active missions and upcoming plans?",
  rockets:    "Compare major launch vehicles: PSLV, GSLV, LVM3, Falcon 9, SLS and Starship.",
  astronomy:  "Tell me about the most significant recent discoveries in astronomy and astrophysics.",
  spacex:     "Tell me about SpaceX — Falcon 9, Starship, Dragon and their latest missions.",
  gaganyaan:  "Explain India's Gaganyaan human spaceflight mission — status, timeline, crew and objectives.",
  artemis:    "Tell me about NASA's Artemis program — goals, timeline, crew and hardware.",
  jwst:       "What are the most significant discoveries of the James Webb Space Telescope so far?",
  careers:    "What career paths exist in aerospace engineering and what skills are needed?",
};

function resolveTopicPrompt(topic) {
  return topicMap[topic] || topic;
}

// ── Auto-resize textarea ─────────────────────────────────────
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 150) + 'px';
}

// ── New Chat ─────────────────────────────────────────────────
function newChat() {
  state.messages = [];
  state.isLoading = false;

  const ca = DOM.chatArea();
  ca.innerHTML = '';

  // Restore welcome
  const welcome = buildWelcome();
  ca.appendChild(welcome);

  // Restore typing indicator
  ca.appendChild(buildTypingIndicator());

  DOM.input().value = '';
  autoResize(DOM.input());
  DOM.sendBtn().disabled = false;
  closeSidebar();
}

function buildWelcome() {
  const el = document.createElement('div');
  el.id = 'welcomeScreen';
  el.innerHTML = `
    <div class="hero-icon-wrap">
      <div class="hero-ring-2"></div>
      <div class="hero-ring"></div>
      <div class="hero-icon">🛸</div>
    </div>
    <h1 class="welcome-title">Your Aerospace Intelligence</h1>
    <p class="welcome-sub">Expert answers on ISRO, NASA, space missions, rockets, satellites, black holes, and the entire universe — powered by Gemini AI.</p>
    <div class="domain-pills">
      <span class="domain-pill" onclick="onSuggestionClick('Tell me about ISRO\'s most significant missions.')">🇮🇳 ISRO</span>
      <span class="domain-pill" onclick="onSuggestionClick('What are NASA\'s current missions?')">🇺🇸 NASA</span>
      <span class="domain-pill" onclick="onSuggestionClick('Explain how rockets work and types of propulsion.')">🚀 Rockets</span>
      <span class="domain-pill" onclick="onSuggestionClick('Tell me about the latest astronomical discoveries.')">🌌 Astronomy</span>
      <span class="domain-pill" onclick="onSuggestionClick('Explain satellite technology and types of orbits.')">🛰️ Satellites</span>
      <span class="domain-pill" onclick="onSuggestionClick('What careers are available in aerospace engineering?')">✈️ Careers</span>
    </div>
    <div class="suggestions-grid">
      ${[
        ['🌙','Chandrayaan-3',"India's landmark lunar south pole landing","Tell me about India's Chandrayaan-3 mission — the lunar south pole landing and its findings."],
        ['🔭','James Webb Telescope',"Universe's deepest views ever captured","What are the most significant discoveries of the James Webb Space Telescope?"],
        ['🧑‍🚀','Gaganyaan Mission',"India's first crewed spaceflight program","Explain India's Gaganyaan human spaceflight mission — status, timeline and crew."],
        ['🔴','Mars Exploration','Active rovers & orbiters on the Red Planet','What missions are currently exploring Mars? What have they discovered?'],
        ['🕳️','Black Holes','Formation, types & detection methods','Explain black holes — their types, how they form, and how we detect them.'],
        ['⚡','Rocket Propulsion','Engines, propellants & specific impulse','Explain rocket propulsion — how rocket engines work, types of propellants and specific impulse.'],
      ].map(([icon, title, desc, prompt], i) =>
        `<button class="suggestion-card" style="animation-delay:${0.05+i*0.05}s" onclick="onSuggestionClick('${prompt.replace(/'/g,"\\'")}')">
          <span class="sug-icon">${icon}</span>
          <div class="sug-title">${title}</div>
          <div class="sug-desc">${desc}</div>
        </button>`
      ).join('')}
    </div>
  `;
  return el;
}

function buildTypingIndicator() {
  const el = document.createElement('div');
  el.id = 'typingIndicator';
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <div class="message-avatar" style="width:32px;height:32px;background:var(--grad-brand);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;align-self:flex-end;">🚀</div>
    <div class="typing-bubble">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  return el;
}

// ── Sidebar ──────────────────────────────────────────────────
function openSidebar() {
  DOM.sidebar().classList.add('open');
  DOM.overlay().classList.add('open');
  DOM.hamburger().setAttribute('aria-expanded', 'true');
}
function closeSidebar() {
  DOM.sidebar().classList.remove('open');
  DOM.overlay().classList.remove('open');
  DOM.hamburger()?.setAttribute('aria-expanded', 'false');
}

// ── API key ──────────────────────────────────────────────────
function saveApiKey() {
  const val = DOM.apiKeyInput().value.trim();
  if (!val) { showError('⚠ Please enter a valid API key.'); return; }
  state.apiKey = val;
  localStorage.setItem('aerospacebot_key', val);
  setStatus(true);
  const btn = DOM.apiSaveBtn();
  btn.textContent = '✓ Saved';
  btn.style.color = 'var(--emerald-400)';
  btn.style.borderColor = 'rgba(52,211,153,0.3)';
  setTimeout(() => {
    btn.textContent = 'Save Key';
    btn.style.color = '';
    btn.style.borderColor = '';
  }, 2200);
}

function loadApiKey() {
  const saved = localStorage.getItem('aerospacebot_key');
  if (saved) {
    state.apiKey = saved;
    DOM.apiKeyInput().value = saved;
    setStatus(true);
  }
}

function setStatus(online) {
  const dot = DOM.statusDot();
  const txt = DOM.statusText();
  if (online) {
    dot.classList.remove('offline');
    txt.textContent = 'Online · Gemini AI';
  } else {
    dot.classList.add('offline');
    txt.textContent = 'No API Key';
  }
}

// ── Init ─────────────────────────────────────────────────────
function init() {
  initStarfield();
  loadApiKey();

  // Input auto-resize + send on Enter
  const inp = DOM.input();
  inp.addEventListener('input', () => autoResize(inp));
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inp.value); }
  });

  DOM.sendBtn().addEventListener('click', () => sendMessage(inp.value));

  // API key UI
  DOM.apiToggleBtn().addEventListener('click', () => {
    const i = DOM.apiKeyInput();
    i.type = i.type === 'password' ? 'text' : 'password';
    DOM.apiToggleBtn().textContent = i.type === 'password' ? '👁' : '🙈';
  });
  DOM.apiSaveBtn().addEventListener('click', saveApiKey);
  DOM.apiKeyInput().addEventListener('keydown', e => { if (e.key === 'Enter') saveApiKey(); });

  // Sidebar
  DOM.hamburger().addEventListener('click', openSidebar);
  DOM.overlay().addEventListener('click', closeSidebar);
  DOM.newChat().addEventListener('click', newChat);

  // Nav items
  document.querySelectorAll('.nav-item[data-topic]').forEach(item => {
    item.addEventListener('click', () => {
      sendMessage(resolveTopicPrompt(item.dataset.topic));
      closeSidebar();
    });
  });

  // Error toast dismiss on click
  DOM.errorToast().addEventListener('click', () => DOM.errorToast().classList.remove('visible'));
}

document.addEventListener('DOMContentLoaded', init);
