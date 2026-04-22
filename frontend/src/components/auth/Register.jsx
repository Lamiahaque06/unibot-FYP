import React, { useState } from 'react';
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

const getStrength = (pw) => {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map = [
    { label: 'Too weak', color: 'var(--red-500)' },
    { label: 'Weak', color: 'var(--red-400)' },
    { label: 'Fair', color: 'var(--amber-500)' },
    { label: 'Good', color: 'var(--blue-500)' },
    { label: 'Strong', color: 'var(--emerald-500)' },
  ];
  return { score, ...map[score] };
};

const validate = (data) => {
  const errors = {};
  if (!data.firstName.trim()) errors.firstName = 'First name is required';
  if (!data.lastName.trim()) errors.lastName = 'Last name is required';
  if (!data.email.trim()) errors.email = 'Email is required';
  else if (!/\S+@\S+\.\S+/.test(data.email)) errors.email = 'Invalid email address';
  if (!data.password) errors.password = 'Password is required';
  else if (data.password.length < 6) errors.password = 'Minimum 6 characters';
  if (!data.confirmPassword) errors.confirmPassword = 'Please confirm your password';
  else if (data.password !== data.confirmPassword) errors.confirmPassword = 'Passwords do not match';
  if (!data.agreed) errors.agreed = 'You must accept the terms';
  return errors;
};

const Register = () => {
  const navigate = useNavigate();
  const { register, loading, error, clearError } = useAuthStore();

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '',
    password: '', confirmPassword: '',
    studentId: '', major: '', agreed: false,
  });
  const [errors, setErrors] = useState({});
  const [shake, setShake] = useState(false);

  const pwStrength = getStrength(form.password);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
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

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.toLowerCase().trim(),
      password: form.password,
      role: 'student',
    };
    if (form.studentId.trim()) payload.studentId = form.studentId.trim();
    if (form.major.trim()) payload.major = form.major.trim();

    const result = await register(payload);
    if (result.success) {
      const { user } = useAuthStore.getState();
      navigate(user?.role === 'admin' ? '/admin/dashboard' : '/student/dashboard');
    } else {
      triggerShake();
    }
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
          <p className="auth-brand-tagline">Your intelligent university companion — available 24/7</p>
          <ul className="auth-brand-features">
            <li><span>🎓</span> Course enrolment &amp; credit tracking</li>
            <li><span>💰</span> Fee status &amp; payment reminders</li>
            <li><span>📅</span> Exam &amp; deadline management</li>
            <li><span>🏠</span> Hostel &amp; campus services</li>
          </ul>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="auth-panel auth-panel--form">
        <div className="auth-form-wrap">
          <div className="auth-form-header">
            <h2 className="auth-form-title">Create account</h2>
            <p className="auth-form-sub">Join UniBot to get started</p>
          </div>

          {error && (
            <div className="auth-error" role="alert">
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className={`auth-form${shake ? ' animate-shake' : ''}`} noValidate>
            <div className="form-row">
              <Input
                label="First name"
                type="text"
                name="firstName"
                id="firstName"
                value={form.firstName}
                onChange={handleChange}
                placeholder="John"
                error={errors.firstName}
                autoComplete="given-name"
                required
              />
              <Input
                label="Last name"
                type="text"
                name="lastName"
                id="lastName"
                value={form.lastName}
                onChange={handleChange}
                placeholder="Doe"
                error={errors.lastName}
                autoComplete="family-name"
                required
              />
            </div>

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

            <div className="form-row">
              <Input
                label="Student ID (optional)"
                type="text"
                name="studentId"
                id="studentId"
                value={form.studentId}
                onChange={handleChange}
                placeholder="W1234567"
                autoComplete="off"
              />
              <Input
                label="Major (optional)"
                type="text"
                name="major"
                id="major"
                value={form.major}
                onChange={handleChange}
                placeholder="Computer Science"
                autoComplete="off"
              />
            </div>

            <div>
              <Input
                label="Password"
                type="password"
                name="password"
                id="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Minimum 6 characters"
                error={errors.password}
                autoComplete="new-password"
                required
              />
              {form.password && (
                <div className="pw-strength">
                  <div className="pw-strength-bar">
                    <div
                      className="pw-strength-fill"
                      style={{ width: `${(pwStrength.score / 4) * 100}%`, background: pwStrength.color }}
                    />
                  </div>
                  <p className="pw-strength-label" style={{ color: pwStrength.color }}>{pwStrength.label}</p>
                </div>
              )}
            </div>

            <Input
              label="Confirm password"
              type="password"
              name="confirmPassword"
              id="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter your password"
              error={errors.confirmPassword}
              autoComplete="new-password"
              required
            />

            <div className="auth-terms">
              <label className={`auth-terms-label${errors.agreed ? ' auth-terms-label--error' : ''}`}>
                <input
                  type="checkbox"
                  name="agreed"
                  checked={form.agreed}
                  onChange={handleChange}
                  className="auth-terms-check"
                />
                <span>I agree to the <a href="#" className="auth-link">Terms of Service</a> and <a href="#" className="auth-link">Privacy Policy</a></span>
              </label>
              {errors.agreed && <p className="auth-terms-err">{errors.agreed}</p>}
            </div>

            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
              Create account
            </Button>
          </form>

          <p className="auth-switch">
            Already have an account?{' '}
            <Link to="/login" className="auth-link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
