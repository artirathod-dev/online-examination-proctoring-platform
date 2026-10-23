import { Router } from 'express';
import { q } from '../db.js';
import { auth, admin, h } from '../auth.js';
const r = Router();
r.use(auth, admin);

const clean = (b) => {
  const options = (b.options || []).map((o) => String(o).trim()).filter(Boolean);
  const ci = Number(b.correctIndex);
  if (!b.text?.trim() || options.length < 2 || !(ci >= 0 && ci < options.length)) return null;
  return [b.text.trim(), JSON.stringify(options), ci, (b.topic || 'General').trim(), Math.max(1, Number(b.marks) || 1)];
};

r.get('/', h(async (_req, res) =>
  res.json(await q('SELECT id,text,options,correct_index AS "correctIndex",topic,marks FROM questions ORDER BY id DESC'))));

r.post('/', h(async (req, res) => {
  const v = clean(req.body);
  if (!v) return res.status(400).json({ error: 'Need question text, 2+ options and a valid correct answer' });
  const [row] = await q(
    'INSERT INTO questions(text,options,correct_index,topic,marks) VALUES($1,$2,$3,$4,$5) RETURNING id', v);
  res.json(row);
}));

r.put('/:id', h(async (req, res) => {
  const v = clean(req.body);
  if (!v) return res.status(400).json({ error: 'Invalid question' });
  await q('UPDATE questions SET text=$1,options=$2,correct_index=$3,topic=$4,marks=$5 WHERE id=$6', [...v, req.params.id]);
  res.json({ ok: true });
}));

r.delete('/:id', h(async (req, res) => {
  try {
    await q('DELETE FROM questions WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23503') return res.status(409).json({ error: 'Question is used in past attempts and cannot be deleted' });
    throw e;
  }
}));

export default r;
