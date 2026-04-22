import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../layout/Layout';
import Badge from '../common/Badge';
import Button from '../common/Button';
import useAuthStore from '../../contexts/authStore';
import { chatAPI } from '../../services/api';
import './Chat.css';

/* ── Typing Indicator ──────────────────────────────────── */
const TypingIndicator = () => (
  <div className="typing-bubble">
    <div className="typing-avatar">
      <BotAvatar />
    </div>
    <div className="typing-dots">
      <span /><span /><span />
    </div>
  </div>
);

/* ── Bot Avatar ────────────────────────────────────────── */
const BotAvatar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M12 2v3M8 6a4 4 0 018 0"/>
    <circle cx="9" cy="16" r="1" fill="currentColor" stroke="none"/>
    <circle cx="15" cy="16" r="1" fill="currentColor" stroke="none"/>
    <path d="M9 20h6"/>
  </svg>
);

/* ── Source Citations ──────────────────────────────────── */
const SourceCitations = ({ sources }) => {
  const [open, setOpen] = useState(false);
  if (!sources || sources.length === 0) return null;

  const scoreColor = (s) => {
    if (s >= 0.8) return 'var(--emerald-500)';
    if (s >= 0.6) return 'var(--blue-500)';
    return 'var(--amber-500)';
  };

  // Deduplicate by document_id so we show one card per document
  const seen = new Set();
  const unique = sources.filter(s => {
    const key = s.document_id || s.document_name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Best excerpt: pick the highest-scoring source for each doc
  const bestExcerpt = (docId) => {
    const hits = sources
      .filter(s => (s.document_id || s.document_name) === docId)
      .sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0));
    return hits[0]?.chunk_text?.replace(/\s+/g, ' ').trim();
  };

  return (
    <div className="sources">
      <button className="sources__toggle" onClick={() => setOpen(o => !o)}>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 4H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M17 3h-4m4 0v4m0-4L9 11"/>
        </svg>
        University knowledge base · {sources.length} passage{sources.length > 1 ? 's' : ''}
        <svg className={`sources__chevron${open ? ' sources__chevron--open' : ''}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 8l4 4 4-4"/>
        </svg>
      </button>
      {open && (
        <ul className="sources__list">
          {unique.map((s, i) => {
            const docKey = s.document_id || s.document_name;
            const score = s.relevance_score ?? s.score;
            const excerpt = bestExcerpt(docKey);
            const count = sources.filter(x => (x.document_id || x.document_name) === docKey).length;
            return (
              <li key={i} className="sources__item">
                <div className="sources__item-header">
                  <span className="sources__doc-icon">🏫</span>
                  <span className="sources__doc-name">University Uploaded Source</span>
                  <span className="sources__count">{count} passage{count > 1 ? 's' : ''}</span>
                  {score !== undefined && (
                    <span className="sources__score" style={{ color: scoreColor(score) }}>
                      {Math.round(score * 100)}%
                    </span>
                  )}
                </div>
                {excerpt && (
                  <p className="sources__excerpt">"{excerpt.slice(0, 130)}{excerpt.length > 130 ? '…' : ''}"</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

/* ── Markdown Renderer ────────────────────────────────── */
// Parse inline tokens: [Source: ...], **bold**, *italic*
const parseLine = (line) => {
  const parts = [];
  let key = 0;
  const rx = /(\[Source:\s*[^\]]+\]|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0, m;
  while ((m = rx.exec(line)) !== null) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('[Source:')) {
      const name = tok.slice(9, -1).trim();
      parts.push(<span key={key++} className="msg__src-cite">📄 {name}</span>);
    } else if (tok.startsWith('**')) {
      parts.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts.length ? parts : [line];
};

const renderMarkdown = (text) => {
  if (!text) return null;
  // Strip any stray [Source: ...] the LLM might include despite instructions
  text = text.replace(/\s*\[Source:[^\]]*\]/gi, '').trim();
  const elements = [];
  const lines = text.split('\n');
  let bullets = [], numbered = [], n = 0;

  const flush = () => {
    if (bullets.length) {
      elements.push(<ul key={`ul${n}`}>{bullets.map((l, i) => <li key={i}>{parseLine(l)}</li>)}</ul>);
      bullets = [];
    }
    if (numbered.length) {
      elements.push(<ol key={`ol${n}`}>{numbered.map((l, i) => <li key={i}>{parseLine(l)}</li>)}</ol>);
      numbered = [];
    }
  };

  for (const line of lines) {
    n++;
    const h2m = line.match(/^##\s+(.+)/);
    const h1m = line.match(/^#\s+(.+)/);
    const bm  = line.match(/^[\s]*[•\-\*]\s+(.+)/);
    const nm  = line.match(/^[\s]*\d+\.\s+(.+)/);

    if (h1m || h2m) {
      flush();
      const txt = (h1m || h2m)[1];
      elements.push(h2m
        ? <h4 key={n} className="msg__heading">{parseLine(txt)}</h4>
        : <h3 key={n} className="msg__heading">{parseLine(txt)}</h3>);
    } else if (bm) {
      if (numbered.length) flush();
      bullets.push(bm[1]);
    } else if (nm) {
      if (bullets.length) flush();
      numbered.push(nm[1]);
    } else {
      flush();
      if (line.trim()) elements.push(<p key={n}>{parseLine(line)}</p>);
    }
  }
  flush();
  return elements;
};

/* ── Message Bubble ───────────────────────────────────── */
const MessageBubble = ({ message, userInitials }) => {
  const isUser = message.role === 'user';
  const meta = message.metadata || {};
  const confidence = meta.confidence;
  const ragUsed = meta.ragUsed;
  const sources = meta.sources || [];

  return (
    <div className={`msg msg--${isUser ? 'user' : 'bot'}${message.isError ? ' msg--error' : ''}`}>
      {!isUser && (
        <div className="msg__avatar msg__avatar--bot">
          <BotAvatar />
        </div>
      )}

      <div className="msg__body">
        <div className="msg__bubble">
          <div className="msg__text">
            {isUser ? <p>{message.content}</p> : renderMarkdown(message.content)}
          </div>

          {!isUser && (confidence !== undefined || ragUsed !== undefined) && (
            <div className="msg__meta">
              {confidence !== undefined && (
                <span className={`msg__confidence ${confidence >= 0.7 ? 'msg__confidence--good' : 'msg__confidence--low'}`}>
                  {confidence >= 0.7 ? '✓' : '~'} {Math.round(confidence * 100)}% confident
                </span>
              )}
              {ragUsed !== undefined && (
                <Badge variant={ragUsed ? 'primary' : 'default'} size="sm">
                  {ragUsed ? '🧠 AI-powered' : '📋 Rule-based'}
                </Badge>
              )}
            </div>
          )}

          {!isUser && sources.length > 0 && <SourceCitations sources={sources} />}
        </div>
        <span className="msg__time">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {isUser && (
        <div className="msg__avatar msg__avatar--user">
          {userInitials}
        </div>
      )}
    </div>
  );
};

/* ── Quick Actions ────────────────────────────────────── */
const QUICK_ACTIONS = [
  { label: 'My Courses', query: 'What courses am I enrolled in?', icon: '📚' },
  { label: 'My Fees', query: 'What are my outstanding fees?', icon: '💳' },
  { label: 'Admissions', query: 'Tell me about the admission process', icon: '🎓' },
  { label: 'Hostel', query: 'How do I apply for hostel accommodation?', icon: '🏠' },
  { label: 'Exam Schedule', query: 'When are the upcoming exams?', icon: '📅' },
  { label: 'Academic Policy', query: 'What is the academic policy for attendance?', icon: '📋' },
];

/* ── Conversation List Item ───────────────────────────── */
const ConvItem = ({ conv, active, onClick, onDelete }) => (
  <div className={`conv-item${active ? ' conv-item--active' : ''}`} onClick={onClick}>
    <div className="conv-item__body">
      <p className="conv-item__title">{conv.title || 'New conversation'}</p>
      <p className="conv-item__date">
        {conv.updatedAt ? new Date(conv.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
      </p>
    </div>
    <button className="conv-item__del" onClick={(e) => { e.stopPropagation(); onDelete(conv._id); }} title="Delete">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4h10M6 4V3h4v1M5 4v8h6V4H5z"/></svg>
    </button>
  </div>
);

/* ── Main ChatInterface ───────────────────────────────── */
const ChatInterface = () => {
  const location = useLocation();
  const { user } = useAuthStore();

  const firstName = user?.profile?.firstName || user?.firstName || '';
  const lastName = user?.profile?.lastName || user?.lastName || '';
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'U';

  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hello ${firstName || 'there'}! I'm **UniBot**, your AI-powered college support assistant.\n\nI can help you with:\n• Course enrolment and schedules\n• Fee status and payments\n• Admission requirements\n• Hostel information\n• Exam schedules and academic policies\n\nWhat would you like to know?`,
      timestamp: new Date(),
      metadata: {},
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [convLoading, setConvLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const endRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => endRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => { scrollToBottom(); }, [messages, sending]);

  // Load conversations on mount
  useEffect(() => {
    const loadConvs = async () => {
      setConvLoading(true);
      try {
        const res = await chatAPI.getConversations();
        const list = (res.data || res || []).map(c => ({ ...c, _id: c._id || c.id }));
        setConversations(list);
      } catch {}
      finally { setConvLoading(false); }
    };
    loadConvs();
  }, []);

  // Handle pre-filled query from navigation state
  useEffect(() => {
    if (location.state?.query) {
      setInput(location.state.query);
      textareaRef.current?.focus();
    }
  }, [location.state]);

  const send = useCallback(async (text) => {
    if (!text.trim() || sending) return;
    const userMsg = { role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);
    try {
      const res = await chatAPI.sendMessage({ message: text, conversationId: activeConvId });
      const d = res.data || res;
      if (d.conversationId && !activeConvId) {
        setActiveConvId(d.conversationId);
        setConversations(prev => [{ _id: d.conversationId, title: text.slice(0, 40), updatedAt: new Date() }, ...prev]);
      }
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: d.message?.content || d.content || 'I could not process that request.',
        timestamp: new Date(),
        metadata: d.message?.metadata || {},
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I couldn't process your request right now. Please try again.",
        timestamp: new Date(),
        isError: true,
        metadata: {},
      }]);
    } finally {
      setSending(false);
    }
  }, [sending, activeConvId]);

  const handleSubmit = (e) => { e.preventDefault(); send(input); };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const loadConversation = async (convId) => {
    setActiveConvId(convId);
    setSidebarOpen(false);
    try {
      const res = await chatAPI.getConversation(convId);
      const msgs = res.data?.messages || res.messages || [];
      if (msgs.length) {
        setMessages(msgs.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.createdAt || new Date(),
          metadata: m.metadata || {},
        })));
      }
    } catch {}
  };

  const deleteConversation = async (convId) => {
    try {
      await chatAPI.deleteConversation(convId);
      setConversations(prev => prev.filter(c => c._id !== convId));
      if (activeConvId === convId) {
        setActiveConvId(null);
        setMessages([{
          role: 'assistant',
          content: 'Hello again! How can I help you today?',
          timestamp: new Date(),
          metadata: {},
        }]);
      }
    } catch {}
  };

  const startNewChat = () => {
    setActiveConvId(null);
    setSidebarOpen(false);
    setMessages([{
      role: 'assistant',
      content: `Hello ${firstName || 'there'}! How can I help you today?`,
      timestamp: new Date(),
      metadata: {},
    }]);
  };

  return (
    <Layout>
      <div className="chat-page">
        {/* Conversation sidebar (mobile overlay + desktop inline) */}
        <div className={`chat-sidebar${sidebarOpen ? ' chat-sidebar--open' : ''}`}>
          <div className="chat-sidebar__header">
            <span className="chat-sidebar__title">Conversations</span>
            <Button variant="primary" size="sm" onClick={startNewChat}>+ New</Button>
          </div>
          <div className="chat-sidebar__list">
            {convLoading ? (
              <p className="chat-sidebar__empty">Loading…</p>
            ) : conversations.length === 0 ? (
              <p className="chat-sidebar__empty">No conversations yet</p>
            ) : (
              conversations.map(c => (
                <ConvItem
                  key={c._id}
                  conv={c}
                  active={c._id === activeConvId}
                  onClick={() => loadConversation(c._id)}
                  onDelete={deleteConversation}
                />
              ))
            )}
          </div>
        </div>

        {/* Main chat area */}
        <div className="chat-main">
          {/* Chat header */}
          <div className="chat-header">
            <button className="chat-header__menu" onClick={() => setSidebarOpen(o => !o)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
            <div className="chat-header__info">
              <div className="chat-header__avatar"><BotAvatar /></div>
              <div>
                <p className="chat-header__name">UniBot</p>
                <p className="chat-header__status"><span className="chat-header__dot" />AI-powered support</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={startNewChat}>New chat</Button>
          </div>

          {/* Messages */}
          <div className="chat-messages">
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} userInitials={initials} />
            ))}
            {sending && <TypingIndicator />}
            <div ref={endRef} />
          </div>

          {/* Quick actions */}
          <div className="quick-actions">
            <div className="quick-actions__scroll">
              {QUICK_ACTIONS.map(a => (
                <button key={a.label} className="qa-btn" onClick={() => send(a.query)}>
                  <span>{a.icon}</span> {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <form className="chat-input-area" onSubmit={handleSubmit}>
            <div className="chat-input-wrap">
              <textarea
                ref={textareaRef}
                className="chat-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything — courses, fees, admissions, exams…"
                rows={1}
                disabled={sending}
              />
              <div className="chat-input-footer">
                <span className="chat-input-hint">Enter to send · Shift+Enter for new line</span>
                <span className="chat-input-count">{input.length}/1000</span>
              </div>
            </div>
            <button
              type="submit"
              className={`chat-send-btn${(!input.trim() || sending) ? ' chat-send-btn--disabled' : ''}`}
              disabled={!input.trim() || sending}
            >
              {sending ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
                </svg>
              )}
            </button>
          </form>
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && <div className="chat-overlay" onClick={() => setSidebarOpen(false)} />}
      </div>
    </Layout>
  );
};

export { SourceCitations };
export default ChatInterface;
