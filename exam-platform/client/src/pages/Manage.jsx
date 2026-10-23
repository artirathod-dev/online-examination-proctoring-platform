import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const blank = { text: '', options: ['', '', '', ''], correctIndex: 0, topic: 'General', marks: 1 };

export function Questions() {
  const [list, setList] = useState([]);
  const [f, setF] = useState(blank);
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState('');
  const load = () => api('/questions').then(setList);
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault(); setErr('');
    try {
      await api(editId ? `/questions/${editId}` : '/questions', { method: editId ? 'PUT' : 'POST', body: f });
      setF(blank); setEditId(null); load();
    } catch (e) { setErr(e.message); }
  }
  async function del(id) {
    if (!window.confirm('Delete this question?')) return;
    try { await api(`/questions/${id}`, { method: 'DELETE' }); load(); } catch (e) { alert(e.message); }
  }
  const setOpt = (i, v) => setF({ ...f, options: f.options.map((o, j) => (j === i ? v : o)) });

  return (
    <div className="row2" style={{ alignItems: 'flex-start' }}>
      <form className="card" onSubmit={save} style={{ flex: '0 0 380px' }}>
        <h3>{editId ? 'Edit question' : 'Add question'}</h3>
        <textarea rows={3} placeholder="Question text" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} required />
        {f.options.map((o, i) => (
          <label className="row" key={i}>
            <input type="radio" checked={f.correctIndex === i} onChange={() => setF({ ...f, correctIndex: i })} title="Correct answer" />
            <input style={{ margin: 0 }} placeholder={`Option ${i + 1}`} value={o} onChange={(e) => setOpt(i, e.target.value)} />
          </label>
        ))}
        <p className="muted" style={{ fontSize: 12 }}>Select the radio next to the correct option.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Topic" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} />
          <input type="number" min="1" value={f.marks} onChange={(e) => setF({ ...f, marks: e.target.value })} style={{ width: 80 }} />
        </div>
        {err && <div className="err">{err}</div>}
        <button>{editId ? 'Update' : 'Add question'}</button>{' '}
        {editId && <button type="button" className="ghost" onClick={() => { setF(blank); setEditId(null); }}>Cancel</button>}
      </form>
      <div className="card" style={{ flex: 2 }}>
        <h3>Question bank ({list.length})</h3>
        <table>
          <thead><tr><th>Question</th><th>Topic</th><th>Marks</th><th /></tr></thead>
          <tbody>
            {list.map((q) => (
              <tr key={q.id}>
                <td>{q.text}<div className="muted" style={{ fontSize: 12 }}>✔ {q.options[q.correctIndex]}</div></td>
                <td><span className="badge">{q.topic}</span></td><td>{q.marks}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="sm ghost" onClick={() => { setEditId(q.id); setF({ ...q, options: [...q.options, '', '', '', ''].slice(0, Math.max(4, q.options.length)) }); window.scrollTo(0, 0); }}>Edit</button>{' '}
                  <button className="sm danger" onClick={() => del(q.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Exams() {
  const [exams, setExams] = useState([]);
  const [qs, setQs] = useState([]);
  const [f, setF] = useState({ title: '', description: '', durationMin: 30, passPercent: 40, shuffle: true });
  const [picked, setPicked] = useState([]);
  const [err, setErr] = useState('');
  const load = () => api('/exams').then(setExams);
  useEffect(() => { load(); api('/questions').then(setQs); }, []);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function create(e) {
    e.preventDefault(); setErr('');
    try {
      await api('/exams', { method: 'POST', body: { ...f, durationMin: Number(f.durationMin), passPercent: Number(f.passPercent), questionIds: picked } });
      setPicked([]); setF({ ...f, title: '', description: '' }); load();
    } catch (e) { setErr(e.message); }
  }
  async function del(id) {
    if (!window.confirm('Delete exam?')) return;
    try { await api(`/exams/${id}`, { method: 'DELETE' }); load(); } catch (e) { alert(e.message); }
  }

  return (
    <div className="row2" style={{ alignItems: 'flex-start' }}>
      <form className="card" onSubmit={create} style={{ flex: '0 0 400px' }}>
        <h3>Create exam</h3>
        <input placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
        <textarea rows={2} placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div><small className="muted">Duration (min)</small><input type="number" min="1" value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: e.target.value })} /></div>
          <div><small className="muted">Pass %</small><input type="number" min="1" max="100" value={f.passPercent} onChange={(e) => setF({ ...f, passPercent: e.target.value })} /></div>
        </div>
        <label className="row"><input type="checkbox" checked={f.shuffle} onChange={(e) => setF({ ...f, shuffle: e.target.checked })} /> Shuffle question order per student</label>
        <b>Select questions ({picked.length})</b>
        <div style={{ maxHeight: 220, overflow: 'auto', margin: '6px 0 10px' }}>
          {qs.map((q) => (
            <label className="row" key={q.id} style={{ fontSize: 13 }}>
              <input type="checkbox" checked={picked.includes(q.id)} onChange={() => toggle(q.id)} /> {q.text} <span className="badge">{q.topic}</span>
            </label>
          ))}
        </div>
        {err && <div className="err">{err}</div>}
        <button>Create exam</button>
      </form>
      <div className="card" style={{ flex: 2 }}>
        <h3>Exams</h3>
        <table>
          <thead><tr><th>Title</th><th>Qs</th><th>Min</th><th>Attempts</th><th>Status</th><th /></tr></thead>
          <tbody>
            {exams.map((e) => (
              <tr key={e.id}>
                <td><Link to={`/admin/exam/${e.id}`}>{e.title}</Link></td>
                <td>{e.questionCount}</td><td>{e.durationMin}</td><td>{e.attemptCount}</td>
                <td><span className={`badge ${e.active ? 'ok' : 'warn'}`}>{e.active ? 'Active' : 'Hidden'}</span></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="sm ghost" onClick={async () => { await api(`/exams/${e.id}/active`, { method: 'PATCH', body: { active: !e.active } }); load(); }}>{e.active ? 'Deactivate' : 'Activate'}</button>{' '}
                  <button className="sm danger" onClick={() => del(e.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
