import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, downloadCsv } from '../api.js';

const Stat = ({ v, l }) => <div className="card stat"><b>{v}</b><span>{l}</span></div>;
const Bar = ({ label, value, max, text }) => (
  <div className="bar"><span className="lbl" title={label}>{label}</span>
    <div className="track"><div className="fill" style={{ width: `${max ? (value / max) * 100 : 0}%` }} /></div>
    <span className="val">{text ?? value}</span></div>
);

export function Overview() {
  const [o, setO] = useState(null);
  const [exams, setExams] = useState([]);
  useEffect(() => { api('/analytics/overview').then(setO); api('/exams').then(setExams); }, []);
  if (!o) return <p>Loading…</p>;
  return (
    <>
      <h2>Platform overview</h2>
      <div className="grid stats">
        <Stat v={o.students} l="Students" /><Stat v={o.exams} l="Exams" /><Stat v={o.questions} l="Questions" />
        <Stat v={o.submissions} l="Submissions" /><Stat v={`${o.avgPercent}%`} l="Average score" /><Stat v={o.violations} l="Violations logged" />
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Exam results</h3>
        <table><thead><tr><th>Exam</th><th>Attempts</th><th /></tr></thead>
          <tbody>{exams.map((e) => (
            <tr key={e.id}><td>{e.title}</td><td>{e.attemptCount}</td><td><Link to={`/admin/exam/${e.id}`}>View analytics →</Link></td></tr>
          ))}</tbody></table>
      </div>
    </>
  );
}

export function ExamAnalytics() {
  const { id } = useParams();
  const [d, setD] = useState(null);
  useEffect(() => { api(`/analytics/exam/${id}`).then(setD); }, [id]);
  if (!d) return <p>Loading…</p>;
  const { stats: s, exam } = d;
  const maxN = Math.max(1, ...d.buckets.map((b) => b.n));
  return (
    <>
      <h2>{exam.title} — analytics</h2>
      <div className="grid stats">
        <Stat v={s.submitted} l="Submitted" /><Stat v={`${s.avg}%`} l="Average" /><Stat v={`${Math.round(s.highest)}%`} l="Highest" />
        <Stat v={`${Math.round(s.lowest)}%`} l="Lowest" />
        <Stat v={s.submitted ? `${Math.round((s.passed * 100) / s.submitted)}%` : '–'} l={`Pass rate (≥${exam.passPercent}%)`} />
      </div>
      <div className="row2" style={{ margin: '16px 0' }}>
        <div className="card"><h3>Score distribution</h3>
          {d.buckets.map((b) => <Bar key={b.range} label={b.range} value={b.n} max={maxN} />)}</div>
        <div className="card"><h3>Question accuracy</h3>
          {d.questions.map((q) => {
            const pct = q.answered ? Math.round((q.correct * 100) / s.submitted) : 0;
            return <Bar key={q.id} label={q.text} value={pct} max={100} text={`${pct}%`} />;
          })}
          <p className="muted" style={{ fontSize: 12 }}>Low accuracy = hardest questions.</p></div>
      </div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h3>Attempts</h3>
          <button className="sm ghost" onClick={() => downloadCsv(`/analytics/exam/${id}/export.csv`, `exam-${id}-results.csv`)}>⬇ Export CSV</button>
        </div>
        <table><thead><tr><th>Student</th><th>Status</th><th>Score</th><th>Violations</th><th /></tr></thead>
          <tbody>{d.attempts.map((a) => (
            <tr key={a.id}><td>{a.name}<div className="muted" style={{ fontSize: 12 }}>{a.email}</div></td>
              <td><span className={`badge ${a.status === 'submitted' ? 'ok' : 'warn'}`}>{a.status}</span></td>
              <td>{a.score ?? '–'}/{a.total ?? '–'}</td>
              <td><span className={`badge ${a.violations ? 'bad' : 'ok'}`}>{a.violations}</span></td>
              <td><Link to={`/admin/attempt/${a.id}`}>Proctor report</Link></td></tr>
          ))}</tbody></table>
      </div>
    </>
  );
}

export function AttemptReport() {
  const { id } = useParams();
  const [d, setD] = useState(null);
  useEffect(() => { api(`/analytics/attempt/${id}/proctor`).then(setD); }, [id]);
  if (!d) return <p>Loading…</p>;
  return (
    <>
      <h2>Proctor report — {d.attempt.name}</h2>
      <p className="muted">{d.attempt.title} · {d.attempt.status} · score {d.attempt.score ?? '–'}/{d.attempt.total ?? '–'}</p>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Violations ({d.violations.length})</h3>
        {!d.violations.length ? <p className="muted">Clean session — no violations.</p> : (
          <table><thead><tr><th>Time</th><th>Type</th><th>Detail</th></tr></thead>
            <tbody>{d.violations.map((v, i) => (
              <tr key={i}><td>{new Date(v.at).toLocaleTimeString()}</td><td><span className="badge bad">{v.type}</span></td><td>{v.detail}</td></tr>
            ))}</tbody></table>
        )}
      </div>
      <div className="card"><h3>Webcam snapshots</h3>
        {!d.snapshots.length && <p className="muted">No snapshots.</p>}
        <div className="snaps">{d.snapshots.map((s, i) => (
          <figure key={i} style={{ margin: 0 }}><img src={s.image} alt="" /><small className="muted">{new Date(s.at).toLocaleTimeString()}</small></figure>
        ))}</div></div>
    </>
  );
}
