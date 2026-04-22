import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './contexts/authStore';
import ProtectedRoute from './components/common/ProtectedRoute';

// Public
import Landing from './components/landing/Landing';
import Login from './components/auth/Login';
import Register from './components/auth/Register';

// Student
import StudentDashboard from './components/dashboard/StudentDashboard';

// Chat
import ChatInterface from './components/chat/ChatInterface';

// Admin
import AdminDashboard from './components/admin/AdminDashboard';

// Profile
import Profile from './components/profile/Profile';

const App = () => {
  const { isAuthenticated, user } = useAuthStore();
  const dashPath = user?.role === 'admin' ? '/admin/dashboard' : '/student/dashboard';

  return (
    <Routes>
      {/* Landing page — always public */}
      <Route path="/" element={<Landing />} />

      {/* Auth — redirect if already logged in */}
      <Route
        path="/login"
        element={!isAuthenticated ? <Login /> : <Navigate to={dashPath} replace />}
      />
      <Route
        path="/register"
        element={!isAuthenticated ? <Register /> : <Navigate to={dashPath} replace />}
      />

      {/* Student */}
      <Route
        path="/student/dashboard"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />

      {/* Chat */}
      <Route
        path="/chat"
        element={
          <ProtectedRoute allowedRoles={['student', 'admin']}>
            <ChatInterface />
          </ProtectedRoute>
        }
      />

      {/* Admin */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Profile */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute allowedRoles={['student', 'admin']}>
            <Profile />
          </ProtectedRoute>
        }
      />

      {/* 404 */}
      <Route path="*" element={
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100vh', flexDirection: 'column', gap: 16, background: 'var(--bg-primary)'
        }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '5rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>404</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Page not found</p>
          <a href="/" style={{ color: 'var(--blue-600)', fontWeight: 500 }}>← Back home</a>
        </div>
      } />
    </Routes>
  );
};

export default App;
