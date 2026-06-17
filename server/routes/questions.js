import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const r = Router();

function hydrate(id) {
  return db.prepare(`
    SELECT q.*, t.title AS task_title
    FROM questions q
    LEFT JOIN tasks t ON t.id = q.task_id
    WHERE q.id = ?
  `).get(id);
}

r.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT q.*, t.title AS task_title
    FROM questions q
    LEFT JOIN tasks t ON t.id = q.task_id
    ORDER BY q.status ASC, q.created_at DESC
  `).all();
  res.json(rows);
});

r.post('/', (req, res) => {
  const { body, context = '', task_id = null } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: 'Question required' });
  const id = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO questions (id, body, context, task_id, asked_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, body.trim(), context, task_id || null, req.user.handle || 'unknown', now, now);
  res.json(hydrate(id));
});

r.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const updates = [];
  const values = [];
  const b = req.body || {};
  const now = Math.floor(Date.now() / 1000);

  if ('body' in b && b.body?.trim()) { updates.push('body = ?'); values.push(b.body.trim()); }
  if ('context' in b) { updates.push('context = ?'); values.push(b.context || ''); }
  if ('answer' in b) { updates.push('answer = ?'); values.push(b.answer || ''); }
  if ('task_id' in b) { updates.push('task_id = ?'); values.push(b.task_id || null); }

  if ('status' in b && (b.status === 'open' || b.status === 'answered')) {
    updates.push('status = ?'); values.push(b.status);
    if (b.status === 'answered' && existing.status !== 'answered') {
      updates.push('answered_at = ?'); values.push(now);
      updates.push('answered_by = ?'); values.push(req.user.handle || null);
    }
    if (b.status === 'open' && existing.status === 'answered') {
      updates.push('answered_at = NULL');
      updates.push('answered_by = NULL');
    }
  }

  if (!updates.length) return res.json(hydrate(req.params.id));
  updates.push('updated_at = ?'); values.push(now);
  values.push(req.params.id);
  db.prepare(`UPDATE questions SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json(hydrate(req.params.id));
});

r.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default r;
