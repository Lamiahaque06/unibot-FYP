import React, { useState } from 'react';
import Badge from '../common/Badge';
import Button from '../common/Button';
import { adminAPI } from '../../services/api';

/* ── Circular Progress ─────────────────────────────────── */
const CircularProgress = ({ value, size = 80, strokeWidth = 8, label, color }) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const progress = Math.min(Math.max(value, 0), 1);
  const offset = circ * (1 - progress);
  const pct = Math.round(progress * 100);

  return (
    <div className="circ-progress">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="var(--border)" strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div className="circ-progress__label">
        <span className="circ-progress__pct" style={{ color }}>{pct}%</span>
      </div>
      <p className="circ-progress__name">{label}</p>
    </div>
  );
};

const metricColor = (v) => {
  if (v >= 0.8) return 'var(--emerald-500)';
  if (v >= 0.6) return 'var(--amber-500)';
  return 'var(--red-500)';
};

/* ── Evaluation Panel ──────────────────────────────────── */
const EvaluationPanel = () => {
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const runDemo = async () => {
    setRunning(true); setError(''); setResult(null);
    try {
      const res = await adminAPI.runDemoEvaluation();
      // Backend wraps in { success, data } — unwrap to get EvaluationResponse
      setResult(res.data?.data ?? res.data ?? res);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Evaluation failed');
    } finally {
      setRunning(false);
    }
  };

  const metrics = result ? [
    { label: 'Answer Relevance', key: 'answer_relevance', value: result.aggregate?.answer_relevance ?? 0 },
    { label: 'Context Precision', key: 'context_precision', value: result.aggregate?.context_precision ?? 0 },
    { label: 'Faithfulness', key: 'faithfulness', value: result.aggregate?.faithfulness ?? 0 },
  ] : [];

  const overall = result?.aggregate?.overall ?? 0;
  const nfr2Pass = result?.meets_threshold ?? false;

  return (
    <div className="eval-panel">
      <div className="eval-panel__header">
        <div>
          <h3 className="eval-panel__title">RAGAS Evaluation</h3>
          <p className="eval-panel__sub">Evaluate RAG pipeline against NFR2 threshold (≥80%)</p>
        </div>
        <Button
          variant="primary"
          onClick={runDemo}
          loading={running}
          icon={!running && (
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 18A8 8 0 1010 2a8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 002 0V9.414l1.293 1.293a1 1 0 001.414-1.414z"/>
            </svg>
          )}
        >
          Run Demo Evaluation
        </Button>
      </div>

      {error && <p className="eval-panel__error">⚠ {error}</p>}

      {result && (
        <div className="eval-results">
          {/* NFR2 compliance banner */}
          <div className={`nfr2-banner nfr2-banner--${nfr2Pass ? 'pass' : 'fail'}`}>
            <span className="nfr2-banner__icon">{nfr2Pass ? '✅' : '❌'}</span>
            <div>
              <p className="nfr2-banner__title">
                NFR2 {nfr2Pass ? 'Compliant ✓' : 'Not Met ✗'}
              </p>
              <p className="nfr2-banner__sub">
                Overall score: {Math.round(overall * 100)}% — threshold: 80%
              </p>
            </div>
            <Badge variant={nfr2Pass ? 'success' : 'danger'} size="md">
              {Math.round(overall * 100)}%
            </Badge>
          </div>

          {/* Metric circles */}
          <div className="eval-metrics">
            {metrics.map(m => (
              <div key={m.key} className="eval-metric">
                <CircularProgress
                  value={m.value}
                  size={100}
                  strokeWidth={10}
                  label={m.label}
                  color={metricColor(m.value)}
                />
                <p className="eval-metric__status">
                  {m.value >= 0.8 ? '✓ Good' : m.value >= 0.6 ? '~ Fair' : '✗ Low'}
                </p>
              </div>
            ))}
          </div>

          {/* Sample results */}
          {result.results?.length > 0 && (
            <div className="eval-samples">
              <h4 className="eval-samples__title">Sample Q&A Results</h4>
              {result.results.map((s, i) => (
                <div key={i} className="eval-sample">
                  <p className="eval-sample__q"><strong>Q:</strong> {s.query}</p>
                  <p className="eval-sample__a">
                    AR: {Math.round((s.answer_relevance?.score ?? 0) * 100)}% &nbsp;|&nbsp;
                    CP: {Math.round((s.context_precision?.score ?? 0) * 100)}% &nbsp;|&nbsp;
                    FA: {Math.round((s.faithfulness?.score ?? 0) * 100)}% &nbsp;|&nbsp;
                    Overall: {Math.round((s.overall_score ?? 0) * 100)}%
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!result && !running && (
        <div className="eval-panel__empty">
          <span>📊</span>
          <p>Click "Run Demo Evaluation" to assess the RAG pipeline quality using built-in sample Q&A pairs.</p>
        </div>
      )}
    </div>
  );
};

export default EvaluationPanel;
