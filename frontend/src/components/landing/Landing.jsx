import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../../contexts/authStore';
import './Landing.css';

const FEATURES = [
  {
    icon: '🧠',
    title: 'RAG-Powered Intelligence',
    desc: 'Retrieval-Augmented Generation grounds every answer in real university documents — no hallucinations.',
  },
  {
    icon: '⚡',
    title: 'Instant Personalisation',
    desc: 'UniBot knows your enrolled courses, outstanding fees, and upcoming deadlines before you even ask.',
  },
  {
    icon: '📚',
    title: 'Deep Knowledge Base',
    desc: 'Admissions, academic policies, hostel, exams — all indexed and semantically searchable.',
  },
  {
    icon: '✅',
    title: 'RAGAS-Evaluated Quality',
    desc: 'Answer relevance, context precision, and faithfulness are continuously measured against an 80% threshold.',
  },
  {
    icon: '🔒',
    title: 'Secure & Private',
    desc: 'JWT-authenticated sessions. Your data stays yours — never shared, always encrypted.',
  },
  {
    icon: '💬',
    title: '24 / 7 Availability',
    desc: 'No office hours, no queues. Ask anything about your university life at any time.',
  },
];

const STATS = [
  { value: '< 2s', label: 'Response time' },
  { value: '≥ 80%', label: 'RAGAS faithfulness' },
  { value: '6+', label: 'Topic categories' },
  { value: '24/7', label: 'Always available' },
];

const DEMO_QS = [
  'What courses am I enrolled in this semester?',
  'Show my outstanding fee balance',
  'What are the admission requirements for MSc CS?',
  'When is the next exam period?',
  'How do I apply for university accommodation?',
  'What is the late submission policy?',
];

const BotIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M12 2v3M8 6a4 4 0 018 0"/>
    <circle cx="9" cy="16" r="1" fill="currentColor" stroke="none"/>
    <circle cx="15" cy="16" r="1" fill="currentColor" stroke="none"/>
    <path d="M9 20h6"/>
  </svg>
);

const Landing = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [demoIdx, setDemoIdx] = useState(0);
  const [typed, setTyped] = useState('');

  // Typewriter effect cycling through demo questions
  useEffect(() => {
    const q = DEMO_QS[demoIdx];
    let i = 0;
    setTyped('');
    const interval = setInterval(() => {
      i++;
      setTyped(q.slice(0, i));
      if (i >= q.length) {
        clearInterval(interval);
        setTimeout(() => setDemoIdx(n => (n + 1) % DEMO_QS.length), 2200);
      }
    }, 38);
    return () => clearInterval(interval);
  }, [demoIdx]);

  const handleCTA = () => {
    if (isAuthenticated) {
      navigate(user?.role === 'admin' ? '/admin/dashboard' : '/student/dashboard');
    } else {
      navigate('/register');
    }
  };

  return (
    <div className="land">

      {/* ── Nav ── */}
      <nav className="land-nav">
        <div className="land-nav__inner">
          <div className="land-nav__brand">
            <div className="land-nav__icon"><BotIcon /></div>
            <span className="land-nav__name">UniBot</span>
          </div>
          <div className="land-nav__links">
            <a href="#features" className="land-nav__link">Features</a>
            <a href="#how" className="land-nav__link">How it works</a>
          </div>
          <div className="land-nav__cta">
            <Link to="/login" className="land-nav__signin">Sign in</Link>
            <Link to="/register" className="land-btn land-btn--sm">Get started</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="land-hero">
        {/* Background orbs */}
        <div className="land-orbs" aria-hidden="true">
          <div className="land-orb land-orb--1" />
          <div className="land-orb land-orb--2" />
          <div className="land-orb land-orb--3" />
        </div>

        <div className="land-hero__inner">


          <h1 className="land-hero__title">
            Your university,<br />
            <span className="land-hero__accent">intelligently</span><br />
            answered.
          </h1>

          <p className="land-hero__sub">
            UniBot combines Gemini AI with Retrieval-Augmented Generation to give students
            instant, accurate answers about courses, fees, admissions, exams, and more.
          </p>

          <div className="land-hero__actions">
            <button className="land-btn land-btn--lg" onClick={handleCTA}>
              {isAuthenticated ? 'Go to Dashboard' : 'Start for free'}
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 10h12M10 4l6 6-6 6"/>
              </svg>
            </button>
            <Link to="/login" className="land-btn land-btn--ghost land-btn--lg">Sign in</Link>
          </div>

          {/* Demo typewriter chat bubble */}
          <div className="land-demo-bubble">
            <div className="land-demo-bubble__user">
              <span className="land-demo-bubble__avatar land-demo-bubble__avatar--user">S</span>
              <div className="land-demo-bubble__msg land-demo-bubble__msg--user">
                {typed}<span className="land-demo-bubble__cursor" />
              </div>
            </div>
            <div className="land-demo-bubble__bot">
              <span className="land-demo-bubble__avatar land-demo-bubble__avatar--bot">
                <BotIcon />
              </span>
              <div className="land-demo-bubble__msg land-demo-bubble__msg--bot">
                <div className="land-demo-bubble__typing">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="land-stats">
        <div className="land-container">
          <div className="land-stats__grid">
            {STATS.map(s => (
              <div key={s.label} className="land-stat">
                <p className="land-stat__value">{s.value}</p>
                <p className="land-stat__label">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="land-features" id="features">
        <div className="land-container">
          <div className="land-section-hd">
            <p className="land-section-eye">What UniBot offers</p>
            <h2 className="land-section-title">Everything a student needs,<br />in one conversation.</h2>
          </div>
          <div className="land-features__grid">
            {FEATURES.map((f, i) => (
              <div key={i} className="land-feature" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="land-feature__icon">{f.icon}</div>
                <h3 className="land-feature__title">{f.title}</h3>
                <p className="land-feature__desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="land-how" id="how">
        <div className="land-container">
          <div className="land-section-hd">
            <p className="land-section-eye">The technology</p>
            <h2 className="land-section-title">How UniBot answers your questions</h2>
          </div>
          <div className="land-steps">
            {[
              { n: '01', title: 'You ask a question', desc: 'Type naturally — about fees, courses, policies, deadlines, anything.' },
              { n: '02', title: 'RAG retrieves context', desc: 'Your query is embedded and matched against the university knowledge base in Pinecone.' },
              { n: '03', title: 'Gemini generates', desc: 'Google Gemini 1.5 Flash synthesises a grounded, accurate response using only retrieved context.' },
              { n: '04', title: 'Sources shown', desc: 'Every answer cites the documents it used, with a confidence score you can trust.' },
            ].map((s, i) => (
              <div key={i} className="land-step">
                <div className="land-step__num">{s.n}</div>
                <div className="land-step__body">
                  <h3 className="land-step__title">{s.title}</h3>
                  <p className="land-step__desc">{s.desc}</p>
                </div>
                {i < 3 && <div className="land-step__arrow">→</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="land-cta">
        <div className="land-container">
          <div className="land-cta__box">
            <div className="land-cta__orbs" aria-hidden="true">
              <div className="land-orb land-orb--1" style={{ opacity: .12 }} />
              <div className="land-orb land-orb--2" style={{ opacity: .08 }} />
            </div>
            <div className="land-cta__content">
              <h2 className="land-cta__title">Ready to get answers?</h2>
              <p className="land-cta__sub">Join UniBot and stop searching through handbooks. Get your answers in seconds.</p>
              <div className="land-hero__actions">
                <button className="land-btn land-btn--lg land-btn--light" onClick={handleCTA}>
                  {isAuthenticated ? 'Open Dashboard' : 'Create free account'}
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 10h12M10 4l6 6-6 6"/>
                  </svg>
                </button>
                <Link to="/login" className="land-btn land-btn--ghost-light land-btn--lg">Sign in</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="land-footer">
        <div className="land-container">
          <div className="land-footer__inner">
            <div className="land-footer__brand">
              <div className="land-nav__icon"><BotIcon /></div>
              <span className="land-footer__name">UniBot</span>
            </div>
            <p className="land-footer__copy">
              University of Westminster · Final Year Project 2025–26 · Lamia Haque
            </p>
            <div className="land-footer__links">
              <Link to="/login" className="land-footer__link">Sign in</Link>
              <Link to="/register" className="land-footer__link">Register</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
