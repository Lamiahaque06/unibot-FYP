import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../layout/Layout';
import Badge from '../common/Badge';
import Button from '../common/Button';
import useAuthStore from '../../contexts/authStore';
import { studentAPI } from '../../services/api';
import './Dashboard.css';

/* ─── helpers ──────────────────────────────────────────── */
const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const daysUntil = (dateStr) =>
  dateStr ? Math.ceil((new Date(dateStr) - Date.now()) / 86_400_000) : null;

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';

/* ─── Stat Card ────────────────────────────────────────── */
const StatCard = ({ accent, icon, value, label, sub, delay = 0 }) => (
  <article className={`sc sc--${accent}`} style={{ animationDelay: `${delay}ms` }}>
    <div className="sc__top">
      <div className={`sc__icon sc__icon--${accent}`}>{icon}</div>
      <p className="sc__value">{value ?? '—'}</p>
    </div>
    <p className="sc__label">{label}</p>
    {sub && <p className="sc__sub">{sub}</p>}
  </article>
);

/* ─── helpers for nested API fields ───────────────────── */
const instructorName = (v) => {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v.name || v.email || null;
  return null;
};

const scheduleText = (v) => {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length > 0) {
    const s = v[0];
    if (typeof s === 'string') return s;
    if (s && typeof s === 'object') {
      const parts = [s.day, s.startTime && s.endTime ? `${s.startTime}–${s.endTime}` : null, s.location].filter(Boolean);
      return parts.join(' · ') || null;
    }
  }
  return null;
};

/* ─── Course Card ──────────────────────────────────────── */
const CourseCard = ({ course, index }) => {
  const c = course?.course || course || {};
  const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#0891b2'];
  const color = colors[index % colors.length];
  const teacher  = instructorName(c.instructor);
  const schedule = scheduleText(c.schedule);
  return (
    <article className="cc" style={{ '--cc-color': color }}>
      <div className="cc__stripe" />
      <div className="cc__body">
        <div className="cc__top">
          <span className="cc__code">{c.courseCode || 'N/A'}</span>
          {c.credits && <span className="cc__cred">{c.credits} cr</span>}
        </div>
        <h4 className="cc__name">{c.courseName || c.name || 'Unnamed Course'}</h4>
        {teacher && (
          <p className="cc__instructor">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="5" r="2.5"/>
              <path d="M2 14c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/>
            </svg>
            {teacher}
          </p>
        )}
        {schedule && <p className="cc__schedule">{schedule}</p>}
      </div>
    </article>
  );
};

/* ─── Fee Row ──────────────────────────────────────────── */
const FEE_VARIANTS = { paid: 'success', overdue: 'danger', pending: 'warning', partial: 'primary' };

const FeeRow = ({ fee }) => (
  <div className="fr">
    <div className="fr__left">
      <p className="fr__name">{fee.description || fee.feeType || 'Fee'}</p>
      <p className="fr__due">Due {fmtDate(fee.dueDate)}</p>
    </div>
    <div className="fr__right">
      <span className="fr__amount">£{Number(fee.amount || 0).toFixed(2)}</span>
      <Badge variant={FEE_VARIANTS[fee.status] || 'default'} size="sm">
        {fee.status || 'unknown'}
      </Badge>
    </div>
  </div>
);

/* ─── Deadline Row ─────────────────────────────────────── */
const DeadlineRow = ({ deadline }) => {
  const days = daysUntil(deadline.dueDate);
  const urgent = days !== null && days <= 3;
  const soon   = days !== null && days <= 7 && !urgent;
  return (
    <div className={`dr ${urgent ? 'dr--urgent' : soon ? 'dr--soon' : ''}`}>
      <div className="dr__dot" />
      <div className="dr__body">
        <p className="dr__title">{deadline.title}</p>
        {deadline.course && <p className="dr__course">{deadline.course}</p>}
      </div>
      <div className="dr__meta">
        {days !== null && (
          <span className={`dr__badge ${urgent ? 'dr__badge--urgent' : soon ? 'dr__badge--soon' : ''}`}>
            {days < 0 ? 'Overdue' : days === 0 ? 'Today' : `${days}d`}
          </span>
        )}
        <span className="dr__date">{fmtDate(deadline.dueDate)}</span>
      </div>
    </div>
  );
};

/* ─── Skeleton ─────────────────────────────────────────── */
const Skeleton = ({ h = 80 }) => (
  <div className="skel" style={{ height: h }} />
);

/* ─── Main ─────────────────────────────────────────────── */
const StudentDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const firstName = user?.profile?.firstName || user?.firstName || 'Student';

  const [stats,    setStats]    = useState(null);
  const [courses,  setCourses]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [dashRes, enrollRes] = await Promise.allSettled([
          studentAPI.getDashboard(),
          studentAPI.getEnrollments(),
        ]);

        if (!alive) return;

        if (dashRes.status === 'fulfilled') {
          const d = dashRes.value?.data ?? dashRes.value ?? {};
          setStats(d);
        }

        if (enrollRes.status === 'fulfilled') {
          const raw = enrollRes.value?.data ?? enrollRes.value ?? [];
          setCourses(Array.isArray(raw) ? raw : []);
        }
      } catch (err) {
        if (alive) setError(err.message || 'Failed to load dashboard');
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, []);

  const fees      = Array.isArray(stats?.pendingFees)       ? stats.pendingFees       : [];
  const deadlines = Array.isArray(stats?.upcomingDeadlines) ? stats.upcomingDeadlines : [];
  const overdueCount = fees.filter(f => f.status === 'overdue').length;
  const thisWeek     = deadlines.filter(d => { const n = daysUntil(d.dueDate); return n !== null && n <= 7 && n >= 0; }).length;

  return (
    <Layout>
      <div className="dash">

        {/* ── Header ── */}
        <header className="dash__hd">
          <div>
            <p className="dash__greet">{greeting()}</p>
            <h1 className="dash__name">{firstName}</h1>
          </div>
          <Button
            variant="primary"
            onClick={() => navigate('/chat')}
            icon={
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v7a2 2 0 01-2 2H7l-4 4V5z"/>
              </svg>
            }
          >
            Ask UniBot
          </Button>
        </header>

        {loading ? (
          <div className="dash__skel-grid">
            {[100, 100, 100, 100, 220, 220, 160].map((h, i) => <Skeleton key={i} h={h} />)}
          </div>
        ) : error ? (
          <div className="dash__err">
            <div className="dash__err-icon">⚠</div>
            <p className="dash__err-msg">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </div>
        ) : (
          <>
            {/* ── Stats ── */}
            <div className="dash__stats">
              <StatCard
                accent="blue" delay={0}
                value={stats?.enrollments ?? courses.length}
                label="Enrolled Courses"
                sub={`${stats?.totalCredits ?? 0} credits`}
                icon={
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M10 2L2 6l8 4 8-4-8-4zM2 10l8 4 8-4M2 14l8 4 8-4"/>
                  </svg>
                }
              />
              <StatCard
                accent={overdueCount > 0 ? 'red' : 'green'} delay={60}
                value={`£${Number(stats?.totalOutstandingFees ?? 0).toFixed(0)}`}
                label="Outstanding Fees"
                sub={overdueCount > 0 ? `${overdueCount} overdue` : 'All clear'}
                icon={
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="2" y="5" width="16" height="11" rx="2"/>
                    <path d="M2 9h16M6 13h2M10 13h4"/>
                  </svg>
                }
              />
              <StatCard
                accent="amber" delay={120}
                value={deadlines.length}
                label="Upcoming Deadlines"
                sub={thisWeek > 0 ? `${thisWeek} this week` : 'None this week'}
                icon={
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="3" y="3" width="14" height="14" rx="2"/>
                    <path d="M7 1v2M13 1v2M3 8h14"/>
                  </svg>
                }
              />
              <StatCard
                accent="purple" delay={180}
                value={stats?.gpa ? stats.gpa.toFixed(2) : '—'}
                label="GPA"
                sub="Current semester"
                icon={
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M3 17l3-5 3 3 3-8 3 5 2-3"/>
                  </svg>
                }
              />
            </div>

            {/* ── Body ── */}
            <div className="dash__body">

              {/* LEFT: courses + fees */}
              <div className="dash__main">

                {/* Courses */}
                <section className="dash__panel">
                  <div className="panel-hd">
                    <h2 className="panel-title">My Courses</h2>
                    <span className="panel-count">{courses.length}</span>
                  </div>
                  {courses.length === 0 ? (
                    <div className="dash__empty">
                      <span>📚</span><p>No courses enrolled yet</p>
                    </div>
                  ) : (
                    <div className="courses-grid">
                      {courses.map((c, i) => (
                        <CourseCard key={c._id || i} course={c} index={i} />
                      ))}
                    </div>
                  )}
                </section>

                {/* Fees */}
                {fees.length > 0 && (
                  <section className="dash__panel">
                    <div className="panel-hd">
                      <h2 className="panel-title">Fee Summary</h2>
                      {overdueCount > 0
                        ? <Badge variant="danger" size="sm" dot>{overdueCount} overdue</Badge>
                        : <Badge variant="success" size="sm" dot>Up to date</Badge>
                      }
                    </div>
                    <div className="fees-list">
                      {fees.map((f, i) => <FeeRow key={f._id || i} fee={f} />)}
                    </div>
                  </section>
                )}
              </div>

              {/* RIGHT: chat + deadlines */}
              <aside className="dash__aside">

                {/* UniBot CTA */}
                <section className="dash__panel dash__panel--chat">
                  <div className="chat-cta__logo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <rect x="3" y="11" width="18" height="11" rx="2"/>
                      <path d="M12 2v3M8 6a4 4 0 018 0"/>
                      <circle cx="9" cy="16" r="1" fill="currentColor" stroke="none"/>
                      <circle cx="15" cy="16" r="1" fill="currentColor" stroke="none"/>
                    </svg>
                  </div>
                  <h3 className="chat-cta__title">Ask UniBot</h3>
                  <p className="chat-cta__sub">AI-powered answers about your courses, fees, admissions, exams and more.</p>
                  <div className="chat-cta__chips">
                    {['My courses', 'Pending fees', 'Next exam'].map(q => (
                      <button
                        key={q}
                        className="chip"
                        onClick={() => navigate('/chat', { state: { query: q } })}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                  <Button variant="primary" fullWidth onClick={() => navigate('/chat')}>
                    Open Chat
                  </Button>
                </section>

                {/* Deadlines */}
                <section className="dash__panel">
                  <div className="panel-hd">
                    <h2 className="panel-title">Deadlines</h2>
                    {deadlines.length > 0 && (
                      <span className="panel-count">{deadlines.length}</span>
                    )}
                  </div>
                  {deadlines.length === 0 ? (
                    <div className="dash__empty">
                      <span>✅</span><p>All clear</p>
                    </div>
                  ) : (
                    <div className="deadlines-list">
                      {deadlines.slice(0, 6).map((d, i) => (
                        <DeadlineRow key={i} deadline={d} />
                      ))}
                    </div>
                  )}
                </section>

              </aside>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export { CourseCard, FeeRow };
export default StudentDashboard;
