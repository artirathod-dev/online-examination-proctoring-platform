import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';

export function Dashboard() {
  const [exams, setExams] = useState([]);
  useEffect(() => { api('/exams').then(setExams); }, []);
  return (
    <>
      <h2>Available Exams</h2>
      {!exams.length && <p className="muted">No exams available right now.</p>}
      <div className="grid">
        {exams.map((e) => (
          <div className="card" key={e.id}>
            <h3>{e.title}</h3>
            <p className="muted">{e.description}</p>
            <p>⏱ {e.durationMin} min · ❓ {e.questionCount} questions · ✅ pass {e.passPercent}%</p>
            {e.attemptStatus === 'submitted' ? (
              <>
                <span className="badge ok">Completed: {e.score}/{e.total}</span>{' '}
                <Link to={`/result/${e.attemptId}`}>View result</Link>
              </>
            ) : (
              <Link className="btn" to={`/exam/${e.id}`}>{e.attemptStatus === 'in_progress' ? 'Resume exam' : 'Start exam'}</Link>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

export function Result() {
  const { id } = useParams();
  const [r, setR] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api(`/attempts/${id}/result`).then(setR).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <p className="err">{err}</p>;
  if (!r) return <p>Loading…</p>;
  return (
    <>
      <div className="card" style={{ textAlign: 'center', marginBottom: 16 }}>
        <h2>{r.title}</h2>
        <div style={{ fontSize: 48, fontWeight: 800 }}>{r.percent}%</div>
        <p>Score {r.score}/{r.total} · <span className={`badge ${r.passed ? 'ok' : 'bad'}`}>{r.passed ? 'PASSED' : 'FAILED'}</span>
          <span className="muted"> (pass mark {r.passPercent}%)</span></p>
      </div>
      <h3>Answer review</h3>
      {r.review.map((q, i) => (
        <div className="card" key={q.id} style={{ marginBottom: 12 }}>
          <b>{i + 1}. {q.text}</b>
          {q.options.map((o, j) => (
            <div key={j} className={`opt ${j === q.correctIndex ? 'right' : j === q.selected ? 'wrong' : ''}`}>
              {o} {j === q.correctIndex && '✔'} {j === q.selected && j !== q.correctIndex && '✘ (your answer)'}
            </div>
          ))}
          {q.selected == null && <span className="badge warn">Not answered</span>}
        </div>
      ))}
      <Link className="btn" to="/dashboard">Back to exams</Link>
    </>
  );
}
