import React, { useState, useEffect } from 'react';
import Layout from '../layout/Layout';
import Badge from '../common/Badge';
import Button from '../common/Button';
import Modal from '../common/Modal';
import DataTable from './DataTable';
import DocumentUpload from './DocumentUpload';
import EvaluationPanel from './EvaluationPanel';
import useAuthStore from '../../contexts/authStore';
import { adminAPI } from '../../services/api';
import './Admin.css';

/* ── Stat Card ─────────────────────────────────────────── */
const StatCard = ({ icon, label, value, accent = 'blue' }) => (
  <div className={`admin-stat admin-stat--${accent}`}>
    <div className="admin-stat__icon">{icon}</div>
    <div>
      <p className="admin-stat__value">{value ?? '—'}</p>
      <p className="admin-stat__label">{label}</p>
    </div>
  </div>
);

/* ── Tab system ────────────────────────────────────────── */
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'knowledge', label: 'Knowledge Base' },
  { id: 'evaluation', label: 'RAGAS Evaluation' },
  { id: 'faqs', label: 'FAQs' },
  { id: 'users', label: 'Users' },
  { id: 'courses', label: 'Courses' },
];

/* ── Documents columns ─────────────────────────────────── */
const docStatusVariant = { active: 'success', processing: 'warning', failed: 'danger' };

/* ── FAQ Modal Form ────────────────────────────────────── */
const FAQForm = ({ initial, onSave, onClose }) => {
  const [form, setForm] = useState({ question: initial?.question || '', answer: initial?.answer || '', category: initial?.category || 'general' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (initial?._id) await adminAPI.updateFAQ(initial._id, form);
      else await adminAPI.createFAQ(form);
      onSave();
    } catch {}
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="faq-form">
      <div className="faq-form__field">
        <label>Question</label>
        <input className="faq-form__input" value={form.question} onChange={e => setForm(p => ({ ...p, question: e.target.value }))} required />
      </div>
      <div className="faq-form__field">
        <label>Answer</label>
        <textarea className="faq-form__textarea" rows={4} value={form.answer} onChange={e => setForm(p => ({ ...p, answer: e.target.value }))} required />
      </div>
      <div className="faq-form__field">
        <label>Category</label>
        <select className="faq-form__select" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
          {['general','admissions','fees','courses','hostel','exams','academic_policy'].map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="faq-form__footer">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" loading={saving}>Save FAQ</Button>
      </div>
    </form>
  );
};

/* ── Admin Dashboard ───────────────────────────────────── */
const AdminDashboard = () => {
  const { user } = useAuthStore();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [faqs, setFAQs] = useState([]);
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState({ stats: true, docs: false, faqs: false, users: false, courses: false });
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [faqModal, setFaqModal] = useState(null); // null | 'new' | faqObject

  const firstName = user?.profile?.firstName || user?.firstName || 'Admin';

  /* ── Load stats on mount ── */
  useEffect(() => {
    adminAPI.getDashboard()
      .then(res => setStats(res.data || res))
      .catch(() => {})
      .finally(() => setLoading(l => ({ ...l, stats: false })));
  }, []);

  /* ── Load tab data ── */
  useEffect(() => {
    if (tab === 'knowledge' && documents.length === 0) {
      setLoading(l => ({ ...l, docs: true }));
      adminAPI.getDocuments().then(res => setDocuments(res.data || res || [])).catch(() => {}).finally(() => setLoading(l => ({ ...l, docs: false })));
    }
    if (tab === 'faqs' && faqs.length === 0) {
      setLoading(l => ({ ...l, faqs: true }));
      adminAPI.getFAQs().then(res => setFAQs(res.data || res || [])).catch(() => {}).finally(() => setLoading(l => ({ ...l, faqs: false })));
    }
    if (tab === 'users' && users.length === 0) {
      setLoading(l => ({ ...l, users: true }));
      adminAPI.getUsers().then(res => setUsers(res.data || res || [])).catch(() => {}).finally(() => setLoading(l => ({ ...l, users: false })));
    }
    if (tab === 'courses' && courses.length === 0) {
      setLoading(l => ({ ...l, courses: true }));
      adminAPI.getCourses().then(res => setCourses(res.data || res || [])).catch(() => {}).finally(() => setLoading(l => ({ ...l, courses: false })));
    }
  }, [tab]);

  const handleSyncFAQs = async () => {
    setSyncing(true); setSyncMsg('');
    try {
      const res = await adminAPI.syncFAQs();
      setSyncMsg(`✓ Synced ${res.data?.count ?? res.count ?? '?'} FAQs to vector store`);
    } catch (err) {
      setSyncMsg('⚠ Sync failed: ' + (err.message || 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteDoc = async (id) => {
    if (!window.confirm('Delete this document and its vectors?')) return;
    try {
      await adminAPI.deleteDocument(id);
      setDocuments(prev => prev.filter(d => d._id !== id));
    } catch {}
  };

  const handleDeleteFAQ = async (id) => {
    if (!window.confirm('Delete this FAQ?')) return;
    try {
      await adminAPI.deleteFAQ(id);
      setFAQs(prev => prev.filter(f => f._id !== id));
    } catch {}
  };

  const refreshDocs = () => {
    setLoading(l => ({ ...l, docs: true }));
    adminAPI.getDocuments().then(res => setDocuments(res.data || res || [])).catch(() => {}).finally(() => setLoading(l => ({ ...l, docs: false })));
  };

  // After upload: refresh immediately, then again after 12s so processed status/chunks show up
  const handleDocUploaded = () => {
    refreshDocs();
    setTimeout(refreshDocs, 12000);
  };

  const refreshFAQs = () => {
    setLoading(l => ({ ...l, faqs: true }));
    adminAPI.getFAQs().then(res => setFAQs(res.data || res || [])).catch(() => {}).finally(() => setLoading(l => ({ ...l, faqs: false })));
  };

  const o = stats?.overview || stats || {};

  return (
    <Layout>
      <div className="admin">
        {/* Header */}
        <div className="admin__header">
          <div>
            <h1 className="admin__title">Admin Portal</h1>
            <p className="admin__sub">Welcome back, {firstName}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="admin-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`admin-tab${tab === t.id ? ' admin-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {tab === 'overview' && (
          <div className="admin-section">
            <div className="admin-stat-grid">
              <StatCard icon="👥" label="Total Students" value={o.totalStudents} accent="blue" />
              <StatCard icon="📚" label="Active Courses" value={o.totalCourses} accent="green" />
              <StatCard icon="📄" label="Documents" value={o.totalDocuments} accent="purple" />
              <StatCard icon="❓" label="FAQs" value={o.totalFAQs} accent="amber" />
              <StatCard icon="🔢" label="Vector Chunks" value={o.vectorCount} accent="blue" />
              <StatCard icon="💬" label="Conversations" value={o.totalConversations} accent="green" />
            </div>

            {stats?.recentEnrollments?.length > 0 && (
              <div className="admin-card">
                <h3 className="admin-card__title">Recent Enrolments</h3>
                <DataTable
                  columns={[
                    { key: 'student', label: 'Student', render: (_, r) => r.student?.email || '—' },
                    { key: 'course', label: 'Course', render: (_, r) => r.course?.courseName || '—' },
                    { key: 'createdAt', label: 'Date', sortable: true, render: v => v ? new Date(v).toLocaleDateString() : '—' },
                  ]}
                  data={stats.recentEnrollments}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Knowledge Base ── */}
        {tab === 'knowledge' && (
          <div className="admin-section">
            <div className="admin-card">
              <h3 className="admin-card__title">Upload Document</h3>
              <DocumentUpload onUploaded={handleDocUploaded} />
            </div>

            <div className="admin-card">
              <div className="admin-card__header">
                <h3 className="admin-card__title">Document Library</h3>
                <div className="admin-card__actions">
                  {syncMsg && <span className="admin-sync-msg">{syncMsg}</span>}
                  <Button variant="secondary" size="sm" loading={syncing} onClick={handleSyncFAQs}>
                    Sync FAQs to Vector Store
                  </Button>
                  <Button variant="ghost" size="sm" onClick={refreshDocs}>Refresh</Button>
                </div>
              </div>
              <DataTable
                loading={loading.docs}
                columns={[
                  { key: 'title', label: 'Document', sortable: true },
                  { key: 'category', label: 'Category', sortable: true, render: v => v || 'general' },
                  { key: 'status', label: 'Status', render: v => <Badge variant={docStatusVariant[v] || 'default'} size="sm" dot>{v || 'unknown'}</Badge> },
                  { key: 'embedding', label: 'Chunks / Vectors', render: v => v?.isProcessed ? `${v.chunksCount} / ${v.vectorsCount}` : '—' },
                  { key: 'createdAt', label: 'Uploaded', sortable: true, render: v => v ? new Date(v).toLocaleDateString() : '—' },
                ]}
                data={documents}
                emptyMessage="No documents uploaded yet"
                actions={row => (
                  <button className="dt-action-btn dt-action-btn--danger" onClick={() => handleDeleteDoc(row._id)}>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4h10M6 4V3h4v1M5 4v8h6V4H5z"/></svg>
                  </button>
                )}
              />
            </div>
          </div>
        )}

        {/* ── RAGAS Evaluation ── */}
        {tab === 'evaluation' && (
          <div className="admin-section">
            <EvaluationPanel />
          </div>
        )}

        {/* ── FAQs ── */}
        {tab === 'faqs' && (
          <div className="admin-section">
            <div className="admin-card">
              <div className="admin-card__header">
                <h3 className="admin-card__title">FAQ Management</h3>
                <Button variant="primary" size="sm" onClick={() => setFaqModal('new')}>+ Add FAQ</Button>
              </div>
              <DataTable
                loading={loading.faqs}
                columns={[
                  { key: 'question', label: 'Question', sortable: true },
                  { key: 'category', label: 'Category', sortable: true },
                  { key: 'answer', label: 'Answer', render: v => v?.slice(0, 80) + (v?.length > 80 ? '…' : '') },
                ]}
                data={faqs}
                emptyMessage="No FAQs found"
                actions={row => (
                  <div className="dt-actions-row">
                    <button className="dt-action-btn" onClick={() => setFaqModal(row)}>
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 2l3 3-9 9H2v-3l9-9z"/></svg>
                    </button>
                    <button className="dt-action-btn dt-action-btn--danger" onClick={() => handleDeleteFAQ(row._id)}>
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4h10M6 4V3h4v1M5 4v8h6V4H5z"/></svg>
                    </button>
                  </div>
                )}
              />
            </div>
          </div>
        )}

        {/* ── Users ── */}
        {tab === 'users' && (
          <div className="admin-section">
            <div className="admin-card">
              <h3 className="admin-card__title">User Management</h3>
              <DataTable
                loading={loading.users}
                columns={[
                  { key: 'email', label: 'Email', sortable: true },
                  { key: 'role', label: 'Role', sortable: true, render: v => <Badge variant={v === 'admin' ? 'danger' : 'primary'} size="sm">{v}</Badge> },
                  { key: 'profile', label: 'Name', render: v => v ? `${v.firstName || ''} ${v.lastName || ''}`.trim() || '—' : '—' },
                  { key: 'createdAt', label: 'Joined', sortable: true, render: v => v ? new Date(v).toLocaleDateString() : '—' },
                ]}
                data={users}
                emptyMessage="No users found"
              />
            </div>
          </div>
        )}

        {/* ── Courses ── */}
        {tab === 'courses' && (
          <div className="admin-section">
            <div className="admin-card">
              <h3 className="admin-card__title">Course Management</h3>
              <DataTable
                loading={loading.courses}
                columns={[
                  { key: 'courseCode', label: 'Code', sortable: true },
                  { key: 'courseName', label: 'Course Name', sortable: true },
                  { key: 'instructor', label: 'Instructor' },
                  { key: 'credits', label: 'Credits', sortable: true },
                  { key: 'status', label: 'Status', render: v => <Badge variant={v === 'active' ? 'success' : 'default'} size="sm">{v || 'active'}</Badge> },
                ]}
                data={courses}
                emptyMessage="No courses found"
              />
            </div>
          </div>
        )}
      </div>

      {/* FAQ Modal */}
      {faqModal && (
        <Modal
          isOpen
          onClose={() => setFaqModal(null)}
          title={faqModal === 'new' ? 'Add FAQ' : 'Edit FAQ'}
          size="md"
        >
          <FAQForm
            initial={faqModal === 'new' ? null : faqModal}
            onSave={() => { setFaqModal(null); refreshFAQs(); }}
            onClose={() => setFaqModal(null)}
          />
        </Modal>
      )}
    </Layout>
  );
};

export default AdminDashboard;
