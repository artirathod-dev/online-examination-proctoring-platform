import { Router } from 'express';
import { q } from '../db.js';
import { auth, h } from '../auth.js';
const r = Router();
r.use(auth);

// Server-side grading: runs once, only for in-progress attempts
async function finalize(id) {
  await q(`
    UPDATE attempts a SET status='submitted', submitted_at=now(),
      total=(SELECT COALESCE(SUM(qs.marks),0) FROM exam_questions eq JOIN questions qs ON qs.id=eq.question_id WHERE eq.exam_id=a.exam_id),
      score=(SELECT COALESCE(SUM(qs.marks),0) FROM answers an JOIN questions qs ON qs.id=an.question_id
             WHERE an.attempt_id=a.id AND an.selected=qs.correct_index)
    WHERE a.id=$1 AND a.status='in_progress'`, [id]);
}

async function ownAttempt(req, res) {
  const [a] = await q('SELECT * FROM attempts WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  if (!a) { res.status(404).json({ error: 'Attempt not found' }); return null; }
  if (a.status === 'in_progress' && new Date(a.deadline) < new Date()) {
    await finalize(a.id);
    res.status(409).json({ error: 'Time is up. Exam auto-submitted.', expired: true });
    return null;
  }
  return a;
}

async function payload(a) {
  const [exam] = await q('SELECT * FROM exams WHERE id=$1', [a.exam_id]);
  const sql = `SELECT qs.id,qs.text,qs.options,qs.marks,qs.topic FROM exam_questions eq
    JOIN questions qs ON qs.id=eq.question_id WHERE eq.exam_id=${Number(exam.id)}
    ORDER BY ${exam.shuffle ? 'md5($1::text||qs.id::text)' : 'qs.id'}`;
  const questions = await (exam.shuffle ? q(sql, [a.id]) : q(sql));
  const saved = await q('SELECT question_id,selected FROM answers WHERE attempt_id=$1', [a.id]);
  return {
    attempt: { id: a.id, status: a.status, deadline: a.deadline },
    exam: { id: exam.id, title: exam.title, durationMin: exam.duration_min },
    questions,
    answers: Object.fromEntries(saved.map((s) => [s.question_id, s.selected])),
    serverNow: new Date().toISOString(),
  };
}

r.post('/start', h(async (req, res) => {
  const [exam] = await q('SELECT * FROM exams WHERE id=$1 AND active', [req.body.examId]);
  if (!exam) return res.status(404).json({ error: 'Exam not available' });
  let [a] = await q('SELECT * FROM attempts WHERE exam_id=$1 AND user_id=$2', [exam.id, req.user.id]);
  if (a) {
    if (a.status === 'in_progress' && new Date(a.deadline) > new Date()) return res.json(await payload(a)); // resume
    if (a.status === 'in_progress') await finalize(a.id);
    return res.status(409).json({ error: 'You have already attempted this exam' });
  }
  [a] = await q(
    `INSERT INTO attempts(exam_id,user_id,deadline) VALUES($1,$2, now() + $3 * interval '1 minute') RETURNING *`,
    [exam.id, req.user.id, exam.duration_min]);
  res.json(await payload(a));
}));

r.put('/:id/answer', h(async (req, res) => {
  const a = await ownAttempt(req, res); if (!a) return;
  if (a.status !== 'in_progress') return res.status(409).json({ error: 'Already submitted' });
  const { questionId, selected } = req.body;
  await q(`INSERT INTO answers(attempt_id,question_id,selected) VALUES($1,$2,$3)
           ON CONFLICT (attempt_id,question_id) DO UPDATE SET selected=EXCLUDED.selected`,
    [a.id, questionId, selected ?? null]);
  res.json({ ok: true });
}));

r.post('/:id/submit', h(async (req, res) => {
  const [a] = await q('SELECT * FROM attempts WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  if (!a) return res.status(404).json({ error: 'Attempt not found' });
  await finalize(a.id);
  const [f] = await q('SELECT score,total FROM attempts WHERE id=$1', [a.id]);
  res.json(f);
}));

r.post('/:id/violation', h(async (req, res) => {
  const a = await ownAttempt(req, res); if (!a) return;
  const type = String(req.body.type || 'unknown').slice(0, 40);
  const detail = String(req.body.detail || '').slice(0, 200);
  await q('INSERT INTO violations(attempt_id,type,detail) VALUES($1,$2,$3)', [a.id, type, detail]);
  const [{ count }] = await q('SELECT COUNT(*)::int AS count FROM violations WHERE attempt_id=$1', [a.id]);
  req.app.get('io').to('proctors').emit('violation',
    { attemptId: a.id, userName: req.user.name, type, detail, at: new Date().toISOString(), count });
  res.json({ count });
}));

r.post('/:id/snapshot', h(async (req, res) => {
  const a = await ownAttempt(req, res); if (!a) return;
  const img = String(req.body.image || '');
  if (!img.startsWith('data:image/jpeg') || img.length > 400000) return res.status(400).json({ error: 'Bad image' });
  await q('INSERT INTO snapshots(attempt_id,image) VALUES($1,$2)', [a.id, img]);
  res.json({ ok: true });
}));

r.get('/:id', h(async (req, res) => {
  const a = await ownAttempt(req, res); if (!a) return;
  res.json(await payload(a));
}));

r.get('/:id/result', h(async (req, res) => {
  const [a] = await q(`SELECT a.*,e.title,e.pass_percent FROM attempts a JOIN exams e ON e.id=a.exam_id WHERE a.id=$1`, [req.params.id]);
  if (!a || (a.user_id !== req.user.id && req.user.role !== 'admin')) return res.status(404).json({ error: 'Not found' });
  if (a.status === 'in_progress') return res.status(409).json({ error: 'Exam not submitted yet' });
  const review = await q(`
    SELECT qs.id,qs.text,qs.options,qs.marks,qs.correct_index AS "correctIndex",an.selected
    FROM exam_questions eq JOIN questions qs ON qs.id=eq.question_id
    LEFT JOIN answers an ON an.question_id=qs.id AND an.attempt_id=$1
    WHERE eq.exam_id=$2 ORDER BY qs.id`, [a.id, a.exam_id]);
  const pct = a.total ? Math.round((a.score * 100) / a.total) : 0;
  res.json({ title: a.title, score: a.score, total: a.total, percent: pct, passed: pct >= a.pass_percent,
             passPercent: a.pass_percent, review });
}));

export default r;
