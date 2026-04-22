import React, { useState } from 'react';
import Layout from '../layout/Layout';
import Button from '../common/Button';
import Input from '../common/Input';
import useAuthStore from '../../contexts/authStore';
import { authAPI } from '../../services/api';
import './Profile.css';

const Profile = () => {
  const { user, updateUser } = useAuthStore();

  const [profile, setProfile] = useState({
    firstName: user?.profile?.firstName || user?.firstName || '',
    lastName: user?.profile?.lastName || user?.lastName || '',
    studentId: user?.profile?.studentId || '',
    major: user?.profile?.major || '',
    semester: user?.profile?.semester || '',
    phone: user?.profile?.phone || '',
  });
  const [pw, setPw] = useState({ current: '', newPw: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [errors, setErrors] = useState({});
  const [pwErrors, setPwErrors] = useState({});

  const initials = `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase() || 'U';

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile(p => ({ ...p, [name]: value }));
    if (errors[name]) setErrors(p => ({ ...p, [name]: '' }));
  };

  const handlePwChange = (e) => {
    const { name, value } = e.target;
    setPw(p => ({ ...p, [name]: value }));
    if (pwErrors[name]) setPwErrors(p => ({ ...p, [name]: '' }));
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!profile.firstName.trim() || !profile.lastName.trim()) {
      setErrors({ firstName: !profile.firstName.trim() ? 'Required' : '', lastName: !profile.lastName.trim() ? 'Required' : '' });
      return;
    }
    setSaving(true); setMsg('');
    try {
      const res = await authAPI.updateProfile({ profile });
      updateUser(res.data || res);
      setMsg('Profile updated successfully');
    } catch (err) {
      setMsg('Error: ' + (err.message || 'Failed to update'));
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!pw.current) errs.current = 'Current password required';
    if (!pw.newPw || pw.newPw.length < 6) errs.newPw = 'Minimum 6 characters';
    if (pw.newPw !== pw.confirm) errs.confirm = 'Passwords do not match';
    if (Object.keys(errs).length) { setPwErrors(errs); return; }

    setPwSaving(true); setPwMsg('');
    try {
      await authAPI.changePassword({ currentPassword: pw.current, newPassword: pw.newPw });
      setPwMsg('Password changed successfully');
      setPw({ current: '', newPw: '', confirm: '' });
    } catch (err) {
      setPwMsg('Error: ' + (err.message || 'Failed to change password'));
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <Layout>
      <div className="profile">
        <div className="profile__header">
          <h1 className="profile__title">Profile Settings</h1>
          <p className="profile__sub">Manage your personal information and account settings</p>
        </div>

        <div className="profile__grid">
          {/* Left: avatar + info */}
          <aside className="profile__aside">
            <div className="profile__card">
              <div className="profile__avatar">{initials}</div>
              <p className="profile__name">{profile.firstName} {profile.lastName}</p>
              <p className="profile__email">{user?.email}</p>
              <div className="profile__role-badge">
                {user?.role === 'admin' ? '🛡 Administrator' : '🎓 Student'}
              </div>
              {profile.studentId && (
                <p className="profile__student-id">ID: {profile.studentId}</p>
              )}
            </div>
          </aside>

          {/* Right: forms */}
          <div className="profile__main">
            {/* Personal info */}
            <div className="profile__card profile__card--form">
              <h2 className="profile__card-title">Personal Information</h2>
              <form onSubmit={saveProfile} className="profile__form">
                <div className="profile__row">
                  <Input
                    label="First name"
                    name="firstName"
                    value={profile.firstName}
                    onChange={handleProfileChange}
                    error={errors.firstName}
                    required
                  />
                  <Input
                    label="Last name"
                    name="lastName"
                    value={profile.lastName}
                    onChange={handleProfileChange}
                    error={errors.lastName}
                    required
                  />
                </div>
                <Input
                  label="Email address"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  help="Email cannot be changed"
                />
                {user?.role === 'student' && (
                  <div className="profile__row">
                    <Input
                      label="Student ID"
                      name="studentId"
                      value={profile.studentId}
                      onChange={handleProfileChange}
                      placeholder="W1234567"
                    />
                    <Input
                      label="Major"
                      name="major"
                      value={profile.major}
                      onChange={handleProfileChange}
                      placeholder="Computer Science"
                    />
                  </div>
                )}
                <div className="profile__row">
                  <Input
                    label="Phone (optional)"
                    name="phone"
                    value={profile.phone}
                    onChange={handleProfileChange}
                    placeholder="+44 7700 900000"
                  />
                  {user?.role === 'student' && (
                    <Input
                      label="Semester"
                      name="semester"
                      value={profile.semester}
                      onChange={handleProfileChange}
                      placeholder="3"
                    />
                  )}
                </div>
                <div className="profile__form-footer">
                  {msg && (
                    <span className={`profile__msg${msg.startsWith('Error') ? ' profile__msg--err' : ' profile__msg--ok'}`}>
                      {msg}
                    </span>
                  )}
                  <Button type="submit" variant="primary" loading={saving}>Save Changes</Button>
                </div>
              </form>
            </div>

            {/* Change password */}
            <div className="profile__card profile__card--form">
              <h2 className="profile__card-title">Change Password</h2>
              <form onSubmit={savePassword} className="profile__form">
                <Input
                  label="Current password"
                  type="password"
                  name="current"
                  value={pw.current}
                  onChange={handlePwChange}
                  error={pwErrors.current}
                  autoComplete="current-password"
                  required
                />
                <div className="profile__row">
                  <Input
                    label="New password"
                    type="password"
                    name="newPw"
                    value={pw.newPw}
                    onChange={handlePwChange}
                    error={pwErrors.newPw}
                    autoComplete="new-password"
                    required
                  />
                  <Input
                    label="Confirm new password"
                    type="password"
                    name="confirm"
                    value={pw.confirm}
                    onChange={handlePwChange}
                    error={pwErrors.confirm}
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div className="profile__form-footer">
                  {pwMsg && (
                    <span className={`profile__msg${pwMsg.startsWith('Error') ? ' profile__msg--err' : ' profile__msg--ok'}`}>
                      {pwMsg}
                    </span>
                  )}
                  <Button type="submit" variant="secondary" loading={pwSaving}>Update Password</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
