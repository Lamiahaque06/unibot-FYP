import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Input from '../common/Input';
import Button from '../common/Button';
import useAuthStore from '../../contexts/authStore';
import './Auth.css';

const BrainIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5C8.5 5 6 7.5 6 9.5c0 1.7 1 3 2.5 3.5C7.5 14 7 15 7 16c0 2.2 1.8 4 4 4h2c2.2 0 4-1.8 4-4 0-1-.5-2-1.5-3 1.5-.5 2.5-1.8 2.5-3.5C18 7.5 15.5 5 12 5z"/>
  </svg>
);

const DEMO_ACCOUNTS = [
  { label: 'Demo Student', email: 'john.doe@student.edu', password: 'student123' },
  { label: 'Demo Admin', email: 'admin@college.edu', password: 'admin123' },
];

const validate = (data) => {
  const errors = {};
  if (!data.email.trim()) errors.email = 'Email is required';
  else if (!/\S+@\S+\.\S+/.test(data.email)) errors.email = 'Invalid email address';
  if (!data.password) errors.password = 'Password is required';
  else if (data.password.length < 6) errors.password = 'Minimum 6 characters';
  return errors;
};

const Login = () => {
  const navigate = useNavigate();
  const { login, loading, error, clearError } = useAuthStore();
  const formRef = useRef(null);

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [shake, setShake] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    if (error) clearError();
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); triggerShake(); return; }

    const result = await login({ email: form.email.toLowerCase().trim(), password: form.password });
    if (result.success) {
      const { user } = useAuthStore.getState();
      navigate(user?.role === 'admin' ? '/admin/dashboard' : '/student/dashboard');
    } else {
      triggerShake();
    }
  };

  const fillDemo = (account) => {
    setForm({ email: account.email, password: account.password });
    setErrors({});
    if (error) clearError();
  };

  return (
    <div className="auth-page">
      {/* Left panel — branding */}
      <div className="auth-panel auth-panel--brand">
        <div className="auth-brand-bg" aria-hidden="true">
          <div className="auth-brand-orb auth-brand-orb--1" />
          <div className="auth-brand-orb auth-brand-orb--2" />
          <div className="auth-brand-orb auth-brand-orb--3" />
        </div>
        <div className="auth-brand-content">
          <div className="auth-brand-logo">
            <BrainIcon />
          </div>
          <h1 className="auth-brand-title">UniBot</h1>
          <p className="auth-brand-tagline">AI-powered college support at your fingertips</p>
          <ul className="auth-brand-features">
            <li><span>🎓</span> Personalised course &amp; fee info</li>
            <li><span>🔍</span> RAG-powered knowledge search</li>
            <li><span>💬</span> 24/7 conversational support</li>
            <li><span>📊</span> RAGAS-evaluated accuracy</li>
          </ul>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="auth-panel auth-panel--form">
        <div className="auth-form-wrap">
          <div className="auth-form-header">
            <h2 className="auth-form-title">Welcome back</h2>
            <p className="auth-form-sub">Sign in to your account to continue</p>
          </div>

          {error && (
            <div className="auth-error" role="alert">
              <span>⚠</span> {error}
            </div>
          )}

          <form ref={formRef} onSubmit={handleSubmit} className={`auth-form${shake ? ' animate-shake' : ''}`} noValidate>
            <Input
              label="Email address"
              type="email"
              name="email"
              id="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@university.edu"
              error={errors.email}
              autoComplete="email"
              required
            />
            <Input
              label="Password"
              type="password"
              name="password"
              id="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter your password"
              error={errors.password}
              autoComplete="current-password"
              required
            />

            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
              Sign in
            </Button>
          </form>

          {/* Demo accounts */}
          <div className="auth-demo">
            <p className="auth-demo-title">Quick access — demo accounts</p>
            <div className="auth-demo-btns">
              {DEMO_ACCOUNTS.map(acc => (
                <button key={acc.email} className="auth-demo-btn" onClick={() => fillDemo(acc)} type="button">
                  {acc.label}
                </button>
              ))}
            </div>
          </div>

          <p className="auth-switch">
            No account?{' '}
            <Link to="/register" className="auth-link">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
