import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const r = Router();

function annotate(row) {
  if (!row) return row;
  let options = null;
  if (row.options_json) {
    try { options = JSON.parse(row.options_json); } catch { options = null; }
  }
  return { ...row, options };
}

function hydrate(id) {
  const row = db.prepare(`
    SELECT mq.*, t.title AS task_title, m.label AS member_label
    FROM member_questions mq
    LEFT JOIN tasks t ON t.id = mq.task_id
    LEFT JOIN members m ON m.id = mq.member_id
    WHERE mq.id = ?
  `).get(id);
  return annotate(row);
}

r.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT mq.*, t.title AS task_title, m.label AS member_label
    FROM member_questions mq
    LEFT JOIN tasks t ON t.id = mq.task_id
    LEFT JOIN members m ON m.id = mq.member_id
    ORDER BY mq.status ASC, mq.asked_at DESC
  `).all();
  res.json(rows.map(annotate));
});

r.post('/', (req, res) => {
  const { member_id, task_id = null, body, options = null, recommended_option = null } = req.body || {};
  if (!member_id) return res.status(400).json({ error: 'member_id required' });
  if (!body || !body.trim()) return res.status(400).json({ error: 'body required' });
  const member = db.prepare('SELECT id FROM members WHERE id = ?').get(member_id);
  if (!member) return res.status(400).json({ error: 'Unknown member_id' });
  if (task_id) {
    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(task_id);
    if (!task) return res.status(400).json({ error: 'Unknown task_id' });
  }
  let optionsJson = '';
  if (Array.isArray(options) && options.length) {
    const cleaned = options.map(o => String(o).trim()).filter(Boolean);
    if (cleaned.length) optionsJson = JSON.stringify(cleaned);
  }
  let rec = null;
  if (recommended_option !== null && recommended_option !== undefined) {
    const n = parseInt(recommended_option, 10);
    if (!Number.isNaN(n) && n >= 0) rec = n;
  }
  const id = uuidv4();
  db.prepare(`
    INSERT INTO member_questions (id, member_id, task_id, body, options_json, recommended_option)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, member_id, task_id || null, body.trim(), optionsJson, rec);
  res.json(hydrate(id));
});

r.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM member_questions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const body = req.body || {};
  const updates = [];
  const values = [];
  if ('body' in body) {
    if (!body.body || !body.body.trim()) return res.status(400).json({ error: 'body cannot be empty' });
    updates.push('body = ?'); values.push(body.body.trim());
  }
  if ('answer' in body) { updates.push('answer = ?'); values.push(body.answer || ''); }
  if ('selected_option' in body) {
    const n = body.selected_option === null ? null : parseInt(body.selected_option, 10);
    updates.push('selected_option = ?'); values.push(Number.isNaN(n) ? null : n);
  }
  if ('task_id' in body) { updates.push('task_id = ?'); values.push(body.task_id || null); }
  if ('options' in body) {
    let optionsJson = '';
    if (Array.isArray(body.options) && body.options.length) {
      const cleaned = body.options.map(o => String(o).trim()).filter(Boolean);
      if (cleaned.length) optionsJson = JSON.stringify(cleaned);
    }
    updates.push('options_json = ?'); values.push(optionsJson);
  }
  if ('recommended_option' in body) {
    const n = body.recommended_option === null ? null : parseInt(body.recommended_option, 10);
    updates.push('recommended_option = ?'); values.push(Number.isNaN(n) ? null : n);
  }
  const now = Math.floor(Date.now() / 1000);
  if ('status' in body) {
    if (!['open','answered'].includes(body.status)) return res.status(400).json({ error: 'invalid status' });
    updates.push('status = ?'); values.push(body.status);
    if (body.status === 'answered' && existing.status !== 'answered') {
      updates.push('answered_at = ?'); values.push(now);
    }
    if (body.status === 'open' && existing.status === 'answered') {
      updates.push('answered_at = NULL');
    }
  }
  if (!updates.length) return res.json(hydrate(req.params.id));
  updates.push('updated_at = ?'); values.push(now);
  values.push(req.params.id);
  db.prepare(`UPDATE member_questions SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json(hydrate(req.params.id));
});

r.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM member_questions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default r;
