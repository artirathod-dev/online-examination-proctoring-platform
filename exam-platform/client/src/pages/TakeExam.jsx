import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import useProctor from '../hooks/useProctor.js';

export default function TakeExam() {
  const { examId } = useParams();
  const nav = useNavigate();
  const [phase, setPhase] = useState('intro');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const streamRef = useRef(null);

  async function begin() {
    setErr(''); setBusy(true);
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
    } catch {
      setBusy(false);
      return setErr('Camera access is required for this proctored exam. Allow it in your browser and try again.');
    }
    try {
      await document.documentElement.requestFullscreen().catch(() => {});
      setData(await api('/attempts/start', { method: 'POST', body: { examId: Number(examId) } }));
      setPhase('run');
    } catch (e) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      document.fullscreenElement && document.exitFullscreen();
      setErr(e.message);
    }
    setBusy(false);
  }

  if (phase === 'run')
    return <Exam data={data} stream={streamRef.current}
      onDone={(id) => { document.fullscreenElement && document.exitFullscreen().catch(() => {}); nav(`/result/${id}`, { replace: true }); }} />;

  return (
    <div className="card" style={{ maxWidth: 640, margin: '3rem auto' }}>
      <h2>Before you begin</h2>
      <ul>
        <li>This exam is <b>proctored</b>: your webcam is monitored and snapshots are saved.</li>
        <li>The exam runs in <b>fullscreen</b>. Leaving fullscreen or switching tabs is logged as a violation.</li>
        <li>Copy, paste and right-click are disabled. Keep your face visible and stay alone.</li>
        <li>After <b>5 violations</b> the exam is submitted automatically.</li>
        <li>The timer starts when you click start and cannot be paused. Answers save automatically.</li>
      </ul>
      {err && <div className="err">{err}</div>}
      <button onClick={begin} disabled={busy}>{busy ? 'Starting…' : '📷 Enable camera & start exam'}</button>{' '}
      <button className="ghost" onClick={() => nav('/dashboard')}>Cancel</button>
    </div>
  );
}

function Exam({ data, stream, onDone }) {
  const { attempt, exam, questions } = data;
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState(data.answers);
  const [flags, setFlags] = useState({});
  const [, tick] = useState(0);
const done = useRef(false);
const vref = useRef();

const deadline = new Date(attempt.deadline).getTime();
const serverOffset = useRef(
  new Date(data.serverNow).getTime() - Date.now()
);

const remaining = Math.max(
  0,
  Math.floor((deadline - (Date.now() + serverOffset.current)) / 1000)
);

  async function submit() {
    if (done.current) return;
    done.current = true;
    try { await api(`/attempts/${attempt.id}/submit`, { method: 'POST' }); } catch { /* server auto-finalizes */ }
    stream.getTracks().forEach((t) => t.stop());
    onDone(attempt.id);
  }

  const proctor = useProctor({ attemptId: attempt.id, examTitle: exam.title, stream, onLimit: submit });

  useEffect(() => { vref.current.srcObject = stream; }, [stream]);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (remaining === 0) submit(); });

  function choose(qid, i) {
    setAnswers((a) => ({ ...a, [qid]: i }));
    api(`/attempts/${attempt.id}/answer`, { method: 'PUT', body: { questionId: qid, selected: i } })
      .catch((e) => e.data?.expired && submit());
  }

  const q = questions[idx];
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const answered = Object.values(answers).filter((v) => v != null).length;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="card row2" style={{ alignItems: 'center', marginBottom: 12, display: 'flex' }}>
        <div><b>{exam.title}</b><div className="muted">{answered}/{questions.length} answered</div></div>
        <div className={`timer ${remaining < 60 ? 'low' : ''}`} style={{ textAlign: 'center' }}>⏱ {mm}:{ss}</div>
        <div style={{ textAlign: 'right' }}>
          <span className={`badge ${proctor.count ? 'bad' : 'ok'}`}>Violations {proctor.count}/{proctor.maxViolations}</span>
        </div>
      </div>
      {proctor.warning && (
        <div className="banner">⚠ {proctor.warning} <button className="sm ghost" onClick={proctor.dismiss}>OK</button></div>
      )}
      <div className="exam">
        <div className="card">
          <div className="muted">Question {idx + 1} of {questions.length} · {q.marks} mark{q.marks > 1 && 's'}</div>
          <h3 style={{ margin: '.5rem 0 1rem' }}>{q.text}</h3>
          {q.options.map((o, i) => (
            <label key={i} className={`opt ${answers[q.id] === i ? 'sel' : ''}`}>
              <input type="radio" name={`q${q.id}`} checked={answers[q.id] === i} onChange={() => choose(q.id, i)} /> {o}
            </label>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button className="ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← Previous</button>
            <button className="ghost" onClick={() => setFlags({ ...flags, [q.id]: !flags[q.id] })}>{flags[q.id] ? '🚩 Unflag' : '🏳 Flag for review'}</button>
            <button className="ghost" disabled={idx === questions.length - 1} onClick={() => setIdx(idx + 1)}>Next →</button>
            <span className="spacer" style={{ flex: 1 }} />
            <button className="danger" onClick={() => window.confirm(`Submit now? ${questions.length - answered} unanswered.`) && submit()}>Submit exam</button>
          </div>
        </div>
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <video ref={vref} autoPlay muted playsInline />
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>🔴 Proctoring active</div>
          </div>
          <div className="card">
            <b>Question palette</b>
            <div className="pal" style={{ marginTop: 8 }}>
              {questions.map((x, i) => (
                <button key={x.id} onClick={() => setIdx(i)}
                  className={`${answers[x.id] != null ? 'ans' : ''} ${flags[x.id] ? 'flag' : ''} ${i === idx ? 'cur' : ''}`}>{i + 1}</button>
              ))}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Green = answered · Amber = flagged</div>
          </div>
        </div>
      </div>
    </div>
  );
}
