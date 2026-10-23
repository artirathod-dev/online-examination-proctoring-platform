import { createContext, useContext, useEffect, useState } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { api } from './api.js';
import Login from './pages/Login.jsx';
import { Dashboard, Result } from './pages/Student.jsx';
import TakeExam from './pages/TakeExam.jsx';
import { Overview, ExamAnalytics, AttemptReport } from './pages/Analytics.jsx';
import { Questions, Exams } from './pages/Manage.jsx';
import Proctor from './pages/Proctor.jsx';

const Ctx = createContext();
export const useAuth = () => useContext(Ctx);

function Protected({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (!localStorage.getItem('token')) return setReady(true);
    api('/auth/me').then(setUser).catch(() => localStorage.removeItem('token')).finally(() => setReady(true));
  }, []);

  const login = ({ token, user }) => { localStorage.setItem('token', token); setUser(user); nav('/'); };
  const logout = () => { localStorage.removeItem('token'); setUser(null); nav('/login'); };
  if (!ready) return <p style={{ padding: 20 }}>Loading…</p>;
  const inExam = loc.pathname.startsWith('/exam/');

  return (
    <Ctx.Provider value={{ user, login, logout }}>
      {user && !inExam && (
        <header className="nav">
          <span className="brand">🎓 ProctorExam</span>
          {user.role === 'admin' ? (
            <>
              <NavLink to="/admin" end>Analytics</NavLink>
              <NavLink to="/admin/questions">Question Bank</NavLink>
              <NavLink to="/admin/exams">Exams</NavLink>
              <NavLink to="/admin/proctor">Live Proctor</NavLink>
            </>
          ) : <NavLink to="/dashboard">My Exams</NavLink>}
          <span className="spacer" />
          <span className="muted">{user.name}</span>
          <button className="ghost sm" onClick={logout}>Logout</button>
        </header>
      )}
      <main>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
          <Route path="/" element={<Navigate to={!user ? '/login' : user.role === 'admin' ? '/admin' : '/dashboard'} replace />} />
          <Route path="/dashboard" element={<Protected role="student"><Dashboard /></Protected>} />
          <Route path="/exam/:examId" element={<Protected role="student"><TakeExam /></Protected>} />
          <Route path="/result/:id" element={<Protected><Result /></Protected>} />
          <Route path="/admin" element={<Protected role="admin"><Overview /></Protected>} />
          <Route path="/admin/questions" element={<Protected role="admin"><Questions /></Protected>} />
          <Route path="/admin/exams" element={<Protected role="admin"><Exams /></Protected>} />
          <Route path="/admin/proctor" element={<Protected role="admin"><Proctor /></Protected>} />
          <Route path="/admin/exam/:id" element={<Protected role="admin"><ExamAnalytics /></Protected>} />
          <Route path="/admin/attempt/:id" element={<Protected role="admin"><AttemptReport /></Protected>} />
        </Routes>
      </main>
    </Ctx.Provider>
  );
}
