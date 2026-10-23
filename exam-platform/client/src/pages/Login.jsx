import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';

export default function Login() {
  const { login } = useAuth();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setErr('');
    try { login(await api(`/auth/${mode}`, { method: 'POST', body: f })); }
    catch (e) { setErr(e.message); }
  }
  return (
    <div className="card auth">
      <h2>🎓 ProctorExam</h2>
      <p className="muted">{mode === 'login' ? 'Sign in to continue' : 'Create a student account'}</p>
      <form onSubmit={submit}>
        {mode === 'register' && <input placeholder="Full name" value={f.name} onChange={set('name')} required />}
        <input type="email" placeholder="Email" value={f.email} onChange={set('email')} required />
        <input type="password" placeholder="Password (6+ chars)" value={f.password} onChange={set('password')} required />
        {err && <div className="err">{err}</div>}
        <button style={{ width: '100%' }}>{mode === 'login' ? 'Sign in' : 'Register'}</button>
      </form>
      <p className="muted" style={{ marginTop: 14 }}>
        {mode === 'login' ? 'New student? ' : 'Have an account? '}
        <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === 'login' ? 'register' : 'login'); }}>
          {mode === 'login' ? 'Register' : 'Sign in'}
        </a>
      </p>
      <p className="muted" style={{ fontSize: 12 }}>Demo — admin@exam.com / admin123 · student@exam.com / student123</p>
    </div>
  );
}
