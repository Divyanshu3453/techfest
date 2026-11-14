import { useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// "Ask me anything" chatbot (bottom-right). Talks to the NITA FresherBot API.
//
// Config (frontend/.env.local):
//   VITE_ASK_BOT_URL=https://your-bot-host      (no trailing slash)
// In `npm run dev` it falls back to http://localhost:8000 when not set.
// If there is no URL at all (production build without the variable) the
// widget is simply not rendered.
// ---------------------------------------------------------------------------

const BOT_URL = (
  import.meta.env.VITE_ASK_BOT_URL ||
  (import.meta.env.DEV ? 'http://localhost:8000' : '')
).replace(/\/+$/, '');

const TITLE = 'Ask me anything';
const SUBTITLE = 'Answers from the official campus documents';
const WELCOME = "Hi! Ask me a question and I'll do my best to help.";
const PLACEHOLDER = 'Type your question…';
const DEFAULT_MAX_CHARS = 500; // replaced by the bot's own limit once it answers /config

// Leave empty to show the bot's own "not in the documents" message.
// Set a text to show a different one on this site, e.g. 'Please ask at the hostel office.'
const OUT_OF_CONTEXT_TEXT = '';

const URL_RE = /(https?:\/\/[^\s<]*[^\s<.,;:!?)\]])/g;

// Plain text + safe clickable http(s) links (never dangerouslySetInnerHTML)
function Linkified({ text }) {
  return text.split(URL_RE).map((part, i) =>
    i % 2 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
    ) : (
      part
    )
  );
}

function fallbackMessage(status) {
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status >= 500) return 'Something went wrong on our side. Please try again in a moment.';
  return "Sorry, that didn't work. Please try again.";
}

function AskBotPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ id: 0, role: 'bot', text: WELCOME }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0); // seconds left after a short rate limit
  const [maxChars, setMaxChars] = useState(DEFAULT_MAX_CHARS);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const nextId = useRef(1);
  const configLoaded = useRef(false);

  const push = (role, text) =>
    setMessages((m) => [...m, { id: nextId.current++, role, text }]);

  // On first open: focus the input and sync the length limit with the server
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    if (configLoaded.current) return;
    configLoaded.current = true;
    fetch(`${BOT_URL}/config`)
      .then((res) => (res.ok ? res.json() : null))
      .then((cfg) => {
        if (cfg && cfg.max_question_chars > 0) setMaxChars(cfg.max_question_chars);
      })
      .catch(() => {});
  }, [open]);

  // Keep the newest message in view
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, open]);

  // Auto-grow the textarea (up to a few lines)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 110)}px`;
  }, [input, open]);

  // Countdown shown after a per-second / per-minute rate limit
  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function send(e) {
    if (e) e.preventDefault();
    const question = input.trim();
    if (!question || busy || wait > 0) return;

    setBusy(true);
    push('user', question);
    setInput('');

    try {
      const res = await fetch(`${BOT_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data && typeof data.answer === 'string') {
        if (data.in_context === false) push('notice', OUT_OF_CONTEXT_TEXT || data.answer);
        else push('bot', data.answer);
      } else {
        const err = (data && data.error) || {};
        push('error', err.message || fallbackMessage(res.status));
        setInput((cur) => cur || question); // give the question back to edit / resend

        const retry = parseInt(err.retry_after || res.headers.get('Retry-After'), 10) || 0;
        if (res.status === 429 && retry > 0 && retry <= 120) setWait(retry);
      }
    } catch {
      push('error', "Can't reach the assistant right now. Please check your connection and try again.");
      setInput((cur) => cur || question);
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="askbot" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      {open && (
        <section className="askbot-panel" role="dialog" aria-label={TITLE}>
          <header className="askbot-head">
            <div>
              <strong>{TITLE}</strong>
              <span>{SUBTITLE}</span>
            </div>
            <button type="button" className="askbot-close" aria-label="Close chat" onClick={() => setOpen(false)}>
              ×
            </button>
          </header>

          <div className="askbot-messages" ref={listRef} role="log" aria-live="polite">
            {messages.map((m) => (
              <div key={m.id} className={`askbot-msg is-${m.role}`}>
                <Linkified text={m.text} />
              </div>
            ))}
            {busy && (
              <div className="askbot-msg is-bot askbot-typing" role="status" aria-label="Thinking">
                <i /><i /><i />
              </div>
            )}
          </div>

          {wait > 0 && <p className="askbot-hint muted">You can ask again in {wait}s</p>}

          <form className="askbot-form" onSubmit={send}>
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              maxLength={maxChars}
              placeholder={PLACEHOLDER}
              aria-label="Your question"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button className="li-btn primary" type="submit" disabled={busy || wait > 0 || !input.trim()}>
              Send
            </button>
          </form>
        </section>
      )}

      <button type="button" className="li-btn primary askbot-launcher" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? 'Close' : TITLE}
      </button>
    </div>
  );
}

export default function AskBot() {
  if (!BOT_URL) return null;
  return <AskBotPanel />;
}