import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const r = Router();

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

r.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM date_shortcuts
    ORDER BY sort_order ASC, created_at ASC
  `).all();
  res.json(rows);
});

r.post('/', (req, res) => {
  const { label, date } = req.body || {};
  if (!label || !label.trim()) return res.status(400).json({ error: 'Label required' });
  if (!ISO_DATE.test(date || '')) return res.status(400).json({ error: 'Date must be YYYY-MM-DD' });
  const id = uuidv4();
  const next = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM date_shortcuts').get();
  db.prepare(`
    INSERT INTO date_shortcuts (id, label, date, sort_order)
    VALUES (?, ?, ?, ?)
  `).run(id, label.trim(), date, next.n);
  res.json(db.prepare('SELECT * FROM date_shortcuts WHERE id = ?').get(id));
});

r.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM date_shortcuts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { label, date } = req.body || {};
  const updates = [];
  const values = [];
  if (label !== undefined) {
    if (!label.trim()) return res.status(400).json({ error: 'Label required' });
    updates.push('label = ?'); values.push(label.trim());
  }
  if (date !== undefined) {
    if (!ISO_DATE.test(date)) return res.status(400).json({ error: 'Date must be YYYY-MM-DD' });
    updates.push('date = ?'); values.push(date);
  }
  if (!updates.length) return res.json(existing);
  values.push(req.params.id);
  db.prepare(`UPDATE date_shortcuts SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json(db.prepare('SELECT * FROM date_shortcuts WHERE id = ?').get(req.params.id));
});

r.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM date_shortcuts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

r.post('/reorder', (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
  const stmt = db.prepare('UPDATE date_shortcuts SET sort_order = ? WHERE id = ?');
  const tx = db.transaction(list => list.forEach((id, i) => stmt.run(i, id)));
  tx(ids);
  res.json({ ok: true });
});

export default r;
