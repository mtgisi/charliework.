import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';

const r = Router();

function annotate(m) {
  if (!m) return m;
  return { ...m, active: !!m.active };
}

r.get('/', (req, res) => {
  const includeInactive = req.query.all === '1';
  const rows = includeInactive
    ? db.prepare('SELECT * FROM members ORDER BY active DESC, sort_order ASC, created_at ASC').all()
    : db.prepare('SELECT * FROM members WHERE active = 1 ORDER BY sort_order ASC, created_at ASC').all();
  res.json(rows.map(annotate));
});

r.post('/', (req, res) => {
  const { label, role = '', email = '', avatar_url = '' } = req.body || {};
  if (!label || !label.trim()) return res.status(400).json({ error: 'Label required' });
  const id = uuidv4();
  const next = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM members').get();
  db.prepare(`
    INSERT INTO members (id, label, role, email, avatar_url, active, sort_order)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).run(id, label.trim(), role, email, avatar_url, next.n);
  res.json(annotate(db.prepare('SELECT * FROM members WHERE id = ?').get(id)));
});

r.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const fields = ['label', 'role', 'email', 'avatar_url', 'active'];
  const updates = [];
  const values = [];
  const body = req.body || {};
  for (const f of fields) {
    if (f in body) {
      let v = body[f];
      if (f === 'label' && (!v || !v.trim())) return res.status(400).json({ error: 'Label required' });
      if (f === 'active') v = v ? 1 : 0;
      updates.push(`${f} = ?`);
      values.push(v);
    }
  }
  if (!updates.length) return res.json(annotate(existing));
  values.push(req.params.id);
  db.prepare(`UPDATE members SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json(annotate(db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id)));
});

r.delete('/:id', (req, res) => {
  const tx = db.transaction(() => {
    db.prepare('UPDATE tasks SET assignee_member_id = NULL WHERE assignee_member_id = ?').run(req.params.id);
    db.prepare('DELETE FROM member_questions WHERE member_id = ?').run(req.params.id);
    db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);
  });
  tx();
  res.json({ ok: true });
});

r.post('/reorder', (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
  const stmt = db.prepare('UPDATE members SET sort_order = ? WHERE id = ?');
  const tx = db.transaction(list => list.forEach((id, i) => stmt.run(i, id)));
  tx(ids);
  res.json({ ok: true });
});

export default r;
