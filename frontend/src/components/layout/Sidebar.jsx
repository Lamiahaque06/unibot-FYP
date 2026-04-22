import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../contexts/authStore';
import './Sidebar.css';

const NavItem = ({ to, icon, label, end = false }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) => `sidebar__nav-item${isActive ? ' sidebar__nav-item--active' : ''}`}
  >
    <span className="sidebar__nav-icon">{icon}</span>
    <span className="sidebar__nav-label">{label}</span>
  </NavLink>
);

const studentNav = [
  { to: '/student/dashboard', icon: <GridIcon />, label: 'Dashboard', end: true },
  { to: '/chat', icon: <ChatIcon />, label: 'Chat' },
  { to: '/student/dashboard', icon: <BookIcon />, label: 'My Courses', end: true },
  { to: '/student/dashboard', icon: <CreditCardIcon />, label: 'My Fees', end: true },
  { to: '/profile', icon: <UserIcon />, label: 'Profile' },
];

const adminNav = [
  { to: '/admin/dashboard', icon: <GridIcon />, label: 'Dashboard', end: true },
  { to: '/chat', icon: <ChatIcon />, label: 'Chat' },
  { to: '/admin/dashboard', icon: <DocumentIcon />, label: 'Knowledge Base', end: true },
  { to: '/profile', icon: <UserIcon />, label: 'Profile' },
];

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  );
}
function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
    </svg>
  );
}
function CreditCardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  );
}
function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  );
}
function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}
function BrainIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5C8.5 5 6 7.5 6 9.5c0 1.7 1 3 2.5 3.5C7.5 14 7 15 7 16c0 2.2 1.8 4 4 4h2c2.2 0 4-1.8 4-4 0-1-.5-2-1.5-3 1.5-.5 2.5-1.8 2.5-3.5C18 7.5 15.5 5 12 5z"/>
    </svg>
  );
}

const Sidebar = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const navItems = isAdmin ? adminNav : studentNav;

  const initials = user?.profile
    ? `${user.profile.firstName?.[0] || ''}${user.profile.lastName?.[0] || ''}`.toUpperCase()
    : user?.email?.[0]?.toUpperCase() || '?';

  const fullName = user?.profile
    ? `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim()
    : user?.email || 'User';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar__logo">
        <div className="sidebar__logo-icon">
          <BrainIcon />
        </div>
        <div className="sidebar__logo-text">
          <span className="sidebar__logo-name">UniBot</span>
          <span className="sidebar__logo-sub">Support AI</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar__nav" aria-label="Main navigation">
        {navItems.map((item) => (
          <NavItem key={item.to + item.label} {...item} />
        ))}
      </nav>

      {/* Bottom */}
      <div className="sidebar__bottom">
        <div className="sidebar__user">
          <div className="sidebar__user-avatar">{initials}</div>
          <div className="sidebar__user-info">
            <span className="sidebar__user-name truncate">{fullName}</span>
            <span className="sidebar__user-role">{isAdmin ? 'Administrator' : 'Student'}</span>
          </div>
        </div>
        <button className="sidebar__logout" onClick={handleLogout} aria-label="Log out">
          <LogoutIcon />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
