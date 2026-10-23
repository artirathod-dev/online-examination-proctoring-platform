import { Router } from 'express';
import { q, pool } from '../db.js';
import { auth, admin, h } from '../auth.js';
const r = Router();
r.use(auth);

r.get('/', h(async (req, res) => {
  if (req.user.role === 'admin') {
    return res.json(await q(`
      SELECT e.id,e.title,e.description,e.duration_min AS "durationMin",e.pass_percent AS "passPercent",
             e.shuffle,e.active,
             (SELECT COUNT(*) FROM exam_questions WHERE exam_id=e.id) AS "questionCount",
             (SELECT COUNT(*) FROM attempts WHERE exam_id=e.id) AS "attemptCount"
      FROM exams e ORDER BY e.id DESC`));
  }
  res.json(await q(`
    SELECT e.id,e.title,e.description,e.duration_min AS "durationMin",e.pass_percent AS "passPercent",
           (SELECT COUNT(*) FROM exam_questions WHERE exam_id=e.id) AS "questionCount",
           a.id AS "attemptId", a.status AS "attemptStatus", a.score, a.total
    FROM exams e LEFT JOIN attempts a ON a.exam_id=e.id AND a.user_id=$1
    WHERE e.active ORDER BY e.id DESC`, [req.user.id]));
}));

r.post('/', admin, h(async (req, res) => {
  const { title, description = '', durationMin, passPercent = 40, shuffle = true, questionIds = [] } = req.body;
  if (!title?.trim() || !(durationMin > 0) || !questionIds.length)
    return res.status(400).json({ error: 'Title, duration and at least one question are required' });
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const { rows: [e] } = await c.query(
      'INSERT INTO exams(title,description,duration_min,pass_percent,shuffle) VALUES($1,$2,$3,$4,$5) RETURNING id',
      [title.trim(), description, durationMin, passPercent, shuffle]);
    for (const id of questionIds) await c.query('INSERT INTO exam_questions VALUES($1,$2)', [e.id, id]);
    await c.query('COMMIT');
    res.json(e);
  } catch (err) { await c.query('ROLLBACK'); throw err; } finally { c.release(); }
}));

r.patch('/:id/active', admin, h(async (req, res) => {
  await q('UPDATE exams SET active=$1 WHERE id=$2', [!!req.body.active, req.params.id]);
  res.json({ ok: true });
}));

r.delete('/:id', admin, h(async (req, res) => {
  try {
    await q('DELETE FROM exams WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23503') return res.status(409).json({ error: 'Exam has attempts. Deactivate it instead.' });
    throw e;
  }
}));

export default r;
