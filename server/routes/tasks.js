import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { ASSIGNEE_HANDLES, DEFAULT_ASSIGNEE } from '../users.js';

const r = Router();

const VALID_ASSIGNEES = new Set(ASSIGNEE_HANDLES);
const VALID_CATEGORIES = new Set(['tech', 'biz_comp', 'esports', 'robotics', 'st_croix', 'ultimate', 'personal']);

function sanitizeCategories(input) {
  if (input === null || input === undefined || input === '') return null;
  const parts = Array.isArray(input)
    ? input
    : String(input).split(',').map(s => s.trim()).filter(Boolean);
  const valid = [...new Set(parts.filter(p => VALID_CATEGORIES.has(p)))];
  return valid.length ? valid.join(',') : null;
}
const VALID_TIERS = new Set(['normal', 'someday']);

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function addWorkDays(n) {
  const d = new Date();
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

function annotate(rows) {
  const soon = addWorkDays(2);
  const today = todayISO();
  return rows.map(t => ({
    ...t,
    pinned: !!t.pinned,
    awaiting_review: !!t.awaiting_review,
    awaiting_subtask: !!t.awaiting_subtask,
    is_due_soon: !!(t.status === 'open' && t.due_date && t.due_date <= soon),
    is_overdue: !!(t.status === 'open' && t.due_date && t.due_date < today),
  }));
}

r.get('/', (req, res) => {
  const soon = addWorkDays(2);
  const rows = db.prepare(`
    SELECT * FROM tasks
    WHERE status = 'open'
    ORDER BY
      awaiting_review DESC,
      pinned DESC,
      CASE WHEN due_date IS NOT NULL AND due_date <= ? THEN 0 ELSE 1 END ASC,
      CASE WHEN due_date IS NOT NULL AND due_date <= ? THEN due_date END ASC,
      priority ASC,
      created_at DESC
  `).all(soon, soon);

  const done = db.prepare(`
    SELECT * FROM tasks WHERE status = 'done'
    ORDER BY completed_at DESC
  `).all();

  res.json(annotate([...rows, ...done]));
});

r.post('/', (req, res) => {
  const { title, notes = '', additional_notes = '', assignee = DEFAULT_ASSIGNEE, due_date = null, pinned = false, category = null, tier = 'normal', parent_id = null, assignee_member_id = null } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title required' });
  const a = VALID_ASSIGNEES.has(assignee) ? assignee : DEFAULT_ASSIGNEE;
  const c = sanitizeCategories(category);
  const ti = VALID_TIERS.has(tier) ? tier : 'normal';
  let pid = null;
  if (parent_id) {
    const parent = db.prepare('SELECT id FROM tasks WHERE id = ?').get(parent_id);
    if (parent) pid = parent_id;
  }
  let memberId = null;
  if (assignee_member_id) {
    const m = db.prepare('SELECT id FROM members WHERE id = ?').get(assignee_member_id);
    if (m) memberId = assignee_member_id;
  }
  const id = uuidv4();
  const row = db.prepare('SELECT COALESCE(MIN(priority), 0) - 1 AS p FROM tasks WHERE status = ?').get('open');
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO tasks (id, title, notes, additional_notes, status, priority, pinned, due_date, assignee, assignee_member_id, category, tier, parent_id, created_by_email, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title.trim(), notes, additional_notes, row.p, pinned ? 1 : 0, due_date || null, a, memberId, c, ti, pid, req.user.email, now, now);
  res.json(annotate([db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)])[0]);
});

r.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const fields = ['title', 'notes', 'additional_notes', 'status', 'assignee', 'due_date', 'pinned', 'category', 'tier', 'awaiting_review', 'awaiting_subtask', 'assignee_member_id'];
  const updates = [];
  const values = [];
  const body = req.body || {};

  for (const f of fields) {
    if (f in body) {
      let v = body[f];
      if (f === 'assignee' && !VALID_ASSIGNEES.has(v)) continue;
      if (f === 'category') {
        v = sanitizeCategories(v);
      }
      if (f === 'tier' && !VALID_TIERS.has(v)) continue;
      if (f === 'assignee_member_id') {
        if (v === '' || v === null) v = null;
        else {
          const m = db.prepare('SELECT id FROM members WHERE id = ?').get(v);
          if (!m) continue;
        }
      }
      if (f === 'awaiting_review') v = v ? 1 : 0;
      if (f === 'awaiting_subtask') v = v ? 1 : 0;
      if (f === 'pinned') v = v ? 1 : 0;
      if (f === 'due_date' && v === '') v = null;
      updates.push(`${f} = ?`);
      values.push(v);
    }
  }
  const now = Math.floor(Date.now() / 1000);
  if (body.status === 'done' && existing.status !== 'done') {
    updates.push('completed_at = ?', 'awaiting_review = 0', 'awaiting_subtask = 0');
    values.push(now);
  }
  if (body.status === 'open' && existing.status === 'done') {
    updates.push('completed_at = NULL');
  }
  if (!updates.length) return res.json(annotate([existing])[0]);
  updates.push('updated_at = ?');
  values.push(now);
  values.push(req.params.id);
  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json(annotate([db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)])[0]);
});

r.delete('/:id', (req, res) => {
  const collectDescendants = (id, acc = []) => {
    const kids = db.prepare('SELECT id FROM tasks WHERE parent_id = ?').all(id);
    for (const k of kids) { acc.push(k.id); collectDescendants(k.id, acc); }
    return acc;
  };
  const descendants = collectDescendants(req.params.id);
  const all = [...descendants, req.params.id];
  const tx = db.transaction(() => {
    for (const id of all) {
      db.prepare('UPDATE questions SET task_id = NULL WHERE task_id = ?').run(id);
      db.prepare('UPDATE member_questions SET task_id = NULL WHERE task_id = ?').run(id);
      db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    }
  });
  tx();
  res.json({ ok: true });
});

r.post('/reorder', (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
  const stmt = db.prepare('UPDATE tasks SET priority = ?, updated_at = ? WHERE id = ?');
  const now = Math.floor(Date.now() / 1000);
  const tx = db.transaction((list) => {
    list.forEach((id, i) => stmt.run(i, now, id));
  });
  tx(ids);
  res.json({ ok: true });
});

export default r;
