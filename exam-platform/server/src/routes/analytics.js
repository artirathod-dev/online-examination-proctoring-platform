import { Router } from 'express';
import { q } from '../db.js';
import { auth, admin, h } from '../auth.js';
const r = Router();
r.use(auth, admin);

r.get('/overview', h(async (_req, res) => {
  const [o] = await q(`SELECT
    (SELECT COUNT(*) FROM users WHERE role='student') AS students,
    (SELECT COUNT(*) FROM exams) AS exams,
    (SELECT COUNT(*) FROM questions) AS questions,
    (SELECT COUNT(*) FROM attempts WHERE status='submitted') AS submissions,
    (SELECT COUNT(*) FROM violations) AS violations,
    (SELECT COALESCE(ROUND(AVG(score*100.0/NULLIF(total,0)))::float,0) FROM attempts WHERE status='submitted') AS "avgPercent"`);
  res.json(o);
}));

r.get('/exam/:id', h(async (req, res) => {
  const id = req.params.id;
  const [exam] = await q('SELECT id,title,pass_percent AS "passPercent" FROM exams WHERE id=$1', [id]);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });
  const [s] = await q(`SELECT COUNT(*) AS started,
      COUNT(*) FILTER (WHERE status='submitted') AS submitted,
      COALESCE(ROUND(AVG(score*100.0/NULLIF(total,0)))::float,0) AS avg,
      COALESCE(MAX(score*100.0/NULLIF(total,0))::float,0) AS highest,
      COALESCE(MIN(score*100.0/NULLIF(total,0))::float,0) AS lowest,
      COUNT(*) FILTER (WHERE status='submitted' AND score*100.0/NULLIF(total,0) >= $2) AS passed
    FROM attempts WHERE exam_id=$1`, [id, exam.passPercent]);
  const dist = await q(`SELECT LEAST(FLOOR(score*10.0/NULLIF(total,0)),9)::int AS bucket, COUNT(*) AS n
    FROM attempts WHERE exam_id=$1 AND status='submitted' AND total>0 GROUP BY 1`, [id]);
  const buckets = Array.from({ length: 10 }, (_, i) => ({ range: `${i * 10}-${i * 10 + 10}%`, n: dist.find((d) => d.bucket === i)?.n || 0 }));
  const questions = await q(`
    SELECT qs.id,qs.text,qs.topic,
      COUNT(an.attempt_id) AS answered,
      COUNT(an.attempt_id) FILTER (WHERE an.selected=qs.correct_index) AS correct
    FROM exam_questions eq JOIN questions qs ON qs.id=eq.question_id
    LEFT JOIN answers an ON an.question_id=qs.id
      AND an.attempt_id IN (SELECT id FROM attempts WHERE exam_id=$1 AND status='submitted')
    WHERE eq.exam_id=$1 GROUP BY qs.id ORDER BY qs.id`, [id]);
  const attempts = await q(`
    SELECT a.id,u.name,u.email,a.status,a.score,a.total,a.submitted_at AS "submittedAt",
      (SELECT COUNT(*) FROM violations v WHERE v.attempt_id=a.id) AS violations
    FROM attempts a JOIN users u ON u.id=a.user_id WHERE a.exam_id=$1 ORDER BY a.id DESC`, [id]);
  res.json({ exam, stats: s, buckets, questions, attempts });
}));

r.get('/exam/:id/export.csv', h(async (req, res) => {
  const rows = await q(`SELECT u.name,u.email,a.status,a.score,a.total,a.submitted_at,
      (SELECT COUNT(*) FROM violations v WHERE v.attempt_id=a.id) AS violations
    FROM attempts a JOIN users u ON u.id=a.user_id WHERE a.exam_id=$1 ORDER BY u.name`, [req.params.id]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = 'Name,Email,Status,Score,Total,Submitted At,Violations';
  res.type('text/csv').send([head, ...rows.map((x) => Object.values(x).map(esc).join(','))].join('\n'));
}));

r.get('/attempt/:id/proctor', h(async (req, res) => {
  const [a] = await q(`SELECT a.id,a.status,a.score,a.total,u.name,e.title FROM attempts a
    JOIN users u ON u.id=a.user_id JOIN exams e ON e.id=a.exam_id WHERE a.id=$1`, [req.params.id]);
  if (!a) return res.status(404).json({ error: 'Not found' });
  const violations = await q('SELECT type,detail,created_at AS "at" FROM violations WHERE attempt_id=$1 ORDER BY id', [a.id]);
  const snapshots = await q('SELECT image,created_at AS "at" FROM snapshots WHERE attempt_id=$1 ORDER BY id DESC LIMIT 24', [a.id]);
  res.json({ attempt: a, violations, snapshots });
}));

export default r;
